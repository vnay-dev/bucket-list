import { DashboardView } from "@/components/admin/DashboardView";
import { getDashboardOverview } from "@/lib/admin/dashboard";

export default async function AdminDashboardPage() {
  let overview: Awaited<ReturnType<typeof getDashboardOverview>> | null = null;
  let errorMessage: string | null = null;

  try {
    overview = await getDashboardOverview();
  } catch {
    errorMessage =
      "Unable to load dashboard data right now. Try refreshing the page.";
  }

  return (
    <DashboardView
      counts={
        overview?.counts ?? {
          pendingSubmissions: 0,
          experiences: 0,
          places: 0,
          tags: 0,
        }
      }
      pendingSubmissions={overview?.pendingSubmissions ?? []}
      errorMessage={errorMessage}
    />
  );
}
