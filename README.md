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

Read [full docs](https://unknownprinciple.github.io/inertial/) on the website.
