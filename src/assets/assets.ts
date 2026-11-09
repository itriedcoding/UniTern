import type { AssetData } from '../core/scene-data';

export interface LoadProgress {
  loaded: number;
  total: number;
  current: string | null;
}

/**
 * Image and audio store for a scene. Imports are embedded as data URLs so a
 * scene (and a built game) stays self-contained.
 */
export class AssetStore {
  private images = new Map<string, HTMLImageElement>();
  private pending = new Map<string, Promise<HTMLImageElement>>();
  private entriesById = new Map<string, AssetData>();

  constructor(entries: AssetData[] = []) {
    for (const entry of entries) this.entriesById.set(entry.id, entry);
  }

  get entries(): AssetData[] {
    return [...this.entriesById.values()];
  }

  add(entry: AssetData): void {
    this.entriesById.set(entry.id, entry);
  }

  remove(id: string): void {
    this.entriesById.delete(id);
    this.images.delete(id);
    this.pending.delete(id);
  }

  has(id: string): boolean {
    return this.entriesById.has(id);
  }

  getEntry(id: string): AssetData | undefined {
    return this.entriesById.get(id);
  }

  getImage(id: string | null | undefined): HTMLImageElement | undefined {
    if (!id) return undefined;
    return this.images.get(id);
  }

  /** Load an image entry into the cache. */
  async loadImage(id: string): Promise<HTMLImageElement | null> {
    const cached = this.images.get(id);
    if (cached) return cached;
    const pending = this.pending.get(id);
    if (pending) return pending;
    const entry = this.entriesById.get(id);
    if (!entry || entry.type !== 'image') return null;

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      if (!entry.src.startsWith('data:')) image.crossOrigin = 'anonymous';
      image.onload = () => {
        this.images.set(id, image);
        this.pending.delete(id);
        resolve(image);
      };
      image.onerror = () => {
        this.pending.delete(id);
        reject(new Error(`Failed to load image asset "${entry.name}" (${id})`));
      };
      image.src = entry.src;
    });
    this.pending.set(id, promise);
    try {
      return await promise;
    } catch (error) {
      console.warn('[unitern]', error);
      return null;
    }
  }

  /** Preload every image in the store. */
  async preload(onProgress?: (progress: LoadProgress) => void): Promise<void> {
    const images = this.entries.filter((entry) => entry.type === 'image');
    let loaded = 0;
    onProgress?.({ loaded, total: images.length, current: null });
    await Promise.all(
      images.map(async (entry) => {
        if (!this.images.has(entry.id)) onProgress?.({ loaded, total: images.length, current: entry.name });
        await this.loadImage(entry.id);
        loaded++;
        onProgress?.({ loaded, total: images.length, current: entry.name });
      }),
    );
  }
}

/** Read a File into a data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/** Load an <img> from any URL (including data URLs). */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith('data:')) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}
