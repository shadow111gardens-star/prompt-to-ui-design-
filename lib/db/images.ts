import { requireOwnedProject, ownerFilter, ProjectAccessError } from '@/lib/server/project-access';
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from 'node:crypto';

const UPLOADS_ROOT = path.join(process.cwd(), "data", "uploads");
const uploadURL = (filePath: string) => '/api/uploads/' + filePath.split('/').map(encodeURIComponent).join('/');

// Helper to ensure directory exists
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch {
    // Ignore if already exists
  }
}

export async function addMoodBoardImage(
  projectId: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
) {
  await requireOwnedProject(projectId);
  const uniqueName = `${randomUUID()}_${path.basename(fileName.replace(/\\/g, '/')).replace(/[\s\x00-\x1f]/g, "_")}`;
  const relativeDir = path.join("moodboard", projectId);
  const targetDir = path.join(UPLOADS_ROOT, relativeDir);
  await ensureDir(targetDir);

  const targetPath = path.join(targetDir, uniqueName);
  await fs.writeFile(targetPath, fileBuffer);

  const filePath = path.join(relativeDir, uniqueName).replace(/\\/g, "/");

  const image = await prisma.moodBoardImage.create({
    data: {
      projectId,
      filePath,
      fileName,
      mimeType,
    },
  });

  return {
    _id: image.id,
    projectId: image.projectId,
    url: uploadURL(image.filePath),
    createdAt: image.createdAt.getTime(),
  };
}

export async function removeMoodBoardImage(id: string) {
  const image = await prisma.moodBoardImage.findUnique({
    where: { id, project: await ownerFilter() },
  });

  if (!image) throw new ProjectAccessError(404, "Image not found.");

  // Delete file from disk
  const absolutePath = path.join(UPLOADS_ROOT, image.filePath);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    console.warn("Could not delete file from disk:", absolutePath, error);
  }

  // Delete from DB
  await prisma.moodBoardImage.delete({
    where: { id, project: await ownerFilter() },
  });

  return { success: true };
}

export async function getMoodBoardImages(projectId: string) {
  await requireOwnedProject(projectId);
  const images = await prisma.moodBoardImage.findMany({
    where: { projectId, project: await ownerFilter() },
    orderBy: { createdAt: "asc" },
  });

  return images.map((img: {
    id: string;
    projectId: string;
    filePath: string;
    createdAt: Date;
  }) => ({
    _id: img.id,
    projectId: img.projectId,
    url: uploadURL(img.filePath),
    createdAt: img.createdAt.getTime(),
  }));
}

export async function addInspirationImage(
  projectId: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer
) {
  await requireOwnedProject(projectId);
  const uniqueName = `${randomUUID()}_${path.basename(fileName.replace(/\\/g, '/')).replace(/[\s\x00-\x1f]/g, "_")}`;
  const relativeDir = path.join("inspiration", projectId);
  const targetDir = path.join(UPLOADS_ROOT, relativeDir);
  await ensureDir(targetDir);

  const targetPath = path.join(targetDir, uniqueName);
  await fs.writeFile(targetPath, fileBuffer);

  const filePath = path.join(relativeDir, uniqueName).replace(/\\/g, "/");

  const image = await prisma.inspirationImage.create({
    data: {
      projectId,
      filePath,
      fileName,
      mimeType,
    },
  });

  return {
    _id: image.id,
    projectId: image.projectId,
    url: uploadURL(image.filePath),
    createdAt: image.createdAt.getTime(),
  };
}

export async function removeInspirationImage(id: string) {
  const image = await prisma.inspirationImage.findUnique({
    where: { id, project: await ownerFilter() },
  });

  if (!image) throw new ProjectAccessError(404, "Image not found.");

  // Delete file from disk
  const absolutePath = path.join(UPLOADS_ROOT, image.filePath);
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    console.warn("Could not delete file from disk:", absolutePath, error);
  }

  // Delete from DB
  await prisma.inspirationImage.delete({
    where: { id, project: await ownerFilter() },
  });

  return { success: true };
}

export async function getInspirationImages(projectId: string) {
  await requireOwnedProject(projectId);
  const images = await prisma.inspirationImage.findMany({
    where: { projectId, project: await ownerFilter() },
    orderBy: { createdAt: "asc" },
  });

  return images.map((img: {
    id: string;
    projectId: string;
    filePath: string;
    createdAt: Date;
  }) => ({
    _id: img.id,
    projectId: img.projectId,
    url: uploadURL(img.filePath),
    createdAt: img.createdAt.getTime(),
  }));
}
