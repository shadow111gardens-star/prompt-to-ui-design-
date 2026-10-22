import { withProjectRoute, projectAccessResponse, ownerFilter } from '@/lib/server/project-access';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const GET = withProjectRoute(async function GET(request: NextRequest) {
  try {
    const settings = await prisma.projectSettings.findMany({ where: { project: await ownerFilter() } });
    return NextResponse.json({ success: true, count: settings.length, settings });
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    return NextResponse.json({ error: "Unable to load settings" }, { status: 500 });
  }
});
