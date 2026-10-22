import { ownedProjectWhere } from '@/lib/server/project-access';
import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { NextRequest, NextResponse } from "next/server";
import {
  getLanguageModel,
  getFallbackModel,
  ProviderKey,
} from "@/lib/ai/provider-registry";
import { createStreamResponse } from "@/lib/ai/route-utils";
import { prisma } from "@/lib/db";
import { streamText } from "ai";
import { buildRedesignPrompt, REDESIGN_SYSTEM_PROMPT } from "@/lib/ai/redesign-context";

export const POST=withPersonalProvider(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userMessage, generatedUIId, currentHTML, projectId, streamId } = body;
    const activeStreamId = streamId || generatedUIId;

    if (!userMessage || !generatedUIId || !currentHTML || !projectId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: userMessage, generatedUIId, currentHTML, projectId!",
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: await ownedProjectWhere(projectId),
      include: { settings: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found!" },
        { status: 404 },
      );
    }

    // Resolve model
    let model;
    try {
      const settings = project.settings;
      if (settings?.provider && settings?.model) {
        model = getLanguageModel(
          settings.provider as ProviderKey,
          settings.model,
        );
      } else {
        model = getFallbackModel();
      }
    } catch (err) {
      console.warn("Failed to resolve project model, using fallback:", err);
      model = getFallbackModel();
    }

    const userPrompt = buildRedesignPrompt({
      userMessage,
      currentHTML,
      originalStyleReference: body.originalStyleReference,
      designContext: body.designContext,
      viewportWidth: body.viewportWidth,
    });

    const createGeneration = (candidate: Parameters<typeof streamText>[0]["model"]) => streamText({
      maxRetries: 0,
      abortSignal: request.signal,
      model: candidate,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
      system: REDESIGN_SYSTEM_PROMPT,
      temperature: 0.7,
    });

    let result = createGeneration(model as Parameters<typeof streamText>[0]["model"]);
    let providerAttempts = 1;
    async function* checkedStream() {
      let emittedText = false;
      try {
        for await (const part of result.fullStream) {
          if (part.type === "error") throw part.error;
          if (part.type === "text-delta") { emittedText = true; yield part.text; }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
        const busy = status === 503 || /high demand|overload|temporarily unavailable|no longer available|not found/i.test(message);
        if (emittedText || !busy || project?.settings?.provider !== "google") throw error;
        const fallbackId = process.env.GOOGLE_REDESIGN_FALLBACK_MODEL || "gemini-3.5-flash-lite";
        if (project.settings.model?.replace(/^google\//, "") === fallbackId) throw error;
        providerAttempts = 2;
        result = createGeneration(getLanguageModel("google", fallbackId) as Parameters<typeof streamText>[0]["model"]);
        for await (const part of result.fullStream) {
          if (part.type === "error") throw part.error;
          if (part.type === "text-delta") yield part.text;
        }
      }
    }
    return createStreamResponse(checkedStream(), "text/event-stream; charset=utf-8", activeStreamId);
  } catch (error) {
    console.error("Workflow redesign API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process workflow redesign request!",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
