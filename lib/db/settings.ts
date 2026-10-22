import { requireOwnedProject, ownerFilter } from '@/lib/server/project-access';
import { prisma } from "@/lib/db";

export async function getProjectSettings(projectId: string) {
  await requireOwnedProject(projectId);
  return prisma.projectSettings.findUnique({
    where: { projectId, project: await ownerFilter() },
  });
}

export async function updateProjectSettings(
  projectId: string,
  settings: { provider: string | null; model: string | null }
) {
  await requireOwnedProject(projectId);
  return prisma.projectSettings.upsert({
    where: { projectId, project: await ownerFilter() },
    update: {
      provider: settings.provider,
      model: settings.model,
    },
    create: {
      projectId,
      provider: settings.provider,
      model: settings.model,
    },
  });
}
