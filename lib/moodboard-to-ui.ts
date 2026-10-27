import { reportSavedCredits } from '@/lib/billing/client';
import type { AppStore } from '@/redux/store';
import { addGeneratedUI, selectShape, clearSelection, updateShape, type Shape, type GeneratedUIShape } from '@/redux/slice/shapes';
import { restoreViewport } from '@/redux/slice/viewport';
import { cleanStreamingHtml, parseSSEStream } from '@/lib/stream-utils';
import { identifyHtmlElements, scanHtmlTags } from '@/lib/element-editing';

type CanvasStore = Pick<AppStore, 'getState' | 'dispatch'>;
export const MOODBOARD_VIEWPORTS = { web: { width: 1600, height: 900 }, tablet: { width: 768, height: 1024 }, mobile: { width: 375, height: 812 } };

export function moodboardCanvasHTML(source: string) {
  const html = cleanStreamingHtml(source);
  const tags = scanHtmlTags(html).filter(tag => !tag.close);
  const layout = tags.some(tag => /^(main|section|article|div|form)$/.test(tag.tag));
  const components = tags.filter(tag => /^(h[1-6]|p|button|nav|input|label|li|a|table|select|textarea)$/.test(tag.tag));
  if (!layout || components.length < 2 || !html.includes('>')) throw new Error('The model did not return an editable UI. Select a vision-capable coding model and try again; no screen was added.');
  return identifyHtmlElements(html);
}

export async function saveMoodboardCanvas(store: CanvasStore, projectId: string, signal?: AbortSignal) {
  const state = store.getState();
  if (state.shapes.activeProjectId !== projectId) throw new Error('The active project changed. Return to the original project before saving.');
  const response = await fetch('/api/autosave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ projectId, shapesData: state.shapes, viewportData: { scale: state.viewport.scale, translate: state.viewport.translate } }) });
  if (!response.ok) throw new Error('The screen was added to the canvas, but saving failed. Retry saving before leaving this page.');
  await reportSavedCredits(response);
}

export class MoodboardSaveError extends Error {
  constructor(public screenId: string, cause: unknown) { super(cause instanceof Error ? cause.message : 'Saving failed. Retry saving before leaving.'); }
}

export async function generateMoodboardScreen(options: { store: CanvasStore; projectId: string; imageIds: string[]; prompt: string; device: keyof typeof MOODBOARD_VIEWPORTS; signal: AbortSignal; onProgress: (text: string) => void }) {
  const { store, projectId, signal } = options;
  if (store.getState().shapes.activeProjectId !== projectId) throw new Error('Wait for this project to finish loading before generating.');
  const streamId = crypto.randomUUID();
  const body = new FormData();
  body.set('projectId', projectId);body.set('generationMode', 'moodboard');body.set('moodboardImageIds', JSON.stringify(options.imageIds));
  body.set('prompt', options.prompt.trim() || 'Create a new polished application interface inspired by these visual references.');
  body.set('deviceType', options.device);body.set('streamId', streamId);
  const response = await fetch('/api/generate', { method: 'POST', body, signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.details || error?.error || `Generation failed (${response.status}). Check the selected provider and try again.`);
  }
  if (!response.body) throw new Error('The provider returned no generation stream. Retry with an image-capable model.');
  const source = await parseSSEStream(response.body.getReader(), streamId, () => options.onProgress('Generating editable components…'));
  signal.throwIfAborted();
  const html = moodboardCanvasHTML(source);
  if (store.getState().shapes.activeProjectId !== projectId) throw new Error('The active project changed. The result was not added to a different project.');
  const screens = (Object.values(store.getState().shapes.shapes.entities) as (Shape | undefined)[]).filter((shape): shape is GeneratedUIShape => shape?.type === 'generatedui');
  const x = Math.max(0, ...screens.map(shape => shape.x + shape.w)) + 80, y = screens[0]?.y ?? 80;
  const size = MOODBOARD_VIEWPORTS[options.device];
  store.dispatch(addGeneratedUI({ id: streamId, x, y, w: size.width, h: size.height, sourceFrameId: '', isWorkflowPage: true, uiSpecData: html, isGenerating: false }));
  store.dispatch(updateShape({ id: streamId, patch: { screenName: 'Moodboard design' } }));
  store.dispatch(clearSelection());store.dispatch(selectShape(streamId));
  store.dispatch(restoreViewport({ scale: options.device === 'web' ? 0.5 : 0.8, translate: { x: 60 - x * (options.device === 'web' ? 0.5 : 0.8), y: 60 - y * (options.device === 'web' ? 0.5 : 0.8) } }));
  if (!store.getState().shapes.shapes.entities[streamId]) throw new Error('Could not add the generated screen to this canvas.');
  options.onProgress('Screen added. Saving project…');
  try { await saveMoodboardCanvas(store, projectId, signal); }
  catch (error) { throw new MoodboardSaveError(streamId, error); }
  return streamId;
}
