import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

type KeyRecord = { hash: string; suffix: string; createdAt: string; ownerUid?: string };
export function createWorkspaceKeyStore(directory: string) {
  const filename = path.join(directory, 'workspace-key.json');
  async function read(): Promise<KeyRecord | null> {
    try {
      const record: KeyRecord = JSON.parse(await readFile(filename, 'utf8'));
      if (!/^[a-f0-9]{64}$/.test(record.hash) || typeof record.suffix !== 'string' || typeof record.createdAt !== 'string') throw new Error('Invalid workspace key record');
      return record;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
  return {
    async status(ownerUid?: string) { const record = await read(); return record?.ownerUid && record.ownerUid === ownerUid ? { configured: true, suffix: record.suffix, createdAt: record.createdAt } : { configured: false }; },
    async generate(ownerUid: string) {
      if (!ownerUid || ownerUid.length > 128) throw new Error('Authenticated key owner required.');
      const previous = await read();
      if (previous?.ownerUid && previous.ownerUid !== ownerUid) throw new Error('Workspace key belongs to another account.');
      const key = `oui_${randomBytes(32).toString('hex')}`;
      const record: KeyRecord = { ownerUid, hash: createHash('sha256').update(key).digest('hex'), suffix: key.slice(-4), createdAt: new Date().toISOString() };
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temporary = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
      try { await writeFile(temporary, JSON.stringify(record), { mode: 0o600 }); await rename(temporary, filename); }
      finally { await rm(temporary, { force: true }); }
      return { key, configured: true, suffix: record.suffix, createdAt: record.createdAt };
    },
    async revoke(ownerUid: string) { const previous = await read(); if (!ownerUid || (previous?.ownerUid && previous.ownerUid !== ownerUid)) throw new Error('Workspace key belongs to another account.'); await rm(filename, { force: true }); },
    async verify(key: string) {
      if (!/^oui_[a-f0-9]{64}$/.test(key)) return false;
      const record = await read();
      return !!record?.ownerUid && timingSafeEqual(Buffer.from(record.hash, 'hex'), createHash('sha256').update(key).digest());
    },
    async owner(key: string) {
      if (!/^oui_[a-f0-9]{64}$/.test(key)) return null;
      const record = await read();
      return record?.ownerUid && timingSafeEqual(Buffer.from(record.hash, 'hex'), createHash('sha256').update(key).digest()) ? record.ownerUid : null;
    },
  };
}

export const workspaceKeyStore = createWorkspaceKeyStore(path.join(process.cwd(), '.openui'));

// Key administration is available only to the local UI, never cross-origin websites.
export function isLocalKeyAdmin(request: Request) {
  const url = new URL(request.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return false;
  const origin = request.headers.get('origin');
  return origin === url.origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
