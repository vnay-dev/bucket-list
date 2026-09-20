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
import type { PlaceRecord } from "@/lib/places/repository";
import {
  createPlaceAction,
  deletePlaceAction,
  updatePlaceAction,
} from "@/lib/admin/place-actions";
import { placeNoticeMessage } from "@/lib/admin/place-helpers";
import styles from "./PlaceEditor.module.css";

type PlaceEditorProps =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      place: PlaceRecord;
      experienceCount: number;
      initialNotice?: "created" | "updated" | null;
    };

export function PlaceEditor(props: PlaceEditorProps) {
  const router = useRouter();
  const isCreate = props.mode === "create";
  const place = props.mode === "edit" ? props.place : null;
  const experienceCount = props.mode === "edit" ? props.experienceCount : 0;

  const [name, setName] = useState(place?.name ?? "");
  const [slug, setSlug] = useState(place?.slug ?? "");
  const [city, setCity] = useState(place?.city ?? "");
  const [state, setState] = useState(place?.state ?? "");
  const [latitude, setLatitude] = useState(
    place ? String(place.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    place ? String(place.longitude) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(
    props.mode === "edit" && props.initialNotice
      ? placeNoticeMessage(props.initialNotice)
      : null,
  );
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const nameId = useId();
  const slugId = useId();
  const cityId = useId();
  const stateId = useId();
  const latitudeId = useId();
  const longitudeId = useId();

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
    }>,
    onSuccess?: () => void,
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
      onSuccess?.();
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreate) {
      runAction(() =>
        createPlaceAction({
          name,
          slug,
          city,
          state,
          latitude,
          longitude,
        }),
      );
      return;
    }

    if (!place) return;

    runAction(
      () =>
        updatePlaceAction({
          currentSlug: place.slug,
          name,
          slug,
          city,
          state,
          latitude,
          longitude,
        }),
      () => {
        setSuccess("Place saved.");
        router.refresh();
      },
    );
  }

  function onConfirmDelete() {
    if (!place) return;
    runAction(() =>
      deletePlaceAction({
        slug: place.slug,
      }),
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <Link href="/admin/places" className={styles.backLink}>
          ← Back to places
        </Link>
      </div>

      <header className={styles.header}>
        <h1 className={styles.title}>
          {isCreate ? "Create place" : "Edit place"}
        </h1>
        {!isCreate && place ? (
          <p className={styles.meta}>
            {experienceCount === 0
              ? "No experiences linked yet."
              : experienceCount === 1
                ? "1 experience linked."
                : `${experienceCount} experiences linked.`}
            {experienceCount > 0 ? (
              <>
                {" "}
                <Link
                  href={`/admin/experiences?placeId=${place.id}`}
                  className={styles.metaLink}
                >
                  View experiences
                </Link>
              </>
            ) : null}
          </p>
        ) : (
          <p className={styles.meta}>
            Add a location that experiences and submissions can reference.
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

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor={nameId} className={styles.label}>
            Name
          </label>
          <input
            id={nameId}
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={isPending}
            autoComplete="off"
          />
          {fieldErrors.name ? (
            <p className={styles.fieldError}>{fieldErrors.name}</p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor={slugId} className={styles.label}>
            Slug
          </label>
          <input
            id={slugId}
            className={styles.input}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            disabled={isPending}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${slugId}-hint`}
          />
          <p id={`${slugId}-hint`} className={styles.hint}>
            Lowercase letters, numbers, and single hyphens only.
          </p>
          {fieldErrors.slug ? (
            <p className={styles.fieldError}>{fieldErrors.slug}</p>
          ) : null}
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={cityId} className={styles.label}>
              City
            </label>
            <input
              id={cityId}
              className={styles.input}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
              disabled={isPending}
              autoComplete="address-level2"
            />
            {fieldErrors.city ? (
              <p className={styles.fieldError}>{fieldErrors.city}</p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor={stateId} className={styles.label}>
              State
            </label>
            <input
              id={stateId}
              className={styles.input}
              value={state}
              onChange={(event) => setState(event.target.value)}
              required
              disabled={isPending}
              autoComplete="address-level1"
            />
            {fieldErrors.state ? (
              <p className={styles.fieldError}>{fieldErrors.state}</p>
            ) : null}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label htmlFor={latitudeId} className={styles.label}>
              Latitude
            </label>
            <input
              id={latitudeId}
              className={styles.input}
              type="text"
              inputMode="decimal"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
              required
              disabled={isPending}
              autoComplete="off"
              aria-describedby={`${latitudeId}-hint`}
            />
            <p id={`${latitudeId}-hint`} className={styles.hint}>
              Between −90 and 90.
            </p>
            {fieldErrors.latitude ? (
              <p className={styles.fieldError}>{fieldErrors.latitude}</p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor={longitudeId} className={styles.label}>
              Longitude
            </label>
            <input
              id={longitudeId}
              className={styles.input}
              type="text"
              inputMode="decimal"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
              required
              disabled={isPending}
              autoComplete="off"
              aria-describedby={`${longitudeId}-hint`}
            />
            <p id={`${longitudeId}-hint`} className={styles.hint}>
              Between −180 and 180.
            </p>
            {fieldErrors.longitude ? (
              <p className={styles.fieldError}>{fieldErrors.longitude}</p>
            ) : null}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={isPending}
          >
            {isPending
              ? "Working…"
              : isCreate
                ? "Create place"
                : "Save changes"}
          </button>
          <Link href="/admin/places" className={styles.secondaryLink}>
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
          aria-labelledby="delete-place-title"
        >
          <div className={styles.dialogInner}>
            <h2 id="delete-place-title" className={styles.dialogTitle}>
              Delete this place?
            </h2>
            <p className={styles.dialogCopy}>
              Deletion may not be possible if this place is still used by
              experiences or submissions. Related content will not be deleted
              automatically.
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
