# Authentication & authorization

Google OAuth via Auth.js (NextAuth v5) is the authentication layer for
contributor APIs and the future `/admin` area.

## Flow

1. User opens `/login` and chooses **Continue with Google**.
2. Google OAuth completes at `/api/auth/callback/google`.
3. On first successful sign-in, an application `User` row is created
   (`role = user` by default).
4. On later sign-ins, the existing `User` is resolved by email. Role is
   never changed by the OAuth callback (except the optional first-superadmin
   bootstrap described below). Name and avatar may refresh from Google.
5. A JWT session stores the application `User.id`. Authorization helpers
   always reload the user (including role) from the database — never from
   client input.

## Role hierarchy

| Role | Access |
| --- | --- |
| `user` | Public product only |
| `curator` | `/admin` content management (future) |
| `superadmin` | Everything curator can do, plus future team/admin management |

Higher roles include lower privileges (`superadmin` may use curator features).

## Server-side authorization

Use the helpers in `src/lib/auth/authenticated-user.ts`:

| Helper | Behavior |
| --- | --- |
| `getAuthenticatedUser()` | Session user or `null` |
| `requireAuthenticatedUser()` | Throws `AuthorizationError` → treat as **401** |
| `requireCurator()` | Requires curator or superadmin → else **403** |
| `requireSuperAdmin()` | Requires superadmin → else **403** |

`POST /api/submissions` already uses `getAuthenticatedUser()`. The
submission `userId` always comes from that identity — never from the
request body.

`/admin` is protected by:

1. Middleware — redirects unauthenticated visitors to `/login`
2. `src/app/admin/layout.tsx` — `requireCurator()` (defense in depth)

Hiding UI links is not security; server checks are required.

## Establishing the first superadmin

Do **not** hardcode emails in application code. Prefer one of:

### Recommended: promote script

After the person signs in once with Google (so a `User` row exists):

```bash
npx tsx --env-file=.env.local scripts/promote-superadmin.ts you@example.com
```

### Optional bootstrap env

Set `INITIAL_SUPERADMIN_EMAIL` before the first matching Google sign-in.
If **no** superadmin exists yet, that account is created as `superadmin`.
If a superadmin already exists, the env var does nothing — it will not
promote additional users or downgrade anyone.

## Environment variables

See [`.env.example`](../.env.example). Required for auth:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon PostgreSQL (server-only) |
| `AUTH_SECRET` | Auth.js session secret (`npx auth secret`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret (server-only) |
| `AUTH_URL` | Optional canonical app URL in some deployments |
| `INITIAL_SUPERADMIN_EMAIL` | Optional first-superadmin bootstrap |

Google Cloud Console redirect URI (local):

`http://localhost:3000/api/auth/callback/google`

Never expose `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, or `DATABASE_URL` to the
client.

## Production setup checklist

1. Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
2. Apply Drizzle migrations (includes `superadmin` on `user_role_check`).
3. Register the production Google redirect URI.
4. Sign in once with the intended superadmin Google account.
5. Run `scripts/promote-superadmin.ts` (or use `INITIAL_SUPERADMIN_EMAIL`
   only when no superadmin exists yet).
6. Confirm `/admin` works for that account and returns restricted access
   for a normal user.
