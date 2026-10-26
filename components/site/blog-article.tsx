import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ChevronRight, Clock3, Lightbulb } from 'lucide-react';
import SiteHeader from '@/components/site/header';
import SiteFooter from '@/components/site/footer';
import ArticleSidebar, { ArticleShare } from '@/components/site/article-sidebar';
import { MobileBriefExample, DesignSystemExample, RefinementExample, ConnectedScreensExample } from '@/components/site/mobile-design-examples';
import { blogArticles, articleReadingMinutes, type BlogArticle } from '@/lib/blog-content';

const sectionId = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
type Section = BlogArticle['sections'][number];

function ComparisonTable({ section }: { section: Section }) {
  if (!section.table) return null;
  return <div className="min-w-0 overflow-x-auto rounded-xl border border-border" role="region" aria-label={`${section.title} comparison`} tabIndex={0}><table className="w-full min-w-[25rem] text-left text-xs leading-6"><thead className="bg-secondary/70"><tr>{section.table.headers.map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{section.table.rows.map(row => <tr key={row[0]} className="border-t border-border">{row.map((cell,i) => i === 0 ? <th key={i} scope="row" className="px-4 py-3 font-medium">{cell}</th> : <td key={i} className="px-4 py-3 text-muted-foreground">{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default function BlogArticlePage({ article, slug }: { article: BlogArticle; slug: string }) {
  const mobileGuide = slug === 'design-better-mobile-app-screens';
  const related = Object.entries(blogArticles).filter(([id]) => id !== slug).map(([id,item]) => ({slug:id,title:item.title,image:item.cover.src,minutes:articleReadingMinutes(item)}));
  const accent = article.titleAccent;
  const titleStart = accent && article.title.endsWith(accent) ? article.title.slice(0, -accent.length).trim() : article.title;
  const takeaways = article.takeaways || article.sections.slice(0,4).map(section => section.title + '.');
  return <div className="min-h-dvh bg-background text-foreground"><SiteHeader/><main className="mx-auto max-w-7xl px-5 pb-16 pt-5 sm:px-8 lg:px-12">
    <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-6 text-muted-foreground"><Link href="/" className="hover:text-primary">Home</Link><ChevronRight aria-hidden="true" className="size-3"/><Link href="/blog" className="hover:text-primary">Blog</Link><ChevronRight aria-hidden="true" className="size-3"/><span aria-current="page" className="max-w-full truncate">{article.category}</span></nav>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_250px] xl:grid-cols-[minmax(0,1fr)_270px]">
      <article className="min-w-0"><header><h1 className="max-w-4xl font-heading text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl xl:text-5xl">{titleStart}{accent && <span className="block text-primary">{accent}</span>}</h1><p className="mt-5 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">{article.description}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4"><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary" aria-hidden="true">UI</span><span className="font-medium text-foreground">OpenUI guides</span><span aria-hidden="true">·</span>{article.publishedOn && <><time dateTime={article.publishedOn}>{new Date(article.publishedOn+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Kolkata'})}</time><span aria-hidden="true">·</span></>}<span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5"/>{articleReadingMinutes(article)} min read</span></div><ArticleShare/></div></header>
      <figure className="mt-5 overflow-hidden rounded-xl border border-border bg-card"><Image unoptimized src={article.cover.src} alt={article.cover.alt} width={1600} height={1000} priority sizes="(max-width: 1023px) 100vw, 70vw" className="aspect-[16/10] w-full object-cover"/><figcaption className="px-4 py-2.5 text-[11px] leading-5 text-muted-foreground">{article.cover.creditUrl ? <a href={article.cover.creditUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{article.cover.caption}</a> : article.cover.caption}</figcaption></figure>
      <section aria-labelledby="takeaways" className="mt-5 rounded-xl border border-primary/25 bg-primary/[0.035] p-5 sm:p-6"><h2 id="takeaways" className="flex items-center gap-3 font-heading text-xl font-semibold"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Lightbulb className="size-4"/></span>TL;DR</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground marker:text-primary">{takeaways.map(item=><li key={item}>{item}</li>)}</ul></section>
      <div className="mt-7 space-y-9">{article.sections.map((section,index)=><section key={section.title} id={sectionId(section.title)} className="scroll-mt-24"><h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-[1.7rem]">{index+1}. {section.title}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{section.text}</p>
        {mobileGuide && index===0 && <MobileBriefExample/>}
        {section.table && <div className={`mt-6 ${mobileGuide && index===1 ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_220px]' : ''}`}><ComparisonTable section={section}/>{mobileGuide && index===1 && <DesignSystemExample/>}</div>}
        {mobileGuide && index===2 && <RefinementExample/>}
        {mobileGuide && index===3 && <ConnectedScreensExample/>}
        {section.paragraphs?.map(paragraph=><p key={paragraph} className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">{paragraph}</p>)}
        {section.bullets && <ul className="mt-5 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground marker:text-primary">{section.bullets.map(bullet=><li key={bullet}>{bullet}</li>)}</ul>}
        {section.example && <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">Example prompt</p><blockquote className="whitespace-pre-wrap text-sm leading-8">{section.example}</blockquote></div>}
        {section.href && <Link href={section.href} className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary underline underline-offset-4">{section.action}</Link>}
      </section>)}</div><Link href="/blog" className="mt-10 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4"/>All OpenUI articles</Link></article>
      <ArticleSidebar related={related} sections={article.sections.map(section=>({title:section.title,id:sectionId(section.title)}))}/>
    </div>
  </main><SiteFooter/></div>;
}
