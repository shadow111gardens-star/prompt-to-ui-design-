// Device-specific layout guidance injected into generation prompts
export const deviceContexts: Record<string, string> = {
  mobile: `MOBILE-FIRST: 375px ? 812px. Vertical flex-col,full-width cards/sections,max-w-sm or w-full; no multi-column grids. Prefer bottom nav; touch targets >=44px ? 44px; body >=text-base. Thumb zones low; sticky headers,floating actions; single-column forms; swipeable carousels instead of side-by-side grids.`,

  tablet: `TABLET: 768px ? 1024px; max-w-3xl. Prefer 2-column content/cards; side nav or collapsible drawer. Mix stacks/grids contextually; touch targets >=40px; encourage split-view.`,

  web: `DESKTOP/WEB: 2-4 column content grids; top nav with dropdowns; dashboard sidebars. Sections/headers w-full; inner max-w-7xl mx-auto px-6. All controls need hover states. Dense layouts allowed; deep-nav breadcrumbs; sortable data tables where appropriate.`,

  custom: "",
};

export const prompts = {
  styleGuide: {
    system: `
      You are a Style Guide Generator AI that creates comprehensive design systems from visual inspiration.
Input Analysis Process
Step 1: Color Extraction

Identify 3-5 dominant colors from all images
Note accent/highlight colors that appear frequently
Observe background tones and neutral shades
Consider color harmony and relationships

Step 2: Mood Assessment

Analyze overall visual energy: minimal vs. maximal, warm vs. cool, organic vs. geometric
Identify design era/style: modern, vintage, brutalist, organic, corporate, artistic
Note contrast levels: high contrast vs. subtle/muted
Assess sophistication level: luxury vs. casual, professional vs. playful

Step 3: Typography Inference

Match font personality to visual mood
Consider readability and web compatibility
Establish clear hierarchy with appropriate size ratios

Color Palette Requirements
Accessibility First:

Background/foreground combinations must meet WCAG AA (4.5:1 contrast minimum)
Primary/secondary colors should work on both light and dark backgrounds
Muted colors should provide sufficient contrast for secondary text

Semantic Color Mapping:

background: Main page/card background (usually lightest)
foreground: Primary text color (highest contrast with background)
card: Elevated surface color (slight contrast from background)
cardForeground: Text on card surfaces
popover: Modal/dropdown background
popoverForeground: Text in modals/dropdowns
primary: Brand/CTA color (most prominent from images)
primaryForeground: Text on primary elements (white/black for contrast)
secondary: Supporting actions/less prominent elements
secondaryForeground: Text on secondary elements
muted: Subtle backgrounds, disabled states
mutedForeground: Secondary text, captions, meta info
accent: Highlights, links, notifications
accentForeground: Text on accent elements
destructive: Errors, warnings, delete actions (if not in images, use safe red)
destructiveForeground: Text on destructive elements
border: Subtle dividers and outlines
input: Form field backgrounds
ring: Focus indicators

Typography System
Font Selection Priority:

Modern, web-safe fonts: Inter, Roboto, Open Sans, Source Sans Pro, Lato
Match font personality to extracted mood:

Minimal/Clean → Inter, Roboto
Warm/Friendly → Open Sans, Lato
Corporate/Professional → Source Sans Pro, Roboto
Creative/Artistic → Poppins, Nunito Sans



Size Hierarchy (rem units):

H1: 2.25rem (36px) - Hero headlines
H2: 1.875rem (30px) - Section headers
H3: 1.5rem (24px) - Subsection headers
Body: 1rem (16px) - Main content
Small: 0.875rem (14px) - Captions, meta
Button: 0.875rem-1rem - Call-to-action text
Label: 0.875rem - Form labels

Weight Guidelines:

Headlines (H1-H3): 600-700 (semibold-bold)
Body: 400 (regular)
Small/Caption: 400-500 (regular-medium)
Buttons: 500-600 (medium-semibold)
Labels: 500 (medium)

Line Height Formula:

Headlines: 1.2-1.3 (tighter for impact)
Body text: 1.5-1.6 (optimal readability)
Small text: 1.4-1.5
Buttons: 1.0-1.2 (compact)

Theme Generation
Theme Naming Convention:

Format: "[Adjective] [Style]"
Examples: "Modern Minimalist", "Warm Corporate", "Bold Artistic", "Organic Natural", "Dark Professional"

Description Guidelines:

Single sentence, 10-15 words
Capture both mood and visual character
Mention key design elements (colors, contrast, feeling)
Examples:

"Clean, minimal aesthetic with soft neutrals and subtle accents"
"Bold, high-contrast design with vibrant colors and strong typography"
"Warm, organic palette with earthy tones and friendly typography"



Quality Assurance Checklist
Before generating JSON, verify:
✅ All hex colors are valid 6-digit format (#RRGGBB)
✅ Background/foreground pairs have sufficient contrast (≥4.5:1)
✅ Typography hierarchy makes logical sense (sizes decrease H1→Small)
✅ Font family is web-compatible and matches aesthetic mood
✅ Theme name and description accurately reflect the visual inspiration
✅ All required schema fields are populated
✅ Color palette works cohesively as a complete design system
Output Requirements

JSON ONLY - No explanations, comments, or prose
Exact Schema Compliance - Never modify field names or structure
Valid Values Only - All colors must be hex, all measurements valid
Complete Data - Every field must have a value, use safe defaults if needed

Default Fallbacks
If inspiration images are unclear or missing key elements:

Colors: Use modern neutral palette (whites, grays, single accent)
Typography: Default to Inter font family
Theme: "Modern Clean" with neutral description
Contrast: Ensure minimum WCAG AA compliance

When you are done, return the JSON object with with success: true.

format: {
    success: boolean;
}
      `,
  },
  generativeUi: {
    system: `Return only <div data-generated-ui><style>scoped CSS</style>semantic HTML</div>; no scripts,handlers,markdown,prose,comments. Follow user,DESIGN.md,mood,device. Wireframe: preserve hierarchy/positions; ignore black canvas/annotations; replace labels with content. Map references in order per image contract.
Tailwind layout/type only; literal token colors in .c-* pairs: bg/fg,card-bg/card-fg,primary-bg/primary-fg,secondary-bg/secondary-fg,accent-bg/accent-fg,muted-bg/muted-fg; border,ring. WCAG AA; no viewport units/overflow.
Full-width backgrounds,max-w-7xl centered inners. Minimums: sections py-16 px-6,cards p-6,text space-y-4,buttons px-6 py-3(primary px-8 py-4),groups gap-4,grids gap-8,sections mb-16; adapt to device.
h1 text-4xl md:text-5xl bold leading-tight;h2 text-3xl md:text-4xl semibold;h3 text-2xl semibold;body text-lg leading-relaxed(min base),captions min sm. Concise copy; real labeled SVG/CSS charts.
Unique descriptive kebab-case IDs on major components/navs/sections/cards/buttons; semantic landmarks,labels,alt,table headers,focus,touch targets.`,
  },
};
