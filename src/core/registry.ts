import type { Component } from './component';
import type { ComponentData, ComponentSchema } from './fields';

export type ComponentConstructor<T extends Component = Component> = {
  new (): T;
  schema: ComponentSchema;
};

const registry = new Map<string, ComponentConstructor>();

/** Register a component so scenes can save and restore it. */
export function registerComponent<T extends Component>(ctor: ComponentConstructor<T>): void {
  const type = ctor.schema.type;
  if (!type || type === 'component') {
    throw new Error('Registered components need a unique schema type');
  }
  const existing = registry.get(type);
  if (existing && existing !== ctor) {
    throw new Error(`Component type "${type}" is already registered`);
  }
  registry.set(type, ctor as ComponentConstructor);
}

export function getComponentConstructor(type: string): ComponentConstructor | undefined {
  return registry.get(type);
}

export function createComponent(data: ComponentData): Component | null {
  const ctor = registry.get(data.type);
  if (!ctor) return null;
  const component = new ctor();
  component.applyData(data);
  return component;
}

export function createComponentByType(type: string): Component | null {
  const ctor = registry.get(type);
  if (!ctor) return null;
  const component = new ctor();
  component.applyData({ type });
  return component;
}

export function listComponentSchemas(): ComponentSchema[] {
  return [...registry.values()].map((ctor) => ctor.schema);
}

export function isComponentTypeRegistered(type: string): boolean {
  return registry.has(type);
}
