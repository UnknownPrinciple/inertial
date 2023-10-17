export function ObservableScope(schedule = (cb) => cb()) {
  let id = 0;
  let tracking = null;
  let queue = new Set();
  let wip = null;
  let vs = []; // vertices [(p0, c0), (p1, c1), ...]
  let dis = [];

  function signal(initial, equals = Object.is) {
    let key = id++;
    let current = initial;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) union(vs, key, tracking);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          if (wip == null || !wip.has(key)) queue.add(key);
          schedule(digest);
        }
      }
    };
  }

  function watch(fn) {
    let clear;
    dis.push(() => {
      if (typeof clear === "function") clear();
    });
    // capturing
    tracking = () => {
      if (typeof clear === "function") clear();
      clear = fn();
    };
    clear = fn();
    tracking = null;
  }

  function derive(get, equals = Object.is) {
    let current;
    let key = id++;
    // capturing
    tracking = () => {
      let val = get();
      if (!equals(current, val)) {
        current = val;
        if (wip != null) wip.add(key);
      }
    };
    current = get();
    tracking = null;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) union(vs, key, tracking);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          if (wip == null || !wip.has(key)) queue.add(key);
          schedule(digest);
        }
      }
    };
  }

  function observe(get, subscribe, equals = Object.is) {
    let current = get();
    let key = id++;
    let clear = subscribe(() => {
      // writing
      let val = get();
      if (!equals(current, val)) {
        current = val;
        if (wip == null || !wip.has(key)) queue.add(key);
        schedule(digest);
      }
    });
    dis.push(clear);
    return () => {
      if (tracking != null) union(vs, key, tracking);
      return current;
    };
  }

  function peek(get) {
    let temp = tracking;
    tracking = null;
    let result = get();
    tracking = temp;
    return result;
  }

  function batch(fn) {
    let temp = schedule;
    schedule = () => {};
    fn();
    schedule = temp;
    schedule(digest);
  }

  function dispose() {
    for (let fn of dis) fn();
  }

  function digest() {
    while (queue.size > 0) {
      wip = queue;
      queue = new Set();
      for (let cursor = 0, used = new WeakSet(), q = wip, fn, p; cursor < vs.length; cursor += 2) {
        if (vs[cursor] === p || q.has(vs[cursor])) {
          p = vs[cursor];
          fn = vs[cursor + 1];
          if (!used.has(fn)) {
            used.add(fn);
            fn();
          }
        }
      }
    }
    wip = null;
  }

  return { signal, watch, derive, observe, peek, batch, dispose };
}

function union(vs, pk, ck) {
  let mid,
    lo = 0,
    hi = vs.length;
  while (lo < hi) {
    mid = (lo + hi) >>> 1;
    mid -= mid % 2;
    if (vs[mid] <= pk) lo = mid + 2;
    else hi = mid;
  }
  vs.splice(lo, 0, pk, ck);
}
