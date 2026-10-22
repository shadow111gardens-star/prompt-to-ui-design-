import { AsyncLocalStorage } from 'node:async_hooks';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, EmailVerificationRequiredError, verifyFirebaseToken, type FirebaseIdentity } from '@/lib/firebase/verify-token';
import { personalProviderIdentity } from '@/lib/ai/personal-provider-auth';
import { prisma } from '@/lib/db';

const identities = new AsyncLocalStorage<FirebaseIdentity>();
export class ProjectAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 404, message: string) { super(message); }
}
export function projectAccessResponse(error: unknown): Response | undefined {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
    return Response.json({ error: 'Project not found.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!(error instanceof ProjectAccessError)) return;
  return Response.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store', Vary: 'Cookie' } });
}
export async function serverIdentity(): Promise<FirebaseIdentity> {
  const identity = identities.getStore();
  if (identity) return identity;
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!token) throw new Error('Missing session');
    return await verifyFirebaseToken(token);
  } catch (error) {
    if (error instanceof EmailVerificationRequiredError) throw new ProjectAccessError(403, 'Verify your email address to continue.');
    throw new ProjectAccessError(401, 'Sign in to continue.');
  }
}
// Internal context accepts an identity only after the caller verifies Firebase.
export function withVerifiedIdentity<T>(identity: FirebaseIdentity, work: () => T): T { return identities.run(identity, work); }
export async function ownerFilter() { return { ownerUid: (await serverIdentity()).sub }; }
export async function ownedProjectWhere(id: string) {
  const owner = await ownerFilter();
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ProjectAccessError(404, 'Project not found.');
  return { id, ...owner };
}
export async function requireOwnedProject(id: string) {
  const where = await ownedProjectWhere(id);
  if (!await prisma.project.findUnique({ where, select: { id: true } })) throw new ProjectAccessError(404, 'Project not found.');
  return where;
}
export function withProjectRoute<T extends Request, A extends unknown[]>(handler: (request: T, ...args: A) => Promise<Response>) {
  return async (request: T, ...args: A): Promise<Response> => {
    let identity: FirebaseIdentity;
    try { identity = await personalProviderIdentity(request); }
    catch (error) {
      return projectAccessResponse(error instanceof EmailVerificationRequiredError
        ? new ProjectAccessError(403, 'Verify your email address to continue.')
        : new ProjectAccessError(401, 'Sign in to continue.'))!;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('origin') !== new URL(request.url).origin) {
      return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
    }
    return withVerifiedIdentity(identity, async () => {
      try {
        const response = await handler(request, ...args);
        response.headers.set('Cache-Control', 'no-store');
        response.headers.set('Vary', 'Cookie');
        return response;
      } catch (error) { const denied = projectAccessResponse(error); if (denied) return denied; throw error; }
    });
  };
}
