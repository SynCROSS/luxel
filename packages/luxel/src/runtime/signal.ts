export type Unsubscribe = () => void;

export type Signal<T> = {
  value: T;
  subscribe(listener: () => void): Unsubscribe;
};

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get value() {
      return value;
    },
    set value(next: T) {
      if (Object.is(value, next)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function effect(fn: () => void | Unsubscribe): Unsubscribe {
  let cleanup: void | Unsubscribe;
  const run = () => {
    cleanup?.();
    cleanup = fn();
  };
  run();
  return () => cleanup?.();
}
