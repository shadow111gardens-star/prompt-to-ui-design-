import { withProjectRoute, projectAccessResponse } from '@/lib/server/project-access';
import { NextResponse } from "next/server";
import { getAllProjects, createProject } from "@/lib/db/projects";

export const GET = withProjectRoute(async function GET(_request: Request) {
  try {
    const projects = await getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
});

export const POST = withProjectRoute(async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createProject(body);
    return NextResponse.json(result);
  } catch (error) {
    const denied = projectAccessResponse(error); if (denied) return denied;
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
});
