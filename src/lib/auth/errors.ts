export type AuthorizationErrorCode = "unauthorized" | "forbidden";

/**
 * Thrown by authorization helpers when a request fails authz checks.
 * API routes map this to JSON errors; page layouts map it to redirects.
 */
export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;
  readonly status: 401 | 403;

  constructor(code: AuthorizationErrorCode, message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = code === "unauthorized" ? 401 : 403;
  }
}
