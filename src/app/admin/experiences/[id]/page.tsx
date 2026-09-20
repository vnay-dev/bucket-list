import { notFound } from "next/navigation";
import { ExperienceEditor } from "@/components/admin/ExperienceEditor";
import { getExperienceEditorData } from "@/lib/admin/experiences";
import { parseExperienceNotice } from "@/lib/admin/experience-helpers";

type ExperienceDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

export default async function AdminExperienceDetailPage({
  params,
  searchParams,
}: ExperienceDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const notice = parseExperienceNotice(query.notice);
  const data = await getExperienceEditorData(id);

  if (!data) {
    notFound();
  }

  return (
    <ExperienceEditor
      mode="edit"
      experience={data.experience}
      places={data.places}
      allTags={data.allTags}
      initialNotice={
        notice === "created" || notice === "updated" ? notice : null
      }
    />
  );
}
