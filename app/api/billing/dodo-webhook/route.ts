import { paymentsEnabled } from '@/lib/billing/feature-flags';
import { verifyDodoSignature, processDodoEvent } from '@/lib/billing/dodo';
import { CreditError } from '@/lib/billing/policy';
export const runtime='nodejs';
export async function POST(request:Request){if(!paymentsEnabled())return Response.json({error:'Payments are disabled for testing.'},{status:503});try{if(Number(request.headers.get('content-length'))>1048576)return Response.json({error:'Webhook too large.'},{status:413});const raw=await request.text();if(Buffer.byteLength(raw)>1048576)return Response.json({error:'Webhook too large.'},{status:413});const id=verifyDodoSignature(raw,request.headers);await processDodoEvent(id,raw);return Response.json({received:true});}catch(error){return Response.json({error:error instanceof CreditError?error.message:'Webhook could not be processed. No credit grant was committed.'},{status:error instanceof CreditError?error.status:503});}}
