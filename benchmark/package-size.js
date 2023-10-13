import { buildSync } from "esbuild";
import { gzipSync, brotliCompressSync } from "node:zlib";

console.log("reactivity");
build(`
import { ObservableScope } from "../reactivity.js";

export function vm() {
  let os = ObservableScope();
  let a = os.signal(0);
  let e = os.observe(
    () => navigator.onLine,
    (cb) => {
      window.addEventListener("offline", cb)
      return () => window.removeEventListener("offline", cb)
    },
  )
  let b = os.derive(() => (e() ? a() * 3 : 0));

  os.watch(() => {
    console.log(b());
  });
}`);

console.log("@preact/signals-core");
build(`
import { signal, computed, effect } from "@preact/signals-core";

export function vm() {
  let a = signal(0);
  let e = signal(navigator.onLine)
  let b = computed(() => a.value * 3);

  effect(() => {
    function handle() {
      e.value = navigator.onLine;
    }

    window.addEventListener('offline', handle);
    return () => window.removeEventListener('offline', handle);
  })

  effect(() => {
    console.log(b.value);
  });
}`);

console.log("@vue/reactivity");
build(`
import { reactive, computed, effect } from "@vue/reactivity";

export function vm() {
  let a = reactive({ value: 0 });
  let e = reactive({ value: navigator.onLine })
  let b = computed(() => e.value ? a.value * 3 : 0);

  function handle() {
    e.value = navigator.onLine;
  }

  window.addEventListener('offline', handle);

  effect(() => {
    console.log(b.value);
  });

  return () => window.removeEventListener('offline', handle);
}`);

console.log("@angular/core");
build(`
import { signal, computed, effect } from "@angular/core";

export function vm() {
  let a = signal(0);
  let e = signal(navigator.onLine);
  let b = computed(() => (e() ? a() * 3 : 0));

  effect((onCleanup) => {
    function handle(event) {
      e.set(navigator.onLine);
    }

    window.addEventListener("offline", handle);
    onCleanup(() => window.removeEventListener("offline", handle));
  });

  effect(() => {
    console.log(b());
  });
}`);

console.log("knockout");
build(`
import { observable, computed } from "knockout";

export function vm() {
  let a = observable(0);
  let e = observable(navigator.onLine);
  let b = computed(() => (e() ? a() * 3 : 0));

  function handle() {
    e(navigator.onLine);
  }

  window.addEventListener("offline", handle);

  computed(() => {
    console.log(b());
  });

  return () => window.removeEventListener("offline", handle);
}`);

function build(contents) {
  let a = buildSync({
    bundle: true,
    write: false,
    minify: true,
    stdin: { contents, loader: "js", resolveDir: process.cwd() },
  });
  let code = a.outputFiles[0].text;
  console.log("   min", code.length);
  let gzbuf = gzipSync(Buffer.from(code));
  console.log("  gzip", gzbuf.length);
  let btbuf = brotliCompressSync(Buffer.from(code));
  console.log("brotli", btbuf.length);
  console.log("");
}
