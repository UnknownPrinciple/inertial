export type Signal<Value> = {
  /** Read signal value */
  (): Value;
  /** Write new value */
  (value: Value): void;
  /** Update signal value */
  (update: (value: Value) => Value): void;
};

export type Scope = {
  /** Subscribe to external source of values */
  observe: <Value>(
    get: () => Value,
    subscribe: (cb: () => void) => () => void,
    equals?: (a: Value, b: Value) => boolean,
  ) => Signal<Value>;
  /** Create a signal */
  signal: <Value>(value?: Value, equals?: (a: Value, b: Value) => boolean) => Signal<Value>;
  /** */
  derive: <Value>(get: () => Value, equals?: (a: Value, b: Value) => boolean) => Signal<Value>;
  /** */
  watch: (cb: (() => void) | (() => () => void)) => void;
  /** Get signal values inside derive/watch functions without tracking dependencies */
  peek: <Value>(get: () => Value) => Value;
  /** Update multiple signals at once before performing the update cycle */
  batch: (fn: () => void) => void;
  /** Dispose all scope's observables and effects */
  dispose: () => void;
};

export function ObservableScope(schedule?: (cb: () => void) => void): Scope;
