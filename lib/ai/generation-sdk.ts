import { streamText as sdkStreamText, generateText as sdkGenerateText } from 'ai';
export { Output } from 'ai';

// Preserve SDK generic signatures. Every application generation call uses this
// boundary so automatic retries remain disabled. No application token cap is set.
export const streamText = ((options: Parameters<typeof sdkStreamText>[0]) => sdkStreamText({
  ...options, maxRetries: 0,
})) as typeof sdkStreamText;
export const generateText = ((options: Parameters<typeof sdkGenerateText>[0]) => sdkGenerateText({
  ...options, maxRetries: 0,
})) as typeof sdkGenerateText;
