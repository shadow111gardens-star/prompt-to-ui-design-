import ProjectsProvider from "@/components/projects/list/provider";
import { getAllProjects } from "@/lib/db/projects";
import WorkspaceHome from "@/components/projects/workspace-home";
import DashboardShell from "@/components/projects/dashboard-shell";

const Page = async () => {
  const projects = await getAllProjects();
  return (
    <ProjectsProvider initialProjects={projects}>
      <DashboardShell>
        <WorkspaceHome />
      </DashboardShell>
    </ProjectsProvider>
  );
};

export default Page;
