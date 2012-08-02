VAL_POSITION = 0
INDEX_POSITION = 1

###
# Utilities
# =========
###


###
# numBytes
# --------
#
# returns the number of bytes the string uses
###

numBytes = (string) -> string.length * 2


###
# Store
# =====
###

class Store
  @proxy = (store, key, bytes) ->
    read = -> store.getItem(key)
    write = (data) -> store.setItem key, data
    proxy = new Store read, write
    proxy.maxBytes = bytes || 1024 * 1024 * 4
    proxy

  constructor: (@read, @write) ->
    @data = {}
    @ordering = new LinkedList
    @hydrated = false
    @maxBytes = -1
    @decode = (x) ->
      try
        JSON.parse(x) || {}
      catch e
        {}
    @encode = (x) -> JSON.stringify(x)
    @namespace = null

  setItem: (key, val) ->
    hydrate this

    if !@data.hasOwnProperty(key)
      datum = @data[key] = datumStruct(key, val)
      datum.i = @ordering.unshift(datum)
    else
      datum = @data[key]
      datum.v = val
      promote(this, datum)

    serialize(this)
    val

  removeItem: (key) ->
    datum = @data[key]
    if datum
      delete @data[key]
      @ordering.remove(datum.i)
      serialize(this)
      datum.v
    else
      datum

  getItem: (key, cbk) ->
    hydrate this
    datum = @data[key]
    if datum
      promote(this, datum)
      serialize(this)
      datum.v
    else
      datum

  clear: ->
    @data = {}
    @ordering = new LinkedList
    serialize(this)
    return

  bytes: -> numBytes(@encode(intermediateRepresentation(this)))


###
# Store class methods
# -------------------
###

promote = (store, datum) ->
  store.ordering.remove datum.i
  datum.i = store.ordering.unshift(datum)

serialize = (store) ->
  serialization = store.encode intermediateRepresentation(store)

  if store.maxBytes >= 0 && numBytes(serialization) > store.maxBytes && store.ordering.length > 0
    eject(store)
    serialize(store)
    return
  else
    store.write serialization
    return

intermediateRepresentation = (store) ->
  ir = {}
  storeOrdering = store.ordering
  iter = storeOrdering.head
  index = 0
  while iter
    curr = iter.data
    serialization = ir[curr.k] = new Array(2)
    serialization[VAL_POSITION] = curr.v
    serialization[INDEX_POSITION] = index
    index++
    iter = iter.next
  
  namespace = store.namespace
  if namespace
    temp = {}
    temp[namespace] = ir
    ir = temp
  ir

hydrate = (store) ->
  return if store.hydrated

  data = store.decode(store.read() || '') || {}
  data = data[store.namespace] || {} if store.namespace

  ordering = []
  for own key of data
    curr = data[key]
    index = curr[INDEX_POSITION]
    ordering[index] = data[key] = datumStruct(key, curr[VAL_POSITION])

  for datum in ordering
    datum.i = store.ordering.push(datum)

  store.data = data
  store.hydrated = true
  return

eject = (store) ->
  datum = store.ordering.pop()?.data
  delete store.data[datum.k] if datum
  return


###
# Datum struct
# ============
###

datumStruct = (key, value) -> k: key, v: value, i: null


###
# Linked list
# ===========
###

class LinkedList
  constructor: ->
    @head = @tail = null
    @length = 0

  push: (data) ->
    iter = iterStruct(data)
    if !@head
      @head = @tail = iter
    else
      @tail.next = iter
      iter.prev = @tail
      @tail = iter
    @length++
    iter

  unshift: (data) ->
    iter = iterStruct(data)
    if !@head
      @head = @tail = iter
    else
      @head.prev = iter
      iter.next = @head
      @head = iter
    @length++
    iter

  remove: (iter) ->
    if iter == @head
      @head = iter.next
    if iter == @tail
      @tail = iter.prev
    iter.prev?.next = null
    iter.next?.prev = null
    iter.next = iter.prev = null
    @length--
    iter

  pop: -> if @tail then @remove(@tail) else null

iterStruct = (data) -> data: data, next: null, prev: null

###
# Export
# ======
###

window.Unreliable = { Store }
