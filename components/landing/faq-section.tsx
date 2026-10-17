"use client";
import { MessageCircle, Sparkles, Pencil, Layers, Code2, Database, KeyRound, CalendarDays, ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const questions=[
  {id:'create',question:'What can I create with OpenUI?',icon:Sparkles,answer:'You can generate complete UI screens from simple text prompts. OpenUI helps you create web and mobile app screens, including layouts, components, and variations. You can then edit the designs on the canvas to refine the details, change styles, and iterate until they match your vision.'},
  {id:'edit',question:'Can I edit generated designs on the canvas?',icon:Pencil,answer:'Yes. Select an element inside a generated screen to edit its text, colors, typography, spacing, and supported layout properties. You can also move and resize supported elements, or ask project chat to refine a screen.'},
  {id:'screens',question:'Can I add multiple screens to one project?',icon:Layers,answer:'Yes. Keep multiple screens in the same project, compare them on the canvas, and use your existing screens and shared design system as a reference when creating new ones.'},
  {id:'export',question:'Which code formats can I export?',icon:Code2,answer:'You can download HTML and convert a screen to React, Vue, Angular, or Svelte. You can also download individual screens as PNG, JPG, or SVG, or export all screens in a ZIP. SVG exports retain HTML/CSS through foreignObject, so browser support differs from vector-only editors.'},
  {id:'credits',question:'How do AI credits work?',icon:Database,answer:'The displayed Plus plan includes 20 credits per month and Pro includes 50, with unused credits rolling over. Credit metering and paid checkout are not active in this version. AI requests currently use your configured provider, whose usage charges and limits apply.'},
  {id:'provider',question:'Can I use my own AI provider key?',icon:KeyRound,answer:'Yes. OpenUI supports your own provider configuration, with API keys kept on the server. Select the available provider and model in your workspace. Provider availability, model features, and usage costs depend on your configuration.'},
  {id:'cancel',question:'Can I cancel my subscription anytime?',icon:CalendarDays,answer:'Paid subscriptions are not active in this version, so there is currently no OpenUI subscription to cancel. If you use your own AI provider account, manage its billing and cancellation directly with that provider.'},
];

export default function FAQSection(){
  return <section id="faq" aria-labelledby="faq-heading" className="grid scroll-mt-24 grid-cols-1 items-start gap-8 py-8 lg:grid-cols-5 lg:gap-12">
    <div className="space-y-5 lg:col-span-2 lg:self-stretch">
      <div className="space-y-5 lg:sticky lg:top-24">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary"><MessageCircle className="size-3.5"/>FAQ</div>
      <h2 id="faq-heading" className="font-heading text-3xl font-black leading-tight text-foreground sm:text-4xl">Frequently Asked<br/>Questions</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Have a question about OpenUI?<br/>We&apos;re here to help.</p>
      <a href="https://x.com/abhay8769" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline">Contact us<ArrowRight className="size-4"/></a>
      </div>
    </div>
    <Accordion type="single" collapsible defaultValue="create" className="space-y-3 lg:col-span-3">
      {questions.map(({id,question,icon:Icon,answer})=><AccordionItem key={id} value={id} className="rounded-2xl border border-border bg-card px-4 last:border-b">
        <AccordionTrigger className="items-center py-4 text-sm font-bold text-foreground hover:no-underline"><span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={20}/></span><span>{question}</span></span></AccordionTrigger>
        <AccordionContent className="pb-5 pl-14 text-xs leading-relaxed text-muted-foreground">{answer}</AccordionContent>
      </AccordionItem>)}
    </Accordion>
  </section>;
}
