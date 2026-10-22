import { NextResponse } from 'next/server';
import { workspaceKeyStore } from '@/lib/workspace-key';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const key = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1] || '';
    const ownerUid = await workspaceKeyStore.owner(key);
    if (!ownerUid) return NextResponse.json({ error: 'Invalid API key.' }, { status: 401, headers });
    const projects = await prisma.project.findMany({ where: { ownerUid }, select: { id: true, name: true, projectNumber: true, lastModified: true }, orderBy: { lastModified: 'desc' } });
    return NextResponse.json({ projects }, { headers });
  } catch { return NextResponse.json({ error: 'Unable to load projects.' }, { status: 500, headers }); }
}
