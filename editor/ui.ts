import { el, svgIcon, type Child } from './dom';

export function toolbarButton(
  label: string,
  iconName: string,
  onClick: () => void,
  variant: 'ghost' | 'primary' = 'ghost',
): HTMLButtonElement {
  const button = el('button', {
    class: `btn btn-${variant}`,
    attrs: { type: 'button', title: label, 'aria-label': label },
    on: { click: () => onClick() },
  });
  button.append(svgIcon(iconName, 15), el('span', { text: label }));
  return button;
}

export function iconButton(
  iconName: string,
  title: string,
  onClick: (event: Event) => void,
  options: { danger?: boolean; active?: boolean } = {},
): HTMLButtonElement {
  const button = el('button', {
    class: `btn-icon${options.danger ? ' is-danger' : ''}${options.active ? ' is-active' : ''}`,
    attrs: { type: 'button', title, 'aria-label': title },
    on: { click: (event) => onClick(event) },
  });
  button.append(svgIcon(iconName, 14));
  return button;
}

export function fieldRow(label: string, control: Child, hint?: string): HTMLElement {
  return el(
    'div',
    { class: 'field' },
    el('span', { class: 'field-label', text: label }),
    el('div', { class: 'field-control' }, control),
    hint ? el('span', { class: 'field-hint', text: hint }) : null,
  );
}

export function emptyState(title: string, description: string): HTMLElement {
  return el(
    'div',
    { class: 'empty-state' },
    el('span', { class: 'empty-title', text: title }),
    el('span', { class: 'empty-text', text: description }),
  );
}

export function miniButton(label: string, onClick: () => void, title = label): HTMLButtonElement {
  return el('button', {
    class: 'mini-btn',
    text: label,
    attrs: { type: 'button', title },
    on: { click: () => onClick() },
  });
}
