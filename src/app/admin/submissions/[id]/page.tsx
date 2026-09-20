import { notFound } from "next/navigation";
import { SubmissionReview } from "@/components/admin/SubmissionReview";
import { getSubmissionReviewData } from "@/lib/admin/submissions";

type SubmissionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminSubmissionDetailPage({
  params,
}: SubmissionDetailPageProps) {
  const { id } = await params;
  const data = await getSubmissionReviewData(id);

  if (!data) {
    notFound();
  }

  return (
    <SubmissionReview
      submission={data.submission}
      place={data.place}
      places={data.places}
      experiences={data.experiences}
      linkedExperience={data.linkedExperience}
    />
  );
}
