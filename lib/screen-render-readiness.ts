/** Read the iframe's realm explicitly: parent instanceof HTMLElement skips iframe nodes. */
export function usedScreenFontFamilies(root: HTMLElement): string[] {
 const view = root.ownerDocument.defaultView;
 if (!view) throw new Error('Screen preview is no longer available.');
 const families = new Set<string>();
 for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
  for (const pseudo of [null, '::before', '::after']) {
   const style = view.getComputedStyle(element, pseudo);
   if (pseudo && (!style.content || style.content === 'none' || style.content === 'normal')) continue;
   for (const family of style.fontFamily.split(',')) {
    const name = family.trim().replace(/^["']|["']$/g, '');
    if (name) families.add(name);
   }
  }
 }
 return [...families];
}

export async function embedScreenFonts(root: HTMLElement, embed: (node: HTMLElement) => Promise<string>): Promise<string> {
 const doc = root.ownerDocument;
 const families = usedScreenFontFamilies(root);
 // Give the library a root listing ALL used families. Its child traversal is not
 // iframe-safe, but this root's ownerDocument still points to the correct sheets.
 const probe = doc.createElement('div');
 probe.style.fontFamily = families.map(name => JSON.stringify(name)).join(', ');
 const css = await timeout(embed(probe), 'Screen fonts could not be embedded in time. Retry export.');
 // The installed library's preferredFontFormat filter uses a stateful global
 // regex and can drop every second src (notably Google Fonts' Latin subsets).
 // Callers deliberately keep all formats. Validate each face, not just its name.
 for (const face of css.match(/@font-face\s*\{[^}]*\}/gi) || []) {
  if (!/\bsrc\s*:\s*[^;]*url\(["']?data:[^,]+,[^"')\s]+/i.test(face)) {
   throw new Error('An exported font subset has no embedded source. Retry export before downloading.');
  }
 }
 if (/url\(["']?(?:https?:|\/)/i.test(css) || /url\(["']?data:[^,]*,["']?\)/i.test(css)) throw new Error('A screen font could not be embedded. Check font access and retry export.');
 const registered = new Set<string>();
 doc.fonts.forEach(face => registered.add(face.family.replace(/^["']|["']$/g, '').toLowerCase()));
 for (const family of families) {
  if (registered.has(family.toLowerCase()) && !css.toLowerCase().includes(family.toLowerCase())) {
   throw new Error(`Could not embed the screen font "${family}". Check font access and retry export.`);
  }
 }
 return css;
}

/** Counter html-to-image's deliberate floor(fontSize)-0.1px clone adjustment.
 * These rules exist only inside the exported SVG; live Canvas styles are untouched.
 */
export function screenFontSizeCSS(root: HTMLElement): string {
 const view = root.ownerDocument.defaultView;
 if (!view) throw new Error('Screen preview is no longer available.');
 const escape = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, character => `\\${character.codePointAt(0)!.toString(16)} `);
 const rules: string[] = [];
 for (const element of [root, ...Array.from(root.querySelectorAll('[data-openui-element]'))]) {
  const size = view.getComputedStyle(element).fontSize;
  if (!/^\d+(?:\.\d+)?px$/.test(size)) continue;
  const id = element.getAttribute('data-openui-element');
  const selector = element === root ? 'foreignObject > :first-child' : id ? `[data-openui-element="${escape(id)}"]` : '';
  if (selector) rules.push(`${selector}{font-size:${size}!important}`);
 }
 return rules.join('\n');
}

function timeout<T>(promise: Promise<T>, message: string, milliseconds = 20000): Promise<T> {
 return new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(message)), milliseconds);
  promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
 });
}

/** Wait for decoded resources and two stable animation frames, not an arbitrary capture delay. */
export async function waitForScreenRender(root: HTMLElement): Promise<void> {
 const doc = root.ownerDocument, view = doc.defaultView;
 if (!view) throw new Error('Screen preview is no longer available.');
 await timeout(Promise.all(Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => {
  if (link.sheet) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
   const done = () => { link.removeEventListener('load', loaded); link.removeEventListener('error', failed); };
   const loaded = () => { done(); resolve(); }, failed = () => { done(); reject(new Error('A screen stylesheet could not load. Retry before exporting.')); };
   link.addEventListener('load', loaded, { once: true }); link.addEventListener('error', failed, { once: true });
  });
 })), 'Screen styles did not finish loading. Retry export.');
 // Force style/layout before fonts.ready so newly inserted iframe content has
 // requested its fonts rather than resolving an earlier, empty FontFaceSet.
 root.getBoundingClientRect();
 await timeout(doc.fonts.ready, 'Screen fonts did not finish loading. Retry export.');
 await timeout(Promise.all(Array.from(root.querySelectorAll('img')).map(async image => {
  const loading = image.loading;
  try {
   image.loading = 'eager';
   if (typeof image.decode === 'function') await image.decode();
   else if (!image.complete) await new Promise<void>((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('A screen image could not load.')), { once: true });
   });
   if (!image.naturalWidth) throw new Error('A screen image is missing. Check its URL before exporting.');
  } finally { image.loading = loading; }
 })), 'Screen images did not finish loading. Retry export.');
 await timeout(new Promise<void>((resolve, reject) => {
  let previous = '', stable = 0, frames = 0;
  const measure = () => {
   const signature = [root.clientWidth, root.clientHeight, root.scrollWidth, root.scrollHeight].join(':');
   stable = signature === previous ? stable + 1 : 0; previous = signature;
   if (stable >= 2) resolve();
   else if (++frames >= 120) reject(new Error('The screen layout is still changing. Wait and retry export.'));
   else view.requestAnimationFrame(measure);
  };
  view.requestAnimationFrame(measure);
 }), 'The screen preview is not rendering. Keep Canvas open and retry export.');
}

export function screenCaptureDimensions(width: number, height: number, pixelRatio = 2) {
 if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('The screen has invalid export dimensions.');
 width = Math.round(width); height = Math.round(height);
 if (width * height * pixelRatio ** 2 > 40_000_000 || Math.max(width, height) * pixelRatio > 16384) throw new Error('This screen is too large to export at 2× resolution. Reduce its frame dimensions and retry.');
 return { width, height, pixelRatio };
}
