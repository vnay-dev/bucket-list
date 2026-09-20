import { TeamList } from "@/components/admin/TeamList";
import { listAdminTeam, type TeamMember } from "@/lib/admin/team";
import { parseTeamNotice } from "@/lib/admin/team-helpers";
import { requireSuperAdmin } from "@/lib/auth/authenticated-user";
import { countSuperAdmins } from "@/lib/auth/users";

type TeamPageProps = {
  searchParams: Promise<{
    notice?: string;
  }>;
};

export default async function AdminTeamPage({ searchParams }: TeamPageProps) {
  const params = await searchParams;
  const notice = parseTeamNotice(params.notice);
  const actor = await requireSuperAdmin();

  let members: TeamMember[] = [];
  let superAdminCount = 0;
  let errorMessage: string | null = null;

  try {
    [members, superAdminCount] = await Promise.all([
      listAdminTeam(),
      countSuperAdmins(),
    ]);
  } catch {
    errorMessage =
      "Unable to load the team right now. Try refreshing the page.";
  }

  return (
    <TeamList
      members={members}
      currentUserId={actor.userId}
      superAdminCount={superAdminCount}
      notice={notice}
      errorMessage={errorMessage}
    />
  );
}
