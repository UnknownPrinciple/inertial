export function ObservableScope(schedule = (cb) => cb()) {
  let id = 0;
  let tracking = null;
  let queue = new Set();
  let wip = new Set();
  let vertices = []; // vertices [(p0, c0), (p1, c1), ...]
  let disposables = [];

  function signal(initial, equals = Object.is) {
    let key = id++;
    let current = initial;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) union(vertices, key, tracking);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          if (!wip.has(key)) queue.add(key);
          schedule(digest);
        }
      }
    };
  }

  function watch(fn) {
    let clear;
    let watcher = () => {
      if (clear != null) clear();
      clear = fn();
    };
    // capturing
    tracking = watcher;
    clear = fn();
    tracking = null;
    let dispose = () => {
      if (clear != null) clear();
      clear = null;
      for (let cursor = 0; cursor < vertices.length; ) {
        if (vertices[cursor + 1] === watcher) {
          vertices.splice(cursor, 2);
        } else {
          cursor += 2;
        }
      }
    };
    disposables.push(dispose);
    return dispose;
  }

  function derive(get, equals = Object.is) {
    let current;
    let key = id++;
    // capturing
    tracking = () => {
      let val = get();
      if (!equals(current, val)) {
        current = val;
        wip.add(key);
      }
    };
    current = get();
    tracking = null;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) union(vertices, key, tracking);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          if (!wip.has(key)) queue.add(key);
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
        if (!wip.has(key)) queue.add(key);
        schedule(digest);
      }
    });
    disposables.push(clear);
    return () => {
      if (tracking != null) union(vertices, key, tracking);
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

  function fork(fn) {
    let startId = id;
    let currentDisposables = disposables;
    disposables = [];
    fn();
    let newId = id;
    let tempDisposables = disposables;
    disposables = currentDisposables;
    let clear = () => {
      for (let fn of tempDisposables) fn();
      for (let cursor = 0; cursor < vertices.length; ) {
        if (vertices[cursor] >= startId && vertices[cursor] < newId) {
          vertices.splice(cursor, 2);
        } else {
          cursor += 2;
        }
      }
    };
    let dispose = () => {
      if (clear != null) clear();
      clear = null;
    };
    disposables.push(dispose);
    return dispose;
  }

  function dispose() {
    vertices = [];
    for (let fn of disposables) fn();
  }

  function digest() {
    while (queue.size > 0) {
      let tmp = wip;
      wip = queue;
      queue = tmp;
      tmp.clear();
      for (
        let cursor = 0, used = new WeakSet(), q = wip, fn, p;
        cursor < vertices.length;
        cursor += 2
      ) {
        if (vertices[cursor] === p || q.has(vertices[cursor])) {
          p = vertices[cursor];
          fn = vertices[cursor + 1];
          if (!used.has(fn)) {
            used.add(fn);
            fn();
          }
        }
      }
    }
    wip.clear();
  }

  return { signal, watch, derive, observe, peek, batch, fork, dispose };
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
