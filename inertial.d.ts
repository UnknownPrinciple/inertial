export type Signal<Value> = {
  /** Read signal value. Reading the value inside a derived signal or a watcher tracks this signal as a dependency. */
  (): Value;
  /** Write new value to the signal and update all dependants. */
  (value: Value): void;
  /** Update signal value */
  (update: (value: Value) => Value): void;
};

export type Scope = {
  observe: {
    /** Create a signal that subscribes to external source of values.*/
    <Value>(
      get: () => Value,
      subscribe: (cb: () => void, signal: AbortSignal) => () => void,
    ): Signal<Value>;
    /** Create a signal that subscribes to external source of values.*/
    <Value>(
      get: () => Value,
      subscribe: (cb: () => void, signal: AbortSignal) => () => void,
      equals: (prev: Value, next: Value) => boolean,
    ): Signal<Value>;
  };

  produce: {
    /** */
    <Value>(
      value: Value,
      produce: (value: Signal<Value>, signal: AbortSignal) => void,
    ): Signal<Value>;
    /** */
    <Value>(
      value: Value,
      produce: (value: Signal<Value>, signal: AbortSignal) => void,
      equals: (prev: Value, next: Value) => boolean,
    ): Signal<Value>;
  };

  signal: {
    /** Create a reactive value. */
    <Value>(value: Value): Signal<Value>;
    /** Create a reactive value. Provide custom equality check. */
    <Value>(value: Value, equals: (prev: Value, next: Value) => boolean): Signal<Value>;
  };

  derive: {
    /** Create a reactive value that computes its value automatically from watching other signals. */
    <Value>(get: () => Value): Signal<Value>;
    /** Create a reactive value that computes its value automatically from watching other signals. */
    <Value>(get: () => Value, equals: (prev: Value, next: Value) => boolean): Signal<Value>;
  };

  watch: {
    /** Perform any action based on reactive values. The function will be rerun when any of dependencies update. */
    (cb: (signal: AbortSignal) => void): () => void;
    /** Perform any action based on reactive values. The function will be rerun when any of dependencies update. */
    (cb: (signal: AbortSignal) => () => void): () => void;
  };

  peek: {
    /** Get signal value inside derive/watch functions without tracking dependency. */
    <Value>(get: Signal<Value>): Value;
    /** Peek arbitrary reactive values without tracking them as dependencies. */
    <Value>(get: () => Value): Value;
  };

  /** Update multiple signals at once before starting the update cycle. */
  batch(fn: () => void): void;

  /** Remove any reactive signal from the scope. */
  deref(...fn: Array<Signal<any>>): void;

  /** Dispose all scope's observables and effects. */
  dispose(): void;
};

/** Instantiate an observable scope. */
export function ObservableScope(): Scope;
/** Instantiate an observable scope with custom scheduling mechanism. */
export function ObservableScope(schedule: (cb: () => void) => void): Scope;
