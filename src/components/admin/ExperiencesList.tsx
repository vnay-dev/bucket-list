import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import type { ExperienceListItem } from "@/lib/admin/experiences";
import {
  experienceNoticeMessage,
  type ExperienceActionNotice,
} from "@/lib/admin/experience-helpers";
import type { PlaceRecord } from "@/lib/places/repository";
import { formatRelativeDate, truncateText } from "@/lib/admin/presentation";
import styles from "./ExperiencesList.module.css";

type ExperiencesListProps = {
  items: ExperienceListItem[];
  places: PlaceRecord[];
  query: string;
  placeId?: string;
  tagId?: string;
  notice: ExperienceActionNotice | null;
  errorMessage?: string | null;
};

export function ExperiencesList({
  items,
  places,
  query,
  placeId,
  tagId,
  notice,
  errorMessage,
}: ExperiencesListProps) {
  const hasFilters = Boolean(query || placeId || tagId);

  return (
    <div className={styles.root}>
      <PageHeader
        title="Experiences"
        description="Manage published experiences that appear in the product."
        actions={
          <Link href="/admin/experiences/new" className={styles.createLink}>
            Create experience
          </Link>
        }
      />

      {notice ? (
        <p className={styles.notice} role="status">
          {experienceNoticeMessage(notice)}
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {tagId ? (
        <p className={styles.filterNote} role="status">
          Showing experiences that use a selected tag.{" "}
          <Link href="/admin/tags" className={styles.clearLink}>
            Back to tags
          </Link>
        </p>
      ) : null}

      <form className={styles.filters} method="get" action="/admin/experiences">
        {tagId ? <input type="hidden" name="tagId" value={tagId} /> : null}
        <div className={styles.field}>
          <label htmlFor="experience-search" className={styles.label}>
            Search
          </label>
          <input
            id="experience-search"
            name="q"
            type="search"
            className={styles.input}
            defaultValue={query}
            placeholder="Search by title"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="experience-place" className={styles.label}>
            Place
          </label>
          <select
            id="experience-place"
            name="placeId"
            className={styles.select}
            defaultValue={placeId ?? "all"}
          >
            <option value="all">All places</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name} · {place.city}, {place.state}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Apply
          </button>
          {hasFilters ? (
            <Link href="/admin/experiences" className={styles.clearLink}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <p className={styles.empty}>
          {hasFilters
            ? "No experiences match these filters."
            : "No experiences yet. Create one to start the catalog."}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <Link
                href={`/admin/experiences/${item.id}`}
                className={styles.itemLink}
              >
                <div className={styles.itemTop}>
                  <h2 className={styles.itemTitle}>{item.title}</h2>
                  <time
                    className={styles.itemTime}
                    dateTime={item.updatedAt.toISOString()}
                  >
                    Updated {formatRelativeDate(item.updatedAt)}
                  </time>
                </div>
                <p className={styles.itemPlace}>
                  {item.placeName}
                  <span className={styles.itemLocation}>
                    {" "}
                    · {item.placeLocation}
                  </span>
                </p>
                {item.description ? (
                  <p className={styles.itemDescription}>
                    {truncateText(item.description, 140)}
                  </p>
                ) : null}
                {item.tags.length > 0 ? (
                  <ul className={styles.tagList} aria-label="Tags">
                    {item.tags.map((tag) => (
                      <li key={tag.id} className={styles.tag}>
                        {tag.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
