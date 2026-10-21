import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { personalProviderContext } from '@/lib/ai/personal-provider-context';
import { NextResponse } from "next/server";
import { fetchAllModels, getEnabledProviders, type AvailableModel } from "@/lib/ai/model-listing";

// Simple in-memory cache
let cachedModels: AvailableModel[] | null = null;
let cacheTime = 0;
let cachedProvidersHash = "";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const GET=withPersonalProvider(async function GET(_request:Request) {
  const personal=personalProviderContext.getStore()?.settings;
  if(personal?.active){const models=Object.entries(personal.providers).flatMap(([provider,record])=>(record?.models||[]).map(item=>({id:provider+'/'+item.id,name:item.name,provider,rawId:item.id})));return NextResponse.json({models,enabledProviders:Object.keys(personal.providers)},{headers:{'Cache-Control':'no-store'}});}
  try {
    const now = Date.now();
    const enabledProviders = getEnabledProviders();
    const providersHash = enabledProviders.join(",");

    if (cachedModels && now - cacheTime < CACHE_TTL_MS && providersHash === cachedProvidersHash) {
      return NextResponse.json({
        models: cachedModels,
        enabledProviders,
      });
    }

    const models = await fetchAllModels();
    cachedModels = models;
    cacheTime = now;
    cachedProvidersHash = providersHash;

    return NextResponse.json({
      models,
      enabledProviders,
    });
  } catch (error) {
    console.error("Error in GET /api/models:", error);
    return NextResponse.json(
      { error: "Failed to load models" },
      { status: 500 },
    );
  }
});
