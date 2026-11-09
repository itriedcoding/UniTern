export type EventMap = Record<string, unknown>;
export type EventListener<T> = (payload: T) => void;
export type Unsubscribe = () => void;

/** Minimal typed event emitter used by the world and the game runtime. */
export class EventBus<E extends EventMap = EventMap> {
  private listeners = new Map<keyof E, Set<EventListener<never>>>();

  on<K extends keyof E>(event: K, listener: EventListener<E[K]>): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as EventListener<never>);
    return () => this.off(event, listener);
  }

  once<K extends keyof E>(event: K, listener: EventListener<E[K]>): Unsubscribe {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof E>(event: K, listener: EventListener<E[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as EventListener<never>);
    if (set.size === 0) this.listeners.delete(event);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as EventListener<E[K]>)(payload);
      } catch (error) {
        // A failing listener must not break the simulation loop.
        console.error(`[unitern] listener for "${String(event)}" threw`, error);
      }
    }
  }

  listenerCount(event: keyof E): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  clear(event?: keyof E): void {
    if (event === undefined) this.listeners.clear();
    else this.listeners.delete(event);
  }
}
