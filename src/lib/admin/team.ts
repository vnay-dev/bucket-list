import type { AppUser } from "@/lib/auth/users";
import { listAdministrativeUsers } from "@/lib/auth/users";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: "curator" | "superadmin";
  createdAt: Date;
};

function toTeamMember(user: AppUser): TeamMember | null {
  if (user.role !== "curator" && user.role !== "superadmin") {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function listAdminTeam(): Promise<TeamMember[]> {
  const users = await listAdministrativeUsers();
  return users
    .map(toTeamMember)
    .filter((member): member is TeamMember => member !== null);
}
