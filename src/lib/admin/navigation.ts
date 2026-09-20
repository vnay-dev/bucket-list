import type { UserRole } from "@/lib/auth/roles";
import { canAccessSuperAdmin } from "@/lib/auth/roles";

export type AdminNavItem = {
  href: string;
  label: string;
  /** When true, only superadmins see and may open this item. */
  superAdminOnly?: boolean;
  /** Exact path match (Dashboard). Default: prefix match. */
  exact?: boolean;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/experiences", label: "Experiences" },
  { href: "/admin/places", label: "Places" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/team", label: "Team", superAdminOnly: true },
];

export function getAdminNavItems(role: UserRole): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || canAccessSuperAdmin(role),
  );
}

export function isAdminNavActive(
  pathname: string,
  item: AdminNavItem,
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
