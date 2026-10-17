import ProjectsProvider from "@/components/projects/list/provider";
import { getAllProjects } from "@/lib/db/projects";
import ProjectsList from "@/components/projects/list";

const Page = async () => {
  const projects = await getAllProjects();
  return (
    <ProjectsProvider initialProjects={projects}>
      <div className="container mx-auto py-20 px-6">
        <ProjectsList />
      </div>
    </ProjectsProvider>
  );
};

export default Page;
