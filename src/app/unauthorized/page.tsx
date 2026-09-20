import Link from "next/link";
import { auth } from "@/auth";
import { signOutToLogin } from "@/lib/auth/actions";
import styles from "./unauthorized.module.css";

export default async function UnauthorizedPage() {
  const session = await auth();

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <p className={styles.brand}>Bucket List</p>
        <h1 className={styles.title}>Access restricted</h1>
        <p className={styles.subtitle}>
          {session?.user
            ? "Your account is signed in, but it does not have permission to use the admin area. Contact a superadmin if you need curator access."
            : "You need to sign in with an authorized account to continue."}
        </p>
        <div className={styles.actions}>
          {session?.user ? (
            <>
              <form action={signOutToLogin} className={styles.actionForm}>
                <button
                  type="submit"
                  className={styles.secondary}
                  aria-label="Sign out and try a different account"
                >
                  Sign out
                </button>
              </form>
              <Link href="/" className={styles.secondary}>
                Back to home
              </Link>
            </>
          ) : (
            <Link href="/login" className={styles.primary}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
