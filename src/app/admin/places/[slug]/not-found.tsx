import Link from "next/link";
import styles from "./not-found.module.css";

export default function AdminPlaceNotFound() {
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>Place not found</h1>
      <p className={styles.copy}>
        This place may have been deleted or the link is incorrect.
      </p>
      <Link href="/admin/places" className={styles.link}>
        Back to places
      </Link>
    </div>
  );
}
