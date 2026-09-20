import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { upsertUserFromGoogle } from "@/lib/auth/users";

/**
 * Auth.js (NextAuth v5) configuration.
 *
 * Google OAuth creates or resolves an application User on sign-in.
 * Session JWT carries the application user id; role is always loaded
 * from the database by authorization helpers — never trusted from the client.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, profile }) {
      const email = user.email ?? profile?.email;
      if (!email) {
        return false;
      }

      const name =
        user.name ??
        (typeof profile?.name === "string" ? profile.name : null) ??
        email;
      const avatar =
        user.image ??
        (typeof profile?.picture === "string" ? profile.picture : null);

      const appUser = await upsertUserFromGoogle({
        email,
        name,
        avatar,
      });

      user.id = appUser.id;
      return true;
    },
  },
});
