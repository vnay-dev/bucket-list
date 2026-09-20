import Link from "next/link";
import styles from "./not-found.module.css";

export default function AdminExperienceNotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Experience not found</h1>
      <p className={styles.copy}>
        This experience may have been deleted or the link is incorrect.
      </p>
      <Link href="/admin/experiences" className={styles.link}>
        Back to experiences
      </Link>
    </div>
  );
}
