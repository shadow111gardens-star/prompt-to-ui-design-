// Device-specific layout guidance injected into generation prompts
export const deviceContexts: Record<string, string> = {
  mobile: `MOBILE-FIRST LAYOUT RULES:
    - Target Screen Resolution: 375px width × 812px height
    - Use vertical stacking (flex-col) as primary layout direction
    - Bottom navigation bar preferred over top horizontal navbars
    - Touch targets minimum 44px × 44px for all interactive elements
    - Full-width cards and sections, avoid multi-column grids
    - Use max-w-sm or w-full container width
    - Large, readable text (text-base minimum for body)
    - Thumb-friendly interaction zones in the lower half of the screen
    - Use sticky headers and floating action buttons
    - Single-column form layouts only
    - Swipeable carousels instead of side-by-side grids`,

  tablet: `TABLET LAYOUT RULES:
    - Target Screen Resolution: 768px width × 1024px height
    - 2-column grid layouts preferred for content areas
    - Side navigation or collapsible drawer acceptable
    - Use max-w-3xl container width
    - Mix vertical stacking and grid layouts contextually
    - Cards can be displayed 2-across in grids
    - Comfortable touch targets (40px minimum)
    - Split-view layouts are encouraged`,

  web: `DESKTOP/WEB LAYOUT RULES:
    - Multi-column grids (2-4 columns) for content areas
    - Top horizontal navigation with dropdown menus
    - Sidebar layouts encouraged for dashboards
    - Use full width (w-full) for page sections and headers, but restrict inner content elements to max-w-7xl mx-auto px-6
    - Hover states required on all interactive elements
    - Dense information layouts are acceptable
    - Use breadcrumbs for deep navigation
    - Data tables with sortable columns when appropriate`,

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
    system: `Create responsive, accessible HTML matching all user requirements, DESIGN.md, tokens, mood and device rules.
Wireframes: keep sections/positions/hierarchy; ignore black canvas, annotations and white labels, replacing labels with real content. Without a wireframe use the request. Map references to image slots in order; follow the image-asset contract for missing assets.
Return ONLY <div data-generated-ui> with scoped <style> and semantic HTML; no markdown, prose, comments, scripts or event handlers.
Tailwind: layout/typography only. Colors: literal token values in scoped .c-* classes, never Tailwind colors. Pair c-bg/c-fg,c-card-bg/c-card-fg,c-primary-bg/c-primary-fg,c-secondary-bg/c-secondary-fg,c-accent-bg/c-accent-fg,c-muted-bg/c-muted-fg; add c-border,c-ring. Keep pairs together, WCAG AA. No viewport units/width overflow.
Full-width section backgrounds; centered max-w-7xl inners. Spacing minima: sections py-16 px-6,cards p-6,text space-y-4,buttons px-6 py-3(primary px-8 py-4),button groups gap-4,grids gap-8,major sections mb-16. Adapt to device width.
Type: h1 text-4xl md:text-5xl font-bold leading-tight;h2 text-3xl md:text-4xl font-semibold;h3 text-2xl font-semibold;body text-lg leading-relaxed(min text-base);captions min text-sm. Concise copy. Requested charts: real labeled inline SVG/CSS marks, never placeholders.
Unique descriptive kebab-case IDs for major components/navs/sections/cards/buttons. Semantic landmarks,labeled controls,descriptive buttons,alt text,table headers,visible focus,touch targets. Verify content,responsiveness,pairs,spacing,IDs.`,
  },
};
