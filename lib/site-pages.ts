import { legalPages } from '@/lib/legal-pages';
export type SiteSection = { title: string; text: string; bullets?: string[]; href?: string; action?: string; table?: { headers: string[]; rows: string[][] } };
export type SitePage = { title: string; group: string; description: string; sections: SiteSection[] };
export const footerGroups = [
  { title: 'Product', items: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
  { title: 'Resources', items: ['Documentation', 'Templates', 'Showcase', 'Community'] },
  { title: 'Company', items: ['About', 'Blog', 'Contact'] },
  { title: 'Legal', items: ['Terms', 'Privacy', 'Security', 'Cookies'] },
];
export const pageHref = (label: string) => `/${label.toLowerCase()}`;
export const sitePages: Record<string, SitePage> = {
  features: {
  "title": "From the first idea to the finer details.",
  "group": "Product",
  "description": "Generate a starting point, refine real interface elements, and bring connected screens together in one OpenUI workspace.",
  "sections": [
    {
      "title": "Start with a clear brief",
      "text": "Describe the product, audience, screens and visual direction. Choose Website or App in the workspace so the design follows the intended format.",
      "bullets": [
        "Choose the target device and describe the required content.",
        "Review generated HTML on the canvas as it streams.",
        "Keep related screens together in the same project."
      ]
    },
    {
      "title": "Make the details yours",
      "text": "Select an element to change its text, layout, spacing, typography or colors. Color controls include alpha, reset, input placeholders and supported SVG fill and stroke.",
      "bullets": [
        "Adjust the selected element through Properties.",
        "Use undo and redo as you explore a direction.",
        "Save changes through the existing project save flow."
      ]
    },
    {
      "title": "Refine with project chat",
      "text": "Request another screen or a focused change using the existing project as context. Review broader proposed edits before applying them."
    },
    {
      "title": "Build a shared visual language",
      "text": "Keep colors, typography and design notes together in Design System & Tokens and Style Guide. Save Moodboard references for visual research; image-based generation depends on provider capability."
    },
    {
      "title": "Review before you hand off",
      "text": "Compare screens at their intended dimensions. Inspect longer content, navigation, color contrast and mobile layout before exporting."
    },
    {
      "title": "Take your screens with you",
      "text": "Export the current screen or all screens as PNG, JPG or SVG. Multiple-screen image exports are packaged in a ZIP archive.",
      "href": "/documentation#exports",
      "action": "Read the export guide"
    }
  ]
},
  pricing: {
  "title": "Know what you are starting with.",
  "group": "Product",
  "description": "Understand workspace access, AI generation limits and billing availability before you start your next project.",
  "sections": [
    {
      "title": "Workspace access",
      "text": "Create an account or sign in to use your own project workspace. Keep generated screens, design settings and edits together under your authenticated account."
    },
    {
      "title": "AI usage is separate",
      "text": "Generation uses the model configured by this OpenUI service. Availability and usage depend on that provider; workspace access does not imply unlimited AI requests."
    },
    {
      "title": "Paid plans are not available to purchase",
      "text": "Subscription checkout is not connected in this build. No paid plan, renewal, credit rollover or support entitlement is promised by this page."
    },
    {
      "title": "Before choosing a paid plan",
      "text": "When paid checkout becomes available, review the exact price, billing period, generation allowance, cancellation terms and included capabilities before paying.",
      "href": "/contact",
      "action": "Ask a billing question"
    }
  ]
},
  changelog: {
  "title": "The details that move OpenUI forward.",
  "group": "Product",
  "description": "Follow improvements to generation, visual editing and exports, with practical notes for your workflow.",
  "sections": [
    {
      "title": "More predictable generation",
      "text": "Generation is configured for one server-selected model with 4,000 input and output limits. Component-level input preflight helps explain rejected requests without logging private prompts.",
      "bullets": [
        "Oversized input is rejected before the provider request.",
        "Automatic provider retries and model fallback are disabled.",
        "Structured responses are checked against their existing schemas."
      ]
    },
    {
      "title": "Color editing in Properties",
      "text": "Text, background and border colors can be edited from the selected element inspector, with relevant controls for input placeholders and SVG elements.",
      "bullets": [
        "Custom hex values, alpha and theme presets.",
        "Reset to the original or inherited styling.",
        "Edits use existing history and persistence paths."
      ]
    },
    {
      "title": "A closer match between preview and export",
      "text": "Export fixes address font loading and font-size differences between the canvas and image captures. Current-screen and multi-screen PNG, JPG and SVG workflows remain available."
    },
    {
      "title": "Project ownership tied to sign-in",
      "text": "New projects use the verified server-side Firebase identity. Ownership-aware queries restrict access to project data and nested resources."
    },
    {
      "title": "Image assets that belong to the project",
      "text": "The image workflow connects section-specific searches, uploaded assets, image replacement and saved project references. Availability depends on the configured image service."
    }
  ]
},
  roadmap: {
  "title": "A considered path forward.",
  "group": "Product",
  "description": "The current foundation, the areas worth improving, and the ideas still being evaluated. Priorities are not promised release dates.",
  "sections": [
    {
      "title": "The foundation today",
      "text": "Prompt-based generation, editable screens, project chat, design tokens, authenticated project ownership and screen exports form the current workflow.",
      "href": "/features",
      "action": "Explore the current tools"
    },
    {
      "title": "Generation reliability",
      "text": "Evaluate better token accounting, clearer input-budget guidance and more useful recovery from provider errors. Preserve the complete user brief instead of silently cutting requirements."
    },
    {
      "title": "Responsive and accessible editing",
      "text": "Broaden real-device checks for canvas navigation, inspector controls and dialogs. Improve keyboard paths and check contrast and overflow with realistic content."
    },
    {
      "title": "More dependable handoff",
      "text": "Continue comparing fonts, images and layout across preview and export formats. Improve guidance for SVG compatibility and long or scrolling screen content."
    },
    {
      "title": "Ideas under consideration",
      "text": "Reusable screen starters, richer shared design patterns and connected subscription management need further evaluation. These are not purchasable features or committed deliveries."
    },
    {
      "title": "Help us prioritize a real workflow",
      "text": "Tell us what you are building, what you expected and where the workflow breaks down. Include the device and browser, but leave out private project data and API keys.",
      "href": "/contact",
      "action": "Share product feedback"
    }
  ]
},
  documentation: { title: 'Build your first OpenUI project.', group: 'Resources', description: 'A practical guide to generation, editing, design consistency and exports.', sections: [
    { title: 'Start a project', text: 'Open Projects and choose New Project. Select an AI model configured on your server, then describe the screens you want.', bullets: ['Name the app and its audience.', 'Specify the screen list and shared visual style.', 'Include realistic content and device requirements.'], href: '/templates', action: 'Choose a starter prompt' },
    { title: 'Editing', text: 'Use Select to pick a screen or an element inside it. The properties panel edits element content and styling. Use Pan for navigation and Sandbox to interact with a prototype.', bullets: ['Use undo and redo to review edits.', 'Select the intended element before asking chat to change it.', 'Save through the existing autosave or manual Save control.'] },
    { title: 'Project chat', text: 'Open Chat from the bottom toolbar. Ask about the design system, add a screen or request an edit. Review proposed broad changes before applying them. New-screen requests should preserve existing screens.' },
    { title: 'Design system', text: 'Open Design System & Tokens to inspect the active project colors, fonts and design notes. Style Guide groups colors, typography and moodboard references.' },
    { title: 'Exports', text: 'Open Export, choose PNG, JPG or SVG, then select the current screen or all screens. SVG exports can contain embedded HTML; support varies between external design tools.' },
    { title: 'API access', text: 'Generate an OpenUI integration key in Settings → API Key. Copy it before reloading. Send Authorization: Bearer YOUR_KEY to GET /api/integration/projects for read-only project metadata. Rotation and revocation invalidate the previous key.', href: '/dashboard/workspace/settings#tab-api', action: 'Open API settings' },
    { title: 'Troubleshooting', text: 'Check that your provider is configured and the selected model is available. For failed requests, inspect the error, retry, and keep secrets out of screenshots. Keep backups of local project data.', href: '/contact', action: 'Get in touch' },
  ] },
  templates: { title: 'Start with a stronger prompt.', group: 'Resources', description: 'Reusable prompt starters for your next interface. Customize the details before sending them to AI.', sections: [] },
  showcase: { title: 'See the workspace in action.', group: 'Resources', description: 'Explore OpenUI interface examples and the tools behind a connected design workflow.', sections: [
    { title: 'The canvas workspace', text: 'Organize screens, compare variations and keep project-wide chat alongside the design. The workspace preview below is a product illustration, not a customer testimonial.', href: '/dashboard/workspace', action: 'Open your projects' },
    { title: 'Mobile fitness example', text: 'A local FitTrack example demonstrates connected dashboard, workout and profile screens with a shared dark-and-lime visual direction.', href: '/fittrack-preview.html', action: 'Open FitTrack example' },
    { title: 'Create your own direction', text: 'Use a starter prompt for a dashboard, mobile product or storefront, then refine the result in your own project.', href: '/templates', action: 'Browse starters' },
  ] },
  community: { title: 'Build, share, learn.', group: 'Resources', description: 'Connect around the process of turning ideas into interfaces.', sections: [
    { title: 'Follow the journey', text: 'Follow Abhay for product updates and work in progress.', href: 'https://x.com/abhay8769', action: 'Connect on X' },
    { title: 'Connect professionally', text: 'Discuss product building and interface workflows on LinkedIn.', href: 'https://www.linkedin.com/in/abhay-solanki-b2a503234/', action: 'Connect on LinkedIn' },
    { title: 'Share useful feedback', text: 'Include your goal, device/browser, reproduction steps and a screenshot when relevant. Remove API keys, personal data and private project content before sharing.', href: '/contact', action: 'Contact' },
  ] },
  about: { title: 'Ideas deserve a clearer starting point.', group: 'Company', description: 'OpenUI brings AI generation and visual iteration into one local-first workspace.', sections: [
    { title: 'From prompt to connected screens', text: 'A good interface is more than a single attractive screen. OpenUI combines an infinite canvas, project context and design tokens so related screens can evolve together.' },
    { title: 'Built for iteration', text: 'Generate a starting point, inspect the design, change details and keep refining. The workflow brings together visual editing and natural-language requests.' },
    { title: 'A local-first foundation', text: 'Projects are stored by this installation in a local SQLite database. AI requests still go to the selected provider unless you configure a local model.', href: '/privacy', action: 'How data is handled' },
    { title: 'Built in the open', text: 'This workspace builds on the MIT-licensed OpenUI codebase and its existing tooling. The repository LICENSE contains the original copyright and license terms.', href: '/contact', action: 'Meet the builder' },
  ] },
  blog: { title: 'Practical guides for better interfaces.', group: 'Company', description: 'Complete guides to mobile app screens, SaaS design systems and meditation app interfaces.', sections: [
    { title: 'Design better mobile app screens with AI', text: 'Work through a clear brief, shared styling, layout refinement and connected mobile screens.', href: '/blog/design-better-mobile-app-screens', action: 'Read the mobile design guide' },
    { title: 'Create a design system for your SaaS product', text: 'Define colors, typography, spacing and reusable components with practical visual examples.', href: '/blog/create-saas-design-system', action: 'Read the design-system guide' },
    { title: 'Design a meditation app UI', text: 'Explore a calm visual style, connected meditation screens and a practical review process.', href: '/blog/design-meditation-app-ui', action: 'Read the meditation design guide' },
  ] },
  contact: { title: 'Let’s talk about what you’re building.', group: 'Company', description: 'Questions, feedback or a workflow that could be better? Start a conversation.', sections: [
    { title: 'Email', text: 'For product, privacy or security enquiries, email solankiabhay722@gmail.com. Please do not include passwords or active API keys.', href: 'mailto:solankiabhay722@gmail.com', action: 'solankiabhay722@gmail.com' },
    { title: 'Product questions and feedback', text: 'Reach Abhay on X. Share a short description of the issue and the outcome you expected.', href: 'https://x.com/abhay8769', action: 'Contact on X' },
    { title: 'Work and collaboration', text: 'Connect on LinkedIn for a professional introduction or a conversation about building products.', href: 'https://www.linkedin.com/in/abhay-solanki-b2a503234/', action: 'Contact on LinkedIn' },
    { title: 'Before reporting an issue', text: 'Include reproduction steps, browser/device information and the visible error. Never publish provider keys, integration keys, private project HTML or personal records.', href: '/documentation#troubleshooting', action: 'Troubleshooting guide' },
  ] },
  ...legalPages,
};

export { blogArticles } from '@/lib/blog-content';
