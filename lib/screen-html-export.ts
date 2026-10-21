import { makeImagesPortable } from '@/lib/images/portable-assets';
import { waitForScreenRender, embedScreenFonts } from '@/lib/screen-render-readiness';

/** Serialize the live iframe, including compiled Tailwind, custom head and injected tokens. */
export async function renderedScreenHTML(shapeId: string, title: string): Promise<string> {
 const frame = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[data-openui-shape]')).find(node => node.dataset.openuiShape === shapeId);
 const doc = frame?.contentDocument, root = doc?.getElementById('mockup-root');
 if (!doc || !root || !root.childElementCount) throw new Error('Open Canvas and wait for this screen to render before exporting HTML.');
 await waitForScreenRender(root);
 const { getFontEmbedCSS } = await import('html-to-image');
 const fontCSS = await embedScreenFonts(root, node => getFontEmbedCSS(node));
 await waitForScreenRender(root);
 const clone = doc.documentElement.cloneNode(true) as HTMLElement;
 clone.querySelectorAll('[data-openui-editor],.sandbox-toast-container,.sandbox-dialog-backdrop').forEach(node => node.remove());
 // Keep the generated document's scripts/noscript fallback. Only discard the
 // editor's surrounding iframe shell scripts, not the exported app's behavior.
 clone.querySelectorAll('script,noscript').forEach(node => {
  if (!node.closest('#mockup-root')) node.remove();
 });
 // CSSOM-inserted rules need not appear in style.textContent (e.g. utility CSS).
 const sourceStyles = doc.querySelectorAll('style'), targetStyles = clone.querySelectorAll('style');
 sourceStyles.forEach((style, index) => {
  try { if (style.sheet && targetStyles[index]) targetStyles[index].textContent = Array.from(style.sheet.cssRules).map(rule => rule.cssText).join('\n'); } catch { /* Original text and external links are retained. */ }
 });
 const embeddedFonts = doc.createElement('style'); embeddedFonts.setAttribute('data-openui-export-fonts', ''); embeddedFonts.textContent = fontCSS; clone.querySelector('head')?.appendChild(embeddedFonts);
 clone.querySelector('title')?.remove();
 const titleNode = doc.createElement('title'); titleNode.textContent = title; clone.querySelector('head')?.appendChild(titleNode);
 // Preserve the exact live viewport as export metadata without rewriting the layout.
 const viewport = doc.createElement('meta'); viewport.name = 'openui-frame'; viewport.content = `${frame!.clientWidth}x${frame!.clientHeight}`; clone.querySelector('head')?.appendChild(viewport);
 return makeImagesPortable('<!DOCTYPE html>\n' + clone.outerHTML);
}
