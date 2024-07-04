const PROVIDER = 0b001;
const CONSUMER = 0b010;
const DISPOSER = 0b100;

export function ObservableScope(schedule = (cb) => cb()) {
  let head = { prev: null, next: null };
  let tail = { prev: null, next: null };
  (head.next = tail).prev = head;

  /** @type {WeakSet<any> | null} */
  let tracking = null;
  let marking = [];
  let future = [];
  let flushing = false;

  function signal(initial, equals = Object.is) {
    let node = { flag: PROVIDER, prev: tail.prev, next: tail };
    tail.prev = tail.prev.next = node;
    let current = initial;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) tracking.add(node);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(val, current)) {
          current = val;
          if (!flushing) {
            marking.push(node);
            schedule(digest);
          } else {
            future.push(node);
          }
        }
      }
    };
  }

  function watch(fn) {
    tracking = new WeakSet();
    let clear = fn();
    let node = {
      flag: CONSUMER + DISPOSER,
      tracking,
      update() {
        if (typeof clear === "function") clear();
        clear = fn();
      },
      dispose() {
        if (typeof clear === "function") clear();
        clear = null;
        (node.prev.next = node.next).prev = node.prev;
      },
      prev: tail.prev,
      next: tail,
    };
    tail.prev = tail.prev.next = node;
    tracking = null;
    return node.dispose;
  }

  function derive(get, equals = Object.is) {
    tracking = new WeakSet();
    let current = get();
    let node = {
      flag: PROVIDER + CONSUMER,
      tracking,
      update() {
        let value = get();
        if (!equals(value, current)) {
          current = value;
          marking.push(node);
        }
      },
      prev: tail.prev,
      next: tail,
    };
    tail.prev = tail.prev.next = node;
    tracking = null;
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) tracking.add(node);
        return current;
      } else {
        // writing
        let val = typeof value === "function" ? value(current) : value;
        if (!equals(val, current)) {
          current = val;
          if (!flushing) {
            marking.push(node);
            schedule(digest);
          } else {
            future.push(node);
          }
        }
      }
    };
  }

  function observe(get, subscribe, equals = Object.is) {
    let current = get();
    let clear;
    let node = {
      flag: PROVIDER + DISPOSER,
      dispose() {
        if (typeof clear === "function") clear();
        clear = null;
        (node.prev.next = node.next).prev = node.prev;
      },
      prev: tail.prev,
      next: tail,
    };
    tail.prev = tail.prev.next = node;
    clear = subscribe(() => {
      let value = get();
      if (!equals(value, current)) {
        current = value;
        marking.push(node);
        schedule(digest);
      }
    });
    return () => {
      if (tracking != null) tracking.add(node);
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
    // temporary measure since digest starts a cycle from marking[0] node
    // which may not be the earliest node in a batch routine
    marking = [head];
    fn();
    schedule = temp;
    if (marking.length > 0) schedule(digest);
  }

  function deref(...signals) {
    tracking = {
      add: (node) => {
        if (node & DISPOSER) node.dispose();
        (node.prev.next = node.next).prev = node.prev;
      },
    };

    for (let signal of signals) signal();

    tracking = null;
  }

  function dispose() {
    let cursor = head;
    while ((cursor = cursor.next) !== tail) {
      if (cursor.flag & DISPOSER) cursor.dispose();
    }
    head = { prev: null, next: null };
    tail = { prev: null, next: null };
    (head.next = tail).prev = head;
  }

  function digest() {
    flushing = true;
    let cursor = marking[0];
    while ((cursor = cursor.next) !== tail) {
      if (cursor.flag & CONSUMER && marking.some((node) => cursor.tracking.has(node))) {
        cursor.update();
      }
    }
    flushing = false;
    if (future.length > 0) {
      marking = [future.shift()];
      schedule(digest);
    } else marking = [];
  }

  return { signal, watch, derive, observe, peek, batch, deref, dispose };
}
