import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { fetchAllModels } from '@/lib/ai/model-listing';
export const GET=withPersonalProvider(async()=>{
 try{return Response.json({models:await fetchAllModels(),enabledProviders:['tokenharbor']},{headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({error:error instanceof Error?error.message:'TokenHarbor configuration is unavailable.'},{status:503});}
});
