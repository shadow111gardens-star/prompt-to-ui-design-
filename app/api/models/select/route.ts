import { withPersonalProvider } from '@/lib/ai/with-personal-provider';
import { tokenHarborConfiguration } from '@/lib/ai/tokenharbor';
import { FIXED_AI_PROVIDER, FIXED_AI_MODEL } from '@/lib/ai/fixed-model';
const selection=()=>{tokenHarborConfiguration();return {provider:FIXED_AI_PROVIDER,model:FIXED_AI_MODEL};};
export const GET=withPersonalProvider(async()=>{try{return Response.json(selection(),{headers:{'Cache-Control':'no-store'}});}catch(error){return Response.json({error:error instanceof Error?error.message:'TokenHarbor configuration is unavailable.'},{status:503});}});
export const POST=withPersonalProvider(async(request:Request)=>{
 try{const input=await request.json();if(input.provider!==FIXED_AI_PROVIDER||input.model!==FIXED_AI_MODEL)return Response.json({error:'This deployment has one fixed TokenHarbor model.'},{status:400});return Response.json({success:true,...selection()});}
 catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid model request.'},{status:503});}
});
