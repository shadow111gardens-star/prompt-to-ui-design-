"use client";
import { makeImagesPortable } from '@/lib/images/portable-assets';
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { downloadBlob } from "@/lib/frame-snapshot";

type Framework = "react" | "vue" | "angular" | "svelte";

const FRAMEWORK_META: Record<
  Framework,
  { label: string; ext: string; icon: string; color: string }
> = {
  react: { label: "React", ext: ".tsx", icon: "⚛️", color: "text-cyan-400" },
  vue: { label: "Vue", ext: ".vue", icon: "🟢", color: "text-emerald-400" },
  angular: { label: "Angular", ext: ".ts", icon: "🅰️", color: "text-red-400" },
  svelte: {
    label: "Svelte",
    ext: ".svelte",
    icon: "🟧",
    color: "text-orange-400",
  },
};

type CodePreviewDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  framework: Framework;
  isStreaming: boolean;
  error?: string;
  onRetry: () => void;
};

export default function CodePreviewDialog({
  isOpen,
  onClose,
  code,
  framework,
  isStreaming,
  error,
  onRetry,
}: CodePreviewDialogProps) {
  const meta = FRAMEWORK_META[framework];

  // Strip markdown code fences if present
  const cleanCode = React.useMemo(() => {
    let cleaned = code;
    // Remove opening fence (```tsx, ```vue, etc.)
    cleaned = cleaned.replace(/^```\w*\s*\n?/, "");
    // Remove closing fence
    cleaned = cleaned.replace(/\n?```\s*$/, "");
    return cleaned.trim();
  }, [code]);

  const handleCopy = () => {
    makeImagesPortable(cleanCode).then(copyToClipboard)
      .then(() => {
        toast.success(`${meta.label} code copied to clipboard!`);
      })
      .catch(() => {
        toast.error("Failed to copy code.");
      });
  };

  const handleDownload = async () => {
    try{const portable=await makeImagesPortable(cleanCode);
    const blob = new Blob([portable], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `component${meta.ext}`);
    toast.success(`${meta.label} file downloaded!`);
    }catch(error){toast.error(error instanceof Error?error.message:"Image export failed.");}
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-4xl min-w-0 max-h-[85vh] bg-background border border-border text-foreground rounded-2xl p-0 flex flex-col overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">
          {meta.label} Component Code Preview
        </DialogTitle>
        <DialogHeader className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span>{meta.icon}</span>
              <span className={meta.color}>{meta.label}</span>
              <span className="text-muted-foreground font-normal">
                Component
              </span>
              {isStreaming && (
                <Loader2
                  size={14}
                  className="animate-spin text-amber-500 ml-1"
                />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                disabled={isStreaming || !cleanCode}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <Copy size={12} className="mr-1" />
                Copy
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDownload}
                disabled={isStreaming || !cleanCode}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <Download size={12} className="mr-1" />
                Download{meta.ext}
              </Button>
              <button
                aria-label="Close code preview"
                onClick={onClose}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div role="alert" className="mx-4 mt-3 rounded-lg border border-destructive/30 p-3 text-sm">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">Retry conversion</Button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-4 pt-2">
          <pre className="bg-muted/40 dark:bg-zinc-900/60 border border-border/60 dark:border-zinc-800/60 rounded-xl p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-foreground/80 dark:text-zinc-300 min-h-[200px]">
            <code>
              {cleanCode ||
                (isStreaming ? "Generating..." : "No code generated yet.")}
            </code>
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { Framework };
