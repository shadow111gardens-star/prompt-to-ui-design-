import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
import { mkdir,readFile,rename,rm,writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PersonalSettings } from '@/lib/ai/personal-provider-types';

export function createPersonalProviderStore(directory:string,secret:()=>string|undefined){
  const queues=new Map<string,Promise<unknown>>();
  function key(){const value=secret();if(!value||! /^[A-Za-z0-9+/]{43}=$/.test(value))throw new Error('Provider key encryption is not configured.');return Buffer.from(value,'base64');}
  function location(uid:string){if(!uid)throw new Error('Authentication required.');const id=createHash('sha256').update(uid).digest('hex');return path.join(directory,id+'.json');}
  async function read(uid:string):Promise<PersonalSettings>{
    let raw:string;try{raw=await readFile(location(uid),'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {providers:{}};throw error;}
    const envelope=JSON.parse(raw);const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(envelope.iv,'base64'));decipher.setAAD(Buffer.from(uid));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8'));
  }
  async function update(uid:string,change:(value:PersonalSettings)=>void){
    const previous=queues.get(uid)||Promise.resolve();
    const task=previous.catch(()=>{}).then(async()=>{
      const settings=await read(uid);change(settings);settings.revision=(settings.revision||0)+1;
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);cipher.setAAD(Buffer.from(uid));
      const data=Buffer.concat([cipher.update(JSON.stringify(settings),'utf8'),cipher.final()]);
      await mkdir(directory,{recursive:true,mode:0o700});const file=location(uid),temp=file+'.'+randomBytes(8).toString('hex')+'.tmp';
      try{await writeFile(temp,JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}),{mode:0o600});await rename(temp,file);}finally{await rm(temp,{force:true});}
      return settings;
    });queues.set(uid,task);try{return await task;}finally{if(queues.get(uid)===task)queues.delete(uid);}
  }
  return {read,update};
}
export const personalProviderStore=createPersonalProviderStore(path.join(process.cwd(),'.openui','provider-keys'),()=>process.env.OPENUI_PROVIDER_KEYS_SECRET);
