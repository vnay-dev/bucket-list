import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import type { SubmissionListItem } from "@/lib/admin/submissions";
import {
  formatSubmissionStatus,
  submissionNoticeMessage,
  type SubmissionActionNotice,
} from "@/lib/admin/submission-helpers";
import type { SubmissionStatus } from "@/lib/submissions/validation";
import { formatRelativeDate, truncateText } from "@/lib/admin/presentation";
import styles from "./SubmissionsList.module.css";

const FILTERS: { status: SubmissionStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
];

type SubmissionsListProps = {
  status: SubmissionStatus;
  items: SubmissionListItem[];
  notice: SubmissionActionNotice | null;
  errorMessage?: string | null;
};

export function SubmissionsList({
  status,
  items,
  notice,
  errorMessage,
}: SubmissionsListProps) {
  return (
    <div className={styles.root}>
      <PageHeader
        title="Submissions"
        description="Review contributor entries and turn them into public experiences."
      />

      {notice ? (
        <p className={styles.notice} role="status">
          {submissionNoticeMessage(notice)}
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className={styles.filters} role="tablist" aria-label="Submission status">
        {FILTERS.map((filter) => {
          const active = filter.status === status;
          return (
            <Link
              key={filter.status}
              href={`/admin/submissions?status=${filter.status}`}
              className={active ? styles.filterActive : styles.filter}
              role="tab"
              aria-selected={active}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>
          {status === "pending"
            ? "No pending submissions. New contributor entries will show up here."
            : status === "approved"
              ? "No approved submissions yet."
              : "No rejected submissions."}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <Link href={`/admin/submissions/${item.id}`} className={styles.itemLink}>
                <div className={styles.itemTop}>
                  <p className={styles.place}>
                    {item.placeName}
                    <span className={styles.location}>
                      {" "}
                      · {item.placeLocation}
                    </span>
                  </p>
                  <span className={styles.status}>
                    {formatSubmissionStatus(item.status)}
                  </span>
                </div>
                <p className={styles.content}>
                  {truncateText(item.content, 160)}
                </p>
                {item.goodToKnow ? (
                  <p className={styles.goodToKnow}>
                    Good to know: {truncateText(item.goodToKnow, 100)}
                  </p>
                ) : null}
                <time
                  className={styles.time}
                  dateTime={item.createdAt.toISOString()}
                >
                  Submitted {formatRelativeDate(item.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
