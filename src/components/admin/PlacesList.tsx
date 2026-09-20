import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import type { PlaceListItem } from "@/lib/admin/places";
import {
  formatCoordinates,
  placeNoticeMessage,
  type PlaceActionNotice,
} from "@/lib/admin/place-helpers";
import styles from "./PlacesList.module.css";

type PlacesListProps = {
  items: PlaceListItem[];
  query: string;
  city: string;
  notice: PlaceActionNotice | null;
  errorMessage?: string | null;
};

export function PlacesList({
  items,
  query,
  city,
  notice,
  errorMessage,
}: PlacesListProps) {
  const hasFilters = Boolean(query || city);

  return (
    <div className={styles.root}>
      <PageHeader
        title="Places"
        description="Maintain the geographic places that scope experiences and submissions."
        actions={
          <Link href="/admin/places/new" className={styles.createLink}>
            Create place
          </Link>
        }
      />

      {notice ? (
        <p className={styles.notice} role="status">
          {placeNoticeMessage(notice)}
        </p>
      ) : null}

      {errorMessage ? (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <form className={styles.filters} method="get" action="/admin/places">
        <div className={styles.field}>
          <label htmlFor="place-search" className={styles.label}>
            Search by name
          </label>
          <input
            id="place-search"
            name="q"
            type="search"
            className={styles.input}
            defaultValue={query}
            placeholder="Search places"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="place-city" className={styles.label}>
            City
          </label>
          <input
            id="place-city"
            name="city"
            type="search"
            className={styles.input}
            defaultValue={city}
            placeholder="Filter by city"
          />
        </div>
        <div className={styles.filterActions}>
          <button type="submit" className={styles.filterButton}>
            Apply
          </button>
          {hasFilters ? (
            <Link href="/admin/places" className={styles.clearLink}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {items.length === 0 ? (
        <p className={styles.empty}>
          {hasFilters
            ? "No places match these filters."
            : "No places yet. Create one to start organizing experiences."}
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.item}>
              <Link
                href={`/admin/places/${item.slug}`}
                className={styles.itemLink}
              >
                <div className={styles.itemTop}>
                  <h2 className={styles.itemTitle}>{item.name}</h2>
                  <p className={styles.itemMeta}>
                    {item.experienceCount === 1
                      ? "1 experience"
                      : `${item.experienceCount} experiences`}
                  </p>
                </div>
                <p className={styles.itemLocation}>
                  {item.city}, {item.state}
                </p>
                <p className={styles.itemSlug}>
                  <span className={styles.srOnly}>Slug: </span>
                  {item.slug}
                </p>
                <p className={styles.itemCoords}>
                  {formatCoordinates(item.latitude, item.longitude)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
