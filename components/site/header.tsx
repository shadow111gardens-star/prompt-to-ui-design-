import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/navbar/theme-toggle';

export default function SiteHeader() {
  return <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-12"><Link href="/" aria-label="OpenUI home"><Image src="/logo-light.png" alt="OpenUI" width={663} height={182} className="h-6 w-auto dark:hidden"/><Image src="/logo-dark.png" alt="OpenUI" width={663} height={182} className="hidden h-6 w-auto dark:block"/></Link><div className="flex items-center gap-2"><ThemeToggle/><Link href="/sign-in" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Sign in</Link></div></div></header>;
}
