"use client";
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import type { AppStore } from '@/redux/store';
import type { MoodBoardImage } from '@/hooks/use-styles';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { generateMoodboardScreen, saveMoodboardCanvas, MoodboardSaveError, MOODBOARD_VIEWPORTS } from '@/lib/moodboard-to-ui';

export default function GenerateMoodboardUI({ images, projectId }: { images: MoodBoardImage[]; projectId: string }) {
  const store = useStore.withTypes<AppStore>()();
  const router = useRouter(), pathname = usePathname();
  const [open, setOpen] = useState(false), [prompt, setPrompt] = useState(''), [device, setDevice] = useState<keyof typeof MOODBOARD_VIEWPORTS>('web');
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState(''), [unsaved, setUnsaved] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const saved = images.filter(image => image.uploaded && !image.uploading && !image.error && image.storageId);
  const ready = !!projectId && saved.length > 0 && !images.some(image => image.uploading || !image.uploaded || image.error);
  function goToCanvas() { router.push(pathname.replace(/\/style-guide\/?$/, '/canvas') + '?project=' + encodeURIComponent(projectId)); }
  async function generate() {
    if (request.current || (!ready && !unsaved)) return;
    const controller = new AbortController();request.current = controller;
    setBusy(true);setError('');setProgress(unsaved ? 'Saving project…' : 'Loading saved references and checking image support…');
    try {
      if (unsaved) await saveMoodboardCanvas(store, projectId, controller.signal);
      else await generateMoodboardScreen({ store, projectId, imageIds: saved.map(image => image.storageId!), prompt, device, signal: controller.signal, onProgress: setProgress });
      setUnsaved(null);setProgress('Design added to your canvas and saved.');goToCanvas();
    } catch (reason) {
      if (reason instanceof MoodboardSaveError) setUnsaved(reason.screenId);
      setError(controller.signal.aborted ? reason instanceof MoodboardSaveError ? 'The screen was added, but saving was cancelled. Retry saving before leaving.' : 'Generation cancelled. No completed result was reported as successful.' : reason instanceof Error ? reason.message : 'Generation failed. Check your model settings and retry.');
      setProgress('');
    } finally { request.current = null;setBusy(false); }
  }
  return <>
    <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)} disabled={!images.length}><Sparkles className="h-4 w-4" />Generate UI from Moodboard</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy && !unsaved) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>Generate UI from Moodboard</DialogTitle>
        <DialogDescription>Create a new editable screen inspired by your saved references using your configured image-capable model. Your current Style Guide stays unchanged.</DialogDescription>
        <p className="text-sm text-muted-foreground">{saved.length} saved reference{saved.length === 1 ? '' : 's'} ready</p>
        {!ready && !unsaved && <p role="status" className="text-sm text-muted-foreground">Upload at least one image and wait for all uploads to finish. Remove or re-upload failed images. PNG/JPEG references work across supported providers.</p>}
        <label className="space-y-2 text-sm">What would you like to build? <span className="text-muted-foreground">(optional)</span><textarea aria-label="Describe the UI to generate" rows={3} value={prompt} disabled={busy || !!unsaved} onChange={event => setPrompt(event.target.value)} placeholder="Create a modern SaaS analytics dashboard inspired by these references." className="w-full rounded-lg border bg-background p-3" /></label>
        <label className="space-y-2 text-sm">Screen size<select aria-label="Moodboard UI screen size" value={device} disabled={busy || !!unsaved} onChange={event => setDevice(event.target.value as keyof typeof MOODBOARD_VIEWPORTS)} className="block w-full rounded-lg border bg-background p-2"><option value="web">Desktop · 1600 × 900</option><option value="tablet">Tablet · 768 × 1024</option><option value="mobile">Mobile · 375 × 812</option></select></label>
        {progress && <p role="status" className="text-sm text-muted-foreground">{progress}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">{busy ? <Button variant="outline" onClick={() => request.current?.abort()}>Cancel</Button> : !unsaved && <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>}<Button disabled={busy || (!ready && !unsaved)} onClick={() => void generate()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{unsaved ? 'Retry saving design' : 'Generate UI from Moodboard'}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
