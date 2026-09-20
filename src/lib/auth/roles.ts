/**
 * Application roles, ordered from least to most privileged.
 *
 * Hierarchy:
 * - user: public product access only
 * - curator: /admin content management
 * - superadmin: curator access + future team/admin management
 */
export const USER_ROLES = ["user", "curator", "superadmin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  curator: 1,
  superadmin: 2,
};

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canAccessCurator(role: UserRole): boolean {
  return roleAtLeast(role, "curator");
}

export function canAccessSuperAdmin(role: UserRole): boolean {
  return roleAtLeast(role, "superadmin");
}
