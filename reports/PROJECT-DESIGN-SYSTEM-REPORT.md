# Automatic project design system — 16 October 2026

The Design System & Tokens page now derives its guide from the selected project's saved generated screens, rather than displaying an unrelated starter palette. This applies to every project through the existing style-guide read path and requires zero AI generation requests.

The left panel shows detected shared roles, project fonts and a full palette of explicit colors. Existing token controls remain available through Edit shared tokens. Defaults for undetected semantic colors and shadows are not presented as observed screen values.

DESIGN.md includes each current screen's name, canvas dimensions, colors, fonts, declared font sizes and weights, radius values, and heading/content sections. Deleted history entries and in-progress frames are excluded. Screen documentation survives visual token-to-markdown synchronization. The split markdown editor stays synchronized when guide data changes.

Project loading now waits for the requested guide before mounting the autosaving editor, cancels obsolete requests, and remounts editor-local state for each project. This prevents old project data from being displayed or autosaved into a newly selected project.

Validation:
- 24/24 regression tests pass, including different project palettes/fonts, project isolation, inline/Tailwind declarations, variable cycles, history exclusion and markdown preservation.
- TypeScript: `npx tsc --noEmit` passes.
- Browser: original project displays #C6FF4D, #101114, #1C1D22 and Inter; four screen sections and font-size details appear in DESIGN.md; unrelated warm beige/coral description absent.
- Browser: separate Toolbar QA project shows its own name and documentation, without FitTrack content.
- Screenshot: project-design-system.jpg.

Detection is static and local: saved HTML, embedded CSS, inline declarations, CSS variables and literal Tailwind color classes. It inventories declarations; it is not a full browser CSS cascade audit. External stylesheets, named utility classes, runtime-only styles, complex gradients and fonts supplied only by external CSS may need manual confirmation. Shared role inference uses semantic names and common detected declarations. All explicit screen differences remain in the per-screen inventory.

No fitness-specific project ID, palette or font is hardcoded into the extraction. No AI call was made for extraction or its validation.
