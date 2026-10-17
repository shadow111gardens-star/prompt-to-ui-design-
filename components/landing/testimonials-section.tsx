import { MessageCircle, Star } from 'lucide-react';

// Review text and ratings supplied by the project owner.
const rows=[
  [
    {name:'Arpit Tiwari',rating:5,review:'The speed and simplicity of generating UI screens really impressed me.'},
    {name:'Abhishek Yadav',rating:5,review:'It generates clean UI screens and makes the design process much faster.'},
    {name:'Mindless_Bass_9045',rating:4,review:'Pretty useful for turning a rough idea into a clean mobile UI.'},
    {name:'Kalash Vasaniya',rating:5,review:'Great for experimenting with layouts and refining ideas quickly.'},
    {name:'saalipagal',rating:4,review:'The multi-screen workflow is useful for keeping designs consistent.'},
    {name:'Jay-Banalal',rating:5,review:'A useful tool for exploring different UI directions from a simple prompt.'},
  ],
  [
    {name:'ch4os-tar',rating:4,review:'I like generating screens and iterating without starting over.'},
    {name:'No_Particular4286',rating:4,review:'Working on multiple screens in one project is a nice touch.'},
    {name:'Rinkit Adhana',rating:5,review:'A convenient way to explore layouts before moving into development.'},
    {name:'DevCraft_21',rating:4,review:'The canvas makes it easier to compare and refine different ideas.'},
    {name:'PixelNomad',rating:5,review:'Helpful for quickly exploring different interface concepts.'},
    {name:'UIBuilder_07',rating:4,review:'A simple workflow for turning early ideas into UI drafts.'},
  ],
];

export default function TestimonialsSection(){
  return <section id="testimonials" aria-labelledby="testimonials-heading" className="scroll-mt-24 space-y-7 overflow-hidden py-8">
    <div className="mx-auto max-w-2xl space-y-3 text-center">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary"><MessageCircle className="size-3.5"/>Testimonials</div>
      <h2 id="testimonials-heading" className="font-heading text-3xl font-black leading-tight text-foreground sm:text-4xl">Less friction. <span className="text-primary">More creating.</span></h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Feedback from builders turning their ideas into interfaces with OpenUI.</p>
    </div>
    <div className="testimonial-marquee space-y-5">
      {rows.map((reviews,index)=><div key={index} aria-label={`Testimonial row ${index+1}, moving ${index===0?'right':'left'}`} className="testimonial-viewport overflow-x-hidden py-1">
        <div className={`testimonial-track flex w-max ${index===0?'testimonial-track-right':'testimonial-track-left'}`}>
          {[0,1].map(copy=><div key={copy} aria-hidden={copy===1?true:undefined} className="flex shrink-0 gap-4 pr-4">
            {reviews.map(({name,rating,review})=><article key={name} className="w-[270px] shrink-0 space-y-3 rounded-2xl border border-border bg-card p-4 sm:w-[308px]">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{name.split(/[\s_-]+/).map(part=>part[0]).join('').slice(0,2).toUpperCase()}</span>
                <h3 className="min-w-0 flex-1 break-words text-xs font-bold text-foreground">{name}</h3>
                <span role="img" aria-label={`${rating} out of 5 stars`} className="flex shrink-0 gap-0.5 text-emerald-500">{[1,2,3,4,5].map(star=><Star key={star} aria-hidden="true" className={`size-2.5 ${star<=rating?'fill-current':''}`}/>)}</span>
              </div>
              <blockquote className="text-xs leading-relaxed text-foreground/85">{review}</blockquote>
            </article>)}
          </div>)}
        </div>
      </div>)}
    </div>
  </section>;
}
