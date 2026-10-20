import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const settings = await prisma.projectSettings.findMany();
    return NextResponse.json({ success: true, count: settings.length, settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load settings" }, { status: 500 });
  }
}
