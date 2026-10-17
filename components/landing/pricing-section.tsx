"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { Box, Zap, Users, Crown, KeyRound, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BillingPeriod, PricingPlan, getPricing, pricingAmount } from '@/lib/pricing';

const plans=[
  {id:'plus' as const,name:'Plus',description:'For testing ideas',icon:Box,badge:'New',features:['20 credits per month','Unused credits roll over (never lost)','Shareable preview links'],cta:'Get Started'},
  {id:'pro' as const,name:'Pro',description:'For indie developers',icon:Zap,badge:'Popular',features:['50 credits per month','150% higher usage limit than Plus','Unused credits roll over (never lost)','All Plus features'],cta:'Upgrade to Pro'},
  {id:'lifetime' as const,name:'Lifetime',description:'For agencies and businesses',icon:Users,badge:'One time',features:['All current Pro features','Use your own Vercel AI Gateway key','Unlimited projects','Dedicated support'],cta:'Get Lifetime Access'},
];

export default function PricingSection(){
  const [period,setPeriod]=useState<BillingPeriod>('monthly');
  const [selected,setSelected]=useState<PricingPlan|null>(null);
  const selectedPlan=plans.find(plan=>plan.id===selected);
  const summary=selected?getPricing(selected,period):null;
  return <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-24 space-y-6 py-8">
    <div className="mx-auto max-w-2xl space-y-3 text-center">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary"><Crown className="size-3.5"/>Pricing</div>
      <h2 id="pricing-heading" className="font-heading text-3xl font-black leading-tight text-foreground sm:text-4xl">Simple Pricing for <span className="text-primary">Everyone</span></h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Start for free and upgrade anytime. Get more AI credits, export options, and advanced features as you grow from ideas to real products.</p>
      <div role="group" aria-label="Billing period" className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
        {(['monthly','yearly'] as const).map(value=><button key={value} type="button" aria-pressed={period===value} onClick={()=>setPeriod(value)} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${period===value?'bg-foreground text-background dark:bg-primary dark:text-primary-foreground':'text-muted-foreground hover:text-foreground'}`}>{value==='monthly'?'Monthly':'Yearly'}</button>)}
        <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">SAVE 30%</span>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {plans.map(({id,name,description,icon:Icon,badge,features,cta})=>{
        const price=getPricing(id,period);const popular=id==='pro';
        return <article key={id} aria-label={`${name} pricing plan`} className={`flex min-w-0 flex-col rounded-2xl border p-6 ${popular?'border-primary bg-primary/[0.035] shadow-sm':'border-border bg-card'}`}>
          <div className="mb-3 flex items-center justify-between gap-2"><div className={`flex size-10 items-center justify-center rounded-xl ${id==='lifetime'?'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':'bg-primary/10 text-primary'}`}><Icon className="size-5"/></div><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${popular?'border-primary/20 bg-primary/10 text-primary':'border-border text-muted-foreground'}`}>{popular?<Crown className="size-3"/>:id==='lifetime'?<KeyRound className="size-3"/>:null}{badge}</span></div>
          <h3 className="text-sm font-bold text-foreground">{name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <p className="mt-4 flex flex-wrap items-baseline gap-1.5"><span className="font-heading text-3xl font-black text-foreground">{pricingAmount(price.displayCents)}</span><span className="text-sm text-muted-foreground">{price.recurring?'/month':'one-time'}</span></p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{!price.recurring?'Bring your own Vercel AI Gateway key.':price.yearly?`${pricingAmount(price.chargedCents)} billed yearly. Save 30%.`:'Billed monthly. Cancel anytime.'}</p>
          <ul className="mt-4 flex-1 space-y-2 border-t border-border/70 pt-4">{features.map(feature=><li key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary"/>{feature}</li>)}</ul>
          {id==='plus'?<Link href="/dashboard/workspace" className="mt-5 flex items-center justify-center rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-xs font-bold text-foreground transition hover:bg-secondary">{cta}</Link>:<button type="button" onClick={()=>setSelected(id)} className={`mt-5 rounded-lg border px-4 py-2.5 text-xs font-bold transition ${popular?'border-primary bg-primary text-primary-foreground hover:bg-primary/90':'border-border bg-secondary/40 text-foreground hover:bg-secondary'}`}>{cta}</button>}
        </article>;
      })}
    </div>
    <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="rounded-2xl border-border bg-card text-foreground"><DialogHeader><DialogTitle className="text-sm font-bold">{selectedPlan?.name} plan</DialogTitle><DialogDescription className="text-xs leading-relaxed">{summary?`${pricingAmount(summary.chargedCents)} ${summary.recurring?(summary.yearly?'per year':'per month'):'one-time'}. `:''}Paid checkout is not connected yet. No payment will be taken.</DialogDescription></DialogHeader><Link href="/dashboard/workspace" className="rounded-lg bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground">Continue to workspace</Link></DialogContent></Dialog>
  </section>;
}
