'use strict'
let arangojs = require('arangojs');
let Promise = require('bluebird');
let aql = arangojs.aql; 
let Database = arangojs.Database;
let config = require('../config.js')
let server_addr = config.get('arango:connectionString');
let db = new Database(server_addr);


let resources = db.collection('resources');
let graphNodes = db.edgeCollection('graphNodes');
let edges = db.edgeCollection('edges');

let resourceFromPath = function(url) {
  return recursiveQuery(url.split('/'), 1, url.split('/')[1]).then((result)=>{
    console.log(result)
  })
}

let recursiveQuery = function(urlArray, i, resource_id) {
  console.log(urlArray, i, resource_id)
  return db.query(aql`
    FOR v, e IN 1..1
      OUTBOUND "graphNode/6"
      edges FILTER e.name == "rocks"
    RETURN v`
  ).then((cursor) => {
    console.log(cursor._result)
    if (cursor._result.length > 0) {
      console.log(cursor._result)
      return recursiveQuery(urlArray,i+1,cursor._result[0].resource_id)
    } else return resource_id
  })
}

let url = 'resources/6/rocks/rocks-index/1';
resourceFromPath(url)
