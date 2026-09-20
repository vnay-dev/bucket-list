"use server";

import { signOut } from "@/auth";

/**
 * Ends the Auth.js session and sends the user to the login page
 * so they can sign in with a different Google account.
 */
export async function signOutToLogin() {
  await signOut({ redirectTo: "/login" });
}
