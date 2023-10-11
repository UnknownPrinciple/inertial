export type Signal<Value> = {
  (): Value;
  (value: Value): void;
  (update: (value: Value) => Value): void;
};

export type Scope = {
  observe: <Value>(
    get: () => Value,
    subscribe: (cb: () => void) => () => void,
    equals?: (a: Value, b: Value) => boolean,
  ) => Signal<Value>;
  signal: <Value>(value?: Value, equals?: (a: Value, b: Value) => boolean) => Signal<Value>;
  derive: <Value>(get: () => Value, equals?: (a: Value, b: Value) => boolean) => Signal<Value>;
  watch: (cb: (() => void) | (() => () => void)) => void;
  dispose: () => void;
};

export function ObservableScope(schedule?: (cb: () => void) => void): Scope;
