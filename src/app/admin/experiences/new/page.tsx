import { ExperienceEditor } from "@/components/admin/ExperienceEditor";
import { getExperienceCreateData } from "@/lib/admin/experiences";

export default async function AdminCreateExperiencePage() {
  const data = await getExperienceCreateData();

  return (
    <ExperienceEditor
      mode="create"
      places={data.places}
      allTags={data.allTags}
    />
  );
}
