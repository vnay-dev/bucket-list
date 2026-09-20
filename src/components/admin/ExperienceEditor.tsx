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
import { useRouter } from "next/navigation";
import type { ExperienceRecord } from "@/lib/experiences/repository";
import type { PlaceRecord } from "@/lib/places/repository";
import type { TagRecord } from "@/lib/tags/repository";
import {
  assignExperienceTagAction,
  createExperienceAction,
  deleteExperienceAction,
  removeExperienceTagAction,
  updateExperienceAction,
} from "@/lib/admin/experience-actions";
import { experienceNoticeMessage } from "@/lib/admin/experience-helpers";
import { formatRelativeDate } from "@/lib/admin/presentation";
import styles from "./ExperienceEditor.module.css";

type ExperienceEditorProps =
  | {
      mode: "create";
      places: PlaceRecord[];
      allTags: TagRecord[];
    }
  | {
      mode: "edit";
      experience: ExperienceRecord;
      places: PlaceRecord[];
      allTags: TagRecord[];
      initialNotice?: "created" | "updated" | null;
    };

function placeLabel(place: PlaceRecord): string {
  return `${place.name} · ${place.city}, ${place.state}`;
}

export function ExperienceEditor(props: ExperienceEditorProps) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const experience = props.mode === "edit" ? props.experience : null;

  const [title, setTitle] = useState(experience?.title ?? "");
  const [description, setDescription] = useState(experience?.description ?? "");
  const [goodToKnow, setGoodToKnow] = useState(experience?.goodToKnow ?? "");
  const [placeId, setPlaceId] = useState(
    experience?.placeId ?? props.places[0]?.id ?? "",
  );
  const [createTagIds, setCreateTagIds] = useState<string[]>([]);
  const [assignedTags, setAssignedTags] = useState<TagRecord[]>(
    experience?.tags ?? [],
  );
  const [tagToAdd, setTagToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(
    props.mode === "edit" && props.initialNotice
      ? experienceNoticeMessage(props.initialNotice)
      : null,
  );
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const titleId = useId();
  const descriptionId = useId();
  const goodToKnowId = useId();
  const placeFieldId = useId();
  const tagSelectId = useId();

  const availableTags = props.allTags.filter(
    (tag) =>
      !assignedTags.some((assigned) => assigned.id === tag.id) &&
      !createTagIds.includes(tag.id),
  );

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteOpen) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [deleteOpen]);

  function runAction(
    action: () => Promise<{
      ok: boolean;
      message?: string;
      fieldErrors?: Record<string, string>;
      tags?: TagRecord[];
    }>,
    onSuccess?: (result: { tags?: TagRecord[] }) => void,
  ) {
    setError(null);
    setFieldErrors({});
    setSuccess(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }
      onSuccess?.(result);
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreate) {
      runAction(() =>
        createExperienceAction({
          title,
          description,
          goodToKnow,
          placeId,
          tagIds: createTagIds,
        }),
      );
      return;
    }

    if (!experience) return;

    runAction(
      () =>
        updateExperienceAction({
          experienceId: experience.id,
          title,
          description,
          goodToKnow,
          placeId,
        }),
      () => {
        setSuccess("Experience saved.");
        router.refresh();
      },
    );
  }

  function onAddTag() {
    if (isCreate) {
      if (!tagToAdd) {
        setError("Select a tag to add.");
        return;
      }
      setCreateTagIds((current) =>
        current.includes(tagToAdd) ? current : [...current, tagToAdd],
      );
      setAssignedTags((current) => {
        const tag = props.allTags.find((item) => item.id === tagToAdd);
        if (!tag || current.some((item) => item.id === tag.id)) {
          return current;
        }
        return [...current, tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      setTagToAdd("");
      setError(null);
      return;
    }

    if (!experience || !tagToAdd) {
      setError("Select a tag to add.");
      return;
    }

    runAction(
      () =>
        assignExperienceTagAction({
          experienceId: experience.id,
          tagId: tagToAdd,
        }),
      (result) => {
        if (result.tags) {
          setAssignedTags(result.tags);
        }
        setTagToAdd("");
        setSuccess("Tag added.");
      },
    );
  }

  function onRemoveTag(tagId: string) {
    if (isCreate) {
      setCreateTagIds((current) => current.filter((id) => id !== tagId));
      setAssignedTags((current) => current.filter((tag) => tag.id !== tagId));
      return;
    }

    if (!experience) return;

    runAction(
      () =>
        removeExperienceTagAction({
          experienceId: experience.id,
          tagId,
        }),
      () => {
        setAssignedTags((current) => current.filter((tag) => tag.id !== tagId));
        setSuccess("Tag removed.");
      },
    );
  }

  function onConfirmDelete() {
    if (!experience) return;
    runAction(() =>
      deleteExperienceAction({
        experienceId: experience.id,
      }),
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <Link href="/admin/experiences" className={styles.backLink}>
          ← Back to experiences
        </Link>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>
          {isCreate ? "Create experience" : "Edit experience"}
        </h1>
        {!isCreate && experience ? (
          <p className={styles.meta}>
            Created {formatRelativeDate(experience.createdAt)}
            <span className={styles.metaSep}>·</span>
            Updated {formatRelativeDate(experience.updatedAt)}
          </p>
        ) : (
          <p className={styles.meta}>
            Publish curator-authored content without a submission.
          </p>
        )}
      </header>

      {success ? (
        <p className={styles.notice} role="status">
          {success}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.field}>
          <label htmlFor={titleId} className={styles.label}>
            Title
          </label>
          <input
            id={titleId}
            className={styles.input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            disabled={isPending}
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
            className={styles.textarea}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={8}
            disabled={isPending}
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
            className={styles.textarea}
            value={goodToKnow}
            onChange={(event) => setGoodToKnow(event.target.value)}
            rows={4}
            disabled={isPending}
          />
          {fieldErrors.goodToKnow ? (
            <p className={styles.fieldError}>{fieldErrors.goodToKnow}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={placeFieldId} className={styles.label}>
            Place
          </label>
          <select
            id={placeFieldId}
            className={styles.select}
            value={placeId}
            onChange={(event) => setPlaceId(event.target.value)}
            required
            disabled={isPending || props.places.length === 0}
          >
            {props.places.length === 0 ? (
              <option value="">No places available</option>
            ) : (
              props.places.map((place) => (
                <option key={place.id} value={place.id}>
                  {placeLabel(place)}
                </option>
              ))
            )}
          </select>
          {fieldErrors.placeId ? (
            <p className={styles.fieldError}>{fieldErrors.placeId}</p>
          ) : null}
        </div>

        <section className={styles.tags} aria-labelledby="tags-heading">
          <h2 id="tags-heading" className={styles.sectionLabel}>
            Tags
          </h2>

          {assignedTags.length === 0 ? (
            <p className={styles.tagEmpty}>No tags assigned yet.</p>
          ) : (
            <ul className={styles.tagList}>
              {assignedTags.map((tag) => (
                <li key={tag.id} className={styles.tagChip}>
                  <span>{tag.name}</span>
                  <button
                    type="button"
                    className={styles.tagRemove}
                    onClick={() => onRemoveTag(tag.id)}
                    disabled={isPending}
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {props.allTags.length === 0 ? (
            <p className={styles.tagHint}>
              No tags exist yet. Tag management will arrive in a later release.
            </p>
          ) : availableTags.length === 0 ? (
            <p className={styles.tagHint}>All available tags are already assigned.</p>
          ) : (
            <div className={styles.tagAdd}>
              <label htmlFor={tagSelectId} className={styles.label}>
                Add tag
              </label>
              <div className={styles.tagAddRow}>
                <select
                  id={tagSelectId}
                  className={styles.select}
                  value={tagToAdd}
                  onChange={(event) => setTagToAdd(event.target.value)}
                  disabled={isPending}
                >
                  <option value="">Select a tag</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={onAddTag}
                  disabled={isPending || !tagToAdd}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </section>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isPending || props.places.length === 0}
          >
            {isPending
              ? "Working…"
              : isCreate
                ? "Create experience"
                : "Save changes"}
          </button>
          <Link href="/admin/experiences" className={styles.secondaryLink}>
            Cancel
          </Link>
          {!isCreate ? (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={isPending}
              onClick={() => {
                setError(null);
                setDeleteOpen(true);
              }}
            >
              Delete
            </button>
          ) : null}
        </div>
      </form>

      {!isCreate ? (
        <dialog
          ref={deleteDialogRef}
          className={styles.dialog}
          onClose={() => setDeleteOpen(false)}
          aria-labelledby="delete-title"
        >
          <div className={styles.dialogInner}>
            <h2 id="delete-title" className={styles.dialogTitle}>
              Delete this experience?
            </h2>
            <p className={styles.dialogCopy}>
              The experience will be removed from the catalog. Linked submissions
              keep their content but lose the experience association. Wishlist
              entries for this experience are removed.
            </p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={isPending}
                onClick={onConfirmDelete}
              >
                {isPending ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={isPending}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
