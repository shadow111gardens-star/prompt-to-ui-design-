export type ColorProperty = 'color' | 'background-color' | 'border-color' | 'fill' | 'stroke' | 'placeholder-color';
export type ColorEdit = { property: ColorProperty; value: string | null; targetId?: string };
export const COLOR_PROPERTIES: ColorProperty[] = ['color','background-color','border-color','fill','stroke','placeholder-color'];

export function validColor(value: string, paint = false): boolean {
 const color = value.trim();
 if (!color || color.length > 256 || /[;{}<>\\]|\/\*|url\s*\(|expression\s*\(/i.test(color)) return false;
 if (paint && color.toLowerCase() === 'none') return true;
 if (typeof CSS !== 'undefined') return CSS.supports('color', color);
 return /^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(color) || /^(?:transparent|inherit|currentcolor|unset|revert|black|white|red|green|blue|orange|gray|grey)$/i.test(color) ||
  /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|color-mix|var)\([a-z\d\s.,%+\-()/]*\)$/i.test(color);
}

/** Always represent transparency explicitly; native RGB pickers must not discard it. */
export function colorHex(value: string): string | null {
 const color = value.trim();
 if (/^#[a-f\d]{3,4}$/i.test(color)) return '#'+color.slice(1).split('').map(c=>c+c).join('').toUpperCase();
 if (/^#(?:[a-f\d]{6}|[a-f\d]{8})$/i.test(color)) return color.toUpperCase();
 if (color.toLowerCase() === 'transparent') return '#00000000';
 const rgb = color.match(/^rgba?\(\s*([\d.]+%?)[,\s]+([\d.]+%?)[,\s]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
 if (rgb) {
  const byte = (v:string,alpha=false) => Math.round(Math.max(0,Math.min(255,(v.endsWith('%')?parseFloat(v)/100*255:parseFloat(v)*(alpha?255:1))))).toString(16).padStart(2,'0');
  return ('#'+rgb.slice(1,4).map(v=>byte(v)).join('')+(rgb[4]!==undefined?byte(rgb[4],true):'')).toUpperCase();
 }
 if (typeof document === 'undefined' || !validColor(color)) return null;
 // A locally filled pixel only; no remote images or cross-origin readback.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 ctx.fillStyle=color;ctx.fillRect(0,0,1,1);
 const rgba=ctx.getImageData(0,0,1,1).data;
 return '#'+Array.from(rgba).map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export function replaceColorRGB(rgb: string, previous: string): string {
 const alpha=colorHex(previous)?.slice(7)||'';
 return rgb.toUpperCase()+alpha;
}
export function colorWithAlpha(value: string, percentage: number): string | null {
 const hex=colorHex(value);if(!hex||!Number.isFinite(percentage))return null;
 return hex.slice(0,7)+Math.round(Math.max(0,Math.min(100,percentage))/100*255).toString(16).padStart(2,'0').toUpperCase();
}
