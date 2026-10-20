"use client";

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { UserRound, KeyRound, CreditCard, Info, Eye, EyeOff, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { loadWorkspaceKey } from '@/lib/load-workspace-key';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'api', label: 'API Key', icon: KeyRound },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;
type Tab = typeof tabs[number]['id'];
const storageKey = 'openui-workspace-profile';

export default function WorkspaceSettings({ providers }: { providers: string[] }) {
  const [tab, setTab] = useState<Tab>('account');
  useEffect(()=>{const sync=()=>{const id=window.location.hash.replace('#tab-','');if(id==='account'||id==='api'||id==='billing'){setTab(id);setRevealed(false);}};sync();window.addEventListener('hashchange',sync);return ()=>window.removeEventListener('hashchange',sync);},[]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [keyStatus, setKeyStatus] = useState<{configured:boolean;suffix?:string}>({configured:false});
  const [apiKey, setApiKey] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [keyAttempt,setKeyAttempt]=useState(0);
  const alive=useRef(false);
  useEffect(()=>{
    alive.current=true;
    const request=loadWorkspaceKey({
      onSuccess:status=>{setKeyStatus(status);setKeyLoaded(true);},
      onError:error=>setNotice(error instanceof Error?error.message:'Unable to load API key'),
      reportError:error=>console.error('Unable to load workspace key status:',error),
    });
    return ()=>{alive.current=false;request.cancel();};
  },[keyAttempt]);
  async function updateKey(method:'POST'|'DELETE') {
    if(keyBusy) return;
    if(keyStatus.configured && !window.confirm(method==='POST'?'Replace your current API key? Existing integrations will stop working.':'Revoke your API key? Existing integrations will stop working.')) return;
    setKeyBusy(true);setNotice('');
    try {
      const response=await fetch('/api/workspace-key',{method});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error || 'Unable to update API key');
      if(!alive.current)return;
      setKeyStatus(body);setKeyLoaded(true);setApiKey(body.key || '');setRevealed(false);
      setNotice(method==='POST'?'Key generated. Copy it now; it will not be shown again after reloading.':'API key revoked.');
    }catch(error){if(alive.current)setNotice(error instanceof Error?error.message:'Unable to update API key');}
    finally{if(alive.current)setKeyBusy(false);}
  }
  async function copyKey(){try{await navigator.clipboard.writeText(apiKey);if(alive.current)setNotice('API key copied.');}catch{if(alive.current)setNotice('Clipboard unavailable. Reveal the key and copy it manually.');}}
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved === 'object') {
        if ('name' in saved && typeof saved.name === 'string') setName(saved.name);
        if ('email' in saved && typeof saved.email === 'string') setEmail(saved.email);
      }
    } catch { setNotice('Saved profile could not be loaded. You can save it again.'); }
  }, []);
  const inputClass = 'h-12 w-full min-w-0 rounded-xl border border-border bg-secondary/40 px-4 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
  return <div className="min-w-0 space-y-8 settings-reference">
    <header><h1 className="text-3xl font-semibold text-foreground">Settings</h1><p className="text-muted-foreground">Manage your account, API keys and billing settings.</p></header>
    <div className="grid min-h-[calc(100dvh-302px)] overflow-hidden rounded-2xl border border-border bg-background lg:grid-cols-[220px_minmax(0,1fr)]">
      <div role="tablist" aria-label="Settings sections" className="flex gap-2 border-b border-border p-2 sm:p-4 lg:flex-col lg:border-r lg:border-b-0 lg:py-7">
        {tabs.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab===id} aria-controls={`panel-${id}`} tabIndex={tab===id?0:-1} onKeyDown={event=>{const index=tabs.findIndex(item=>item.id===id);const next=event.key==='ArrowRight'||event.key==='ArrowDown'?(index+1)%tabs.length:event.key==='ArrowLeft'||event.key==='ArrowUp'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(next>=0){event.preventDefault();setTab(tabs[next].id);document.getElementById(`tab-${tabs[next].id}`)?.focus();}}} onClick={()=>{setTab(id);setRevealed(false);setNotice('');window.history.replaceState(null,'',`#tab-${id}`);}} className={cn('flex min-w-0 flex-1 flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 rounded-xl border px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium transition lg:flex-none lg:justify-start',tab===id?'border-primary bg-primary/15 text-foreground shadow-[inset_3px_0_12px_var(--color-primary)/10]':'border-transparent text-muted-foreground hover:bg-secondary')}><Icon className={cn('size-5 shrink-0',tab===id&&'text-primary')}/>{label}</button>)}
      </div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="min-w-0 p-5 sm:px-8 sm:py-9">
        {tab==='account' && <div className="space-y-7">
          <div><h2 className="text-base font-medium">Account</h2><p className="mt-2 text-sm text-muted-foreground">Manage your local workspace profile.</p></div>
          <form className="space-y-7 pt-2" onSubmit={event=>{event.preventDefault();try{localStorage.setItem(storageKey,JSON.stringify({name:name.trim(),email:email.trim()}));window.dispatchEvent(new Event('openui-profile-updated'));setName(name.trim());setEmail(email.trim());setNotice('Profile saved in this browser.');}catch{setNotice('Unable to save profile. Check your browser storage settings.');}}}>
            <div className="grid items-center gap-3 xl:grid-cols-[160px_minmax(0,1fr)]"><label htmlFor="display-name" className="text-sm text-muted-foreground">Display name</label><input id="display-name" autoComplete="name" maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className={inputClass}/></div>
            <div className="grid items-center gap-3 xl:grid-cols-[160px_minmax(0,1fr)]"><label htmlFor="profile-email" className="text-sm text-muted-foreground">Email</label><input id="profile-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className={inputClass}/></div>
            <div className="grid items-center gap-3 xl:grid-cols-[160px_minmax(0,1fr)]"><span className="text-sm text-muted-foreground">Plan</span><div className="text-sm"><span className="mr-2 rounded-lg bg-primary/10 px-3 py-1 font-semibold text-primary">LOCAL</span>Self-hosted workspace</div></div>
            <div className="flex flex-wrap items-center gap-4 pt-3"><button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" type="submit">Save changes</button><p className="text-xs text-muted-foreground">Profile details stay in this browser; they do not create a login.</p></div>
            <p role="status" className="text-sm text-muted-foreground">{notice}</p>
          </form>
        </div>}
        {tab==='api' && <div className="space-y-7">
          <div><h2 className="text-base font-medium">API Key</h2><p className="mt-2 text-sm text-muted-foreground">Manage your API keys for using OpenUI with external tools.</p></div>
          <div className="rounded-2xl border border-border bg-card/40 p-6">
            <div className="flex flex-wrap items-start justify-between gap-5"><div><h3 className="text-base font-medium">Your API Key</h3><p className="mt-1 text-sm text-muted-foreground">Use this API key to authenticate your requests.</p></div><button type="button" disabled={keyBusy || !keyLoaded} onClick={()=>void updateKey('POST')} className="flex items-center gap-3 rounded-xl border border-primary bg-primary/15 px-4 py-3 text-sm font-medium"><RefreshCw className="size-5"/>{keyBusy?'Updating...':'Generate New Key'}</button></div>
            <div className="mt-7 flex gap-2 sm:gap-3"><div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-border bg-secondary/30"><input aria-label="API key" readOnly type={revealed?'text':'password'} value={apiKey || (keyStatus.configured?`oui_saved_${keyStatus.suffix}`:'')} placeholder={keyLoaded?'No API key generated':'Loading key status...'} className="h-14 min-w-0 flex-1 bg-transparent px-4 text-sm outline-none"/><button type="button" aria-label={revealed?'Hide API key':'Reveal API key'} disabled={!apiKey || keyBusy} onClick={()=>setRevealed(!revealed)} className="border-l border-border bg-secondary/40 px-3 sm:px-4 disabled:opacity-40">{revealed?<EyeOff className="size-6"/>:<Eye className="size-6"/>}</button></div><button type="button" aria-label="Copy API key" disabled={!apiKey || keyBusy} onClick={()=>void copyKey()} className="rounded-xl border border-border bg-secondary/30 px-3 sm:px-4 disabled:opacity-40"><Copy className="size-6"/></button></div>
            <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Info className="size-5 shrink-0"/>Keep your API key secure. Do not share it publicly.</p>
          </div>
          {keyStatus.configured && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{apiKey?'Copy this key before leaving the page.':`Active key ending in ${keyStatus.suffix}. Generate a new key if you no longer have the original.`}</p><button type="button" disabled={keyBusy} onClick={()=>void updateKey('DELETE')} className="flex items-center gap-2 text-sm text-destructive disabled:opacity-40"><Trash2 className="size-4"/>Revoke key</button></div>}
          <p className="break-words text-xs text-muted-foreground">Read-only integration: <code>GET /api/integration/projects</code> with <code>Authorization: Bearer YOUR_KEY</code>.</p>
          <p className="text-xs text-muted-foreground">{providers.length ? `${providers.length} AI provider(s) configured on the server.` : 'No AI providers configured.'} Provider credentials remain on the server.</p>
          {!keyLoaded && <button type="button" onClick={()=>setKeyAttempt(value=>value+1)} className="text-sm text-primary">Retry loading key</button>}
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        </div>}
        {tab==='billing' && <div className="space-y-6">
          <div><h2 className="text-base font-medium">Billing</h2><p className="mt-2 text-sm text-muted-foreground">View your current plan and available upgrades.</p></div>
          <div className="rounded-2xl border border-border bg-card/40 p-6"><div className="grid items-start gap-5 border-b border-border pb-7 2xl:grid-cols-[125px_minmax(0,1fr)_auto]"><p className="pt-2 text-sm">Current plan</p><div><span className="inline-block rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">LOCAL</span><p className="mt-1 text-sm">Self-hosted workspace</p><p className="mt-2 text-sm text-muted-foreground">Use your own AI providers with your local projects.</p></div><Link href="/#pricing" className="mt-4 min-w-44 rounded-xl bg-primary px-6 py-4 text-center text-sm font-medium text-primary-foreground">Upgrade plan</Link></div>
            <dl className="mt-7 grid grid-cols-1 gap-x-5 gap-y-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"><dt className="text-muted-foreground">Next billing date</dt><dd>Not applicable</dd><dt className="text-muted-foreground">Amount</dt><dd>No subscription connected</dd><dt className="text-muted-foreground">Status</dt><dd className="flex items-center gap-3"><span className="size-3 rounded-full bg-primary"/>Local workspace</dd></dl>
          </div>
          <p className="text-xs text-muted-foreground">Paid checkout is not connected. Upgrade opens the pricing page; no payment is taken here.</p>
        </div>}
      </section>
    </div>
  </div>;
}
