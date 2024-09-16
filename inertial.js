const PROVIDER = 0b001;
const CONSUMER = 0b010;
const DISPOSER = 0b100;

export function ObservableScope(schedule = immediate) {
  let head = { prev: null, next: null };
  let tail = { prev: null, next: null };
  (head.next = tail).prev = head;

  /** @type {WeakSet<any> | null} */
  let tracking = null;
  let flushing = false;
  let marking = [];
  let pending = [];

  function signal(initial, equals = Object.is) {
    let node = {
      current: initial,
      flag: PROVIDER,
      prev: tail.prev,
      next: tail,
    };
    tail.prev = tail.prev.next = node;
    return wrap(node, equals);
  }

  function watch(fn) {
    tracking = new WeakSet();
    let ctl = new AbortController();
    fn(ctl.signal);
    let node = {
      flag: CONSUMER + DISPOSER,
      tracking,
      update() {
        ctl = (ctl.abort(), new AbortController());
        tracking = new WeakSet();
        fn(ctl.signal);
        node.tracking = tracking;
        tracking = null;
      },
      dispose() {
        ctl.abort();
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
    let node = {
      current: get(),
      flag: PROVIDER + CONSUMER,
      tracking,
      update() {
        tracking = new WeakSet();
        let value = get();
        node.tracking = tracking;
        tracking = null;
        if (!equals(value, node.current)) {
          node.current = value;
          marking.push(node);
        }
      },
      prev: tail.prev,
      next: tail,
    };
    tail.prev = tail.prev.next = node;
    tracking = null;
    return wrap(node, equals);
  }

  function observe(get, subscribe, equals = Object.is) {
    let ctl = new AbortController();
    let node = {
      current: get(),
      flag: PROVIDER + DISPOSER,
      dispose() {
        ctl.abort();
        (node.prev.next = node.next).prev = node.prev;
      },
      prev: tail.prev,
      next: tail,
    };
    tail.prev = tail.prev.next = node;
    subscribe(() => {
      let value = get();
      if (!equals(value, node.current)) {
        node.current = value;
        mark(node);
      }
    }, ctl.signal);
    return wrap(node, equals);
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
    schedule = noop;
    fn();
    schedule = temp;
    schedule(digest);
  }

  function deref(...signals) {
    tracking = {
      add(node) {
        if (node.flag & DISPOSER) node.dispose();
        (node.prev.next = node.next).prev = node.prev;
      },
    };

    for (let signal of signals) signal();

    tracking = null;
  }

  function dispose() {
    let cursor = head;
    while ((cursor = cursor.next) !== tail && cursor != null) {
      if (cursor.flag & DISPOSER) cursor.dispose();
    }
    head = { prev: null, next: null };
    tail = { prev: null, next: null };
    (head.next = tail).prev = head;
  }

  function wrap(node, equals) {
    return (value) => {
      if (typeof value === "undefined") {
        // reading
        if (tracking != null) tracking.add(node);
        return node.current;
      } else {
        // writing
        let val = typeof value === "function" ? value(node.current) : value;
        if (!equals(val, node.current)) {
          node.current = val;
          mark(node);
        }
      }
    };
  }

  function mark(node) {
    if (flushing) {
      pending.push(node);
    } else {
      marking.push(node);
      schedule(digest);
    }
  }

  function digest() {
    flushing = true;
    let cursor = head;
    while (
      marking.length > 0 &&
      (cursor = cursor.next) !== tail &&
      cursor != null
    ) {
      if (
        cursor.flag & CONSUMER &&
        marking.some((node) => cursor.tracking.has(node))
      ) {
        cursor.update();
      }
    }
    flushing = false;
    if (pending.length > 0) {
      marking = pending;
      pending = [];
      schedule(digest);
    } else marking = [];
  }

  return { signal, watch, derive, observe, peek, batch, deref, dispose };
}

function immediate(cb) {
  cb();
}

function noop() {}
