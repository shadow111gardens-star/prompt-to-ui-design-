import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { z } from 'zod';
import { resolveModelForProject, ProjectNotFoundError } from '@/lib/ai/route-utils';
import { createResilientStreamResponse } from '@/lib/ai/resilient-stream';
import { prisma } from '@/lib/db';
import { PROJECT_CHAT_SYSTEM } from '@/lib/project-chat';
import { EDITABLE_STYLES } from '@/lib/element-editing';
import { designTargetInstruction, projectDesignTarget } from '@/lib/design-target';

const requestSchema=z.object({
  projectId:z.string().min(1),streamId:z.string().min(1),userMessage:z.string().min(1).max(16000),
  context:z.object({screens:z.array(z.object({id:z.string(),name:z.string(),html:z.string().max(250000),width:z.number(),height:z.number(),x:z.number(),y:z.number()})).max(60),
    selectedScreenIds:z.array(z.string()),selectedElement:z.unknown().nullable(),guide:z.unknown(),viewport:z.unknown(),
    history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(12000)})).max(20),
  }),
});

export async function projectChatResponse(request:NextRequest,body:unknown) {
  const parsed=requestSchema.safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Invalid project chat context. Reopen the project and retry.'},{status:400});
  const data=parsed.data;
  if(JSON.stringify(data.context).length>700000)return NextResponse.json({error:'This project is too large for one chat request. Reduce screen source size before retrying.'},{status:413});
  try {
    const project=await prisma.project.findUnique({where:{id:data.projectId},include:{settings:true}});
    if(!project)return NextResponse.json({error:'Project not found.'},{status:404});
    const model=await resolveModelForProject(data.projectId);
    const context={...data.context,projectName:project.name,editableStyles:[...EDITABLE_STYLES]};
    return createResilientStreamResponse(model=>streamText({model,system:PROJECT_CHAT_SYSTEM+designTargetInstruction(projectDesignTarget(project.sketchesData)),
      messages:[{role:'user',content:`PROJECT REFERENCE DATA:\n${JSON.stringify(context)}\n\nCURRENT USER REQUEST:\n${data.userMessage}`}],
      abortSignal:request.signal,maxRetries:0,maxOutputTokens:24000,
    }),model,data.streamId,project.settings?.provider,project.settings?.model);
  }catch(error){
    if(error instanceof ProjectNotFoundError)return NextResponse.json({error:'Project not found.'},{status:404});
    return NextResponse.json({error:error instanceof Error?error.message:'Could not start project chat.'},{status:500});
  }
}
