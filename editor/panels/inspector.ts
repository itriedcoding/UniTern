import {
  clamp,
  getComponentConstructor,
  listComponentSchemas,
  type ComponentData,
  type FieldDef,
  type NodeData,
} from '../../src/index';
import type { EditorContext } from '../context';
import type { EditorState } from '../state';
import { el, formatNumber } from '../dom';
import { emptyState, fieldRow, iconButton } from '../ui';

interface NumberOptions {
  step?: number | 'any';
  min?: number;
  max?: number;
}

function vec2Value(value: unknown): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]) || 0, Number(value[1]) || 0];
  }
  return [0, 0];
}

function rectValue(value: unknown): [number, number, number, number] | null {
  if (Array.isArray(value) && value.length >= 4) {
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0, Number(value[3]) || 0];
  }
  return null;
}

function liveText(get: () => string, set: (value: string) => void, state: EditorState, multiline = false): HTMLElement {
  const input: HTMLInputElement | HTMLTextAreaElement = multiline
    ? el('textarea', { class: 'input input-area', attrs: { rows: 3 } })
    : el('input', { class: 'input', attrs: { type: 'text', spellcheck: 'false' } });
  input.value = get();
  input.addEventListener('focus', () => state.beginTransaction());
  input.addEventListener('input', () => {
    set(input.value);
    state.touch('view');
  });
  input.addEventListener('blur', () => setTimeout(() => state.endTransaction(), 0));
  if (!multiline) {
    input.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Enter') {
        keyboardEvent.preventDefault();
        input.blur();
      }
    });
  }
  return input;
}

function liveNumber(get: () => number, set: (value: number) => void, state: EditorState, options: NumberOptions = {}): HTMLElement {
  const input = el('input', {
    class: 'input input-number',
    attrs: {
      type: 'number',
      step: options.step ?? 1,
      min: options.min,
      max: options.max,
    },
  });
  const precision = options.step === 'any' ? 6 : options.step !== undefined && options.step < 0.01 ? 5 : 3;
  input.value = formatNumber(get(), precision);
  input.addEventListener('focus', () => state.beginTransaction());
  input.addEventListener('input', () => {
    const parsed = Number(input.value);
    if (input.value.trim() !== '' && Number.isFinite(parsed)) {
      const value = options.min !== undefined || options.max !== undefined
        ? clamp(parsed, options.min ?? -Infinity, options.max ?? Infinity)
        : parsed;
      set(value);
      state.touch('view');
    }
  });
  input.addEventListener('blur', () => setTimeout(() => state.endTransaction(), 0));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    }
  });
  return input;
}

function liveVec2(
  get: () => [number, number],
  set: (value: [number, number]) => void,
  state: EditorState,
  step = 1,
): HTMLElement {
  const row = el('div', { class: 'vec2' });
  const makeAxis = (index: 0 | 1, label: string): HTMLElement => {
    const input = el('input', { class: 'input input-number', attrs: { type: 'number', step } });
    input.value = formatNumber(get()[index], 3);
    input.addEventListener('focus', () => state.beginTransaction());
    input.addEventListener('input', () => {
      const parsed = Number(input.value);
      if (input.value.trim() === '' || !Number.isFinite(parsed)) return;
      const next = get();
      next[index] = parsed;
      set(next);
      state.touch('view');
    });
    input.addEventListener('blur', () => setTimeout(() => state.endTransaction(), 0));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    return el('label', { class: 'vec-field' }, el('span', { class: 'vec-label', text: label }), input);
  };
  row.append(makeAxis(0, 'X'), makeAxis(1, 'Y'));
  return row;
}

function liveRect(
  get: () => [number, number, number, number] | null,
  set: (value: [number, number, number, number] | null) => void,
  state: EditorState,
): HTMLElement {
  const wrapper = el('div', { class: 'rect-field' });
  const enabled = el('input', { attrs: { type: 'checkbox' } });
  enabled.checked = get() !== null;
  enabled.addEventListener('change', () => {
    state.mutate(() => set(enabled.checked ? [0, 0, 64, 64] : null));
  });
  wrapper.append(el('label', { class: 'toggle' }, enabled, el('span', { text: 'Enabled' })));

  const current = get();
  if (current) {
    const grid = el('div', { class: 'rect-grid' });
    const labels = ['X', 'Y', 'W', 'H'] as const;
    labels.forEach((label, index) => {
      const input = el('input', { class: 'input input-number', attrs: { type: 'number', step: 1 } });
      const read = get();
      input.value = formatNumber(read ? read[index] : 0, 3);
      input.addEventListener('focus', () => state.beginTransaction());
      input.addEventListener('input', () => {
        const parsed = Number(input.value);
        if (input.value.trim() === '' || !Number.isFinite(parsed)) return;
        const next = get();
        if (!next) return;
        next[index] = parsed;
        set(next);
        state.touch('view');
      });
      input.addEventListener('blur', () => setTimeout(() => state.endTransaction(), 0));
      grid.append(el('label', { class: 'vec-field' }, el('span', { class: 'vec-label', text: label }), input));
    });
    wrapper.append(grid);
  }
  return wrapper;
}

function liveColor(get: () => string, set: (value: string) => void, state: EditorState): HTMLElement {
  const swatch = el('span', { class: 'swatch' });
  swatch.style.background = get();
  const input = el('input', { class: 'input', attrs: { type: 'text', spellcheck: 'false' } });
  input.value = get();
  input.addEventListener('focus', () => state.beginTransaction());
  input.addEventListener('input', () => {
    set(input.value);
    swatch.style.background = input.value;
    state.touch('view');
  });
  input.addEventListener('blur', () => setTimeout(() => state.endTransaction(), 0));
  return el('div', { class: 'color-field' }, swatch, input);
}

function selectControl(
  value: string,
  options: Array<{ value: string; label: string }>,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = el('select', { class: 'input select' });
  for (const option of options) {
    select.append(el('option', { attrs: { value: option.value }, text: option.label }));
  }
  select.value = options.some((option) => option.value === value) ? value : options[0]?.value ?? '';
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function toggle(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const input = el('input', { attrs: { type: 'checkbox' } });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'toggle' }, input, el('span', { text: label }));
}

function renderField(node: NodeData, component: ComponentData, field: FieldDef, ctx: EditorContext): HTMLElement {
  const { state } = ctx;
  const key = field.key;
  switch (field.type) {
    case 'number':
      return fieldRow(
        field.label,
        liveNumber(
          () => Number(component[key]) || 0,
          (value) => {
            component[key] = value;
          },
          state,
          { step: field.step, min: field.min, max: field.max },
        ),
        field.hint,
      );
    case 'vec2':
      return fieldRow(
        field.label,
        liveVec2(
          () => vec2Value(component[key]),
          (value) => {
            component[key] = value;
          },
          state,
        ),
        field.hint,
      );
    case 'rect':
      return fieldRow(
        field.label,
        liveRect(
          () => rectValue(component[key]),
          (value) => {
            component[key] = value;
          },
          state,
        ),
        field.hint,
      );
    case 'color':
      return fieldRow(
        field.label,
        liveColor(
          () => String(component[key] ?? '#ffffff'),
          (value) => {
            component[key] = value;
          },
          state,
        ),
        field.hint,
      );
    case 'text':
      return fieldRow(
        field.label,
        liveText(
          () => String(component[key] ?? ''),
          (value) => {
            component[key] = value;
          },
          state,
        ),
        field.hint,
      );
    case 'textarea':
      return fieldRow(
        field.label,
        liveText(
          () => String(component[key] ?? ''),
          (value) => {
            component[key] = value;
          },
          state,
          true,
        ),
        field.hint,
      );
    case 'boolean':
      return el(
        'div',
        { class: 'field field-inline' },
        toggle(field.label, Boolean(component[key]), (checked) => {
          state.mutate(() => {
            component[key] = checked;
          });
        }),
        field.hint ? el('span', { class: 'field-hint', text: field.hint }) : null,
      );
    case 'select':
      return fieldRow(
        field.label,
        selectControl(String(component[key] ?? ''), field.options ?? [], (value) => {
          state.mutate(() => {
            component[key] = value;
          });
        }),
        field.hint,
      );
    case 'asset': {
      const options = [{ value: '', label: 'None' }].concat(
        state.scene.assets
          .filter((asset) => asset.type === 'image')
          .map((asset) => ({ value: asset.id, label: asset.name })),
      );
      return fieldRow(
        field.label,
        selectControl(String(component[key] ?? ''), options, (value) => {
          state.mutate(() => {
            component[key] = value;
          });
        }),
        field.hint ?? 'Import images from the Assets panel',
      );
    }
    case 'node': {
      const options = [{ value: '', label: 'None' }].concat(
        listNodeOptions(node, state.scene.root).map((option) => ({ value: option.id, label: option.label })),
      );
      return fieldRow(
        field.label,
        selectControl(String(component[key] ?? ''), options, (value) => {
          state.mutate(() => {
            component[key] = value;
          });
        }),
        field.hint,
      );
    }
    default:
      return fieldRow(field.label, el('span', { class: 'muted', text: 'Unsupported field' }));
  }
}

function listNodeOptions(node: NodeData, root: NodeData): Array<{ id: string; label: string }> {
  const options: Array<{ id: string; label: string }> = [];
  const walk = (current: NodeData): void => {
    if (current.id !== node.id) options.push({ id: current.id, label: current.name || 'Node' });
    current.children.forEach(walk);
  };
  walk(root);
  return options;
}

function componentCard(node: NodeData, component: ComponentData, index: number, ctx: EditorContext): HTMLElement {
  const { state } = ctx;
  const schema = getComponentConstructor(component.type)?.schema;
  const card = el('section', { class: 'component-card' });
  const head = el(
    'div',
    { class: 'component-head' },
    el('span', { class: 'component-title', text: schema?.label ?? component.type }),
    iconButton(
      'trash',
      'Remove component',
      () => state.removeComponent(node.id, index),
      { danger: true },
    ),
  );
  card.append(head);
  if (!schema) {
    card.append(el('p', { class: 'component-note', text: 'Unknown component type. It is kept in the scene file unchanged.' }));
    return card;
  }
  const body = el('div', { class: 'component-body' });
  for (const field of schema.fields) body.append(renderField(node, component, field, ctx));
  card.append(body);
  return card;
}

function parentOptions(node: NodeData, root: NodeData): Array<{ id: string; label: string }> {
  const blocked = new Set<string>([node.id]);
  const mark = (current: NodeData): void => {
    blocked.add(current.id);
    current.children.forEach(mark);
  };
  mark(node);
  const options: Array<{ id: string; label: string }> = [];
  const walk = (current: NodeData): void => {
    if (!blocked.has(current.id)) options.push({ id: current.id, label: current.name || 'Node' });
    current.children.forEach(walk);
  };
  walk(root);
  return options;
}

function nodeSection(node: NodeData, ctx: EditorContext): HTMLElement {
  const { state } = ctx;
  const isRoot = node.id === state.scene.root.id;
  const section = el('section', { class: 'inspector-section' });

  const actions = el('div', { class: 'section-actions' });
  if (!isRoot) {
    actions.append(
      iconButton('up', 'Move up', () => state.moveNode(node.id, -1)),
      iconButton('down', 'Move down', () => state.moveNode(node.id, 1)),
      iconButton('copy', 'Duplicate', () => state.duplicateNode(node.id)),
      iconButton('trash', 'Delete', () => state.removeNode(node.id), { danger: true }),
    );
  }
  section.append(el('div', { class: 'section-head' }, el('span', { class: 'section-title', text: 'Node' }), actions));

  section.append(
    fieldRow(
      'Name',
      liveText(
        () => node.name,
        (value) => {
          node.name = value;
        },
        state,
      ),
    ),
    fieldRow(
      'Tags',
      liveText(
        () => node.tags.join(', '),
        (value) => {
          node.tags = value
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        },
        state,
      ),
      'Comma separated, used by Collision and Collectible',
    ),
  );

  const parent = state.findParent(node.id);
  if (!isRoot) {
    section.append(
      fieldRow(
        'Parent',
        selectControl(
          parent?.id ?? '',
          [{ value: '', label: 'None' }].concat(
            parentOptions(node, state.scene.root).map((option) => ({ value: option.id, label: option.label })),
          ),
          (value) => {
            if (value) state.reparent(node.id, value);
          },
        ),
      ),
    );
  }

  section.append(
    el(
      'div',
      { class: 'toggle-row' },
      toggle('Active', node.active, (checked) => state.mutate(() => { node.active = checked; })),
      toggle('Visible', node.visible, (checked) => state.mutate(() => { node.visible = checked; })),
      toggle('Screen space', node.screenSpace, (checked) => state.mutate(() => { node.screenSpace = checked; })),
    ),
  );

  section.append(
    fieldRow(
      'Position',
      liveVec2(
        () => node.position,
        (value) => {
          node.position = value;
        },
        state,
      ),
    ),
    fieldRow(
      'Rotation',
      liveNumber(
        () => (node.rotation * 180) / Math.PI,
        (value) => {
          node.rotation = (value * Math.PI) / 180;
        },
        state,
        { step: 1 },
      ),
      'Degrees',
    ),
    fieldRow(
      'Scale',
      liveVec2(
        () => node.scale,
        (value) => {
          node.scale = value;
        },
        state,
        0.1,
      ),
    ),
    fieldRow(
      'Z Index',
      liveNumber(
        () => node.zIndex,
        (value) => {
          node.zIndex = value;
        },
        state,
      ),
      'Higher values draw on top',
    ),
  );

  return section;
}

function sceneSection(ctx: EditorContext): HTMLElement {
  const { state } = ctx;
  const scene = state.scene;
  const section = el('section', { class: 'inspector-section' });
  section.append(el('div', { class: 'section-head' }, el('span', { class: 'section-title', text: 'Scene' })));
  section.append(
    fieldRow(
      'Background',
      liveColor(
        () => scene.settings.background,
        (value) => {
          scene.settings.background = value;
        },
        state,
      ),
    ),
    fieldRow(
      'Gravity',
      liveVec2(
        () => scene.settings.gravity,
        (value) => {
          scene.settings.gravity = value;
        },
        state,
        10,
      ),
      'World units per second squared',
    ),
    fieldRow(
      'Fixed step',
      liveNumber(
        () => scene.settings.fixedStep,
        (value) => {
          scene.settings.fixedStep = clamp(value, 1 / 240, 1 / 10);
        },
        state,
        { step: 'any', min: 1 / 240, max: 1 / 10 },
      ),
      'Seconds per physics step',
    ),
  );
  return section;
}

export function renderInspector(container: HTMLElement, ctx: EditorContext): void {
  const { state } = ctx;
  const scrollTop = container.scrollTop;
  container.replaceChildren();
  const node = state.findNode(state.selectedId);
  if (!node) {
    container.append(emptyState('Nothing selected', 'Pick a node in the hierarchy or click one in the viewport.'));
    return;
  }

  container.append(nodeSection(node, ctx));
  if (node.id === state.scene.root.id) container.append(sceneSection(ctx));

  for (const [index, component] of node.components.entries()) {
    container.append(componentCard(node, component, index, ctx));
  }

  const addRow = el('div', { class: 'add-component' });
  const select = el('select', { class: 'input select' });
  select.append(el('option', { attrs: { value: '' }, text: 'Add component…' }));
  for (const schema of [...listComponentSchemas()].sort((a, b) => a.label.localeCompare(b.label))) {
    select.append(el('option', { attrs: { value: schema.type }, text: schema.label }));
  }
  select.addEventListener('change', () => {
    if (!select.value) return;
    state.addComponent(node.id, select.value);
    select.value = '';
  });
  addRow.append(select);
  container.append(addRow);
  container.scrollTop = scrollTop;
}
