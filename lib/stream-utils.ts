/**
 * Checks if a stream text chunk contains raw API syntax, status codes,
 * backend logs, or raw JSON structures that should be discarded.
 */
export function isValidStreamChunk(chunk: string): boolean {
  const trimmed = chunk.trim();
  if (!trimmed) return true;

  // Check for common API response headers or raw JSON dumps
  if (
    trimmed.includes("status: 200") ||
    trimmed.includes('"status": 200') ||
    trimmed.includes("status: 500") ||
    trimmed.includes("json: {") ||
    trimmed.startsWith("HTTP/") ||
    (trimmed.startsWith("{") && trimmed.includes('"products"')) ||
    (trimmed.startsWith("{") && trimmed.includes('"token"'))
  ) {
    return false;
  }

  // Check for regex patterns identifying status/JSON contamination
  const rawApiRegex = /(status:\s*\d+|json:\s*\{|\{\s*["']?products["']?)/i;
  if (rawApiRegex.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Progressive sanitizer to strip leading ```html or ``` and trailing ```
 * from HTML streams.
 */
export function cleanStreamingHtml(html: string): string {
  if (!html) return "";
  let cleaned = html.trimStart();
  // Strip leading ```html or ```
  cleaned = cleaned.replace(/^```[a-z][a-z0-9_-]*\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "");
  
  // Strip trailing ```
  let endCleaned = cleaned.trimEnd();
  if (endCleaned.endsWith("```")) {
    endCleaned = endCleaned.slice(0, -3).trimEnd();
  }
  return endCleaned;
}

/**
 * Decodes and parses an SSE-formatted readable stream.
 * Chunks are buffered to handle TCP fragmentation.
 * Only chunks matching the activeStreamId are kept.
 * Malformed packets are discarded; generated text is preserved verbatim.
 *
 * @param reader - The stream reader
 * @param activeStreamId - The stream identifier to validate against
 * @param onChunk - Callback invoked with the updated accumulated text
 * @returns The final accumulated text
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  activeStreamId: string,
  onChunk: (accumulated: string) => void
): Promise<string> {
  const decoder = new TextDecoder();
  let accumulatedText = "";
  let buffer = "";

  const processMessage = (message: string) => {
    const payload = message.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart()).join("\n");
    if (!payload) return;
    let parsed: { streamId?: string; type?: string; text?: unknown; error?: string; finishReason?: string; warnings?:unknown };
    try {
      parsed = JSON.parse(payload);
    } catch {
      return; // Ignore malformed packets, never errors from the consumer.
    }
    if (!parsed || parsed.streamId !== activeStreamId) return;
    if (parsed.type === "error") throw new Error(parsed.error || "UI generation failed. Please try again.");
    if(parsed.type==='image-status'){if(Array.isArray(parsed.warnings)&&typeof window!=='undefined'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('openui-image-status',{detail:parsed.warnings.filter(value=>typeof value==='string').slice(0,5)}));return;}
    if (parsed.type === "usage") {
      if (parsed.finishReason === "error") throw new Error("The AI provider failed to generate a design.");
      return;
    }
    if (typeof parsed.text === "string") {
      accumulatedText = parsed.type==='replace'?parsed.text:accumulatedText+parsed.text;
      onChunk(cleanStreamingHtml(accumulatedText));
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
        processMessage(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (done) {
        if (buffer.trim()) processMessage(buffer);
        break;
      }
    }
    if (!cleanStreamingHtml(accumulatedText).trim()) {
      throw new Error("The AI returned no design. Please try again or choose another model.");
    }
  } finally {
    reader.releaseLock();
  }

  return cleanStreamingHtml(accumulatedText);
}
