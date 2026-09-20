import { asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { isUserRole, type UserRole } from "@/lib/auth/roles";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: UserRole;
  createdAt: Date;
};

export type GoogleProfileInput = {
  email: string;
  name: string;
  avatar: string | null;
};

const ADMINISTRATIVE_ROLES: UserRole[] = ["curator", "superadmin"];

function toAppUser(row: typeof user.$inferSelect): AppUser {
  if (!isUserRole(row.role)) {
    throw new Error(`Invalid user role in database: ${row.role}`);
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const [row] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return row ? toAppUser(row) : null;
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  const normalized = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);
  return row ? toAppUser(row) : null;
}

async function defaultCountSuperAdmins(): Promise<number> {
  const [result] = await db
    .select({ value: count() })
    .from(user)
    .where(eq(user.role, "superadmin"));
  return result?.value ?? 0;
}

type CountSuperAdminsResolver = () => Promise<number>;

let countSuperAdminsResolver: CountSuperAdminsResolver =
  defaultCountSuperAdmins;

/**
 * Test-only seam so team tests can simulate a last-superadmin condition
 * without assuming the shared database has exactly one superadmin.
 */
export function setCountSuperAdminsResolver(
  resolver: CountSuperAdminsResolver,
): void {
  countSuperAdminsResolver = resolver;
}

export function resetCountSuperAdminsResolver(): void {
  countSuperAdminsResolver = defaultCountSuperAdmins;
}

export async function countSuperAdmins(): Promise<number> {
  return countSuperAdminsResolver();
}

/**
 * Lists users with curator or superadmin roles for team management.
 */
export async function listAdministrativeUsers(): Promise<AppUser[]> {
  const rows = await db
    .select()
    .from(user)
    .where(inArray(user.role, ADMINISTRATIVE_ROLES))
    .orderBy(asc(user.name));

  return rows.map(toAppUser);
}

/**
 * Updates a user's role. Callers must enforce authorization and
 * superadmin protection rules before invoking this.
 */
export async function updateUserRoleById(
  id: string,
  role: UserRole,
): Promise<AppUser | null> {
  const [updated] = await db
    .update(user)
    .set({ role })
    .where(eq(user.id, id))
    .returning();

  return updated ? toAppUser(updated) : null;
}

/**
 * Resolves the application User for a Google sign-in.
 *
 * First login creates a User with role "user".
 * Existing users keep their role; name/avatar may refresh from Google.
 * Optional INITIAL_SUPERADMIN_EMAIL bootstraps the first superadmin when
 * none exist yet (never promotes when a superadmin already exists).
 */
export async function upsertUserFromGoogle(
  profile: GoogleProfileInput,
): Promise<AppUser> {
  const email = profile.email.trim().toLowerCase();
  const name = profile.name.trim() || email;
  const avatar = profile.avatar?.trim() || null;

  if (!email) {
    throw new Error("Google profile is missing an email address");
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    const [updated] = await db
      .update(user)
      .set({ name, avatar })
      .where(eq(user.id, existing.id))
      .returning();

    return toAppUser(updated);
  }

  const bootstrapEmail = process.env.INITIAL_SUPERADMIN_EMAIL?.trim().toLowerCase();
  let role: UserRole = "user";

  if (bootstrapEmail && bootstrapEmail === email) {
    const superAdminCount = await countSuperAdmins();
    if (superAdminCount === 0) {
      role = "superadmin";
    }
  }

  const [created] = await db
    .insert(user)
    .values({
      email,
      name,
      avatar,
      role,
    })
    .returning();

  return toAppUser(created);
}

/**
 * Promotes an existing user to superadmin by email.
 * Intended for controlled setup via scripts — not for runtime request handlers.
 */
export async function promoteUserToSuperAdmin(email: string): Promise<AppUser> {
  const normalized = email.trim().toLowerCase();
  const existing = await findUserByEmail(normalized);

  if (!existing) {
    throw new Error(
      `No user found with email "${normalized}". Sign in with Google first, then promote.`,
    );
  }

  if (existing.role === "superadmin") {
    return existing;
  }

  const [updated] = await db
    .update(user)
    .set({ role: "superadmin" })
    .where(eq(user.id, existing.id))
    .returning();

  return toAppUser(updated);
}
