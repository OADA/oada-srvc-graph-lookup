'use strict';

const Promise = require('bluebird');
const uuid = require('uuid');
const kf = require('kafka-node');
const debug = require('debug')('graph-lookup');
const trace = require('debug')('graph-lookup:trace');
const warning = require('debug')('graph-lookup:warning');
const lookupFromUrl = require('../../../admin/oada-lib-arangodb/libs/resources').lookupFromUrl
const config = require('../config')

function start() {
  return Promise.try(() => {
    trace('starting graph-lookup consumer on topic: graph_request')
    var client = new kf.Client('zookeeper:2181','graph-lookup');
    var offset = Promise.promisifyAll(new kf.Offset(client));
    var producer = Promise.promisifyAll(new kf.Producer(client, {
      partitionerType: 0 
    }));
    var consumer = Promise.promisifyAll(new kf.ConsumerGroup({
      host: 'zookeeper:2181',
      groupId: 'graph-lookup-group',
      fromOffset: 'latest'
    }, ['graph_request']));

    trace('starting graph-lookup producer on topic: http_response')
    producer = producer
      .onAsync('ready')
      .return(producer)
      .tap(function(prod) {
        return prod.createTopicsAsync(['http_response'], true);
      });
  
    var requests = {};
    consumer.on('message', function(msg) {
      var resp = JSON.parse(msg.value);
      return lookupFromUrl(resp.url).then((result) => {
        return producer.then(function sendTokReq(prod) {
          return prod.sendAsync([{
            topic: 'http_response',
            messages: JSON.stringify(result)
          }]);
        }).then(() => {
          return offset.commitAsync('graph-lookup-group', [msg]);
        })
      })
    })
  }).then(()=>{
    trace('graph-lookup consumer successfully started')
    trace('graph-lookup producer successfully started')
    return true
  }).catch((err) => {
    console.log(err)
  })
}

module.exports = {
  start
}
