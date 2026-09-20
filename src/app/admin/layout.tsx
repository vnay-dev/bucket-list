import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AuthorizationError } from "@/lib/auth/errors";
import { requireCurator } from "@/lib/auth/authenticated-user";
import { findUserById } from "@/lib/auth/users";
import { getAdminNavItems } from "@/lib/admin/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Authorization boundary and workspace chrome for /admin.
 *
 * Curator and superadmin may enter. Team routes add a superadmin check.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let curator;

  try {
    curator = await requireCurator();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.code === "unauthorized") {
        redirect("/login?callbackUrl=/admin");
      }
      redirect("/unauthorized");
    }
    throw error;
  }

  const profile = await findUserById(curator.userId);
  const viewer = {
    name: profile?.name ?? curator.name,
    email: profile?.email ?? curator.email,
    role: profile?.role ?? curator.role,
    avatar: profile?.avatar ?? null,
  };

  return (
    <AdminShell user={viewer} navItems={getAdminNavItems(viewer.role)}>
      {children}
    </AdminShell>
  );
}
