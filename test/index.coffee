{UnreliableStore} = require '../unreliable.js'
expect = require 'expect.js'

describe 'UnreliableStore', ->
  storage = {}
  reverse = (string) -> string.split('').reverse().join('')
  ns = 'test'
  read = -> storage[ns]
  write = (string) -> storage[ns] = string
  encode = (obj) -> reverse JSON.stringify(obj)
  decode = (string) ->
    try
      JSON.parse reverse(string)
    catch e
      {}
  clear = -> storage = {}

  beforeEach -> clear()

  it 'should work as a simple key-value store in the base case', ->
    kvStore = new UnreliableStore
    kvStore.setItem 'test', 100
    kvStore.setItem 'type', 'key-value'
    expect(kvStore.getItem 'test').to.be 100
    expect(kvStore.getItem 'type').to.be 'key-value'

  it 'should read and write from a given backing store', ->
    store = new UnreliableStore {read, write}
    store2 = new UnreliableStore {read, write}
    store.setItem 'test', 100
    expect(storage[ns]).to.be.a 'string'
    expect(store2.getItem 'test').to.be 100

  it 'should fingerprint when a fingerprint is given', ->
    store = new UnreliableStore {read, write, fingerprint: 1}
    store2 = new UnreliableStore {read, write, fingerprint: 2}
    
    store.setItem 'test', 100
    store2.setItem 'test', 200

    expect(store.getItem 'test').to.be 100
    expect(store2.getItem 'test').to.be 200

  it 'should use given encode, decode functions', ->
    store = new UnreliableStore {read, write}
    encryptedStore = new UnreliableStore {read, write, encode, decode}

    encryptedStore.setItem 'hello', 'sir'
    cryptValue = storage[ns]
    store.setItem 'hello', 'sir'
    expect(storage[ns]).to.be reverse(cryptValue)

  it 'should eject from storage in LRU order if a capacity is exceeded', ->
    store = new UnreliableStore { read, write, capacity: 96 }
    
    store.setItem 'username', 'reissbaker'
    store.setItem 'messages', 10
    store.setItem 'stars', 275

    expect(store.getItem 'username').to.not.be.ok()
    expect(store.getItem 'messages').to.be 10
    expect(store.getItem 'stars').to.be 275

    store.setItem 'username', 'reissbaker'

    expect(store.getItem 'username').to.be 'reissbaker'
    expect(store.getItem 'messages').to.not.be.ok()
    expect(store.getItem 'stars').to.be 275

  

