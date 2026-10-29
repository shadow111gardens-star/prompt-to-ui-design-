import ProjectsProvider from "@/components/projects/list/provider";
import { getSidebarProjects } from "@/lib/db/projects";
import WorkspaceHome from "@/components/projects/workspace-home";
import DashboardShell from "@/components/projects/dashboard-shell";
import { serverIdentity, withVerifiedIdentity } from '@/lib/server/project-access';

export const dynamic = 'force-dynamic';

const Page = async () => {
  const identity = await serverIdentity();
  const projects = await withVerifiedIdentity(identity, () => getSidebarProjects());
  return (
    <ProjectsProvider initialProjects={projects} ownerUid={identity.sub}>
      <DashboardShell>
        <WorkspaceHome />
      </DashboardShell>
    </ProjectsProvider>
  );
};

export default Page;
