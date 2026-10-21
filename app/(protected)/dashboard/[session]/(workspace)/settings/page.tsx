import DashboardShell from '@/components/projects/dashboard-shell';
import ProjectsProvider from '@/components/projects/list/provider';
import WorkspaceHome from '@/components/projects/workspace-home';
import SettingsPopup from '@/components/projects/settings-popup';
import { getAllProjects } from '@/lib/db/projects';
import { getEnabledProviders } from '@/lib/ai/model-listing';

export const dynamic='force-dynamic';
export default async function SettingsPage({searchParams}:{searchParams:Promise<{preview?:string}>}){
  const previewLifetime=process.env.OPENUI_LIFETIME_UI_PREVIEW==='true'||(process.env.NODE_ENV==='development'&&(await searchParams).preview==='lifetime');
  const projects=await getAllProjects();
  return <ProjectsProvider initialProjects={projects}><DashboardShell><WorkspaceHome/></DashboardShell><SettingsPopup providers={getEnabledProviders()} previewLifetime={previewLifetime}/></ProjectsProvider>;
}
