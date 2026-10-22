import { withProjectRoute, projectAccessResponse, ownedProjectWhere } from '@/lib/server/project-access';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const POST = withProjectRoute(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { thumbnail } = await request.json();

    if (!thumbnail) {
      return NextResponse.json({ error: "Missing thumbnail data" }, { status: 400 });
    }

    // H4: Limit thumbnail data URL size (500KB)
    const MAX_THUMBNAIL_SIZE = 500 * 1024;
    if (typeof thumbnail !== "string" || thumbnail.length > MAX_THUMBNAIL_SIZE) {
      return NextResponse.json(
        { error: `Thumbnail too large. Maximum size is ${MAX_THUMBNAIL_SIZE / 1024}KB.` },
        { status: 400 }
      );
    }

    await prisma.project.update({
      where: await ownedProjectWhere(id),
      data: { thumbnail },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    console.error("Failed to update project thumbnail:", error);
    return NextResponse.json({ error: "Failed to update thumbnail" }, { status: 500 });
  }
});
