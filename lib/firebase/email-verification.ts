import { reload, sendEmailVerification, type User } from 'firebase/auth';

export const VERIFICATION_COOLDOWN_MS=60_000;
const pending=new Set<string>();
const deadlines=new Map<string,number>();
function storage(){try{return typeof window!=='undefined'?window.localStorage:undefined;}catch{return undefined;}}
export function verificationWait(uid:string,now=Date.now()){
  let saved=0;try{saved=Number(storage()?.getItem('openui:verification:'+uid)||0);}catch{}
  return Math.max(0,Math.ceil((Math.max(saved,deadlines.get(uid)||0)-now)/1000));
}
export async function sendVerification(user:User){
  if(pending.has(user.uid)||verificationWait(user.uid)>0)throw new Error('Please wait before requesting another verification email.');
  pending.add(user.uid);
  // Apply the cooldown to attempts too, including network failures.
  const until=Date.now()+VERIFICATION_COOLDOWN_MS;deadlines.set(user.uid,until);
  try{storage()?.setItem('openui:verification:'+user.uid,String(until));}catch{}
  try{await sendEmailVerification(user);}finally{pending.delete(user.uid);}
}
export async function refreshVerifiedUser(user:User){
  await reload(user);
  if(!user.emailVerified)return false;
  await user.getIdToken(true);
  return true;
}
