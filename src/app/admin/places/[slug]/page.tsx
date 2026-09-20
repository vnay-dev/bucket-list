import { notFound } from "next/navigation";
import { PlaceEditor } from "@/components/admin/PlaceEditor";
import { parsePlaceNotice } from "@/lib/admin/place-helpers";
import { getPlaceEditorData } from "@/lib/admin/places";
import { validateSlugParam } from "@/lib/places/validation";

type PlaceDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function AdminPlaceDetailPage({
  params,
  searchParams,
}: PlaceDetailPageProps) {
  const { slug: rawSlug } = await params;
  const query = await searchParams;
  const notice = parsePlaceNotice(query.notice);

  const slugResult = validateSlugParam(rawSlug);
  if (!slugResult.ok) {
    notFound();
  }

  const data = await getPlaceEditorData(slugResult.data);
  if (!data) {
    notFound();
  }

  return (
    <PlaceEditor
      mode="edit"
      place={data.place}
      experienceCount={data.experienceCount}
      initialNotice={
        notice === "created" || notice === "updated" ? notice : null
      }
    />
  );
}
