import { getFallbackSelection } from '@/lib/ai/provider-registry';
import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { personalProviderContext } from '@/lib/ai/personal-provider-context';
import { personalProviderStore } from '@/lib/ai/personal-provider-store';
import { isPersonalProvider } from '@/lib/ai/personal-provider-types';
import { NextRequest, NextResponse } from "next/server";
import { getProjectSettings, updateProjectSettings } from "@/lib/db/settings";

export const GET=withPersonalProvider(async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const personal=personalProviderContext.getStore()?.settings;
    if(personal?.active)return NextResponse.json({provider:personal.active,model:personal.active+'/'+personal.providers[personal.active]?.model});
    const settings = await getProjectSettings(projectId);
    if(settings?.provider&&settings?.model)return NextResponse.json({provider:settings.provider,model:settings.model});
    const fallback=getFallbackSelection();
    return NextResponse.json({provider:fallback.provider,model:fallback.provider+'/'+fallback.modelId});
  } catch (error) {
    console.error("Error fetching project settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
});

export const POST=withPersonalProvider(async function POST(request: NextRequest) {
  try {
    let { projectId, provider, model } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    if ((!provider || provider === "undefined") && model) {
      const parts = model.split("/");
      if (parts.length > 0) {
        provider = parts[0];
      }
    }

    const context=personalProviderContext.getStore();
    if(context?.settings.active){
      if(!isPersonalProvider(provider)||typeof model!=='string')return NextResponse.json({error:'Select a saved provider model.'},{status:400});
      const raw=model.startsWith(provider+'/')?model.slice(provider.length+1):model;
      await personalProviderStore.update(context.uid,state=>{const record=state.providers[provider];if(!record?.models.some(item=>item.id===raw))throw new Error('Model unavailable. Test your saved key again.');record.model=raw;state.active=provider;});
    }
    const settings = await updateProjectSettings(projectId, { 
      provider: provider || "openrouter", 
      model: model || null 
    });
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    console.error("Error updating project settings:", error);
    return NextResponse.json({
      error: "Failed to update settings",
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});
