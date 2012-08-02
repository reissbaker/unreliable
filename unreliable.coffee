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
# Size conversions
# ----------------
#
# For self-documenting filesize descriptions
###

bytes = (x) -> x
kilobytes = (x) -> bytes(x) * 1024
megabytes = (x) -> kilobytes(x) * 1024


###
# Store
# =====
###

class Store
  @proxy = (store, key, bytes) ->
    read = -> store.getItem(key)
    write = (data) -> store.setItem key, data
    proxy = new Store read, write
    proxy.maxBytes = bytes || megabytes(4)
    proxy

  constructor: (@read, @write) ->
    @data = {}
    @ordering = new LinkedList
    @hydrated = false
    @maxBytes = -1
    @decode = (x) -> JSON.parse(x) || {}
    @encode = (x) -> JSON.stringify(x) || ''
    @namespace = null

  setItem: (key, val) ->
    hydrate this

    if !@data.hasOwnProperty(key)
      datum = @data[key] = new Datum(key, val)
      datum.iter = @ordering.unshift(datum)
    else
      datum = @data[key]
      datum.val = val
      iter = datum.iter
      promote(this, datum)

    serialize(this)
    val

  removeItem: (key) ->
    datum = @data[key]
    if datum
      delete @data[key]
      @ordering.remove(datum.iter)
      serialize(this)
      true
    else
      false

  getItem: (key, cbk) ->
    hydrate this
    datum = @data[key]
    if datum
      promote(this, datum)
      serialize(this)
      datum.val
    else
      datum

  clear: ->
    @data = {}
    @ordering = new LinkedList
    serialize(this)


###
# Store class methods
# -------------------
###

promote = (store, datum) ->
  store.ordering.remove datum.iter
  datum.iter = store.ordering.unshift(datum)

serialize = (store) ->
  ir = intermediateRepresentation(store)
  if store.namespace
    temp = {}
    temp[store.namespace] = ir
    ir = temp
  serialization = store.encode(ir)
  if store.maxBytes >= 0 && numBytes(serialization) > store.maxBytes
    if store.ordering.length > 0
      eject(store)
      serialize(store)
  else
    store.write serialization
    return

intermediateRepresentation = (store) ->
  data = {}
  storeOrdering = store.ordering
  iter = storeOrdering.head
  index = 0
  while iter
    curr = iter.data
    serialization = data[curr.key] = new Array(2)
    serialization[VAL_POSITION] = curr.val
    serialization[INDEX_POSITION] = index
    index++
    iter = iter.next
  data

hydrate = (store) ->
  return if store.hydrated

  try
    data = store.decode(store.read() || '') || {}
    if store.namespace
      data = data[store.namespace] || {}
  catch e
    data = {}

  ordering = []
  for own key of data
    curr = data[key]
    index = curr[INDEX_POSITION]
    ordering[index] = data[key] = new Datum(key, curr[VAL_POSITION])
  for datum in ordering
    datum.iter = store.ordering.push(datum)
  store.data = data
  store.hydrated = true
  return

eject = (store) ->
  datum = store.ordering.pop()?.data
  delete store.data[datum.key] if datum
  return


###
# Datum class
# ===========
###

class Datum
  constructor: (@key, @val) ->
    @iter = null


###
# Linked list
# ===========
###

class LinkedList
  constructor: ->
    @head = @tail = null
    @length = 0

  push: (data) ->
    node = new ListNode(data)
    if !@head
      @head = @tail = node
    else
      @tail.next = node
      node.prev = @tail
      @tail = node
    @length++
    node

  unshift: (data) ->
    node = new ListNode(data)
    if !@head
      @head = @tail = node
    else
      @head.prev = node
      node.next = @head
      @head = node
    @length++
    node

  remove: (node) ->
    if node == @head
      @head = node.next
    if node == @tail
      @tail = node.prev
    node.prev?.next = null
    node.next?.prev = null
    node.next = node.prev = null
    @length--
    node

  pop: ->
    popped = @tail
    popped?.prev?.next = null
    @tail = popped?.prev
    @length-- if popped
    popped

class ListNode
  constructor: (@data) ->
    @next = null
    @prev = null


###
# Export
# ======
###

window.Unreliable = {
  Store
  bytes
  kilobytes
  megabytes
}
