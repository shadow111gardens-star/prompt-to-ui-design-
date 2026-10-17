"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadProjectStyleGuide } from "@/lib/load-project-style-guide";
import DesignTokensEditor from "@/components/canvas/shapes/generatedui/design-tokens-editor";
import { useAppDispatch } from "@/redux/store";
import {
  loadStyleGuideStart,
  loadStyleGuideSuccess,
  loadStyleGuideFailure,
} from "@/redux/slice/style-guide";

export default function DesignSystemPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project") || "";
  const dispatch = useAppDispatch();
  const [loadedProject, setLoadedProject] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!projectId) return;

    setLoadedProject("");
    setLoadError("");
    dispatch(loadStyleGuideStart());
    const request = loadProjectStyleGuide(projectId, {
      onSuccess: (guide) => {
        dispatch(loadStyleGuideSuccess(guide));
        setLoadedProject(projectId);
      },
      onError: () => {
        dispatch(loadStyleGuideFailure("Failed to load style guide"));
        setLoadError("Could not load this project’s design system. Please reload.");
      },
      reportError: (error) => console.error("Failed to load project design system:", error),
    });
    return () => request.cancel();
  }, [dispatch, projectId]);

  return (
    <div className="h-screen w-screen flex flex-col pt-16 bg-background overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col p-6">
        <div className="flex items-center justify-between pb-2 shrink-0">
          <div>
            <h1 className="text-3xl lg:text-left text-center font-bold text-foreground">
              Design System & Tokens
            </h1>
            <p className="text-muted-foreground text-center lg:text-left">
              Configure and preview the brand style tokens and markdown
              configurations.
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0 mt-4 bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {loadedProject === projectId && projectId ? <DesignTokensEditor key={projectId} projectId={projectId} /> : <p className="p-6">{loadError || (projectId ? "Reading project screens…" : "Select a project to view its design system.")}</p>}
        </div>
      </div>
    </div>
  );
}
