import ProjectsProvider from "@/components/projects/list/provider";
import { getAllProjects } from "@/lib/db/projects";
import ProjectsList from "@/components/projects/list";
import DashboardShell from "@/components/projects/dashboard-shell";

const Page = async () => {
  const projects = await getAllProjects();
  return (
    <ProjectsProvider initialProjects={projects}>
      <DashboardShell>
        <ProjectsList />
      </DashboardShell>
    </ProjectsProvider>
  );
};

export default Page;
