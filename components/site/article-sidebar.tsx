'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Mail, Search, Share2 } from 'lucide-react';

export function ArticleShare() {
  const [status, setStatus] = useState('');
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url: window.location.href }); setStatus(''); }
      else { await navigator.clipboard.writeText(window.location.href); setStatus('Article link copied.'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setStatus('Copy the article URL from your address bar to share it.'); }
  }
  return <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={share} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"><Share2 className="size-3.5"/>Share</button>{status && <span role="status" className="text-xs text-muted-foreground">{status}</span>}</div>;
}

export default function ArticleSidebar({ related, sections }: { related: { slug: string; title: string; image: string; minutes: number }[]; sections: { title: string; id: string }[] }) {
  const [query, setQuery] = useState('');
  const matches = related.filter(article => article.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <aside className="min-w-0 space-y-5 lg:sticky lg:top-24" aria-label="Article resources"><section className="rounded-2xl border border-border bg-card/60 p-5"><h2 className="font-heading text-base font-semibold">You might also like</h2><label className="relative mt-4 block"><span className="sr-only">Search related articles</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-3.5 text-muted-foreground"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search articles…" className="min-h-10 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/></label><div className="mt-5 space-y-5">{matches.map(article => <Link key={article.slug} href={`/blog/${article.slug}`} className="group flex items-start gap-3"><Image unoptimized src={article.image} alt="" width={72} height={72} className="size-16 shrink-0 rounded-lg object-cover"/><div className="min-w-0"><h3 className="text-xs font-semibold leading-5 transition group-hover:text-primary">{article.title}</h3><p className="mt-1 text-[11px] text-muted-foreground">{article.minutes} min read</p></div></Link>)}{!matches.length && <p role="status" className="text-xs leading-6 text-muted-foreground">No matching articles. Try another search.</p>}</div></section><section className="rounded-2xl border border-border bg-primary/5 p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail className="size-6"/></span><h2 className="mt-4 font-heading text-lg font-semibold leading-tight">A question about your next design?</h2><p className="mt-3 text-xs leading-6 text-muted-foreground">Share your workflow or ask us about getting started with OpenUI.</p><Link href="/contact" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Get in touch<ArrowRight className="size-3.5"/></Link></section><nav aria-label="In this article" className="rounded-2xl border border-border p-5"><h2 className="mb-4 text-sm font-semibold">In this article</h2><ol className="space-y-3">{sections.map((section, index) => <li key={section.id}><a href={`#${section.id}`} className="flex gap-2 text-xs leading-5 text-muted-foreground hover:text-primary"><span className="text-primary">{index + 1}.</span>{section.title}</a></li>)}</ol></nav></aside>;
}
