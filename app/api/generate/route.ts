import { ownedProjectWhere } from '@/lib/server/project-access';
import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { prompts, deviceContexts } from "@/prompts";
import {
  getLanguageModel,
  getVisionLanguageModel,
  getFallbackModel,
  ProviderKey,
} from "@/lib/ai/provider-registry";
import { createStreamResponse } from "@/lib/ai/route-utils";
import { prisma } from "@/lib/db";
import { streamText } from "@/lib/ai/generation-sdk";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getMoodboardModel } from '@/lib/ai/moodboard-model';
import { readMoodboardReferences } from '@/lib/moodboard-references';
import { designTargetInstruction, projectDesignTarget } from '@/lib/design-target';
import { setGenerationDesignTarget } from '@/lib/ai/usage-logging';

export const POST=withPersonalProvider(async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const projectId = formData.get("projectId") as string;
    const prompt = (formData.get("prompt") as string) || "";
    const deviceType = (formData.get("deviceType") as string) || "custom";
    const includeDrawingStr = (formData.get("includeDrawing") as string) || "false";
    const includeDrawing = includeDrawingStr === "true";
    const selectedImageIdsStr = (formData.get("selectedImageIds") as string) || "[]";
    const temperatureStr = (formData.get("temperature") as string) || "0.7";
    const temperature = Math.min(1.5, Math.max(0.1, parseFloat(temperatureStr) || 0.7));
    const variantIndex = parseInt((formData.get("variantIndex") as string) || "0", 10);
    const variantCountTotal = parseInt((formData.get("variantCount") as string) || "1", 10);
    const streamId = (formData.get("streamId") as string) || "gen-ui";
    const moodboardMode = formData.get('generationMode') === 'moodboard';
    let moodboardIds: string[] = [];
    if (moodboardMode) {
      try {
        const ids: unknown = JSON.parse(String(formData.get('moodboardImageIds') || '[]'));
        if (!Array.isArray(ids) || !ids.length || ids.length > 5 || ids.some(id => typeof id !== 'string' || !id || id.length > 200)) throw new Error();
        moodboardIds = ids;
      } catch { return NextResponse.json({ error: 'Select one to five saved Moodboard images.' }, { status: 400 }); }
      if (prompt.length > 4000) return NextResponse.json({ error: 'Keep the description under 4,000 characters.' }, { status: 400 });
    }

    let selectedImageIds: string[] = [];
    try {
      selectedImageIds = JSON.parse(selectedImageIdsStr);
    } catch (e) {
      console.warn("Failed to parse selectedImageIds:", e);
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "No projectId provided!" },
        { status: 400 },
      );
    }

    if (includeDrawing && !imageFile) {
      return NextResponse.json(
        { error: "No image file provided when drawing context is selected!" },
        { status: 400 },
      );
    }

    // Validate file type if file is present
    if (imageFile && !imageFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Invalid file type. Only images are allowed." },
        { status: 400 },
      );
    }

    const imageBuffer = imageFile ? await imageFile.arrayBuffer() : null;
    const project = await prisma.project.findUnique({
      where: await ownedProjectWhere(projectId),
      include: { settings: true, inspirationImages: true, moodBoardImages: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found!" },
        { status: 404 },
      );
    }
    setGenerationDesignTarget(projectDesignTarget(project.sketchesData));



    // Read style guide and Design.md
    const guide = project.styleGuide
      ? JSON.parse(project.styleGuide)
      : null;

    const colors = guide?.colorSections || [];
    const typography = guide?.typographySections || [];
    const designMd = guide?.designSystemDetails?.designMd || "";

    // Load local inspiration images and convert to Uint8Array (filtered by selectedImageIds)
    const visionImages: Array<{ type: "image"; image: Uint8Array; mediaType?: string }> = [];
    for (const img of moodboardMode ? [] : project.inspirationImages) {
      // If user selected specific images, filter by them
      if (!selectedImageIds.includes(img.id)) {
        continue;
      }
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
    const hasImages = !!imageBuffer || visionImages.length > 0;
    let model;
    if (moodboardMode) {
      try {
        const selected = await getMoodboardModel(project.settings);
        visionImages.push(...await readMoodboardReferences(project.moodBoardImages, moodboardIds, selected.provider));
        model = selected.model;
      } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Moodboard image input is unavailable.' }, { status: 422 }); }
    } else {
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
        console.warn(`[Generate] project.settings is missing or incomplete. Settings: ${JSON.stringify(settings)}`);
        model = getFallbackModel();
      }
    } catch (err) {
      console.warn("[Generate] Failed to resolve project model, using fallback. Error details:", err);
      model = getFallbackModel();
    }
    }

    const systemPrompt = prompts.generativeUi.system;

    // Add variant diversity instruction for non-first variants
    const variantDiversityPrompt = variantIndex > 0
      ? `\n\nIMPORTANT: This is variant #${variantIndex + 1} of ${variantCountTotal}. Generate a DISTINCTLY DIFFERENT layout variation from the other variants. Explore alternative:\n- Component arrangements and visual hierarchies\n- Layout patterns (grid vs stack vs sidebar vs split)\n- Spacing rhythms and section ordering\n- Visual weight distribution\nMaintain the same content requirements and style system, but create a unique structural interpretation.`
      : "";

    const styleConstraints = designMd
      ? designMd
      : `Use the user-provided styleGuide colors and typography for all visual decisions:
         colors: ${colors.map((color: any) => color.swatches.map((swatch: any) => `${swatch.name}: ${swatch.hexColor}, ${swatch.description}`).join(", ")).join("; ")}
         typography: ${typography.map((typo: any) => typo.styles.map((style: any) => `${style.name}: ${style.fontFamily}, size ${style.fontSize}`).join(", ")).join("; ")}
         enforce WCAG AA contrast (>=4.5:1), and if any token is missing fall back to neutral light defaults.`;

    // Remove indentation only; keep every device rule and numerical constraint.
    const deviceContext = (deviceContexts[deviceType] || "").split('\n').map(line => line.trim()).join('\n');

    const moodboardInstruction = `\nMOODBOARD-TO-UI: Analyze all attached references for layout, visual hierarchy, palette, typography, spacing, borders, imagery and component style. Create a NEW responsive interface inspired by their shared visual direction and the user's optional description. These design references are inspiration only: never map them into image slots. Do not copy a reference pixel-for-pixel, and do not render the Moodboard itself or use reference screenshots as the resulting UI. Build real editable HTML elements, CSS and SVG components, not a single screenshot/image. Return only complete runnable HTML. No analysis prose. For this task the references provide primary visual direction; preserve explicit user requirements.`;
    const messagesContent: Array<{ type: "text"; text: string } | { type: "image"; image: Uint8Array; mediaType?: string }> = [
      {
        type: "text",
        text: 'USER REQUIREMENTS (verbatim):\n' + (prompt || 'Generate a modern interface based on style system.'),
      },
      { type: 'text', text: 'DEVICE RULES: ' + deviceType + '\n' + deviceContext },
      { type: 'text', text: 'DESIGN SYSTEM:\n' + styleConstraints },
    ];

    if (imageBuffer) {
      messagesContent.push({
        type: "image",
        image: new Uint8Array(imageBuffer),
      });
    }

    // Add selected visionImages
    messagesContent.push(...visionImages);

    const result = streamText({
      maxRetries: 0,
      abortSignal: request.signal,
      model: model as Parameters<typeof streamText>[0]["model"],
      messages: [
        {
          role: "user",
          content: messagesContent,
        },
      ],
      system: systemPrompt + variantDiversityPrompt + (moodboardMode ? moodboardInstruction : '') + designTargetInstruction(projectDesignTarget(project.sketchesData)),
      temperature: temperature,
    });

    async function* checkedTextStream() {
      for await (const part of result.fullStream) {
        if (part.type === "error") throw part.error;
        if (part.type === "text-delta") yield part.text;
      }
    }
    return createStreamResponse(checkedTextStream(), "text/event-stream; charset=utf-8", streamId, async () => ({
      usage: await result.totalUsage,
      finishReason: await result.finishReason,
      providerAttemptsLimit: 1,
    }));
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate UI Design.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
