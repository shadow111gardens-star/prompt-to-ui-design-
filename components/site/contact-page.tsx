import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquare, ShieldCheck } from 'lucide-react';
import SiteHeader from '@/components/site/header';
import SiteFooter from '@/components/site/footer';
import ContactForm from '@/components/site/contact-form';
import { CONTACT_NAME, CONTACT_EMAIL } from '@/lib/contact-email';

export default function ContactPage() {
  return <div className="min-h-dvh bg-background text-foreground"><SiteHeader/><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-16 lg:px-12">
    <Link href="/" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4"/>Back to home</Link>
    <header className="mb-12 mt-8 max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Contact OpenUI</p><h1 className="mt-5 font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Let’s talk about<br/>what you’re building.</h1><p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">A product question, a design workflow that could be smoother, or an idea to share? We would like to hear from you.</p></header>
    <div className="grid items-start gap-8 lg:grid-cols-[0.7fr_1.3fr]"><aside className="space-y-6"><section className="rounded-3xl border border-border bg-card/50 p-7"><Mail aria-hidden="true" className="mb-5 size-6 text-primary"/><h2 className="font-heading text-xl font-semibold">Contact directly</h2><p className="mt-5 text-sm font-medium">{CONTACT_NAME}</p><a href={`mailto:${CONTACT_EMAIL}`} className="mt-2 block break-all text-sm leading-7 text-primary underline underline-offset-4">{CONTACT_EMAIL}</a><p className="mt-4 text-sm leading-7 text-muted-foreground">For product questions, feedback, privacy and security enquiries.</p></section><section className="px-2"><MessageSquare aria-hidden="true" className="mb-3 size-5 text-primary"/><h2 className="text-sm font-semibold">Make your message useful</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">For a problem report, include the page, your device and browser, what you tried and what you expected to happen.</p></section><section className="px-2"><ShieldCheck aria-hidden="true" className="mb-3 size-5 text-primary"/><h2 className="text-sm font-semibold">Keep private details private</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">Share only what is needed to understand the issue. <Link href="/privacy" className="text-primary underline underline-offset-4">Read our privacy information.</Link></p></section></aside><ContactForm/></div>
  </main><SiteFooter/></div>;
}
