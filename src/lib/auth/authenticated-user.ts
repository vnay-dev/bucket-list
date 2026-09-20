/**
 * Authenticated caller identity.
 *
 * Auth.js is not implemented yet. Route handlers that need a user must call
 * `getAuthenticatedUser` and treat a null result as an explicit auth boundary
 * (do not accept `userId` from the client body as a trusted identity).
 */
export type AuthenticatedUser = {
  userId: string;
};

/**
 * Resolves the authenticated user for the current request.
 *
 * Returns null until an authentication layer is wired up. Callers must not
 * invent or trust a substitute identity from the request body.
 */
export async function getAuthenticatedUser(
  _request: Request,
): Promise<AuthenticatedUser | null> {
  return null;
}
