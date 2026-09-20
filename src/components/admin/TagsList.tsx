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
import { PageHeader } from "@/components/admin/PageHeader";
import type { TagListItem } from "@/lib/admin/tags";
import {
  createTagAction,
  deleteTagAction,
  updateTagAction,
} from "@/lib/admin/tag-actions";
import {
  tagNoticeMessage,
  type TagActionNotice,
} from "@/lib/admin/tag-helpers";
import styles from "./TagsList.module.css";

type TagsListProps = {
  items: TagListItem[];
  query: string;
  notice: TagActionNotice | null;
  errorMessage?: string | null;
};

export function TagsList({
  items,
  query,
  notice,
  errorMessage,
}: TagsListProps) {
  const [createName, setCreateName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(
    notice ? tagNoticeMessage(notice) : null,
  );
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<TagListItem | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const createId = useId();
  const editId = useId();

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (deleteTarget) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [deleteTarget]);

  function runAction(
    action: () => Promise<{
      ok: boolean;
      message?: string;
      fieldErrors?: Record<string, string>;
    }>,
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
      }
    });
  }

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditingId(null);
    runAction(() => createTagAction({ name: createName }));
  }

  function onRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    runAction(() =>
      updateTagAction({
        tagId: editingId,
        name: editName,
      }),
    );
  }

  function onConfirmDelete() {
    if (!deleteTarget) return;
    runAction(() =>
      deleteTagAction({
        tagId: deleteTarget.id,
      }),
    );
  }

  function startRename(item: TagListItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setError(null);
    setFieldErrors({});
    setSuccess(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
    setFieldErrors({});
  }

  return (
    <div className={styles.root}>
      <PageHeader
        title="Tags"
        description="Organize reusable labels applied to experiences during curation."
      />

      {success ? (
        <p className={styles.notice} role="status">
          {success}
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.createForm} onSubmit={onCreate} noValidate>
        <div className={styles.field}>
          <label htmlFor={createId} className={styles.label}>
            New tag
          </label>
          <div className={styles.createRow}>
            <input
              id={createId}
              className={styles.input}
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Tag name"
              disabled={isPending}
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isPending}
            >
              {isPending ? "Working…" : "Create tag"}
            </button>
          </div>
          {fieldErrors.name && !editingId ? (
            <p className={styles.fieldError}>{fieldErrors.name}</p>
          ) : null}
        </div>
      </form>

      <form className={styles.filters} method="get" action="/admin/tags">
        <div className={styles.field}>
          <label htmlFor="tag-search" className={styles.label}>
            Search
          </label>
          <input
            id="tag-search"
            name="q"
            type="search"
            className={styles.input}
            defaultValue={query}
            placeholder="Search by name"
          />
        </div>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Apply
          </button>
          {query ? (
            <Link href="/admin/tags" className={styles.clearLink}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <p className={styles.empty}>
          {query
            ? "No tags match this search."
            : "No tags yet. Create one to start labeling experiences."}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const isEditing = editingId === item.id;
            const countLabel =
              item.experienceCount === 1
                ? "1 experience"
                : `${item.experienceCount} experiences`;

            return (
              <li key={item.id} className={styles.item}>
                {isEditing ? (
                  <form className={styles.editForm} onSubmit={onRename} noValidate>
                    <div className={styles.field}>
                      <label htmlFor={`${editId}-${item.id}`} className={styles.label}>
                        Rename tag
                      </label>
                      <input
                        id={`${editId}-${item.id}`}
                        className={styles.input}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        disabled={isPending}
                        autoComplete="off"
                        autoFocus
                      />
                      {fieldErrors.name ? (
                        <p className={styles.fieldError}>{fieldErrors.name}</p>
                      ) : null}
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="submit"
                        className={styles.primaryButton}
                        disabled={isPending}
                      >
                        {isPending ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={isPending}
                        onClick={cancelRename}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.itemBody}>
                    <div className={styles.itemMain}>
                      <h2 className={styles.itemTitle}>{item.name}</h2>
                      {item.experienceCount > 0 ? (
                        <Link
                          href={`/admin/experiences?tagId=${item.id}`}
                          className={styles.countLink}
                        >
                          {countLabel}
                        </Link>
                      ) : (
                        <span className={styles.countMuted}>{countLabel}</span>
                      )}
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={isPending}
                        onClick={() => startRename(item)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        disabled={isPending}
                        onClick={() => {
                          setError(null);
                          setDeleteTarget(item);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <dialog
        ref={deleteDialogRef}
        className={styles.dialog}
        onClose={() => setDeleteTarget(null)}
        aria-labelledby="delete-tag-title"
      >
        <div className={styles.dialogInner}>
          <h2 id="delete-tag-title" className={styles.dialogTitle}>
            Delete this tag?
          </h2>
          <p className={styles.dialogCopy}>
            {deleteTarget && deleteTarget.experienceCount > 0
              ? `“${deleteTarget.name}” is assigned to ${
                  deleteTarget.experienceCount === 1
                    ? "1 experience"
                    : `${deleteTarget.experienceCount} experiences`
                }. Deleting it removes the tag from those experiences. The experiences themselves are not deleted.`
              : deleteTarget
                ? `“${deleteTarget.name}” is not assigned to any experiences. It will be removed from the catalog.`
                : null}
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
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
