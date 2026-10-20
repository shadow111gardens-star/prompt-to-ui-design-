import { legalPages } from '@/lib/legal-pages';
export type SiteSection = { title: string; text: string; bullets?: string[]; href?: string; action?: string; table?: { headers: string[]; rows: string[][] } };
export type SitePage = { title: string; group: string; description: string; sections: SiteSection[] };
export const footerGroups = [
  { title: 'Product', items: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
  { title: 'Resources', items: ['Documentation', 'Templates', 'Showcase', 'Community'] },
  { title: 'Company', items: ['About', 'Blog', 'Careers', 'Contact'] },
  { title: 'Legal', items: ['Terms', 'Privacy', 'Security', 'Cookies'] },
];
export const pageHref = (label: string) => `/${label.toLowerCase()}`;
export const sitePages: Record<string, SitePage> = {
  features: { title: 'One canvas. Your entire interface.', group: 'Product', description: 'Go from a rough idea to connected screens, then refine the details in one workspace.', sections: [
    { title: 'Generate with a prompt', text: 'Describe a product, audience and visual direction. OpenUI streams generated screens into your project.', bullets: ['Choose your configured AI provider and model.', 'Keep multiple screens together.', 'Review the output directly on the canvas.'], href: '/templates', action: 'Explore starter prompts' },
    { title: 'Edit the details', text: 'Select elements inside generated screens and adjust text, dimensions, spacing, colors and typography with the properties panel.', href: '/documentation#editing', action: 'Learn about editing' },
    { title: 'Iterate with project chat', text: 'Ask for a new screen, a selected-element edit or a redesign. Project context helps related screens follow the same design system.' },
    { title: 'Keep your design consistent', text: 'Inspect project colors and typography in Design System & Tokens. Review the page-specific design notes and refine shared styling.' },
    { title: 'Preview at different sizes', text: 'Switch between phone, tablet and desktop frames. Pan, zoom and compare screens without leaving the workspace.' },
    { title: 'Export your screens', text: 'Download the current screen or all screens as PNG, JPG or SVG. All-screen exports package the images in a ZIP archive.', href: '/documentation#exports', action: 'Export guide' },
  ] },
  pricing: { title: 'Simple Pricing for Everyone', group: 'Product', description: 'Explore the published plans and how this local installation works.', sections: [
    { title: 'Your local workspace', text: 'This installation uses your configured AI providers. Paid checkout, subscriptions and credit metering are not connected here. Provider usage charges are separate.', href: '/dashboard/workspace/settings#tab-billing', action: 'View billing settings' },
  ] },
  changelog: { title: 'A better workflow, one update at a time.', group: 'Product', description: 'A digest of functionality implemented in this OpenUI workspace.', sections: [
    { title: 'Responsive workspace', text: 'Responsive page gutters, mobile navigation, viewport-bounded panels and dialogs, and touch canvas navigation.', bullets: ['Two-finger zoom and pan.', 'Compact editor navigation.', 'Stacked token editors on smaller screens.'] },
    { title: 'Workspace settings', text: 'Local profile persistence, project search, theme switching and an OpenUI integration key with generation, reveal, copy, rotation and revocation.' },
    { title: 'Project chat and element editing', text: 'Project-scoped chat history and screen context, selected-element editing, and review of broad changes before applying them.' },
    { title: 'Image exports', text: 'Current-screen and all-screen exports in PNG, JPG and SVG. Legacy code export options remain hidden in this build.' },
  ] },
  roadmap: { title: 'What comes next.', group: 'Product', description: 'Directions for future work. Planned items are not shipping commitments or release dates.', sections: [
    { title: 'Available now', text: 'Multi-screen canvas, AI generation, project chat, element editing, shared design tokens and image exports.', href: '/features', action: 'See current features' },
    { title: 'Improve next', text: 'Broader browser/device verification, more resilient generation recovery and deeper accessibility checks are areas for continued improvement.' },
    { title: 'Under consideration', text: 'More reusable screen starters, richer integration APIs and connected subscription management. These are ideas, not enabled features.' },
    { title: 'Help shape the direction', text: 'Share the task you are trying to complete and what gets in the way. Specific workflows are more useful than a feature name alone.', href: '/contact', action: 'Share feedback' },
  ] },
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
  blog: { title: 'Notes from the design workflow.', group: 'Company', description: 'Practical guides to better prompts, consistent screens and a smoother handoff.', sections: [
    { title: 'Write a prompt that gives your design direction', text: 'Specify audience, screens, content and shared tokens before you focus on decorative details.', href: '/blog/better-ui-prompts', action: 'Read the guide' },
    { title: 'Keep a multi-screen app consistent', text: 'Use existing screens as a reference and describe which details a redesign must preserve.', href: '/blog/consistent-screens', action: 'Read the guide' },
    { title: 'Prepare a design for export', text: 'Check the screen boundaries, preview sizes and output format before sharing a design.', href: '/blog/export-checklist', action: 'Read the guide' },
  ] },
  careers: { title: 'Build tools that help people create.', group: 'Company', description: 'An honest look at opportunities around this project.', sections: [
    { title: 'No open roles listed', text: 'There are currently no published job openings or application process on this site. New roles will be listed here when available.' },
    { title: 'Interested in the work?', text: 'Introduce yourself with the kind of problem you enjoy solving and a link to relevant work. Please do not send identity documents or sensitive personal details through public social posts.', href: '/contact', action: 'Get in touch' },
  ] },
  contact: { title: 'Let’s talk about what you’re building.', group: 'Company', description: 'Questions, feedback or a workflow that could be better? Start a conversation.', sections: [
    { title: 'Email', text: 'For product, privacy or security enquiries, email solankiabhay722@gmail.com. Please do not include passwords or active API keys.', href: 'mailto:solankiabhay722@gmail.com', action: 'solankiabhay722@gmail.com' },
    { title: 'Product questions and feedback', text: 'Reach Abhay on X. Share a short description of the issue and the outcome you expected.', href: 'https://x.com/abhay8769', action: 'Contact on X' },
    { title: 'Work and collaboration', text: 'Connect on LinkedIn for a professional introduction or a conversation about building products.', href: 'https://www.linkedin.com/in/abhay-solanki-b2a503234/', action: 'Contact on LinkedIn' },
    { title: 'Before reporting an issue', text: 'Include reproduction steps, browser/device information and the visible error. Never publish provider keys, integration keys, private project HTML or personal records.', href: '/documentation#troubleshooting', action: 'Troubleshooting guide' },
  ] },
  ...legalPages,
};

export const blogArticles: Record<string, SitePage> = {
  'better-ui-prompts': { group: 'Guide', title: 'Give your UI prompt a clear direction.', description: 'A useful design brief is specific about the product and flexible about the execution.', sections: [
    { title: 'Start with the task', text: 'Say who the interface is for and what they need to do. “A fitness tracker for people planning three weekly workouts” gives the model a clearer product than “a beautiful dashboard”.' },
    { title: 'Name the connected screens', text: 'List the screens and the content each one needs. Include realistic numbers, labels and empty-state expectations. Ask for the same navigation and design system across the set.' },
    { title: 'Define the visual rules', text: 'Specify a palette, font direction, spacing rhythm, card treatment and target devices. Give a few useful constraints instead of a long collection of unrelated style references.' },
    { title: 'Iterate one decision at a time', text: 'Review the first result, select the screen or element you mean, and describe a concrete change. Keep successful details and request broader changes only when needed.', href: '/templates', action: 'Try a starter prompt' },
  ] },
  'consistent-screens': { group: 'Guide', title: 'Make every screen belong to the same app.', description: 'Consistency comes from a small set of shared decisions.', sections: [
    { title: 'Choose a reference', text: 'Use an existing screen as the reference for colors, typography, spacing, navigation and button styles. Tell a redesign request which parts must remain consistent.' },
    { title: 'Separate layout from styling', text: 'A profile page can have a different content structure while sharing the dashboard’s surfaces, text hierarchy and controls. Ask for a new arrangement while preserving those rules.' },
    { title: 'Compare at the same size', text: 'Review neighboring screens at matching device dimensions. Look at heading weights, card padding and primary-action placement before adjusting individual decorations.' },
    { title: 'Review shared changes', text: 'A project-wide button change affects several screens. Inspect the proposed changes, apply only the intended set and verify the result before exporting.', href: '/documentation#design-system', action: 'Read the design-system guide' },
  ] },
  'export-checklist': { group: 'Guide', title: 'A short checklist before you export.', description: 'Help the next person see the design as you intended.', sections: [
    { title: 'Check the boundaries', text: 'Open Preview and check that content fits the intended screen. Review scrolling sections, fixed navigation and the corners of device frames.' },
    { title: 'Use realistic content', text: 'Replace unfinished labels and check wrapping with longer names and descriptions. Verify the selected screen and the full screen set before choosing an all-screen export.' },
    { title: 'Choose the format', text: 'PNG works well for sharp interface screenshots. JPG is useful when a smaller photographic raster is preferred. SVG exports can embed HTML, so test compatibility in the destination tool.' },
    { title: 'Review the download', text: 'Open the downloaded image or ZIP archive. Confirm screen names and content. A picture of an interface is a design handoff, not a tested production application.', href: '/documentation#exports', action: 'Export documentation' },
  ] },
};
