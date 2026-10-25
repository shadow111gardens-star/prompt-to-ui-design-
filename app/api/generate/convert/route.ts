import { ownedProjectWhere } from '@/lib/server/project-access';
import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { prepareElementConversionHtml } from "@/lib/element-editing";
import { NextRequest, NextResponse } from "next/server";
import {
  getLanguageModel,
  getFallbackModel,
  ProviderKey,
} from "@/lib/ai/provider-registry";
import { createResilientStreamResponse } from "@/lib/ai/resilient-stream";
import { prisma } from "@/lib/db";
import { streamText } from "@/lib/ai/generation-sdk";

const FRAMEWORK_PROMPTS: Record<string, string> = {
  react: `You are a senior React developer. Convert the given HTML + Tailwind CSS into a modern React functional component.

Rules:
- Use TypeScript (.tsx)
- Use React hooks (useState, useEffect, etc.) where appropriate
- Convert class to className
- Keep all Tailwind CSS classes exactly as-is
- Use semantic component names
- Add proper TypeScript types/interfaces for props
- Export the component as default
- Wrap the entire output in a single code block
- Do NOT include any import for React (React 18+ doesn't require it)
- Include necessary imports (e.g., useState from 'react')
- Make interactive elements functional (buttons, inputs, forms)`,

  vue: `You are a senior Vue.js developer. Convert the given HTML + Tailwind CSS into a Vue 3 Single File Component.

Rules:
- Use <script setup lang="ts"> with Composition API
- Keep all Tailwind CSS classes exactly as-is
- Use ref() and reactive() for state
- Use proper TypeScript types
- Wrap the entire output in a single code block
- Include <template>, <script setup>, and optionally <style> sections
- Make interactive elements functional`,

  angular: `You are a senior Angular developer. Convert the given HTML + Tailwind CSS into an Angular standalone component.

Rules:
- Use Angular 17+ standalone component syntax
- Keep all Tailwind CSS classes exactly as-is
- Use TypeScript with proper typing
- Include @Component decorator with inline template
- Use signals for reactive state where appropriate
- Wrap the entire output in a single code block
- Make interactive elements functional`,

  svelte: `You are a senior Svelte developer. Convert the given HTML + Tailwind CSS into a Svelte 5 component.

Rules:
- Use Svelte 5 runes ($state, $derived, $effect)
- Keep all Tailwind CSS classes exactly as-is
- Use TypeScript with <script lang="ts">
- Wrap the entire output in a single code block
- Include <script>, HTML template, and optionally <style> sections
- Make interactive elements functional`,
};

export const POST=withPersonalProvider(async function POST(request: NextRequest) {
  try {
    const rawText = await request.text();
    const body = JSON.parse(rawText);
    const { html, framework, projectId, streamId } = body;
    const activeStreamId = streamId || "convert-framework";

    if (!html || !framework || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: html, framework, projectId" },
        { status: 400 },
      );
    }

    if (!FRAMEWORK_PROMPTS[framework]) {
      return NextResponse.json(
        {
          error: `Unsupported framework: ${framework}. Supported: react, vue, angular, svelte`,
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
        console.warn(`[Generate Convert] project.settings is missing or incomplete. Settings: ${JSON.stringify(settings)}`);
        model = getFallbackModel();
      }
    } catch (err) {
      console.warn("[Generate Convert] Failed to resolve project model, using fallback. Error details:", err);
      model = getFallbackModel();
    }

    const systemPrompt = `${FRAMEWORK_PROMPTS[framework]}
Preserve all authored text, attributes, responsive rules and element-level style overrides.
Inline CSS declarations with !important must retain their priority: move them to a scoped CSS rule/class in the target framework when necessary. Never put !important inside React style-object values; React cannot apply those values correctly. Do not drop edited dimensions, colors, fonts or transforms.`;

    const userPrompt = `Convert this HTML + Tailwind CSS UI into a ${framework} component:

\`\`\`html
${prepareElementConversionHtml(html)}
\`\`\`

Generate a complete, production-ready ${framework} component. Output ONLY the code, no explanations.`;

    const generate = (candidate: Parameters<typeof streamText>[0]["model"]) => streamText({
      maxRetries: 0,
      abortSignal: request.signal,
      model: candidate,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: systemPrompt,
      temperature: 0.35,
    });

    return createResilientStreamResponse(generate, model as Parameters<typeof streamText>[0]["model"], activeStreamId, project.settings?.provider, project.settings?.model);
  } catch (error) {
    console.error("Convert API error:", error);
    return NextResponse.json(
      {
        error: "Failed to convert code.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
});
