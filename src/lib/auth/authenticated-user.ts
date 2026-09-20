import type { Session } from "next-auth";
import { auth } from "@/auth";
import { AuthorizationError } from "@/lib/auth/errors";
import {
  canAccessCurator,
  canAccessSuperAdmin,
  type UserRole,
} from "@/lib/auth/roles";
import { findUserById } from "@/lib/auth/users";

/**
 * Authenticated caller identity.
 *
 * Role and identity always come from the server-side User record.
 * Never trust a role or userId supplied by the client.
 */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
};

type AuthResolver = (
  request?: Request,
) => Promise<AuthenticatedUser | null>;

async function resolveFromSession(): Promise<AuthenticatedUser | null> {
  let session: Session | null;

  try {
    session = await auth();
  } catch {
    // Route handlers invoked outside a Next.js request (e.g. unit tests)
    // cannot read session cookies via auth(). Treat as unauthenticated.
    return null;
  }

  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return null;
  }

  const dbUser = await findUserById(sessionUserId);

  if (!dbUser) {
    return null;
  }

  return {
    userId: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

let authResolver: AuthResolver = resolveFromSession;

/**
 * Test-only seam so authorization and submission tests can inject an identity
 * without real Google OAuth.
 */
export function setAuthenticatedUserResolver(resolver: AuthResolver): void {
  authResolver = resolver;
}

export function resetAuthenticatedUserResolver(): void {
  authResolver = resolveFromSession;
}

/**
 * Resolves the authenticated user for the current request.
 * Returns null when there is no valid session or matching User row.
 */
export async function getAuthenticatedUser(
  request?: Request,
): Promise<AuthenticatedUser | null> {
  return authResolver(request);
}

export async function requireAuthenticatedUser(
  request?: Request,
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    throw new AuthorizationError(
      "unauthorized",
      "Authentication required",
    );
  }

  return user;
}

export async function requireCurator(
  request?: Request,
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser(request);

  if (!canAccessCurator(user.role)) {
    throw new AuthorizationError(
      "forbidden",
      "Curator access required",
    );
  }

  return user;
}

export async function requireSuperAdmin(
  request?: Request,
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser(request);

  if (!canAccessSuperAdmin(user.role)) {
    throw new AuthorizationError(
      "forbidden",
      "Superadmin access required",
    );
  }

  return user;
}
