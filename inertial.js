export function ObservableScope(schedule = (cb) => cb()) {
  let id = 0;
  let tracking = null;
  let queue = new Set();
  let wip = null;
  let cbs = new Map();
  let vs = []; // vertices [(p0, c0), (p1, c1), ...]

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
    let key = id++;
    cbs.set(key, (action) => {
      if (typeof clear === "function") clear();
      if (action === "digest") clear = fn();
    });
    // capturing
    tracking = key;
    clear = fn();
    tracking = null;
  }

  function derive(get, equals = Object.is) {
    let current;
    let inputKey = id++;
    let outputKey = id++;
    cbs.set(outputKey, (action) => {
      if (action === "digest") {
        let val = get();
        if (!equals(current, val)) {
          current = val;
          if (wip != null) wip.add(inputKey);
        }
      }
    });
    // capturing
    tracking = outputKey;
    current = get();
    tracking = null;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) union(vs, inputKey, tracking);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          if (wip == null || !wip.has(inputKey)) queue.add(inputKey);
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
    cbs.set(key, (action) => {
      if (action === "dispose") clear();
    });
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
    for (let cb of cbs.values()) cb("dispose");
  }

  function digest() {
    while (queue.size > 0) {
      wip = queue;
      queue = new Set();
      for (
        let cursor = 0, cons = new Map(cbs), q = wip, key, fn, p;
        cursor < vs.length;
        cursor += 2
      ) {
        if (vs[cursor] === p || q.has(vs[cursor])) {
          p = vs[cursor];
          key = vs[cursor + 1];
          fn = cons.get(key);
          if (fn != null) {
            cons.delete(key);
            fn("digest");
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
