export type Signal<Value> = {
  /** Read signal value. Reading the value inside a derived signal or a watcher tracks this signal as a dependency. */
  (): Value;
  /** Write new value to the signal and update all dependants. */
  (value: Value): void;
  /** Update signal value */
  (update: (value: Value) => Value): void;
};

/** Create a signal that subscribes to external source of values. */
declare function observe<Value>(
  get: () => Value,
  subscribe: (cb: () => void) => () => void,
): Signal<Value>;
/** Create a signal that subscribes to external source of values. */
declare function observe<Value>(
  get: () => Value,
  subscribe: (cb: () => void) => () => void,
  equals: (prev: Value, next: Value) => boolean,
): Signal<Value>;

/** Create a reactive value. */
declare function signal<Value>(value: Value): Signal<Value>;
/** Create a reactive value. Provide custom equality check. */
declare function signal<Value>(
  value: Value,
  equals: (prev: Value, next: Value) => boolean,
): Signal<Value>;

/** Create a reactive value that computes its value automatically from watching other signals. */
declare function derive<Value>(get: () => Value): Signal<Value>;
/** Create a reactive value that computes its value automatically from watching other signals. */
declare function derive<Value>(
  get: () => Value,
  equals: (prev: Value, next: Value) => boolean,
): Signal<Value>;

/** Perform any action based on reactive values. The function will be rerun when any of dependencies update. */
declare function watch(cb: () => void): void;
/** Perform any action based on reactive values. The function will be rerun when any of dependencies update. */
declare function watch(cb: () => () => void): void;

/** Get signal value inside derive/watch functions without tracking dependency. */
declare function peek<Value>(get: Signal<Value>): Value;
/** Peek arbitrary reactive values without tracking them as dependencies. */
declare function peek<Value>(get: () => Value): Value;

/** Update multiple signals at once before starting the update cycle. */
declare function batch(fn: () => void): void;

/** Dispose all scope's observables and effects. */
declare function dispose(): void;

export type Scope = {
  observe: typeof observe;
  signal: typeof signal;
  derive: typeof derive;
  watch: typeof watch;
  peek: typeof peek;
  batch: typeof batch;
  dispose: typeof dispose;
};

/** Instantiate an observable scope. */
export declare function ObservableScope(): Scope;
/** Instantiate an observable scope with custom scheduling mechanism. */
export declare function ObservableScope(schedule: (cb: () => void) => void): Scope;
