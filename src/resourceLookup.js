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

let resIdFromUrl = function(url) {
  let resourceId = url.split('/')[2];
  return db.query(aql`
    FOR n IN graphNodes
      FILTER n.is_resource == true && n.resource_id == ${resourceId}
      RETURN n`
  ).then((cursor) => {
    return recursiveQuery(url.split('/'), 3, cursor._result[0]._key, '')
 })
}

let recursiveQuery = function(urlArray, i, graphNodeId, leftoverPath) {
  let graphNode = "graphNodes/" + graphNodeId;
  return db.query(aql`
    FOR v, e IN 1..1
      OUTBOUND ${graphNode}
      edges FILTER e.name == ${urlArray[i]} 
    RETURN v`
  ).then((cursor) => {
// At the end of the url, return the resource id
    if (i == urlArray.length-1) {
//Return the leftoverPath
      leftoverPath = (cursor._result[0].is_resource) ? '' : leftoverPath+'/'+urlArray[i]
      return {resourceId: graphNodeId, leftoverPath}
    } else if (cursor._result.length > 0) {
      leftoverPath = (cursor._result[0].is_resource) ? '' : leftoverPath+'/'+urlArray[i]
      return recursiveQuery(urlArray,i+1,cursor._result[0]._key, leftoverPath)
    } else return null
  })
}
module.exports = {
  resIdFromUrl,
}
