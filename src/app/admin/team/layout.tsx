import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireSuperAdmin } from "@/lib/auth/authenticated-user";

/**
 * Superadmin-only boundary for team management.
 * Navigation hiding is not enough — this enforces access server-side.
 */
export default async function AdminTeamLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "unauthorized") {
        redirect("/login?callbackUrl=/admin/team");
      }
      redirect("/unauthorized");
    }
    throw error;
  }

  return children;
}
