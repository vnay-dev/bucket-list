"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireSuperAdmin,
  type AuthenticatedUser,
} from "@/lib/auth/authenticated-user";
import { AuthorizationError } from "@/lib/auth/errors";
import { isUserRole, type UserRole } from "@/lib/auth/roles";
import {
  countSuperAdmins,
  findUserByEmail,
  findUserById,
  updateUserRoleById,
  type AppUser,
} from "@/lib/auth/users";
import {
  isValidEmailFormat,
  normalizeEmailInput,
} from "@/lib/admin/team-helpers";

export type TeamLookupResult =
  | {
      ok: true;
      user: {
        id: string;
        name: string;
        email: string;
        avatar: string | null;
        role: UserRole;
      };
    }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "forbidden"
        | "not_found"
        | "invalid_input"
        | "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type TeamMutationResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "unauthorized"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "invalid_input"
        | "error";
      message: string;
      fieldErrors?: Record<string, string>;
    };

type AdminRole = "curator" | "superadmin";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Outside a Next.js request context (e.g. unit tests).
  }
}

function mapAuthError(error: unknown): TeamMutationResult | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "unauthorized" ? "unauthorized" : "forbidden",
    message: error.message,
  };
}

function mapLookupAuthError(error: unknown): TeamLookupResult | null {
  if (!(error instanceof AuthorizationError)) {
    return null;
  }

  return {
    ok: false,
    code: error.code === "unauthorized" ? "unauthorized" : "forbidden",
    message: error.message,
  };
}

function redirectCuratorAdded(): never {
  redirect("/admin/team?notice=curator_added");
}

function redirectRoleUpdated(): never {
  redirect("/admin/team?notice=role_updated");
}

function redirectAccessRemoved(): never {
  redirect("/admin/team?notice=access_removed");
}

function isAdminRole(role: UserRole): role is AdminRole {
  return role === "curator" || role === "superadmin";
}

async function guardSuperadminDemotion(
  target: AppUser,
  nextRole: UserRole,
): Promise<TeamMutationResult | null> {
  if (target.role !== "superadmin" || nextRole === "superadmin") {
    return null;
  }

  const superAdminCount = await countSuperAdmins();
  if (superAdminCount <= 1) {
    return {
      ok: false,
      code: "conflict",
      message:
        "The last remaining superadmin cannot be demoted or removed.",
    };
  }

  return null;
}

function guardSelfProtection(
  actor: AuthenticatedUser,
  target: AppUser,
  nextRole: UserRole,
): TeamMutationResult | null {
  if (actor.userId !== target.id) {
    return null;
  }

  if (target.role === "superadmin" && nextRole !== "superadmin") {
    return {
      ok: false,
      code: "conflict",
      message: "You cannot remove your own superadmin access.",
    };
  }

  if (nextRole === "user") {
    return {
      ok: false,
      code: "conflict",
      message: "You cannot remove your own admin access.",
    };
  }

  return null;
}

export async function lookupUserByEmailAction(input: {
  email: string;
}): Promise<TeamLookupResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    const mapped = mapLookupAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!isValidEmailFormat(input.email)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  const email = normalizeEmailInput(input.email);

  try {
    const found = await findUserByEmail(email);
    if (!found) {
      return {
        ok: false,
        code: "not_found",
        message:
          "No account found with that email. The person must sign in with Google once before they can be granted curator access.",
      };
    }

    return {
      ok: true,
      user: {
        id: found.id,
        name: found.name,
        email: found.email,
        avatar: found.avatar,
        role: found.role,
      },
    };
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to look up that user. Please try again.",
    };
  }
}

export async function grantCuratorAccessAction(input: {
  email: string;
}): Promise<TeamMutationResult> {
  try {
    await requireSuperAdmin();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  if (!isValidEmailFormat(input.email)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Enter a valid email address.",
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  const email = normalizeEmailInput(input.email);

  let target: AppUser | null;

  try {
    target = await findUserByEmail(email);
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to update team access. Please try again.",
    };
  }

  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message:
        "No account found with that email. The person must sign in with Google once before they can be granted curator access.",
    };
  }

  if (target.role === "curator") {
    return {
      ok: false,
      code: "conflict",
      message: "This user is already a curator.",
    };
  }

  if (target.role === "superadmin") {
    return {
      ok: false,
      code: "conflict",
      message: "This user is already a superadmin.",
    };
  }

  try {
    const updated = await updateUserRoleById(target.id, "curator");
    if (!updated) {
      return {
        ok: false,
        code: "not_found",
        message: "User not found.",
      };
    }
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to update team access. Please try again.",
    };
  }

  safeRevalidatePath("/admin/team");
  redirectCuratorAdded();
}

export async function changeAdminRoleAction(input: {
  userId: string;
  role: string;
}): Promise<TeamMutationResult> {
  let actor: AuthenticatedUser;

  try {
    actor = await requireSuperAdmin();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const userId = input.userId.trim();
  if (!userId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "A team member is required.",
    };
  }

  if (!isUserRole(input.role) || !isAdminRole(input.role)) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Choose either curator or superadmin.",
      fieldErrors: { role: "Choose either curator or superadmin." },
    };
  }

  const nextRole = input.role;

  let target: AppUser | null;

  try {
    target = await findUserById(userId);
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to update the role. Please try again.",
    };
  }

  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message: "User not found.",
    };
  }

  if (!isAdminRole(target.role)) {
    return {
      ok: false,
      code: "invalid_input",
      message:
        "Only existing curators and superadmins can change administrative roles here. Grant curator access first.",
    };
  }

  if (target.role === nextRole) {
    return {
      ok: false,
      code: "conflict",
      message: `This user is already a ${nextRole}.`,
    };
  }

  const selfGuard = guardSelfProtection(actor, target, nextRole);
  if (selfGuard) return selfGuard;

  const lastGuard = await guardSuperadminDemotion(target, nextRole);
  if (lastGuard) return lastGuard;

  try {
    const updated = await updateUserRoleById(target.id, nextRole);
    if (!updated) {
      return {
        ok: false,
        code: "not_found",
        message: "User not found.",
      };
    }
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to update the role. Please try again.",
    };
  }

  safeRevalidatePath("/admin/team");
  redirectRoleUpdated();
}

export async function removeCuratorAccessAction(input: {
  userId: string;
}): Promise<TeamMutationResult> {
  let actor: AuthenticatedUser;

  try {
    actor = await requireSuperAdmin();
  } catch (error) {
    const mapped = mapAuthError(error);
    if (mapped) return mapped;
    throw error;
  }

  const userId = input.userId.trim();
  if (!userId) {
    return {
      ok: false,
      code: "invalid_input",
      message: "A team member is required.",
    };
  }

  let target: AppUser | null;

  try {
    target = await findUserById(userId);
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to remove admin access. Please try again.",
    };
  }

  if (!target) {
    return {
      ok: false,
      code: "not_found",
      message: "User not found.",
    };
  }

  if (target.role !== "curator") {
    return {
      ok: false,
      code: "invalid_input",
      message:
        target.role === "superadmin"
          ? "Demote this superadmin to curator before removing admin access."
          : "This user does not have curator access.",
    };
  }

  const selfGuard = guardSelfProtection(actor, target, "user");
  if (selfGuard) return selfGuard;

  try {
    const updated = await updateUserRoleById(target.id, "user");
    if (!updated) {
      return {
        ok: false,
        code: "not_found",
        message: "User not found.",
      };
    }
  } catch {
    return {
      ok: false,
      code: "error",
      message: "Unable to remove admin access. Please try again.",
    };
  }

  safeRevalidatePath("/admin/team");
  redirectAccessRemoved();
}
