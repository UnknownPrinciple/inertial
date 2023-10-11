export function ObservableScope(schedule = (cb) => cb()) {
  let sets = DisjointSet();
  let tracking = null;
  let queue = new Set();
  let wip = null;
  let cbs = new Map();

  function signal(initial, equals = Object.is) {
    let key = sets.push();
    let current = initial;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) sets.union(tracking, key);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          let root = sets.find(key);
          if (wip == null || !wip.has(root)) queue.add(root);
          schedule(digest);
        }
      }
    };
  }

  function watch(fn) {
    let clear;
    let key = sets.push();
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
    let inputKey = sets.push();
    let outputKey = sets.push();
    cbs.set(outputKey, (action) => {
      if (action === "digest") {
        let val = get();
        if (!equals(current, val)) {
          current = val;
          let root = sets.find(inputKey);
          if (wip == null || !wip.has(root)) queue.add(root);
          // no digest, one is already in progress and all derive consumers are in the future
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
        if (tracking != null) sets.union(tracking, inputKey);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(current, val)) {
          current = val;
          let root = sets.find(inputKey);
          if (wip == null || !wip.has(root)) queue.add(root);
          schedule(digest);
        }
      }
    };
  }

  function observe(get, subscribe, equals = Object.is) {
    let current = get();
    let key = sets.push();
    let clear = subscribe(() => {
      let val = get();
      if (!equals(current, val)) {
        current = val;
        let root = sets.find(key);
        if (wip == null || !wip.has(root)) queue.add(root);
        schedule(digest);
      }
    });
    cbs.set(key, (action) => {
      if (action === "dispose") clear();
    });
    return () => {
      if (tracking != null) sets.union(tracking, key);
      return current;
    };
  }

  function dispose() {
    for (let cb of cbs.values()) cb("dispose");
  }

  function digest() {
    let temp = (wip = queue);
    queue = new Set();
    for (let cursor = 0; cursor < sets.parents.length; cursor++) {
      if (temp.has(sets.find(sets.parents[cursor]))) {
        if (cbs.has(cursor)) cbs.get(cursor)("digest"); // -> this can update queue
      }
    }

    if (queue.size > 0) schedule(digest);
    else wip = null;
  }

  return { signal, watch, derive, observe, dispose };
}

function DisjointSet() {
  let parents = [];
  let ranks = [];

  function push() {
    let x = parents.length;
    parents.push(x);
    ranks.push(0);
    return x;
  }

  /** Find root of `x` set */
  function find(x) {
    let y = x;
    let c, p;

    while (true) {
      c = parents[y];
      if (y === c) break;
      y = c;
    }

    // Path compression
    while (true) {
      p = parents[x];
      if (p === y) break;
      parents[x] = y;
      x = p;
    }

    return y;
  }

  /** Define union between two target indices */
  function union(x, y) {
    let xRoot = find(x);
    let yRoot = find(y);

    // x and y are already in the same set
    if (xRoot === yRoot) return;

    // x and y are not in the same set, we merge them
    let xRank = ranks[x];
    let yRank = ranks[y];

    if (xRank < yRank) {
      parents[xRoot] = yRoot;
    } else if (xRank > yRank) {
      parents[yRoot] = xRoot;
    } else {
      parents[yRoot] = xRoot;
      ranks[xRoot]++;
    }
  }

  return { parents, push, find, union };
}
