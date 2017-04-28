'use strict'
let arangojs = require('arangojs');
let Database = arangojs.Database;
let Promise = require('bluebird');
let aql = arangojs.aql; 
let server_addr = process.env.ARANGODB_SERVER ? process.env.ARANGODB_SERVER : "http://localhost:8529";
let db = new Database(server_addr);


let resources = db.collection('resources');
let graphNodes = db.edgeCollection('graphNodes');
let edges = db.edgeCollection('edges');

// Inputs: resources URL
let url = 'resources/6/rocks/rocks-index/123';

let resourceFromPath = function(url) {
  return recursiveQuery(url.split('/'), 1, url.split('/')[1]).then((result)=>{
    console.log(result)
  })
}

let recursiveQuery = function(urlArray, i, resource_id) {
  return db.query(aql`
    FOR v, e IN 1..1
      OUTBOUND ${resource_id}
      edges FILTER e.name == ${urlArray[i+1]}
    RETURN v`
  ).then((cursor) => {
    if (cursor._result.length > 0) {
      return recursiveQuery(urlArray,i+1,cursor._result[0].resource_id)
    } else return resource_id
  })
}
