export type Unsubscribe = () => void;

export type Signal<T> = {
  value: T;
  subscribe(listener: () => void): Unsubscribe;
};

let activeEffect: (() => void) | null = null;
let activeEffectDepSets: Set<Set<() => void>> | null = null;

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<() => void>();

  return {
    get value() {
      if (activeEffect && activeEffectDepSets) {
        listeners.add(activeEffect);
        activeEffectDepSets.add(listeners);
      }
      return value;
    },
    set value(next: T) {
      if (Object.is(value, next)) return;
      value = next;
      [...listeners].forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function effect(fn: () => void | Unsubscribe): Unsubscribe {
  let cleanup: void | Unsubscribe;
  let stopped = false;
  const depListenerSets = new Set<Set<() => void>>();

  const run = () => {
    if (stopped) return;
    cleanup?.();
    cleanup = undefined;
    for (const set of depListenerSets) {
      set.delete(run);
    }
    depListenerSets.clear();

    activeEffect = run;
    activeEffectDepSets = depListenerSets;
    try {
      cleanup = fn();
    } finally {
      activeEffect = null;
      activeEffectDepSets = null;
    }
  };

  run();
  return () => {
    stopped = true;
    cleanup?.();
    for (const set of depListenerSets) {
      set.delete(run);
    }
    depListenerSets.clear();
  };
}
