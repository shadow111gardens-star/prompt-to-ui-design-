import DashboardShell from '@/components/projects/dashboard-shell';
import WorkspaceSettings from '@/components/projects/workspace-settings';
import { getEnabledProviders } from '@/lib/ai/model-listing';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return <DashboardShell><WorkspaceSettings providers={getEnabledProviders()}/></DashboardShell>;
}
