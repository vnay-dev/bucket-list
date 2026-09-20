import Link from "next/link";
import styles from "./not-found.module.css";

export default function AdminSubmissionNotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Submission not found</h1>
      <p className={styles.copy}>
        This submission may have been removed or the link is incorrect.
      </p>
      <Link href="/admin/submissions" className={styles.link}>
        Back to submissions
      </Link>
    </div>
  );
}
