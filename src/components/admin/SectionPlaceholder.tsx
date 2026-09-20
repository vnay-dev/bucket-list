import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import styles from "./SectionPlaceholder.module.css";

type SectionPlaceholderProps = {
  title: string;
  description: string;
};

/**
 * Lightweight placeholder for admin sections that are not built yet.
 */
export function SectionPlaceholder({
  title,
  description,
}: SectionPlaceholderProps) {
  return (
    <div className={styles.root}>
      <PageHeader title={title} description={description} />
      <div className={styles.panel}>
        <p className={styles.note}>
          This section is reserved for upcoming curation tools. Use the
          navigation to move between areas of the workspace.
        </p>
        <Link href="/admin" className={styles.link}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
