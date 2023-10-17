export function ObservableScope(schedule = (cb) => cb()) {
  let id = 0;
  let tracking = null;
  let queue = new Set();
  let wip = null;
  let cbs = new Map();

  let producers = [];
  let consumers = [];
  function vertice(p, c) {
    let insert = bisect(producers, p);
    producers.splice(insert, 0, p);
    consumers.splice(insert, 0, c);
  }

  function signal(initial, equals = Object.is) {
    let key = id++;
    let current = initial;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) vertice(key, tracking);
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
        if (tracking != null) vertice(inputKey, tracking);
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
      if (tracking != null) vertice(key, tracking);
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
      let temp = (wip = queue);
      queue = new Set();
      let cons = new Map(cbs);
      for (let cursor = 0, key, fn; cursor < producers.length; cursor++) {
        if (temp.has(producers[cursor])) {
          key = consumers[cursor];
          fn = cons.get(key);
          if (fn != null) {
            fn("digest");
            cons.delete(key);
          }
        }
      }
    }
    wip = null;
  }

  return { signal, watch, derive, observe, peek, batch, dispose };
}

function bisect(values, x, lo = 0, hi = values.length) {
  let mid, val;
  while (lo < hi) {
    mid = (lo + hi) >>> 1;
    val = values[mid];
    if (val <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
