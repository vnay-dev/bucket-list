import { PlacesList } from "@/components/admin/PlacesList";
import {
  parseCityFilter,
  parsePlaceNotice,
  parseSearchQuery,
} from "@/lib/admin/place-helpers";
import { listAdminPlaces, type PlaceListItem } from "@/lib/admin/places";

type PlacesPageProps = {
  searchParams: Promise<{
    q?: string;
    city?: string;
    notice?: string;
  }>;
};

export default async function AdminPlacesPage({
  searchParams,
}: PlacesPageProps) {
  const params = await searchParams;
  const query = parseSearchQuery(params.q);
  const city = parseCityFilter(params.city);
  const notice = parsePlaceNotice(params.notice);

  let items: PlaceListItem[] = [];
  let errorMessage: string | null = null;

  try {
    items = await listAdminPlaces({ query, city });
  } catch {
    errorMessage =
      "Unable to load places right now. Try refreshing the page.";
  }

  return (
    <PlacesList
      items={items}
      query={query}
      city={city}
      notice={notice}
      errorMessage={errorMessage}
    />
  );
}
