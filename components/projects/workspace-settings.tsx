"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { updateProfile } from 'firebase/auth';
import ProviderKeysPreview from '@/components/projects/provider-keys-preview';
import BillingPanel from '@/components/billing/billing-panel';
import GatewayKey from '@/components/billing/gateway-key';
import { useCreditUsage } from '@/components/billing/use-credit-usage';
import { accountPlan, planLabels } from '@/lib/account-plan';
import { useAuth } from '@/components/auth/provider';
import { authErrorMessage } from '@/lib/firebase/errors';
import { UserRound, Layers, Sun, CreditCard } from 'lucide-react';
import ThemeToggle from '@/components/navbar/theme-toggle';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'api', label: 'AI Preferences', icon: Layers },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;
type Tab = typeof tabs[number]['id'];

export default function WorkspaceSettings({ providers,onClose,previewLifetime=false }: { providers: string[];onClose?:()=>void;previewLifetime?:boolean }) {
  const {user,plan:firebasePlan='local'}=useAuth();
  const credits=useCreditUsage();
  const plan=accountPlan(credits.data?.plan??firebasePlan);
  const lifetime=plan==='lifetime';
  const showAI=lifetime||previewLifetime;
  const availableTabs=tabs.filter(item=>item.id!=='api'||showAI);
  const [profileBusy,setProfileBusy]=useState(false);
  const [tab, setTab] = useState<Tab>(previewLifetime?'api':'account');
  useEffect(()=>{const sync=()=>{const id=window.location.hash.replace('#tab-','');if(availableTabs.some(item=>item.id===id)){setTab(id as Tab);}};sync();window.addEventListener('hashchange',sync);return ()=>window.removeEventListener('hashchange',sync);},[showAI]);
  useEffect(()=>{if(!showAI&&tab==='api')setTab('account');},[showAI,tab]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(()=>{
    setName(user?.displayName || user?.email?.split('@')[0] || '');
    setEmail(user?.email || '');
    setNotice('');
  },[user?.uid,user?.displayName,user?.email]);
  async function saveProfile(){
    if(!user||profileBusy)return;
    const displayName=name.trim();
    if(!displayName){setNotice('Enter your display name.');return;}
    setProfileBusy(true);setNotice('');
    try{
      await updateProfile(user,{displayName});
      setName(displayName);
      setNotice('Account name updated.');
    }catch(error){setNotice(authErrorMessage(error));}
    finally{setProfileBusy(false);}
  }
  const inputClass = 'h-11 w-full min-w-0 rounded-lg border border-border bg-secondary/25 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
  return <div className="settings-reference grid h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-background md:grid-cols-[220px_minmax(0,1fr)] md:grid-rows-1">
      <aside className="flex min-h-0 flex-col border-b border-border bg-card/20 p-3 md:border-r md:border-b-0">
        <h2 className="px-2 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Settings</h2>
        <div role="tablist" aria-label="Settings sections" className="mt-2 flex gap-1 overflow-x-auto border-t border-border/60 pt-1 md:flex-col">
        {availableTabs.map(({id,label,icon:Icon})=><button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab===id} aria-controls={`panel-${id}`} tabIndex={tab===id?0:-1} onKeyDown={event=>{const index=availableTabs.findIndex(item=>item.id===id);const next=event.key==='ArrowRight'||event.key==='ArrowDown'?(index+1)%availableTabs.length:event.key==='ArrowLeft'||event.key==='ArrowUp'?(index+availableTabs.length-1)%availableTabs.length:event.key==='Home'?0:event.key==='End'?availableTabs.length-1:-1;if(next>=0){event.preventDefault();setTab(availableTabs[next].id);document.getElementById(`tab-${availableTabs[next].id}`)?.focus();}}} onClick={()=>{setTab(id);setNotice('');window.history.replaceState(null,'',`#tab-${id}`);}} className={cn('flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left text-xs font-medium transition md:w-full',tab===id?'bg-secondary text-foreground':'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}><Icon className="size-4 shrink-0"/>{label}</button>)}
        </div>
        {onClose&&<button type="button" onClick={onClose} className="mt-auto hidden min-h-11 shrink-0 border-t border-border/60 text-xs text-muted-foreground hover:text-foreground md:block">Close</button>}
      </aside>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="min-h-0 min-w-0 overflow-y-auto p-5 outline-none sm:px-8 sm:py-8">
        {tab==='account' && <div className="space-y-7">
          <div><h2 className="text-base font-medium">Account</h2><p className="mt-2 text-sm text-muted-foreground">Manage your signed-in OpenUI account.</p></div>
          <form className="space-y-7 pt-2" onSubmit={event=>{event.preventDefault();void saveProfile();}}>
            <div className="grid items-center gap-3 lg:grid-cols-[150px_minmax(0,1fr)]"><label htmlFor="display-name" className="text-sm text-muted-foreground">Display name</label><input id="display-name" disabled={profileBusy||!user} autoComplete="name" maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className={inputClass}/></div>
            <div className="grid items-center gap-3 lg:grid-cols-[150px_minmax(0,1fr)]"><label htmlFor="profile-email" className="text-sm text-muted-foreground">Email</label><input id="profile-email" readOnly aria-readonly="true" type="email" autoComplete="email" maxLength={254} value={email} placeholder="you@example.com" className={inputClass}/></div>
            <div className="grid items-center gap-3 lg:grid-cols-[150px_minmax(0,1fr)]"><span className="text-sm text-muted-foreground">Plan</span><div className="text-sm"><span className="mr-2 rounded-lg bg-primary/10 px-3 py-1 font-semibold text-primary">{planLabels[plan]}</span>{plan==='local'?'No paid plan connected':'Current plan'}</div></div>
            <div className="flex flex-wrap items-center gap-4 pt-3"><button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" type="submit" disabled={profileBusy||!user}>{profileBusy?'Saving...':'Save changes'}</button><p className="text-xs text-muted-foreground">Your email is linked to your sign-in account.</p></div>
            <p role="status" className="text-sm text-muted-foreground">{notice}</p>
          </form>
          {process.env.NODE_ENV==='development'&&<Link href="/dashboard/workspace/settings?preview=lifetime#tab-api" className="inline-flex text-xs font-medium text-primary hover:underline">Preview Lifetime UI</Link>}
        </div>}
        {tab==='appearance'&&<div className="space-y-7"><div><h2 className="text-base font-medium">Appearance</h2><p className="mt-2 text-sm text-muted-foreground">Choose the OpenUI theme for this browser.</p></div><div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"><div><h3 className="text-sm font-medium">Color theme</h3><p className="mt-1 text-xs text-muted-foreground">Switch between the light and brown themes.</p></div><ThemeToggle/></div></div>}
        {tab==='api' && showAI && <div className="space-y-7">
          {previewLifetime&&<p role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary">Local testing mode. Provider key tools are enabled for this authenticated development workspace; your paid plan is unchanged.</p>}
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-medium">AI Preferences</h2><p className="mt-2 text-sm text-muted-foreground">Manage your AI provider keys and models for design generation.</p></div><span className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">Lifetime Plan</span></div>
          <GatewayKey/>
          <ProviderKeysPreview/>
          <p className="text-xs text-muted-foreground">{providers.length ? `${providers.length} AI provider(s) configured on the server.` : 'No AI providers configured.'} Provider credentials remain on the server.</p>
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        </div>}
        {tab==='billing' && <BillingPanel/>}
      </section>
  </div>;
}
