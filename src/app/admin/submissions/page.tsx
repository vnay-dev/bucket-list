import { SubmissionsList } from "@/components/admin/SubmissionsList";
import { listAdminSubmissions } from "@/lib/admin/submissions";
import {
  parseSubmissionNotice,
  parseSubmissionStatusFilter,
} from "@/lib/admin/submission-helpers";
import type { SubmissionListItem } from "@/lib/admin/submissions";

type SubmissionsPageProps = {
  searchParams: Promise<{
    status?: string;
    notice?: string;
  }>;
};

export default async function AdminSubmissionsPage({
  searchParams,
}: SubmissionsPageProps) {
  const params = await searchParams;
  const status = parseSubmissionStatusFilter(params.status);
  const notice = parseSubmissionNotice(params.notice);

  let items: SubmissionListItem[] = [];
  let errorMessage: string | null = null;

  try {
    items = await listAdminSubmissions(status);
  } catch {
    errorMessage =
      "Unable to load submissions right now. Try refreshing the page.";
  }

  return (
    <SubmissionsList
      status={status}
      items={items}
      notice={notice}
      errorMessage={errorMessage}
    />
  );
}
