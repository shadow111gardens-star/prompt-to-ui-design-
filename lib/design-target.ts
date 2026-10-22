export type DesignTarget = 'web' | 'app';

export function projectDesignTarget(sketches: unknown): DesignTarget | undefined {
  try {
    const value = typeof sketches === 'string' ? JSON.parse(sketches) : sketches;
    const target = value && typeof value === 'object' ? (value as { designTarget?: unknown }).designTarget : undefined;
    return target === 'web' || target === 'app' ? target : undefined;
  } catch { return undefined; }
}

export function designTargetInstruction(target?: DesignTarget): string {
  if (target === 'web') return '\nPROJECT DESIGN TARGET: WEB WEBSITE. Create a responsive website, with website navigation, page sections, content hierarchy and a footer where appropriate. Default new screens to 1600x900 desktop website layouts that adapt to mobile. Interpret the requested subject as a website; do not replace it with a mobile app, phone mockup or unrelated application dashboard. Preserve this website direction for new screens and subsequent edits.';
  if (target === 'app') return '\nPROJECT DESIGN TARGET: APP APPLICATION. Create a mobile-first application interface with task-oriented screens, functional controls, application navigation and stateful components. Default new screens to 375x812 mobile app layouts, adapting responsively where needed. Interpret the requested subject as an application; do not replace it with a marketing website, long landing page, promotional hero or website footer. Preserve this application direction for new screens and subsequent edits.';
  return '';
}
