import { test, mock } from "node:test";
import { equal, deepEqual } from "node:assert/strict";
import { ObservableScope } from "./inertial.js";

function args(mock) {
  return mock.calls.map((call) => call.arguments);
}

/* The most basic use case is to be able to hold a value in a Signal. */
test("signal", () => {
  let os = ObservableScope();
  // put initial value
  let value = os.signal(0);
  equal(value(), 0, "read initial value");
  // set new value
  value(13);
  equal(value(), 13, "read new value");
  // update value based on current one
  value((v) => v + 1);
  equal(value(), 14, "read updated value");
});

/* Additionaly, I'd like to be able to prevent value updates based on equality
function. */
test("signal + equals", () => {
  let os = ObservableScope();
  let equality = mock.fn(() => true);
  let value = os.signal(13, equality);
  value(14);
  equal(value(), 13, "signal preserves original value");
  equal(equality.mock.callCount(), 1, "equality criteria used on update");
});

/* Now I want to be able to react to values being changed. Separately from each
other, exactly based on what was used. */
test("signal + watch", () => {
  let os = ObservableScope();
  let valueA = os.signal(13);
  let valueB = os.signal(42);
  let watcherA = mock.fn();
  os.watch(() => watcherA(valueA()));
  let watcherB = mock.fn();
  os.watch(() => watcherB(valueB()));
  deepEqual(args(watcherA.mock), [[13]]);
  deepEqual(args(watcherB.mock), [[42]]);
  valueA((v) => v + 1);
  deepEqual(args(watcherA.mock), [[13], [14]]);
  deepEqual(args(watcherB.mock), [[42]]);
  valueB((v) => v + 1);
  deepEqual(args(watcherA.mock), [[13], [14]]);
  deepEqual(args(watcherB.mock), [[42], [43]]);
});

/* I also need to make sure that watcher is being called only when the value
changes. */
test("signal + equals + watch", () => {
  let os = ObservableScope();
  let equality = mock.fn(() => true);
  let valueA = os.signal(13, equality);
  let watcherA = mock.fn();
  os.watch(() => watcherA(valueA()));
  deepEqual(args(watcherA.mock), [[13]]);
  valueA((v) => v + 1);
  deepEqual(args(watcherA.mock), [[13]]);
});

/* One of primary function of watchers is side effects, which means there has
to be a way to perform cleanup before handling new values. */
test("signal + watch + cleanup", () => {
  let os = ObservableScope();
  let value = os.signal(13);
  let cleanup = mock.fn();
  os.watch(() => {
    value();
    return cleanup;
  });
  equal(cleanup.mock.callCount(), 0);
  value((v) => v + 1);
  equal(cleanup.mock.callCount(), 1);
});

test("signal + watch + unsub", () => {
  let os = ObservableScope();
  let value = os.signal(13);
  let watcherA = mock.fn(() => {
    value();
  });
  let watcherB = mock.fn(() => {
    value();
  });
  let unsubA = os.watch(watcherA);
  let unsubB = os.watch(watcherB);
  equal(watcherA.mock.callCount(), 1);
  equal(watcherB.mock.callCount(), 1);
  value((v) => v + 1);
  equal(watcherA.mock.callCount(), 2);
  equal(watcherB.mock.callCount(), 2);
  unsubA();
  value((v) => v + 1);
  equal(watcherA.mock.callCount(), 2);
  equal(watcherB.mock.callCount(), 3);
  unsubB();
  value((v) => v + 1);
  equal(watcherA.mock.callCount(), 2);
  equal(watcherB.mock.callCount(), 3);
});

/** There has to be some resolution for cases where a signal is being updated
inside a watcher that is triggered by other signal update. */
test("signal + watch + signal", () => {
  let os = ObservableScope();
  let valueA = os.signal(13);
  let valueB = os.signal();
  os.watch(() => valueB(valueA() * 3));
  let watcherB = mock.fn();
  os.watch(() => watcherB(valueB()));
  deepEqual(args(watcherB.mock), [[39]]);
  valueA(10);
  deepEqual(args(watcherB.mock), [[39], [30]]);
});

/* Watchers should also use available cleanup functions when the whole scope
is getting disposed. */
test("signal + watch + dispose", () => {
  let os = ObservableScope();
  let cleanup = mock.fn();
  let watcher = mock.fn(() => cleanup);
  os.watch(watcher);
  equal(cleanup.mock.callCount(), 0);
  equal(watcher.mock.callCount(), 1);
  os.dispose();
  equal(cleanup.mock.callCount(), 1);
  equal(watcher.mock.callCount(), 1);
});

/* Now let's consider a primitive to derive values of different signals. */
test("signal + derive", () => {
  let os = ObservableScope();
  let equality = mock.fn(() => false);
  let value = os.signal(13, equality);
  let computation = mock.fn(() => value() * 2);
  let compute = os.derive(computation);
  equal(compute(), 26);
  equal(computation.mock.callCount(), 1);
  value((v) => v + 1);
  equal(compute(), 28);
  equal(computation.mock.callCount(), 2);
  equality.mock.mockImplementation(() => true);
  value((v) => v + 1);
  equal(compute(), 28);
  equal(computation.mock.callCount(), 2);
});

/* A derived signal can substitute signals in watchers or other derivatives. */
test("signal + derive + equality + watch", () => {
  let os = ObservableScope();
  let value = os.signal(13);
  let equality = mock.fn(() => false);
  let compute = os.derive(() => value() * 2, equality);
  let watcher = mock.fn();
  os.watch(() => watcher(compute()));

  deepEqual(args(watcher.mock), [[26]]);
  value((v) => v + 1);
  deepEqual(args(watcher.mock), [[26], [28]]);
  equality.mock.mockImplementation(() => true);
  value((v) => v + 1);
  deepEqual(args(watcher.mock), [[26], [28]]);
});

/* Whenever a watcher observes a signal and a derived signal, it only needs 
to work once per update cycle. */
test("signal + derive + watch", () => {
  let os = ObservableScope();
  let value = os.signal(13);
  let compute = os.derive(() => value() * 2);
  let watcher = mock.fn();
  os.watch(() => watcher(value(), compute()));
  deepEqual(args(watcher.mock), [[13, 26]]);
  value((v) => v + 1);
  deepEqual(args(watcher.mock), [
    [13, 26],
    [14, 28],
  ]);
});

/* Additional catch: if a watcher at the end of digest writes to a signal that
has prior declared watchers, additional digest cycle is performed. */
test("signal A + signal B + watch B + watch A", () => {
  let os = ObservableScope();
  let valueA = os.signal(false);
  let valueB = os.signal(100);
  let watcherB = mock.fn();
  os.watch(() => watcherB(valueB()));
  let watcherA = mock.fn();
  os.watch(() => {
    watcherA(valueA());
    if (valueA()) {
      valueB(200);
    }
  });
  deepEqual(args(watcherA.mock), [[false]]);
  deepEqual(args(watcherB.mock), [[100]]);
  valueA(true);
  deepEqual(args(watcherA.mock), [[false], [true]]);
  deepEqual(args(watcherB.mock), [[100], [200]]);
});

/* One more important detail about derivative signals: I need to be able to
override current value and still be able to derive a new value later. */
test("signal + derive writable", () => {
  let os = ObservableScope();
  let valueA = os.signal(13);
  let valueB = os.derive(() => valueA() * 2);
  let watcher = mock.fn();
  os.watch(() => watcher(valueB()));
  equal(valueB(), 26);
  deepEqual(args(watcher.mock), [[26]]);
  valueB(100);
  equal(valueB(), 100);
  deepEqual(args(watcher.mock), [[26], [100]]);
  valueA(26);
  equal(valueB(), 52);
  deepEqual(args(watcher.mock), [[26], [100], [52]]);
  valueB((v) => v * 2);
  deepEqual(args(watcher.mock), [[26], [100], [52], [104]]);
});

test("signal + derive bailout", () => {
  let os = ObservableScope();
  let a = os.signal(0);
  let b = os.derive(() => a());
  let cm = mock.fn(() => a());
  os.derive(cm);
  let dm = mock.fn(() => b());
  os.derive(dm);
  b(123);
  equal(cm.mock.callCount(), 1);
  equal(dm.mock.callCount(), 2);
  a(124);
  equal(cm.mock.callCount(), 2);
  equal(dm.mock.callCount(), 3);
});

test("signal + derive dynamic", () => {
  let os = ObservableScope();
  let a = os.signal(0);
  let b = os.signal(false);
  let cm = mock.fn(() => {
    if (b()) return a();
    return -1;
  });
  let c = os.derive(cm);
  equal(c(), -1);
  equal(cm.mock.callCount(), 1);
  a((v) => v + 1);
  equal(cm.mock.callCount(), 1);
  equal(c(), -1);
  b(true);
  equal(cm.mock.callCount(), 2);
  equal(c(), 1);
  a((v) => v + 1);
  equal(cm.mock.callCount(), 3);
  equal(c(), 2);
  b(false);
  equal(cm.mock.callCount(), 4);
  equal(c(), -1);
  a((v) => v + 1);
  equal(cm.mock.callCount(), 4);
  equal(c(), -1);
});

test("signal + signal + watch + watch bailout", () => {
  let os = ObservableScope();
  let a = os.signal(0);
  let b = os.signal(1);
  let watcherA = mock.fn();
  let watcherB = mock.fn();
  os.watch(() => watcherA(a(), b()));
  os.watch(() => watcherB(b()));
  deepEqual(args(watcherA.mock), [[0, 1]]);
  deepEqual(args(watcherB.mock), [[1]]);
  a((v) => v + 2);
  deepEqual(args(watcherA.mock), [
    [0, 1],
    [2, 1],
  ]);
  deepEqual(args(watcherB.mock), [[1]]);
});

test("signal + derive + watch + derive write", () => {
  let os = ObservableScope();
  let a = os.signal(1);
  let b = os.derive(() => a() * 2);
  os.watch(() => {
    if (a() > 1) {
      b(100);
    }
  });
  equal(a(), 1);
  equal(b(), 2);
  a((v) => v + 1);
  equal(a(), 2);
  equal(b(), 100);
});

/* Borrow a test case from Angular signals. */
test("signal + derive diamond", () => {
  let os = ObservableScope();
  let watcher = mock.fn((v) => v);
  let name = os.signal("John Doe");
  let first = os.derive(() => name().split(" ")[0]);
  let last = os.derive(() => name().split(" ")[1]);
  let full = os.derive(() => watcher(`${first()}/${last()}`));
  equal(full(), "John/Doe");
  equal(watcher.mock.callCount(), 1);
  name("Bob Fisher");
  equal(full(), "Bob/Fisher");
  equal(watcher.mock.callCount(), 2);
});

test("signal + derive once", () => {
  let os = ObservableScope();
  let a = os.signal("a");
  let b = os.derive(() => a() + "b");
  let watcher = mock.fn((v) => v);
  let c = os.derive(() => watcher(`${a()}|${b()}`));
  equal(c(), "a|ab");
  equal(watcher.mock.callCount(), 1);
  a("A");
  equal(c(), "A|Ab");
  equal(watcher.mock.callCount(), 2);
});

/* One more capability */
test("observe + watch", () => {
  let os = ObservableScope();

  let et = new EventTarget();
  let source = 0;
  let a = os.observe(
    () => source,
    (cb) => {
      et.addEventListener("update", cb);
      return () => et.removeEventListener("update", cb);
    },
  );

  equal(a(), 0);

  let received;
  let cleanup = mock.fn();
  let b = os.signal(true);
  os.watch(() => {
    if (!b()) return;
    received = a();
    return cleanup;
  });
  let c = os.derive(() => a());

  equal(received, 0);

  source = 13;
  et.dispatchEvent(new Event("update"));

  equal(a(), 13);
  equal(received, 13);
  equal(c(), 13);
  equal(cleanup.mock.callCount(), 1);

  b(false);

  source = 100;
  et.dispatchEvent(new Event("update"));

  equal(a(), 100);
  equal(received, 13);
  equal(c(), 100);
  equal(cleanup.mock.callCount(), 2);

  os.dispose();

  source = 200;
  et.dispatchEvent(new Event("update"));

  equal(a(), 100);
  equal(received, 13);
  equal(c(), 100);
  equal(cleanup.mock.callCount(), 2);
});

test("signal + peek + watch", () => {
  let os = ObservableScope();

  let valueA = os.signal(13);
  let valueB = os.derive(() => valueA() * 2);
  let valueC = os.signal(false);

  let watcherA = mock.fn();
  let watcherB = mock.fn();

  os.watch(() => {
    watcherA(os.peek(() => valueA() + valueB()));
    watcherB(valueC());
  });

  deepEqual(args(watcherA.mock), [[39]]);
  deepEqual(args(watcherB.mock), [[false]]);

  valueA(2);
  deepEqual(args(watcherA.mock), [[39]]);
  deepEqual(args(watcherB.mock), [[false]]);

  valueC(true);
  deepEqual(args(watcherA.mock), [[39], [6]]);
  deepEqual(args(watcherB.mock), [[false], [true]]);
});

test("signal + derive + batch", () => {
  let os = ObservableScope();

  let valueA = os.signal(13);
  let valueB = os.signal(10);
  let compute = mock.fn((v) => v);
  let valueC = os.derive(() => compute(valueA() * valueB()));

  deepEqual(args(compute.mock), [[130]]);
  equal(valueC(), 130);

  valueA(14);
  valueB(1);
  deepEqual(args(compute.mock), [[130], [140], [14]]);
  equal(valueC(), 14);

  os.batch(() => {
    valueA(15);
    valueB(10);
  });
  deepEqual(args(compute.mock), [[130], [140], [14], [150]]);
  equal(valueC(), 150);
});

test("nesting", () => {
  let parent = ObservableScope();
  let a = parent.signal(13);

  let child = ObservableScope();

  /**
   * @template T
   * @param {import("./inertial").Scope} child
   * @param {import("./inertial").Scope} parent
   * @param {() => T} get
   * @param {T} [value]
   * @returns {import("./inertial").Signal<T>}
   */
  function connect(child, parent, get, value) {
    return child.observe(
      () => value,
      (cb) => parent.watch(() => ((value = get()), cb())),
    );
  }

  let get = mock.fn(() => a() > 10);
  let b = connect(child, parent, get);

  equal(b(), true);
  a(0);
  equal(b(), false);
  equal(get.mock.callCount(), 2);

  child.dispose();

  a(100);
  equal(b(), false);
  equal(get.mock.callCount(), 2);
});

test("deref", () => {
  let os = ObservableScope();
  let a = os.signal(1);
  let b = os.signal(2);
  let getC = mock.fn(() => a() + b());
  let c = os.derive(getC);
  let d = os.derive(() => c() * 2);
  let e = os.derive(() => a() + b());
  equal(c(), 3);
  equal(d(), 6);
  equal(e(), 3);
  a(2);
  equal(c(), 4);
  equal(d(), 8);
  equal(e(), 4);
  os.deref(c);
  a(3);
  equal(getC.mock.callCount(), 2);
  equal(c(), 4);
  equal(d(), 8);
  equal(e(), 5);
});

test("deref + disposer", () => {
  let os = ObservableScope();
  let value = mock.fn(() => 1);
  let unsub = mock.fn();
  let trigger = mock.fn();
  let a = os.observe(value, (cb) => {
    trigger.mock.mockImplementation(cb);
    return unsub;
  });
  equal(a(), 1);
  value.mock.mockImplementation(() => 2);
  trigger();
  equal(a(), 2);
  os.deref(a);
  equal(unsub.mock.callCount(), 1);
  equal(a(), 2);
  trigger();
  equal(a(), 2);
});
