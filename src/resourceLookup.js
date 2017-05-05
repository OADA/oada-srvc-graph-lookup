'use strict'
let arangojs = require('arangojs');
let Promise = require('bluebird');
let aql = arangojs.aql; 
let Database = arangojs.Database;
let config = require('../config.js')
let server_addr = config.get('arango:connectionString');
let db = new Database(server_addr);
let pointer = require('json-pointer');

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
      return {resource_id: graphNodeId, leftover_path}
    } else if (cursor._result.length > 0) {
      leftoverPath = (cursor._result[0].is_resource) ? '' : leftoverPath+'/'+urlArray[i]
      return recursiveQuery(urlArray,i+1,cursor._result[0]._key, leftoverPath)
    } else return null
  })
}
module.exports = {
  resIdFromUrl,
}

let resIdOneHop = function(url) {
  let pieces = pointer.parse(url)
  return db.query(aql`
    FOR n IN graphNodes
      FILTER n.is_resource == true && n.resource_id == ${pieces[1]}
      RETURN n`
  ).then((cursor) => {
    pieces.splice(0,2)
    return oneHopQuery(pieces, 0, cursor._result[0]._key, '')
  })
}

let oneHopQuery = function(urlArray, i, graphNodeId, leftoverPath) {
  let bindVars = {
    value0: urlArray.length,
    value1: 'graphNodes/'+graphNodeId,
  }
// Create a filter for each segment of the url
  const filters = urlArray.map((urlPiece, i) => {
    let bindVarA = 'value' + (2+(i*2)).toString()
    let bindVarB = 'value' + (2+(i*2)+1).toString()
    bindVars[bindVarA] = i;
    bindVars[bindVarB] = urlPiece;
    return `FILTER p.edges[@${bindVarA}].name == @${bindVarB}`
  }).join(' ')
  let query = `FOR v, e, p IN 0..@value0
      OUTBOUND @value1 
      edges
      ${filters}
      RETURN p`
  return db.query({query, bindVars})
  .then((cursor) => {
    console.log(cursor._result)
// At the end of the url, return the resource id
    return cursor._result[0]
  })
}

let url = '/resources/6/rocks/rocks-index/1'
return resIdOneHop(url).then((res) => { console.log(res)})
