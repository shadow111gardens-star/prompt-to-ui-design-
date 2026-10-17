import { hexToRgb, relativeLuminance } from "@/lib/contrast";

export function applyPreviewTheme(html: string, vars: Record<string, string>): string {
  const safe = (value: string) => value.replace(/[<>]/g, "");
  const rgb = hexToRgb(vars["--color-primary"] || "#000000");
  const foreground = rgb && relativeLuminance(...rgb) > 0.179 ? "#000000" : "#ffffff";
  const declarations = Object.entries(vars).filter(([name]) => /^--[\w-]+$/.test(name)).map(([name, value]) => `${name}:${safe(value)}`).join(";");
  const css = `:root{${declarations};--ft-bg:var(--color-secondary);--ft-surface:var(--color-surface-variant);--ft-lime:var(--color-primary);--ft-text:var(--color-text)}
[data-generated-ui]{background-color:var(--color-secondary)!important;color:var(--color-text)!important;font-family:var(--font-body)!important}
.profile-card,.stat-box{background:var(--color-surface-variant)!important;border-radius:var(--border-radius-card)!important}
.btn-lime{background:var(--color-primary)!important;color:${foreground}!important;border-radius:var(--border-radius-button)!important}
body{font-family:var(--font-body)!important;color:var(--color-text)}
h1,h2,h3,h4,h5,h6{font-family:var(--font-heading)!important}
.c-bg{background-color:var(--color-secondary)!important}.c-fg,.c-card-fg{color:var(--color-text)!important}
.c-card-bg{background-color:var(--color-surface-variant)!important;border-radius:var(--border-radius-card)!important}
.c-primary-bg{background-color:var(--color-primary)!important}.c-primary-fg{color:${foreground}!important}
.c-accent-bg{background-color:var(--color-accent)!important}.c-muted-bg{background-color:var(--color-muted)!important}.c-border{border-color:var(--color-border)!important}
button.c-primary-bg,a.c-primary-bg{border-radius:var(--border-radius-button)!important}
#fittrack-review .ft-board{--ft-bg:var(--color-secondary)!important;--ft-surface:var(--color-surface-variant)!important;--ft-lime:var(--color-primary)!important;--ft-text:var(--color-text)!important;font-family:var(--font-body)!important}
#fittrack-review .ft-title,#fittrack-review h1,#fittrack-review h2,#fittrack-review h3{font-family:var(--font-heading)!important;color:var(--color-text)!important}
#fittrack-review .ft-panel,#fittrack-review .ft-exercise{border-radius:var(--border-radius-card)!important}
#fittrack-review .ft-primary{border-radius:var(--border-radius-button)!important;color:${foreground}!important}`;
  const style = `<style id="openui-theme-override">${css}</style>`;
  const clean = html.replace(/<style\s+id=["']openui-theme-override["'][^>]*>[\s\S]*?<\/style>/gi, "");
  return /<\/head>/i.test(clean) ? clean.replace(/<\/head>/i, `${style}</head>`) : clean + style;
}
