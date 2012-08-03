!function(window) {
  /*
  # Utilities
  # =========
  */


  /*
  # numBytes
  # --------
  #
  # returns the number of bytes the string uses
  */

  function numBytes(string) { return string.length * 2; }


  /*
   * Store
   * =====
   */

  var Store = (function() {
    var VAL_POSITION = 0,
        INDEX_POSITION = 1;

    function Store(options) {
      this.data = {};
      this.ordering = new LinkedList;
      this.hydrated = false;

      this.fingerprint = options.fingerprint;
      this.maxBytes = options.maxBytes != null ? options.maxBytes : -1;

      this.read = options.read || function() {
        return {};
      };
      this.write = options.write || function(x) {};

      this.decode = options.decode || function(x) {
        try {
          return JSON.parse(x) || {};
        } catch(e) {
          return {};
        }
      };
      this.encode = options.encode || function(x) {
        return JSON.stringify(x);
      };
    }

    
    /*
     * Private Store utility functions
     * -------------------------------
     */

    function hydrated(method) {
      return function() {
        hydrate(this);
        return method.apply(this, arguments);
      };
    }


    /*
     * Public Store methods
     * --------------------
     */

    Store.prototype.setItem = hydrated(function(key, val) {
      var datum;
      if (!this.data.hasOwnProperty(key)) {
        datum = this.data[key] = datumStruct(key, val);
        datum.i = this.ordering.unshift(datum);
      } else {
        datum = this.data[key];
        datum.v = val;
        promote(this, datum);
      }
      serialize(this);
      return val;
    });

    Store.prototype.removeItem = hydrated(function(key) {
      var datum;
      datum = this.data[key];
      if (datum) {
        delete this.data[key];
        this.ordering.remove(datum.i);
        serialize(this);
        return datum.v;
      } else {
        return datum;
      }
    });

    Store.prototype.getItem = hydrated(function(key) {
      var datum;
      datum = this.data[key];
      if (datum) {
        promote(this, datum);
        serialize(this);
        return datum.v;
      } else {
        return datum;
      }
    });

    Store.prototype.clear = function() {
      this.data = {};
      this.ordering = new LinkedList;
      serialize(this);
    };

    Store.prototype.bytes = hydrated(function() {
      return numBytes(this.encode(intermediateRepresentation(this)));
    });

    /*
     * Public Store class methods
     * --------------------------
     */

    Store.proxy = function(store, key, options) {
      return new Store({
        read: function() {
          return store.getItem(key);
        },
        write: function(data) {
          return store.setItem(key, data);
        },
        maxBytes: options.maxBytes,
        fingerprint: options.fingerprint
      });
    };

    /*
     * Private Store methods
     * ---------------------
     */

    function promote(store, datum) {
      store.ordering.remove(datum.i);
      return datum.i = store.ordering.unshift(datum);
    }

    function serialize(store) {
      var serialization;
      serialization = store.encode(intermediateRepresentation(store));
      if (store.maxBytes >= 0 && numBytes(serialization) > store.maxBytes && store.ordering.length > 0) {
        eject(store);
        serialize(store);
      } else {
        store.write(serialization);
      }
    }

    function intermediateRepresentation(store) {
      var curr, fingerprint, index, ir, iter, serialization, storeOrdering, temp;
      ir = {};
      storeOrdering = store.ordering;
      iter = storeOrdering.head;
      index = 0;
      while (iter) {
        curr = iter.data;
        serialization = ir[curr.k] = new Array(2);
        serialization[VAL_POSITION] = curr.v;
        serialization[INDEX_POSITION] = index;
        index++;
        iter = iter.next;
      }
      fingerprint = store.fingerprint;
      if (fingerprint) {
        temp = {};
        temp[fingerprint] = ir;
        ir = temp;
      }
      return ir;
    }

    function hydrate(store) {
      var curr, data, datum, index, key, ordering, _i, _len;
      if (store.hydrated) {
        return;
      }
      data = store.decode(store.read() || '') || {};
      if (store.fingerprint) {
        data = data[store.fingerprint] || {};
      }
      ordering = [];
      for (key in data) {
        if (!data.hasOwnProperty(key)) continue;
        curr = data[key];
        index = curr[INDEX_POSITION];
        ordering[index] = data[key] = datumStruct(key, curr[VAL_POSITION]);
      }
      for (_i = 0, _len = ordering.length; _i < _len; _i++) {
        datum = ordering[_i];
        datum.i = store.ordering.push(datum);
      }
      store.data = data;
      store.hydrated = true;
    }

    function eject(store) {
      var datum, _ref;
      datum = (_ref = store.ordering.pop()) != null ? _ref.data : void 0;
      if (datum) {
        delete store.data[datum.k];
      }
    }

    return Store;
  })();



  /*
   * Datum struct
   * ============
   */


  function datumStruct(key, value) {
    return {
      k: key,
      v: value,
      i: null
    };
  }


  /*
  # Linked list
  # ===========
  */

  LinkedList = (function() {
    function LinkedList() {
      this.head = this.tail = null;
      this.length = 0;
    }

    LinkedList.prototype.push = function(data) {
      var iter = iterStruct(data);

      if (!this.head) {
        this.head = this.tail = iter;
      } else {
        this.tail.next = iter;
        iter.prev = this.tail;
        this.tail = iter;
      }
      this.length++;
      return iter;
    };

    LinkedList.prototype.unshift = function(data) {
      var iter = iterStruct(data);
      if (!this.head) {
        this.head = this.tail = iter;
      } else {
        this.head.prev = iter;
        iter.next = this.head;
        this.head = iter;
      }
      this.length++;
      return iter;
    };

    LinkedList.prototype.remove = function(iter) {
      var _ref, _ref1;
      if (iter === this.head) {
        this.head = iter.next;
      }
      if (iter === this.tail) {
        this.tail = iter.prev;
      }
      if ((_ref = iter.prev) != null) {
        _ref.next = null;
      }
      if ((_ref1 = iter.next) != null) {
        _ref1.prev = null;
      }
      iter.next = iter.prev = null;
      this.length--;
      return iter;
    };

    LinkedList.prototype.pop = function() {
      if (this.tail) return this.remove(this.tail);
      return null;
    };

    return LinkedList;

  })();

  function iterStruct(data) {
    return {
      data: data,
      next: null,
      prev: null
    };
  };


  /*
   * Export
   * ======
   */

  window.Unreliable = {
    Store: Store
  };

}(window);
