import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/db';
import { withProjectRoute, ownerFilter, ProjectAccessError } from '@/lib/server/project-access';
const UPLOADS_ROOT = path.resolve(process.cwd(), 'data', 'uploads');
export const GET = withProjectRoute(async function GET(
  _request: NextRequest, { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments?.length || segments.some(segment => !segment || segment === '..' || /[\\/\0]/.test(segment))) throw new ProjectAccessError(404, 'Image not found.');
  const filePath = segments.join('/');
  const where = { filePath, project: await ownerFilter() };
  const record = segments[0] === 'moodboard'
    ? await prisma.moodBoardImage.findFirst({ where, select: { id: true } })
    : segments[0] === 'inspiration'
      ? await prisma.inspirationImage.findFirst({ where, select: { id: true } }) : null;
  if (!record) throw new ProjectAccessError(404, 'Image not found.');
  const file = path.resolve(UPLOADS_ROOT, ...segments);
  if (!file.startsWith(UPLOADS_ROOT + path.sep)) throw new ProjectAccessError(404, 'Image not found.');
  let bytes: Buffer;
  try { bytes = await fs.readFile(file); } catch { throw new ProjectAccessError(404, 'Image not found.'); }
  const extension = path.extname(file).toLowerCase();
  const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.jfif': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  return new Response(new Uint8Array(bytes), { headers: {
    'Content-Type': mime[extension] || 'application/octet-stream', 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff',
    ...(extension === '.svg' ? { 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" } : {}),
  } });
});
