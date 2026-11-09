/**
 * Component metadata. Every component declares serializable fields here, which
 * drives both scene serialization and the editor inspector, so the two can
 * never drift apart.
 */

export interface ComponentData {
  type: string;
  [key: string]: unknown;
}

export type FieldType =
  | 'number'
  | 'text'
  | 'textarea'
  | 'color'
  | 'boolean'
  | 'vec2'
  | 'rect'
  | 'select'
  | 'asset'
  | 'node';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  options?: FieldOption[];
  hint?: string;
}

export interface ComponentSchema {
  /** Stable identifier written into scene files. */
  type: string;
  /** Human readable name shown in the editor. */
  label: string;
  description?: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
}
