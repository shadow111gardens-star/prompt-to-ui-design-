import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { NextRequest, NextResponse } from "next/server";
import {
  getLanguageModel,
  getVisionLanguageModel,
  getFallbackModel,
  ProviderKey,
} from "@/lib/ai/provider-registry";
import { createResilientStreamResponse } from "@/lib/ai/resilient-stream";
import { prisma } from "@/lib/db";
import { streamText } from "ai";
import { prompts } from "@/prompts";
import { buildRedesignPrompt, REDESIGN_SYSTEM_PROMPT, summarizeScreenStyle } from "@/lib/ai/redesign-context";
import fs from "fs/promises";
import path from "path";

export const POST=withPersonalProvider(async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { generatedUIId, currentHTML, projectId, pageIndex, streamId } = body;
    const activeStreamId = streamId || generatedUIId;

    if (
      !generatedUIId ||
      !currentHTML ||
      !projectId ||
      pageIndex === undefined
    ) {
      // M5: Log only field presence, not full content
      console.log("Missing fields:", {
        hasGeneratedUIId: !!generatedUIId,
        hasCurrentHTML: !!currentHTML,
        hasProjectId: !!projectId,
        pageIndex,
      });
      return NextResponse.json(
        {
          error:
            "Missing required fields: generatedUIId, currentHTML, projectId & pageIndex!",
        },
        { status: 400 },
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { settings: true, inspirationImages: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found!" },
        { status: 404 },
      );
    }



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

    // Resolve model based on presence of image input
    const hasImages = visionImages.length > 0;
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

    // Define the page types for dynamic generation
    const pageTypes = [
      "Dashboard/Analytics page with charts, metrics, and KPIs",
      "Settings/Configuration page with preferences and account management",
      "User Profile page with personal information and activity",
      "Data Listing/Table page with search, filters, and pagination",
    ];

    const selectedPageType = pageTypes[pageIndex] || pageTypes[0];

    const userPrompt = buildRedesignPrompt({
      userMessage: `Create a NEW connected ${selectedPageType} for this application. Match the reference screen's exact app palette, fonts, radii, navigation and density. Keep it within ${body.viewportWidth || 375}px width. Fill all sections with real sample content, never blank charts or cards. Return one complete screen with its CSS.`,
      currentHTML,
      designContext: summarizeScreenStyle(currentHTML),
      viewportWidth: body.viewportWidth,
    });

    const messagesContent: any[] = [
      {
        type: "text",
        text: userPrompt,
      },
      ...visionImages,
    ];

    const generate = (candidate: Parameters<typeof streamText>[0]["model"]) => streamText({
      maxRetries: 0,
      abortSignal: request.signal,
      model: candidate,
      messages: [
        {
          role: "user",
          content: messagesContent,
        },
      ],
      system: REDESIGN_SYSTEM_PROMPT,
      temperature: 0.7,
    });

    return createResilientStreamResponse(generate, model as Parameters<typeof streamText>[0]["model"], activeStreamId, project.settings?.provider, project.settings?.model);
  } catch (error) {
    console.error("Workflow generation API error:", error);
    return NextResponse.json(
      {
        error: "Failed to process workflow generation request!",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
