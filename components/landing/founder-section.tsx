import Image from 'next/image';
import { ShieldCheck, LockKeyhole, Baby, Activity, ArrowRight, ExternalLink } from 'lucide-react';

const products=[
  {name:'VaultPass',description:'Secure password manager for individuals and teams.',status:'$0 MRR',icon:LockKeyhole,color:'bg-purple-500/10 text-purple-500 border-purple-500/20'},
  {name:'Babycry',description:'Baby sleep tracking and bidding platform.',status:'$0 MRR',icon:Baby,color:'bg-rose-500/10 text-rose-500 border-rose-500/20'},
  {name:'SVG Motion',description:'Animate SVGs with simple tools.',status:'In Production',icon:Activity,color:'bg-orange-500/10 text-orange-500 border-orange-500/20'},
];

export default function FounderSection(){
  return <section id="about" aria-labelledby="founder-heading" className="relative grid grid-cols-1 items-start gap-8 overflow-hidden rounded-3xl border border-border bg-linear-to-br from-card to-secondary/35 p-8 lg:grid-cols-5 lg:p-12">
    <div className="min-w-0 space-y-6 lg:col-span-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400"><ShieldCheck className="size-3.5"/>Meet the Founder</div>
      <div className="space-y-3"><h3 id="founder-heading" className="font-heading text-3xl font-black text-foreground">Hi, I&apos;m Abhay</h3><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solo SaaS Builder &amp; Creator of OpenUI</p></div>
      <blockquote className="border-l-2 border-primary/50 pl-4 text-sm italic leading-relaxed text-muted-foreground">I&apos;m a solo founder who loves building useful tools with AI. OpenUI is my latest project to make interface design faster and more accessible for everyone. I focus on shipping real products, learning in public, and sharing the journey.</blockquote>
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-foreground">Other products I&apos;ve built</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map(({name,description,status,icon:Icon,color})=><article key={name} className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${color}`}><Icon className="size-5"/></div>
            <h5 className="text-xs font-bold text-foreground">{name}</h5>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{name==='VaultPass'?<>Secure password manager<br/>for individuals and teams.</>:description}</p>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status==='In Production'?'border-primary/20 bg-primary/10 text-primary':'border-border bg-secondary text-foreground'}`}>{status}</span>
          </article>)}
        </div>
      </div>
    </div>
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:col-span-2 lg:self-stretch">
      {/* Artwork stays above the CTA and social links, matching the supplied reference. */}
      <div className="relative aspect-[696/438] shrink-0 overflow-hidden bg-[#241b15]">
        <Image src="/founder-reference.png" alt="Illustrated OpenUI founder working on a laptop beside a friendly AI robot" width={2051} height={767} sizes="(min-width:1024px) 1200px, 2000px" className="absolute left-[-175.72%] top-[-23.06%] h-auto w-[294.68%] max-w-none"/>
      </div>
      <div className="mt-auto space-y-4 p-5">
      <a href="https://x.com/abhay8769" target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-primary/95">Follow my journey<ArrowRight className="size-3.5"/></a>
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <a href="https://x.com/abhay8769" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground transition hover:underline">@abhay8769<ExternalLink className="size-3"/></a>
        <a href="https://www.linkedin.com/in/abhay-solanki-b2a503234/?isSelfProfile=true" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition hover:underline">abhay-solanki<ExternalLink className="size-3"/></a>
      </div>
      </div>
    </div>
  </section>;
}
