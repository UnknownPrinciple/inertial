# inertial

    npm install inertial

A tiny library for integrating reactive signals anywhere.

- Zero dependencies & tiny bundle (around 700B min+gzip)
- Predictable memory management & lowest CPU overhead
- TypeScript typings & inline hints included

```js
import { ObservableScope } from "inertial";

/* Create isolated scope that has its own lifecycle */
let os = ObservableScope();

/* Use signals to define values and relations between them */
let counter = os.signal(0);
let doubled = os.derive(() => counter() * 2);

/* Use watchers to track value changes and perform side effects */
let output = document.getElementById("output");
os.watch(() => {
  output.innerText = doubled();
});

/* Trigger value updates that will ensure all relations updated as well */
let trigger = document.getElementById("trigger");
trigger.addEventListener("click", () => {
  counter((value) => value + 1);
});
```

## Installing

Using NPM:

```sh
npm install inertial
```

```js
import { ObservableScope } from "inertial";
```

Using CDN:

```html
<script type="module">
  import { ObservableScope } from "https://esm.sh/inertial@0.1.0";
</script>
```

## Getting Started

Inertial is a library that provides a set of functions for creating and working with reactive values
(signals) and derived values (derived signals). Reactive values can be observed, updated, and
derived from other reactive values, enabling efficient and automatic updates throughout a system.

To start, import the `ObservableScope` function from `"inertial"`. The function creates an instance
of scope that holds reactive values.

```js
/* Import scope constructor from the library */
import { ObservableScope } from "inertial";

/* Instantiate the scope for each isolated environment needed */
let os = ObservableScope();
```

Now you can use the methods provided by the instance to create and work with reactive values.

### Creating Signals

The `signal` method creates a reactive value (signal) that can be read and updated:

```js
/* Create a signal with an initial value of 0 */
let count = os.signal(0);

/* Call signal as a function to get current value */
console.log(count());
// Output: 0

/* Update the signal value by calling a function with a single argument */
count(count() + 1);
console.log(count());
// Output: 1

/* Alternatively, pass a function to update value using the current */
count((value) => value + 1);
console.log(count());
// Output: 2
```

### Derived Signals

The `derive` method creates a reactive signal that depends on one or more other signals. Whenever
those signal update their value, the derived value recalculates its value immediately:

```js
/* Create a derived signal by defining the result computation function */
let doubled = os.derive(() => count() * 2);

/* Derived signal behaves in the same way as a simple signal */
console.log(doubled());
// Output: 2

/* Update the 'count' signal to trigger `doubled` update */
count(5);
console.log(doubled());
// Output: 10 (automatically updated)
```

### Watching Signals

The `watch` method allows you to perform an action whenever a signal or derived signal changes. Any
signals which values are used inside a watch function are registered as dependencies and will
trigger watch function to re-run when updated:

```js
/* A watcher function is called every time any of dependencies getting updated */
os.watch(() => {
  console.log(`Count: ${count()}, Doubled: ${doubled()}`);
});

count(10);
// Output: Count: 10, Doubled: 20
```

A watch function may return a "cleanup" function to perform extra work before re-running the
watcher:

```js
let positionX = os.signal(0);

os.watch(() => {
  let animation = element.animate(
    { transform: `translateX(${positionX()}px)` },
    { fill: "forwards" },
  );
  return () => animation.cancel();
});
```

The result of `watch` method is a function that can be used for deactivating the watcher:

```js
let dispose = os.watch(() => {
  console.log(`Count: ${count()}, Doubled: ${doubled()}`);
});

count(10);
// Output: Count: 10, Doubled: 20

dispose();

count(20);
// No output
```

### Working with dependencies

When signals are read in `derive()` or `watch()` functions, they are tracked as dependencies so the
derived signal or the watcher can re-run when the used signal is updated. These dependencies are
dynamic so can be used under some conditions:

```js
let enabled = os.signal(false);
let count = os.signal(0);

os.watch(() => {
  if (enabled()) {
    console.log(`The count is ${count()}.`);
  } else {
    console.log("Nothing to see here!");
  }
});
```

In this example, the watcher going to log "Nothing to see here!" while value of `enabled` remains
`false`. Reading `count` earlier than the condition where it is used means logging "Nothing to see
here" every time `count` is updated, even though it's not going to be actually used.

### Observing External Sources

The `observe` method creates a signal that subscribes to an external source of values:

```js
let onLine = os.observe(
  () => navigator.onLine,
  (cb) => {
    window.addEventListener("offline", cb);
    return () => window.removeEventListener("offline", cb);
  },
);
```

### Peeking at Signal Values

The `peek` method allows you to get the value of a signal or derived signal without tracking it as a
dependency:

```js
let count = os.signal(0);

os.watch(() => {
  /* Get the value without tracking the signal as a dependency */
  let peekedValue = os.peek(count);
  console.log(peekedValue);
});

count(1);
// No output
```

### Batching Updates

The `batch` method allows you to group multiple signal updates together and perform them atomically:

```js
/* Both updates will be applied together before triggering any watchers or derived signals */
os.batch(() => {
  count(count() + 1); // Update 'count' signal
  doubled(doubled() + 10); // Update 'doubled' derived signal
});
```

### Disposing the Scope

To dispose of all observables and watchers in the scope, you can call the `dispose` method:

```js
/* Dispose all observables and watchers in the scope */
os.dispose();
```

### Custom Equality Checks

You can provide a custom equality function to the `signal`, `derive`, and `observe` methods to
control when updates should be triggered. This can be useful for complex data structures or
performance optimization:

```js
let person = os.signal({ name: "John", age: 30 }, (prev, next) => {
  /* Custom equality check for objects */
  return prev.name === next.name && prev.age === next.age;
});

console.log(person());
// Output: { name: 'John', age: 30 }

/* This update will not trigger a change because the object is still equal */
person({ name: "John", age: 30 });

/* This update will trigger a change because the object is different */
person({ name: "Jane", age: 32 });
```

### Custom Scheduling

When creating a new observable scope with `ObservableScope`, you can provide a custom scheduling
function to control how updates are scheduled and executed:

```js
/* Schedule updates for the next event loop tick */
let nextTick = (cb) => setTimeout(cb, 0);

let os = ObservableScope(nextTick);
let signal1 = os.signal(0);
let signal2 = os.signal(0);

let derivedValue = os.derive(() => signal1() + signal2());

os.watch(() => {
  console.log(`Derived value: ${derivedValue()}`);
});

// Update signals
signal1(1);
signal2(2);

// The watcher will be scheduled and executed after the current event loop tick
// Output: Derived value: 3
```

This custom scheduling mechanism can be useful for integrating with different environments or
implementing advanced update strategies.

## Extra Types

The package provides TypeScript typings out of the box. Besides `ObservableScope` following types
can be imported and used inside TypeScript project.

```ts
import { type Scope, type Signal } from "inertial";
```
