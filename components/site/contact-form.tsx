'use client';

import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { CONTACT_EMAIL, contactSchema, createContactEmail } from '@/lib/contact-email';

export default function ContactForm() {
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPrepared(false);
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const result = contactSchema.safeParse(input);
    if (!result.success) { setError(result.error.issues[0]?.message || 'Please check the form.'); return; }
    setError('');
    window.location.href = createContactEmail(result.data);
    setPrepared(true);
  }
  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20';
  return <form onSubmit={submit} className="rounded-3xl border border-border bg-card/60 p-6 sm:p-9" aria-labelledby="contact-form-title" aria-describedby="contact-delivery">
    <h2 id="contact-form-title" className="font-heading text-2xl font-semibold">What can we help with?</h2>
    <p id="contact-delivery" className="mt-3 text-sm leading-7 text-muted-foreground">Fill in the details below to open a draft in your email app. Review the draft and press Send there.</p>
    <div className="mt-7 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium" htmlFor="contact-name">Your name<input className={inputClass} id="contact-name" name="name" autoComplete="name" placeholder="Your full name" required maxLength={100}/></label>
      <label className="text-sm font-medium" htmlFor="contact-email">Your email<input className={inputClass} id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></label>
      <label className="text-sm font-medium sm:col-span-2" htmlFor="contact-subject">Topic<select className={inputClass} id="contact-subject" name="subject" defaultValue="Product question">{contactSchema.shape.subject.options.map(subject => <option key={subject}>{subject}</option>)}</select></label>
      <label className="text-sm font-medium sm:col-span-2" htmlFor="contact-message">Message<textarea className={`${inputClass} min-h-44 resize-y leading-7`} id="contact-message" name="message" placeholder="Tell us what you are building, or what you need help with…" required minLength={10} maxLength={2000} rows={6}/><span className="mt-2 block text-xs font-normal text-muted-foreground">Up to 2,000 characters. Leave out passwords, API keys and private project data.</span></label>
    </div>
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    {prepared && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7">Your email app should open with a draft. Nothing has been sent yet. If no app opens, email <a href={`mailto:${CONTACT_EMAIL}`} className="break-all font-medium text-primary underline">{CONTACT_EMAIL}</a> directly.</p>}
    <button type="submit" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 sm:w-auto"><Mail aria-hidden="true" className="size-4"/>Open email draft<ArrowUpRight aria-hidden="true" className="size-4"/></button>
    <p className="mt-4 text-xs leading-6 text-muted-foreground">To: <span className="break-all">{CONTACT_EMAIL}</span> · Requires an email app configured on your device.</p>
  </form>;
}
