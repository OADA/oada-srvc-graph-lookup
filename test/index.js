'use strict'
const moment = require('moment')
const _ = require('lodash')
const expect = require('chai').expect
const Promise = require('bluebird')
const debug = require('debug')
const kf = require('kafka-node');
const config = require('../config')
config.set('isTest', true)
const init = require('../../../admin/oada-lib-arangodb/init')
const graphLookupService = require('../server')

// Tests for the arangodb driver:

let rockUrl = '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss'
let rockResourceId = 'default:resources_rock_123'
let rockMetaId = 'default:meta_rock_123'
let rockPathLeft = ''

let rocksIndexUrl = '/resources/default:resources_bookmarks_123/rocks/rocks-index'
let rocksIndexResourceId = 'default:resources_rocks_123'
let rocksIndexMetaId = 'default:meta_rocks_123'
let rocksIndexPathLeft = '/rocks-index'

let rockPickedUrl = '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss/picked_up'
let rockPickedPathLeft = '/picked_up'

let graphRequestProducer
let graphRequestConsumer
let httpRequestProducer
let httpRequestConsumer

describe('graph-lookup service', () => {
  before(() => {

    // Create the test database (with necessary collections and dummy data)
    return init.run()
    .then(() => graphLookupService.start())
    .then(() => {
      // Setup Kafka
      let client = Promise.promisifyAll(new kf.Client('zookeeper:2181','graph-lookup'))
      let offset = Promise.promisifyAll(new kf.Offset(client))

      // Create a fake consumer of http-request
      let consOptions = { autoCommit: true };
      let consTopic = 'http_response';
      httpRequestConsumer = Promise.promisifyAll(new kf.Consumer(client, [ {topic: consTopic} ], consOptions));

      // Create a fake producer of graph-request messages
      graphRequestProducer = Promise.promisifyAll(new kf.Producer(client, {
        partitionerType: 0
      }))
      graphRequestProducer.on('error', (err)=> { console.log(err)})
      return graphRequestProducer = graphRequestProducer 
        .onAsync('ready')
        .return(graphRequestProducer)
        .tap(function(prod) {
          return prod.createTopicsAsync(['graph_request'], true);
        });
    }).catch(err => {
      console.log('FAILED to initialize graph-lookup tests by creating database ')
      console.log('The error = ', err)
    })
  })

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------

  it('should consume messages on the graph-request topic', done => {
    graphRequestProducer.then(prod => {
      return prod.sendAsync([{
        topic: 'graph_request', 
        messages: JSON.stringify({url:rockUrl})
      }]).then(() => {
        httpRequestConsumer.on('message', msg => {
          var result = JSON.parse(msg.value)
          expect(result.resource_id).to.equal(rockResourceId)
          expect(result.meta_id).to.equal(rockMetaId)
          expect(result.path_left).to.equal(rockPathLeft)
          done()
        })
      })
    }).catch(done)
  })
  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(() => {
//    db.useDatabase('_system') // arango only lets you drop a database from the _system db
 //   return db.dropDatabase(dbname)
 //   .then(() => { console.log('Successfully cleaned up test database '+dbname) })
 //   .catch(err => console.log('Could not drop test database '+dbname+' after the tests! err = ', err))
  })
})
