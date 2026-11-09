export type Child = Node | string | null | undefined | false;

export interface ElementProps {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  style?: Partial<CSSStyleDeclaration>;
  on?: Record<string, EventListener>;
  title?: string;
}

/** Tiny element factory to keep the editor code readable without a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.title !== undefined) element.title = props.title;
  if (props.attrs) {
    for (const [name, value] of Object.entries(props.attrs)) {
      if (value === null || value === undefined || value === false) continue;
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }
  if (props.style) Object.assign(element.style, props.style);
  if (props.on) {
    for (const [name, listener] of Object.entries(props.on)) element.addEventListener(name, listener);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

export function clear(element: HTMLElement): void {
  element.replaceChildren();
}

const ICONS: Record<string, string> = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M9 4v6h6V4M9 20v-6h6v6"/>',
  open: '<path d="M3 7h6l2 2h10v10H3z"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m3 17 5-5 4 4 3-3 6 6"/>',
  grid: '<path d="M4 9h16M4 15h16M9 4v16M15 4v16"/>',
  magnet: '<path d="M6 4v7a6 6 0 0 0 12 0V4h-4v7a2 2 0 0 1-4 0V4z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="m3 3 18 18"/><path d="M10.5 5.2A10.9 10.9 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-2.4 3.4M6.4 6.5A17 17 0 0 0 2 12s4 7 10 7a10 10 0 0 0 4.3-.9"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
  ui: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
  text: '<path d="M5 6h14M12 6v12M8 18h8"/>',
};

export function svgIcon(name: string, size = 16): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name] ?? ICONS.spark;
  return svg;
}

/** Convert #rrggbb or #rrggbbaa to a value an <input type="color"> accepts. */
export function colorInputValue(value: string): string {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim());
  if (match) return `#${match[1]}`;
  return '#000000';
}

export function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits);
}
