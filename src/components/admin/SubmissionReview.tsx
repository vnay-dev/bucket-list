"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import type { ExperienceRecord } from "@/lib/experiences/repository";
import type { PlaceRecord } from "@/lib/places/repository";
import type { SubmissionRecord } from "@/lib/submissions/repository";
import {
  approveEditedSubmissionAction,
  mergeSubmissionAction,
  rejectSubmissionAction,
} from "@/lib/admin/submission-actions";
import {
  formatSubmissionStatus,
  suggestExperienceTitle,
} from "@/lib/admin/submission-helpers";
import { formatRelativeDate } from "@/lib/admin/presentation";
import styles from "./SubmissionReview.module.css";

type SubmissionReviewProps = {
  submission: SubmissionRecord;
  place: PlaceRecord;
  places: PlaceRecord[];
  experiences: ExperienceRecord[];
  linkedExperience: ExperienceRecord | null;
};

type Panel = "review" | "merge" | "reject";

function placeLabel(place: PlaceRecord): string {
  return `${place.name} · ${place.city}, ${place.state}`;
}

export function SubmissionReview({
  submission,
  place,
  places,
  experiences,
  linkedExperience,
}: SubmissionReviewProps) {
  const isPending = submission.status === "pending";
  const [panel, setPanel] = useState<Panel>("review");
  const [title, setTitle] = useState(suggestExperienceTitle(submission.content));
  const [description, setDescription] = useState(submission.content);
  const [goodToKnow, setGoodToKnow] = useState(submission.goodToKnow ?? "");
  const [placeId, setPlaceId] = useState(submission.placeId);
  const [selectedExperienceId, setSelectedExperienceId] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPendingAction, startTransition] = useTransition();
  const rejectDialogRef = useRef<HTMLDialogElement>(null);
  const mergeDialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const goodToKnowId = useId();
  const placeIdLabel = useId();
  const mergeSearchId = useId();

  const selectedExperience =
    experiences.find((item) => item.id === selectedExperienceId) ?? null;

  const mergeCandidates = experiences
    .filter((item) => {
      const query = mergeQuery.trim().toLowerCase();
      if (!query) {
        return item.placeId === submission.placeId;
      }
      return (
        item.title.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query)
      );
    })
    .slice(0, 40);

  useEffect(() => {
    const dialog = rejectDialogRef.current;
    if (!dialog) return;
    if (panel === "reject") {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [panel]);

  useEffect(() => {
    const dialog = mergeDialogRef.current;
    if (!dialog) return;
    if (panel === "merge") {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [panel]);

  function runAction(
    action: () => Promise<{ ok: boolean; message?: string; fieldErrors?: Record<string, string>; code?: string }>,
  ) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        if (result.code === "conflict") {
          setPanel("review");
        }
      }
    });
  }

  function onApprove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runAction(() =>
      approveEditedSubmissionAction({
        submissionId: submission.id,
        title,
        description,
        goodToKnow,
        placeId,
      }),
    );
  }

  function onConfirmMerge() {
    if (!selectedExperienceId) {
      setError("Select an experience before confirming the merge.");
      return;
    }
    runAction(() =>
      mergeSubmissionAction({
        submissionId: submission.id,
        experienceId: selectedExperienceId,
      }),
    );
  }

  function onConfirmReject() {
    runAction(() =>
      rejectSubmissionAction({
        submissionId: submission.id,
      }),
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <Link href="/admin/submissions?status=pending" className={styles.backLink}>
          ← Back to queue
        </Link>
        <span className={styles.statusBadge}>
          {formatSubmissionStatus(submission.status)}
        </span>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>Review submission</h1>
        <p className={styles.meta}>
          {place.name} · {place.city}, {place.state}
          <span className={styles.metaSep}>·</span>
          <time dateTime={submission.createdAt.toISOString()}>
            Submitted {formatRelativeDate(submission.createdAt)}
          </time>
        </p>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <section className={styles.original} aria-labelledby="original-heading">
        <h2 id="original-heading" className={styles.sectionLabel}>
          Original submission
        </h2>
        <div className={styles.originalBody}>
          <p className={styles.originalContent}>{submission.content}</p>
          {submission.goodToKnow ? (
            <p className={styles.originalNote}>
              <span className={styles.originalNoteLabel}>Good to know</span>
              {submission.goodToKnow}
            </p>
          ) : (
            <p className={styles.originalEmpty}>No good-to-know details provided.</p>
          )}
        </div>
      </section>

      {!isPending ? (
        <section className={styles.processed} aria-labelledby="processed-heading">
          <h2 id="processed-heading" className={styles.sectionLabel}>
            Outcome
          </h2>
          <p className={styles.processedCopy}>
            This submission is {formatSubmissionStatus(submission.status).toLowerCase()}
            {linkedExperience
              ? ` and linked to “${linkedExperience.title}”.`
              : "."}{" "}
            Moderation actions are only available while a submission is pending.
          </p>
          <Link href="/admin/submissions?status=pending" className={styles.secondaryButton}>
            Return to pending queue
          </Link>
        </section>
      ) : (
        <>
          <section className={styles.curation} aria-labelledby="curation-heading">
            <div className={styles.curationIntro}>
              <h2 id="curation-heading" className={styles.sectionLabel}>
                Experience draft
              </h2>
              <p className={styles.curationHelp}>
                Edit what will become the public experience. The original submission
                above stays unchanged.
              </p>
            </div>

            <form className={styles.form} onSubmit={onApprove}>
              <div className={styles.field}>
                <label htmlFor={titleId} className={styles.label}>
                  Title
                </label>
                <input
                  id={titleId}
                  name="title"
                  className={styles.input}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  required
                  disabled={isPendingAction}
                />
                {fieldErrors.title ? (
                  <p className={styles.fieldError}>{fieldErrors.title}</p>
                ) : null}
              </div>

              <div className={styles.field}>
                <label htmlFor={descriptionId} className={styles.label}>
                  Description
                </label>
                <textarea
                  id={descriptionId}
                  name="description"
                  className={styles.textarea}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={8}
                  required
                  disabled={isPendingAction}
                />
                {fieldErrors.description ? (
                  <p className={styles.fieldError}>{fieldErrors.description}</p>
                ) : null}
              </div>

              <div className={styles.field}>
                <label htmlFor={goodToKnowId} className={styles.label}>
                  Good to know
                </label>
                <textarea
                  id={goodToKnowId}
                  name="goodToKnow"
                  className={styles.textarea}
                  value={goodToKnow}
                  onChange={(event) => setGoodToKnow(event.target.value)}
                  rows={4}
                  disabled={isPendingAction}
                />
                {fieldErrors.goodToKnow ? (
                  <p className={styles.fieldError}>{fieldErrors.goodToKnow}</p>
                ) : null}
              </div>

              <div className={styles.field}>
                <label htmlFor={placeIdLabel} className={styles.label}>
                  Place
                </label>
                <select
                  id={placeIdLabel}
                  name="placeId"
                  className={styles.select}
                  value={placeId}
                  onChange={(event) => setPlaceId(event.target.value)}
                  required
                  disabled={isPendingAction}
                >
                  {places.map((item) => (
                    <option key={item.id} value={item.id}>
                      {placeLabel(item)}
                    </option>
                  ))}
                </select>
                {fieldErrors.placeId ? (
                  <p className={styles.fieldError}>{fieldErrors.placeId}</p>
                ) : null}
              </div>

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={isPendingAction}
                >
                  {isPendingAction ? "Working…" : "Edit & approve"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isPendingAction}
                  onClick={() => {
                    setError(null);
                    setPanel("merge");
                  }}
                >
                  Merge with existing
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={isPendingAction}
                  onClick={() => {
                    setError(null);
                    setPanel("reject");
                  }}
                >
                  Reject
                </button>
              </div>
            </form>
          </section>

          <dialog
            ref={mergeDialogRef}
            className={styles.dialog}
            onClose={() => setPanel("review")}
            aria-labelledby="merge-title"
          >
            <div className={styles.dialogInner}>
              <h2 id="merge-title" className={styles.dialogTitle}>
                Merge with existing experience
              </h2>
              <p className={styles.dialogCopy}>
                Choose an experience to associate with this submission. No new
                experience will be created.
              </p>

              <div className={styles.field}>
                <label htmlFor={mergeSearchId} className={styles.label}>
                  Search experiences
                </label>
                <input
                  id={mergeSearchId}
                  className={styles.input}
                  value={mergeQuery}
                  onChange={(event) => setMergeQuery(event.target.value)}
                  placeholder="Search by title…"
                  disabled={isPendingAction}
                />
                <p className={styles.hint}>
                  {mergeQuery.trim()
                    ? "Showing matches across all places."
                    : "Showing experiences at the submission’s place. Search to look elsewhere."}
                </p>
              </div>

              <ul className={styles.candidateList} role="listbox" aria-label="Experiences">
                {mergeCandidates.length === 0 ? (
                  <li className={styles.candidateEmpty}>No experiences match.</li>
                ) : (
                  mergeCandidates.map((item) => {
                    const selected = item.id === selectedExperienceId;
                    const itemPlace = places.find((p) => p.id === item.placeId);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={
                            selected ? styles.candidateActive : styles.candidate
                          }
                          disabled={isPendingAction}
                          onClick={() => setSelectedExperienceId(item.id)}
                        >
                          <span className={styles.candidateTitle}>{item.title}</span>
                          <span className={styles.candidateMeta}>
                            {itemPlace
                              ? `${itemPlace.name} · ${itemPlace.city}, ${itemPlace.state}`
                              : "Unknown place"}
                          </span>
                          {item.description ? (
                            <span className={styles.candidateDescription}>
                              {item.description.length > 120
                                ? `${item.description.slice(0, 119).trimEnd()}…`
                                : item.description}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>

              {selectedExperience ? (
                <div className={styles.selectedPreview}>
                  <p className={styles.selectedLabel}>Selected</p>
                  <p className={styles.candidateTitle}>{selectedExperience.title}</p>
                  {selectedExperience.description ? (
                    <p className={styles.candidateDescription}>
                      {selectedExperience.description}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={isPendingAction || !selectedExperienceId}
                  onClick={onConfirmMerge}
                >
                  {isPendingAction ? "Merging…" : "Confirm merge"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isPendingAction}
                  onClick={() => setPanel("review")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </dialog>

          <dialog
            ref={rejectDialogRef}
            className={styles.dialog}
            onClose={() => setPanel("review")}
            aria-labelledby="reject-title"
          >
            <div className={styles.dialogInner}>
              <h2 id="reject-title" className={styles.dialogTitle}>
                Reject this submission?
              </h2>
              <p className={styles.dialogCopy}>
                The submission will be marked rejected and kept in the archive. It
                will not become a public experience.
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.dangerButton}
                  disabled={isPendingAction}
                  onClick={onConfirmReject}
                >
                  {isPendingAction ? "Rejecting…" : "Confirm reject"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={isPendingAction}
                  onClick={() => setPanel("review")}
                >
                  Cancel
                </button>
              </div>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
