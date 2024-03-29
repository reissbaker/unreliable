!function(root) {
  'use strict';

  /*
   * Utilities
   * =========
   */


  /*
   * Returns the number of bytes the string uses.
   *
   * Takes:
   *
   * - `string`: a string.
   */

  function numBytes(string) { return string.length * 2; }


  /*
   * A safe shim for `hasOwnProperty`.
   *
   * Takes:
   *
   * - `object`: an object.
   * - `property`: a string property.
   */

  function own(object, property) {
    return {}.hasOwnProperty.call(object, property);
  }


  /*
   * Store Class
   * ===========
   */

  /*
   * Store constructor.
   *
   * Arguments:
   *
   *   - `options`: a hash of options. The following are options that can be
   *      set:
   *
   *      + `fingerprint`: a unique key that will distinguish this dataset from
   *         any others. For example, if you're doing per-user storage, you may
   *         want to use a user id as a key to ensure multiple users don't
   *         accidentally write to the same storage location.
   *
   *      + `capacity`: the maximum capacity the store should allow, in bytes.
   *         If the capacity is exceeded, the store will begin the least
   *         recently used data, until the dataset is under the capacity.
   *         `capacity` must, if specified, be greater than 0.
   *
   *      + `read`: a function of the form `function() {}` that returns a 
   *         string from storage. If left unspecified, the store will never be 
   *         able to read from its backing store.
   *
   *      + `write`: a function of the form `function(string) {}` that writes
   *         a string to a backing store. If left unspecified, the store will
   *         never be able to serialized to its backing store.
   *
   *      + `decode`: a function of the form `function(string) {}` that takes a
   *         string and returns an object. `decode` will be called after `read`
   *         to convert the string returned by read into usable data. If left
   *         unspecified, `decode` will attempt to parse the string as JSON.
   *
   *      + `encode`: a function of the form `function(obj) {}` that takes an
   *         object and returns a string. `encode` will be called before
   *         `write` to convert the current data to a string format. If left
   *         unspecified, `encode` will attempt to serialize the object as
   *         JSON.
   */

  var Store = (function() {
    var VAL_POSITION = 0,
        INDEX_POSITION = 1;

    function Store(options) {
      this.data = {};
      this.orderedData = new LinkedList;
      this.hydrated = false;

      setDefaultOptions(this, options, {
        fingerprint: null,
        capacity: -1,
        read: function() { return {}; },
        write: function() {},
        decode: function(x) {
          try {
            return JSON.parse(x) || {};
          } catch(e) {
            return {};
          }
        },
        encode: function(x) { return JSON.stringify(x); }
      });
    }

    
    /*
     * Private Store utility functions
     * -------------------------------
     */

    /*
     * Given an instance method, returns a wrapper that that calls `hydrate`
     * on the instance before calling the method.
     *
     * Arguments:
     *  
     *   - `method`: an instance method.
     */

    function hydrated(method) {
      return function() {
        hydrate(this);
        return method.apply(this, arguments);
      };
    }

    function setDefaultOptions(store, options, defaults) {
      if(!options) options = {};
      for(var prop in defaults) {
        if(own(defaults ,prop)) {
          store[prop] = options[prop] != null ? options[prop] : defaults[prop];
        }
      }
    }


    /*
     * Public Store methods
     * --------------------
     */

    Store.prototype.setItem = hydrated(function(key, val) {
      var datum;
      
      if(!own(this.data, key)) {
        datum = this.data[key] = datumStruct(key, val);
        datum.i = this.orderedData.unshift(datum);
      } else {
        datum = this.data[key];
        datum.v = val;
        promote(this, datum);
      }

      serialize(this);
      return val;
    });

    Store.prototype.removeItem = hydrated(function(key) {
      var datum = this.data[key];

      if(datum) {
        delete this.data[key];
        this.orderedData.remove(datum.i);
        serialize(this);
        return datum.v;
      } 

      return datum;
    });

    Store.prototype.getItem = hydrated(function(key) {
      var datum = this.data[key];

      if(datum) {
        promote(this, datum);
        serialize(this);
        return datum.v;
      }

      return datum;
    });

    Store.prototype.clear = function() {
      this.data = {};
      this.orderedData = new LinkedList;
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
        read: function() { return store.getItem(key); },
        write: function(data) { return store.setItem(key, data); },
        capacity: options.capacity,
        fingerprint: options.fingerprint
      });
    };

    /*
     * Private Store methods
     * ---------------------
     */

    function promote(store, datum) {
      store.orderedData.remove(datum.i);
      datum.i = store.orderedData.unshift(datum);
    }

    function serialize(store) {
      var serialization = store.encode(intermediateRepresentation(store)),
          capacity = store.capacity,
          orderedData = store.orderedData;

      if(capacity >= 0 && numBytes(serialization) > capacity && orderedData.length > 0) {
        eject(store);
        serialize(store);
      } else {
        store.write(serialization);
      }
    }

    function intermediateRepresentation(store) {
      var curr, index, temp, iter, serialization,
          ir = {},
          orderedData = store.orderedData,
          fingerprint = store.fingerprint;

      index = 0;
      for(iter = orderedData.head; iter; iter = iter.next) {
        curr = iter.data;
        serialization = ir[curr.k] = new Array(2);
        serialization[VAL_POSITION] = curr.v;
        serialization[INDEX_POSITION] = index;
        index++;
      }

      if(fingerprint) {
        temp = {};
        temp[fingerprint] = ir;
        ir = temp;
      }

      return ir;
    }

    function hydrate(store) {
      var data, ordering, key, index, length, curr,
          fingerprint = store.fingerprint;

      if(store.hydrated) return;

      data = store.decode(store.read() || '') || {};
      if(fingerprint) data = data[fingerprint] || {};

      ordering = [];
      for(key in data) {
        if(own(data, key)) {
          curr = data[key];
          index = curr[INDEX_POSITION];
          ordering[index] = data[key] = datumStruct(key, curr[VAL_POSITION]);
        }
      }

      for(index = 0, length = ordering.length; index < length; index++) {
        curr = ordering[index];
        curr.i = store.orderedData.push(curr);
      }

      store.data = data;
      store.hydrated = true;
    }

    function eject(store) {
      var iter = store.orderedData.pop();
      if(iter) delete store.data[iter.data.k];
    }

    return Store;
  })();



  /*
   * Datum Struct
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
   * Linked List Class
   * =================
   */

  var LinkedList = (function() {
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
      if(!this.head) {
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
      var next = iter.next,
          prev = iter.prev;

      if(iter === this.head) this.head = next;
      if(iter === this.tail) this.tail = prev;
      
      if(prev) prev.next = next;
      if(next) next.prev = prev;

      iter.next = iter.prev = null;

      this.length--;
      return iter;
    };

    LinkedList.prototype.pop = function() {
      if(this.tail) return this.remove(this.tail);
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

  root.UnreliableStore = Store;

}(typeof exports === 'undefined' ? window : exports);
