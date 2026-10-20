import Link from 'next/link';
import Image from 'next/image';
import { footerGroups, pageHref } from '@/lib/site-pages';

export default function SiteFooter() {
  return <footer className="relative z-10 w-full border-t border-border bg-card/45 px-4 py-12 text-xs text-muted-foreground sm:px-6 lg:px-12">
    <div className="mx-auto mb-8 grid max-w-7xl grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4 lg:grid-cols-6">
      <div className="col-span-2 space-y-3 sm:col-span-4 lg:col-span-2"><Link href="/" aria-label="OpenUI home" className="flex w-fit"><Image src="/logo-light.png" alt="OpenUI" width={663} height={182} className="h-6 w-auto dark:hidden"/><Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} className="hidden h-6 w-auto dark:block"/></Link><p className="max-w-[280px] leading-relaxed">AI-powered UI design platform for generating, editing, and exporting beautiful interfaces. Turn your ideas into production-ready designs.</p></div>
      {footerGroups.map(group=><nav key={group.title} aria-label={`${group.title} footer`} className="flex min-w-0 flex-col gap-3"><h2 className="font-bold text-foreground">{group.title}</h2>{group.items.map(label=><Link key={label} href={pageHref(label)} className="w-fit py-0.5 transition hover:text-foreground hover:underline focus-visible:outline-primary">{label}</Link>)}</nav>)}
    </div><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-8 text-[11px]"><span>OpenUI v1.0.0 · Local-first design environment</span><span>© {new Date().getFullYear()} OpenUI</span></div>
  </footer>;
}
