import fs from 'fs/promises';
import path from 'path';

export type MoodboardReference = { id: string; filePath: string; mimeType: string };
export async function readMoodboardReferences(records: MoodboardReference[], ids: string[], provider: string) {
  if (!ids.length || ids.length > 5 || new Set(ids).size !== ids.length) throw new Error('Select between one and five saved Moodboard images.');
  const root = path.resolve(process.cwd(), 'data', 'uploads');
  let total = 0;
  const result: Array<{ type: 'image'; image: Uint8Array; mediaType: string }> = [];
  for (const id of ids) {
    const record = records.find(item => item.id === id);
    if (!record) throw new Error('A selected Moodboard image does not belong to this project. Reload the Moodboard.');
    if (!['image/png', 'image/jpeg', ...(provider === 'xai' ? [] : ['image/webp'])].includes(record.mimeType)) throw new Error('Use PNG or JPEG references (WebP is also supported except with Grok). Convert GIF/SVG references before generating UI.');
    const file = path.resolve(root, record.filePath);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid saved Moodboard image path.');
    let bytes: Buffer;
    try {
      const stat = await fs.stat(file);
      if (stat.size <= 0 || stat.size > 10 * 1024 * 1024 || total + stat.size > 20 * 1024 * 1024) throw new Error('size');
      bytes = await fs.readFile(file);
    } catch { throw new Error('A saved reference is missing, empty, or too large. Re-upload it; use images under 10 MB each and 20 MB combined.'); }
    total += bytes.length;
    result.push({ type: 'image', image: new Uint8Array(bytes), mediaType: record.mimeType });
  }
  return result;
}
