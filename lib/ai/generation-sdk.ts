import { streamText as sdkStreamText, generateText as sdkGenerateText } from 'ai';
import { AI_MAX_OUTPUT_TOKENS } from '@/lib/ai/fixed-model';
export { Output } from 'ai';

// Preserve SDK generic signatures. Every application generation call uses this
// boundary so retries/output caps cannot be re-enabled by route defaults.
export const streamText = ((options: Parameters<typeof sdkStreamText>[0]) => sdkStreamText({
  ...options, maxRetries: 0, maxOutputTokens: Math.min(options.maxOutputTokens ?? AI_MAX_OUTPUT_TOKENS, AI_MAX_OUTPUT_TOKENS),
})) as typeof sdkStreamText;
export const generateText = ((options: Parameters<typeof sdkGenerateText>[0]) => sdkGenerateText({
  ...options, maxRetries: 0, maxOutputTokens: Math.min(options.maxOutputTokens ?? AI_MAX_OUTPUT_TOKENS, AI_MAX_OUTPUT_TOKENS),
})) as typeof sdkGenerateText;
