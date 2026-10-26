import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import SiteHeader from '@/components/site/header';
import SiteFooter from '@/components/site/footer';
import BlogArticlePage from '@/components/site/blog-article';
import { blogArticles, articleReadingMinutes } from '@/lib/blog-content';

export default function BlogPage({ articleSlug }: { articleSlug?: string }) {
  const article = articleSlug ? blogArticles[articleSlug] : undefined;
  if (article && articleSlug) return <BlogArticlePage article={article} slug={articleSlug}/>;
  const entries = Object.entries(blogArticles);
  return <div className="min-h-dvh bg-background text-foreground"><SiteHeader/><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
    <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4"/>Back to home</Link>
    <header className="mb-10 mt-8 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">The OpenUI journal</p><h1 className="mt-5 font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Practical ideas for better interfaces.</h1><p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">Original guides to writing a stronger brief, keeping screens consistent, and preparing a design for handoff. Read the process, then try it in your own workspace.</p></header>
    <div className={`grid gap-7 md:grid-cols-2 ${entries.length >= 3 ? 'lg:grid-cols-3' : ''}`}>{entries.map(([slug, item]) => <article key={slug} className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card/60"><Link href={`/blog/${slug}`} className="group block focus-visible:outline-primary"><Image unoptimized src={item.cover.src} alt={item.cover.alt} width={1600} height={1000} sizes="(max-width: 767px) 100vw, 50vw" className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"/></Link><div className="flex flex-1 flex-col p-6"><p className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span className="font-semibold uppercase tracking-wider text-primary">{item.category}</span><span>{articleReadingMinutes(item)} min read</span></p><h2 className="mt-4 font-heading text-xl font-semibold leading-snug"><Link href={`/blog/${slug}`} className="hover:text-primary">{item.title}</Link></h2><p className="mb-6 mt-4 text-sm leading-7 text-muted-foreground">{item.description}</p><Link href={`/blog/${slug}`} className="mt-auto inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Read the article<ArrowRight className="size-4"/></Link></div></article>)}</div>
  </main><SiteFooter/></div>;
}
