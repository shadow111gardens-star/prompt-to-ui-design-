import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/navbar/theme-toggle';

export default function SiteHeader() {
  return <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-12"><Link href="/" aria-label="OpenUI home"><Image src="/logo-light.png" alt="OpenUI" width={663} height={182} className="h-6 w-auto dark:hidden"/><Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} className="hidden h-6 w-auto dark:block"/></Link><nav aria-label="Site navigation" className="order-3 flex w-full items-center justify-center gap-5 text-xs font-medium sm:order-none sm:w-auto"><Link href="/features" className="hover:text-primary">Features</Link><Link href="/pricing" className="hover:text-primary">Pricing</Link><Link href="/documentation" className="hover:text-primary">Documentation</Link></nav><div className="flex items-center gap-2"><ThemeToggle/><Link href="/dashboard/workspace" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Workspace</Link></div></div></header>;
}
