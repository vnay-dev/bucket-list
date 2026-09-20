import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import styles from "./login.module.css";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
};

function errorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "AccessDenied") {
    return "Sign-in was denied. Use a Google account with access.";
  }
  if (code === "OAuthAccountNotLinked" || code === "OAuthCallback") {
    return "We could not complete Google sign-in. Try again.";
  }
  return "Something went wrong during sign-in. Please try again.";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const session = await auth();
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/")
      ? params.callbackUrl
      : "/admin";

  if (session?.user) {
    redirect(callbackUrl);
  }

  const message = errorMessage(params.error);

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <p className={styles.brand}>Bucket List</p>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>
          Use your Google account to continue. Admin tools require curator or
          superadmin access.
        </p>

        {message ? (
          <p className={styles.error} role="alert">
            {message}
          </p>
        ) : null}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button type="submit" className={styles.primary}>
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
