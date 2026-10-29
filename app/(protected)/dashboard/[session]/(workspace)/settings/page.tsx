import DashboardShell from '@/components/projects/dashboard-shell';
import ProjectsProvider from '@/components/projects/list/provider';
import WorkspaceHome from '@/components/projects/workspace-home';
import SettingsPopup from '@/components/projects/settings-popup';
import { getSidebarProjects } from '@/lib/db/projects';
import { getEnabledProviders } from '@/lib/ai/model-listing';
import { serverIdentity, withVerifiedIdentity } from '@/lib/server/project-access';

export const dynamic='force-dynamic';
export default async function SettingsPage({searchParams}:{searchParams:Promise<{preview?:string}>}){
  const previewLifetime=process.env.OPENUI_LIFETIME_UI_PREVIEW==='true'||(process.env.NODE_ENV==='development'&&(await searchParams).preview==='lifetime');
  const identity=await serverIdentity();
  const projects=await withVerifiedIdentity(identity,()=>getSidebarProjects());
  return <ProjectsProvider initialProjects={projects} ownerUid={identity.sub}><DashboardShell><WorkspaceHome/></DashboardShell><SettingsPopup providers={getEnabledProviders()} previewLifetime={previewLifetime}/></ProjectsProvider>;
}
