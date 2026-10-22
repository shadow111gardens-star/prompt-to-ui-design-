import { NextResponse } from 'next/server';
import { isLocalKeyAdmin, workspaceKeyStore } from '@/lib/workspace-key';
import { withProjectRoute, serverIdentity } from '@/lib/server/project-access';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
function forbidden() { return NextResponse.json({ error: 'Key management requires the local OpenUI page.' }, { status: 403, headers }); }

export const GET = withProjectRoute(async function GET(request: Request) {
  // GET returns only metadata; the full key is never persisted or returned again.
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)) return forbidden();
  try { const identity=await serverIdentity();if(identity.plan!=='lifetime')return forbidden();return NextResponse.json(await workspaceKeyStore.status(identity.sub), { headers }); }
  catch { return NextResponse.json({ error: 'Unable to load workspace key.' }, { status: 500, headers }); }
});
export const POST = withProjectRoute(async function POST(request: Request) {
  if (!isLocalKeyAdmin(request)) return forbidden();
  try { const identity=await serverIdentity();if(identity.plan!=='lifetime')return forbidden();return NextResponse.json(await workspaceKeyStore.generate(identity.sub), { headers }); }
  catch { return NextResponse.json({ error: 'Unable to generate workspace key.' }, { status: 500, headers }); }
});
export const DELETE = withProjectRoute(async function DELETE(request: Request) {
  if (!isLocalKeyAdmin(request)) return forbidden();
  try { const identity=await serverIdentity();if(identity.plan!=='lifetime')return forbidden();await workspaceKeyStore.revoke(identity.sub); return NextResponse.json({ configured: false }, { headers }); }
  catch { return NextResponse.json({ error: 'Unable to revoke workspace key.' }, { status: 500, headers }); }
});
