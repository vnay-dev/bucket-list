import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import type {
  DashboardCounts,
  PendingSubmissionSummary,
} from "@/lib/admin/dashboard";
import { formatRelativeDate, truncateText } from "@/lib/admin/presentation";
import styles from "./DashboardView.module.css";

type DashboardViewProps = {
  counts: DashboardCounts;
  pendingSubmissions: PendingSubmissionSummary[];
  errorMessage?: string | null;
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <p className={styles.metricValue}>{value}</p>
      <p className={styles.metricLabel}>{label}</p>
    </div>
  );
}

export function DashboardView({
  counts,
  pendingSubmissions,
  errorMessage,
}: DashboardViewProps) {
  return (
    <div className={styles.root}>
      <PageHeader
        title="Dashboard"
        description="A quiet overview of curation work waiting for attention."
      />

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className={styles.metrics} aria-label="Workspace totals">
        <Metric label="Pending submissions" value={counts.pendingSubmissions} />
        <Metric label="Experiences" value={counts.experiences} />
        <Metric label="Places" value={counts.places} />
        <Metric label="Tags" value={counts.tags} />
      </section>

      <section className={styles.queue} aria-labelledby="pending-heading">
        <div className={styles.queueHeader}>
          <div>
            <h2 id="pending-heading" className={styles.queueTitle}>
              Pending submissions
            </h2>
            <p className={styles.queueSubtitle}>
              Oldest first. Open a submission to review, edit, approve, merge,
              or reject.
            </p>
          </div>
          <Link href="/admin/submissions?status=pending" className={styles.queueLink}>
            View all
          </Link>
        </div>

        {pendingSubmissions.length === 0 ? (
          <p className={styles.empty}>
            No pending submissions right now. New contributor entries will
            appear here.
          </p>
        ) : (
          <ul className={styles.list}>
            {pendingSubmissions.map((item) => (
              <li key={item.id} className={styles.item}>
                <Link
                  href={`/admin/submissions/${item.id}`}
                  className={styles.itemLink}
                >
                  <div className={styles.itemMain}>
                    <p className={styles.itemPlace}>
                      {item.placeName}
                      <span className={styles.itemLocation}>
                        {" "}
                        · {item.placeLocation}
                      </span>
                    </p>
                    <p className={styles.itemContent}>
                      {truncateText(item.content, 140)}
                    </p>
                  </div>
                  <time
                    className={styles.itemTime}
                    dateTime={item.createdAt.toISOString()}
                  >
                    {formatRelativeDate(item.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
