import { ExperiencesList } from "@/components/admin/ExperiencesList";
import { listAdminExperiences } from "@/lib/admin/experiences";
import {
  parseExperienceNotice,
  parsePlaceFilter,
  parseSearchQuery,
  parseTagFilter,
} from "@/lib/admin/experience-helpers";
import type { ExperienceListItem } from "@/lib/admin/experiences";
import { listPlaces } from "@/lib/places/repository";

type ExperiencesPageProps = {
  searchParams: Promise<{
    q?: string;
    placeId?: string;
    tagId?: string;
    notice?: string;
  }>;
};

export default async function AdminExperiencesPage({
  searchParams,
}: ExperiencesPageProps) {
  const params = await searchParams;
  const query = parseSearchQuery(params.q);
  const placeId = parsePlaceFilter(params.placeId);
  const tagId = parseTagFilter(params.tagId);
  const notice = parseExperienceNotice(params.notice);

  let items: ExperienceListItem[] = [];
  const places = await listPlaces().catch(() => []);
  let errorMessage: string | null = null;

  try {
    items = await listAdminExperiences({ query, placeId, tagId });
  } catch {
    errorMessage =
      "Unable to load experiences right now. Try refreshing the page.";
  }

  return (
    <ExperiencesList
      items={items}
      places={places}
      query={query}
      placeId={placeId}
      tagId={tagId}
      notice={notice}
      errorMessage={errorMessage}
    />
  );
}
