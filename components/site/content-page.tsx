import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import SiteHeader from '@/components/site/header';
import SiteFooter from '@/components/site/footer';
import PricingSection from '@/components/landing/pricing-section';
import TemplateGallery from '@/components/site/template-gallery';
import type { SitePage } from '@/lib/site-pages';

export const sectionId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export default function ContentPage({ page, slug }: { page: SitePage; slug: string }) {
  const reading = page.group==='Legal' || slug==='documentation' || page.group==='Guide';
  return <div className="min-h-dvh bg-background text-foreground"><SiteHeader/><main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:px-12">
    <Link href={page.group==='Guide'?'/blog':'/'} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary"><ArrowLeft size={14}/>{page.group==='Guide'?'All articles':'Back to home'}</Link>
    <header className="max-w-3xl space-y-5 pb-10 pt-8"><span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">{page.group}</span><h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">{page.title}</h1><p className="max-w-2xl text-sm leading-7 text-muted-foreground">{page.description}</p></header>
    {slug==='pricing' && <PricingSection/>}
    {slug==='templates' && <TemplateGallery/>}
    {slug==='showcase' && <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card p-2"><Image src="/canvas-mockup-light.png" alt="OpenUI canvas product illustration in the light theme" width={1600} height={900} className="h-auto w-full rounded-xl dark:hidden"/><Image src="/canvas-mockup.png" alt="OpenUI canvas product illustration in the dark theme" width={1600} height={900} className="hidden h-auto w-full rounded-xl dark:block"/></div>}
    {page.sections.length>0 && <div className={reading?'grid items-start gap-8 lg:grid-cols-[200px_minmax(0,1fr)]':'grid grid-cols-1 gap-4 md:grid-cols-2'}>
      {reading && <nav aria-label="On this page" className="flex flex-wrap gap-3 rounded-xl border border-border bg-card/50 p-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:flex-col"><p className="w-full text-xs font-semibold">On this page</p>{page.sections.map(section=><a key={section.title} href={`#${sectionId(section.title)}`} className="text-xs leading-5 text-muted-foreground hover:text-primary">{section.title}</a>)}</nav>}
      <div className={reading?'min-w-0 divide-y divide-border rounded-2xl border border-border bg-card/40 px-5 sm:px-8':'contents'}>{page.sections.map((section,index)=><section key={section.title} id={sectionId(section.title)} className={reading?'scroll-mt-40 py-7':'flex min-w-0 scroll-mt-40 flex-col items-start rounded-2xl border border-border bg-card/50 p-5 sm:p-6'}>
        {!reading && <span className="mb-5 flex size-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-semibold text-primary">{String(index+1).padStart(2,'0')}</span>}
        <h2 className="text-base font-semibold">{section.title}</h2><p className="mt-3 break-words text-sm leading-7 text-muted-foreground">{section.text}</p>
        {section.table && <div role="region" aria-label={`${section.title} table`} tabIndex={0} className="mt-5 w-full overflow-x-auto rounded-xl border border-border focus-visible:outline-primary"><table className="w-full min-w-[32rem] border-collapse text-left text-xs leading-6"><thead className="bg-secondary/50"><tr>{section.table.headers.map(header=><th key={header} scope="col" className="border-b border-border px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{section.table.rows.map((row,index)=><tr key={index} className="border-b border-border last:border-0">{row.map((cell,column)=>column===0?<th key={column} scope="row" className="px-4 py-3 align-top font-medium">{cell}</th>:<td key={column} className="px-4 py-3 align-top text-muted-foreground">{cell}</td>)}</tr>)}</tbody></table></div>}
        {section.bullets && <ul className="mt-4 space-y-3">{section.bullets.map(bullet=><li key={bullet} className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><Check size={16} className="mt-1 shrink-0 text-primary"/>{bullet}</li>)}</ul>}
        {section.href && <Link href={section.href} {...(section.href.startsWith('https:')?{target:'_blank',rel:'noopener noreferrer'}:{})} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">{section.action}<ArrowRight size={14}/></Link>}
      </section>)}</div>
    </div>}
    {!reading && <section className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold">Bring your next idea to the canvas.</h2><p className="mt-2 text-sm text-muted-foreground">Start a project and refine it at your own pace.</p></div><Link href="/dashboard/workspace" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-xs font-semibold text-primary-foreground">Open workspace<ArrowRight size={15}/></Link></section>}
  </main><SiteFooter/></div>;
}
