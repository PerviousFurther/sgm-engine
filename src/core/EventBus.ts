import type { RuntimeEventMap } from './types';

type Handler<T> = (payload: T) => void;

export class EventBus<Events extends object = RuntimeEventMap> {
  private listeners = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const handlers = this.listeners.get(event) ?? new Set();
    handlers.add(handler as Handler<never>);
    this.listeners.set(event, handlers);
    return () => handlers.delete(handler as Handler<never>);
  }

  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(event)?.forEach((handler) => handler(payload as never));
  }

  clear(): void {
    this.listeners.clear();
  }
}
