export type DesignTarget = 'web' | 'app';

export function projectDesignTarget(sketches: unknown): DesignTarget | undefined {
  try {
    const value = typeof sketches === 'string' ? JSON.parse(sketches) : sketches;
    const target = value && typeof value === 'object' ? (value as { designTarget?: unknown }).designTarget : undefined;
    return target === 'web' || target === 'app' ? target : undefined;
  } catch { return undefined; }
}

export function designTargetInstruction(target?: DesignTarget): string {
  if (target === 'web') return '\nPROJECT DESIGN TARGET: WEB WEBSITE. Responsive 1600x900 default,adapt to mobile. Website nav,sections,hierarchy,footer where appropriate; never phone mockup,mobile app or unrelated dashboard. Keep direction across screens/edits.';
  if (target === 'app') return '\nPROJECT DESIGN TARGET: APP APPLICATION. Responsive mobile-first 375x812 default. Task screens,functional controls,app nav,stateful components; never marketing website,long landing page,promotional hero or website footer. Keep direction across screens/edits.';
  return '';
}
