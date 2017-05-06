const Database  = require('arangojs').Database
const config = require('../config')
const moment = require('moment')
const _ = require('lodash')
const expect = require('chai').expect
const Promise = require('bluebird')
const addRocksData = require('./createRockDataset.js').addRocksData

// library under test:
let libs = {} // pull this later after config sets the dbname it creates

// Tests for the arangodb driver:

let db
let dbname

let rockUrl = '/resources/6/rocks/rocks-index/1'
let rockResourceId = '777'
let rockMetaId = 'meta:777'
let rockPathLeft = ''

let rocksIndexUrl = '/resources/6/rocks/rocks-index'
let rocksIndexResourceId = '123'
let rocksIndexMetaId = 'meta:123'
let rocksIndexPathLeft = '/rocks-index'

let rockPickedUrl = '/resources/6/rocks/rocks-index/1/picked_up'
let rockPickedPathLeft = '/picked_up'

describe('graph-lookup service', () => {
  before(() => {
    // Create the test database:
    db = new Database(config.get('arango:connectionString'))
    dbname = 'graph-lookup-test'
    config.set('arango:database',dbname)

    return db.createDatabase(dbname)
    .then(() => {
      db.useDatabase(dbname)
      // Create collections for resources, graphNodes, edges
      return Promise.all([
        db.collection('resources').create(),
        db.collection('graphNodes').create(),
        db.edgeCollection('edges').create()
      ])
    }).then(() => {
      return addRocksData()
    }).then(() => {
      libs = {
        'graph-lookup': require('../src/index.js'),
      }

    }).catch(err => {
      console.log('FAILED to initialize graph-lookup tests by creating database '+dbname)
      console.log('The error = ', err)
    })
  })


  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------

  it('should be able to return the resource id, meta doc id from a url', done => {
    libs['graph-lookup'].lookupFromUrl(rockUrl).then((result) => {
      expect(result.resource_id).to.equal(rockResourceId)
      expect(result.meta_id).to.equal(rockMetaId)
      expect(result.path_left).to.equal(rockPathLeft)
      done()
    })
  })
  it('should also return the leftover path for non-resource URLs', done => {
    libs['graph-lookup'].lookupFromUrl(rockPickedUrl).then((result) => {
      expect(result.resource_id).to.equal(rockResourceId)
      expect(result.meta_id).to.equal(rockMetaId)
      expect(result.path_left).to.equal(rockPickedPathLeft)
      done()
    })
  })
  it('should also return the leftover path for non-resource URLs', done => {
    libs['graph-lookup'].lookupFromUrl(rocksIndexUrl).then((result) => {
      expect(result.resource_id).to.equal(rocksIndexResourceId)
      expect(result.meta_id).to.equal(rocksIndexMetaId)
      expect(result.path_left).to.equal(rocksIndexPathLeft)
      done()
    })
  })

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(() => {
    db.useDatabase('_system') // arango only lets you drop a database from the _system db
    return db.dropDatabase(dbname)
    .then(() => { console.log('Successfully cleaned up test database '+dbname) })
    .catch(err => console.log('Could not drop test database '+dbname+' after the tests! err = ', err))
  })
})
