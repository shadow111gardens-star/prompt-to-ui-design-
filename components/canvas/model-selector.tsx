"use client";
import { Sparkles } from 'lucide-react';
import { FIXED_AI_LABEL } from '@/lib/ai/fixed-model';
export default function ModelSelector({ configurationError }: { configurationError?: string | null }) {
  return <div className="flex max-w-sm flex-col gap-1">
    <span aria-label="Selected AI model" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground"><Sparkles className="size-3.5 text-primary" />{FIXED_AI_LABEL}</span>
    {configurationError && <span role="alert" className="text-xs text-destructive">{configurationError}</span>}
  </div>;
}
