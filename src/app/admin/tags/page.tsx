import { TagsList } from "@/components/admin/TagsList";
import {
  parseSearchQuery,
  parseTagNotice,
} from "@/lib/admin/tag-helpers";
import { listAdminTags, type TagListItem } from "@/lib/admin/tags";

type TagsPageProps = {
  searchParams: Promise<{
    q?: string;
    notice?: string;
  }>;
};

export default async function AdminTagsPage({ searchParams }: TagsPageProps) {
  const params = await searchParams;
  const query = parseSearchQuery(params.q);
  const notice = parseTagNotice(params.notice);

  let items: TagListItem[] = [];
  let errorMessage: string | null = null;

  try {
    items = await listAdminTags({ query });
  } catch {
    errorMessage = "Unable to load tags right now. Try refreshing the page.";
  }

  return (
    <TagsList
      items={items}
      query={query}
      notice={notice}
      errorMessage={errorMessage}
    />
  );
}
