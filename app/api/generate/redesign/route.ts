import { ownedProjectWhere } from '@/lib/server/project-access';
import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { NextRequest, NextResponse } from "next/server";
import {
  getLanguageModel,
  getVisionLanguageModel,
  getFallbackModel,
  ProviderKey,
} from "@/lib/ai/provider-registry";
import { createStreamResponse } from "@/lib/ai/route-utils";
import { prisma } from "@/lib/db";
import { streamText } from "ai";
import { buildRedesignPrompt, REDESIGN_SYSTEM_PROMPT } from "@/lib/ai/redesign-context";
import fs from "fs/promises";
import path from "path";
import { projectChatResponse } from "@/lib/ai/project-chat-response";
import { designTargetInstruction, projectDesignTarget } from '@/lib/design-target';
import { setGenerationDesignTarget } from '@/lib/ai/usage-logging';

export const POST=withPersonalProvider(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.mode === "project-chat") return projectChatResponse(request, body);
    const {
      userMessage,
      generatedUIId,
      currentHTML,
      wireframeSnapshot,
      projectId,
      streamId,
    } = body;
    const activeStreamId = streamId || generatedUIId;

    if (!userMessage || !generatedUIId || !projectId) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: userMessage, generatedUIId, & projectId!",
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: await ownedProjectWhere(projectId),
      include: { settings: true, inspirationImages: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found!" },
        { status: 404 },
      );
    }
    setGenerationDesignTarget(projectDesignTarget(project.sketchesData));



    // Read style guide
    const guide = project.styleGuide
      ? JSON.parse(project.styleGuide)
      : { colorSections: [], typographySections: [] };

    const colors = guide.colorSections || [];
    const typography = guide.typographySections || [];

    // Load local inspiration images and convert to Uint8Array
    const visionImages: Array<{ type: "image"; image: Uint8Array }> = [];
    for (const img of project.inspirationImages) {
      try {
        const absolutePath = path.join(
          process.cwd(),
          "data",
          "uploads",
          img.filePath,
        );
        const fileBuffer = await fs.readFile(absolutePath);
        visionImages.push({
          type: "image" as const,
          image: new Uint8Array(fileBuffer),
        });
      } catch (err) {
        console.warn(
          "Failed to read inspiration image for AI:",
          img.filePath,
          err,
        );
      }
    }

    const userPrompt = buildRedesignPrompt({
      userMessage,
      currentHTML,
      originalStyleReference: typeof body.originalStyleReference === "string" ? body.originalStyleReference : "",
      designContext: typeof body.designContext === "string" ? body.designContext : "",
      viewportWidth: body.viewportWidth,
      fallbackGuide: !currentHTML ? { colors, typography } : undefined,
    });

    // Process wireframe snapshot if available
    let wireframeImage = null;
    if (wireframeSnapshot) {
      const rawBase64 = wireframeSnapshot.replace(
        /^data:image\/\w+;base64,/,
        "",
      );
      wireframeImage = new Uint8Array(Buffer.from(rawBase64, "base64"));
    }

    const messagesContent: Array<{ type: "text"; text: string } | { type: "image"; image: Uint8Array }> = [
      {
        type: "text",
        text: userPrompt,
      },
    ];

    if (wireframeImage) {
      messagesContent.push({
        type: "image",
        image: wireframeImage,
      });
    }

    messagesContent.push(...visionImages);

    // Resolve model based on presence of image input
    const hasImages = visionImages.length > 0 || !!wireframeImage;
    let model;
    try {
      const settings = project.settings;
      if (settings?.provider && settings?.model) {
        if (hasImages) {
          model = getVisionLanguageModel(
            settings.provider as ProviderKey,
            settings.model,
          );
        } else {
          model = getLanguageModel(
            settings.provider as ProviderKey,
            settings.model,
          );
        }
      } else {
        model = getFallbackModel();
      }
    } catch (err) {
      console.warn("Failed to resolve project model, using fallback:", err);
      model = getFallbackModel();
    }

    const createGeneration = (candidate: Parameters<typeof streamText>[0]["model"]) => streamText({
      maxRetries: 0,
      abortSignal: request.signal,
      model: candidate,
      messages: [
        {
          role: "user",
          content: messagesContent,
        },
      ],
      system: REDESIGN_SYSTEM_PROMPT+designTargetInstruction(projectDesignTarget(project.sketchesData)),
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
    return createStreamResponse(checkedStream(), "text/event-stream; charset=utf-8", activeStreamId, async () => ({
      providerAttempts,
      usage: await result.totalUsage,
      finishReason: await result.finishReason,
    }));
  } catch (error) {
    console.error("Redesign API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process redesign request!",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
