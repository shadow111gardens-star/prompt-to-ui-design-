import { withProjectRoute, projectAccessResponse } from '@/lib/server/project-access';
import { NextResponse } from "next/server";
import { getProjectStyleGuide, updateProjectStyleGuide } from "@/lib/db/projects";

export const GET = withProjectRoute(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const styleGuide = await getProjectStyleGuide(id);
    return NextResponse.json({ styleGuide });
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    console.error("Error fetching style guide:", error);
    return NextResponse.json(
      { error: "Failed to fetch style guide" },
      { status: 500 }
    );
  }
});

export const PATCH = withProjectRoute(async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { styleGuide } = body;
    if (!styleGuide) {
      return NextResponse.json(
        { error: "Style guide is required" },
        { status: 400 }
      );
    }
    const result = await updateProjectStyleGuide(id, styleGuide);
    return NextResponse.json(result);
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    console.error("Error updating style guide:", error);
    return NextResponse.json(
      { error: "Failed to update style guide" },
      { status: 500 }
    );
  }
});

export const PUT = withProjectRoute(async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const styleGuide = body && body.styleGuide !== undefined ? body.styleGuide : body;

    if (!styleGuide) {
      return NextResponse.json(
        { error: "Style guide is required" },
        { status: 400 }
      );
    }
    const result = await updateProjectStyleGuide(id, styleGuide);
    return NextResponse.json(result);
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    console.error("Error updating style guide via PUT:", error);
    return NextResponse.json(
      { error: "Failed to update style guide" },
      { status: 500 }
    );
  }
});

