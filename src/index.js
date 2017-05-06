'use strict'
let arangojs = require('arangojs');
let Promise = require('bluebird');
let aql = arangojs.aql; 
let Database = arangojs.Database;
let config = require('../config.js')
let server_addr = config.get('arango:connectionString');
let db = new Database(server_addr);
db.useDatabase('graph-lookup-test')
let pointer = require('json-pointer');
let _ = require('lodash')

let resources = db.collection('resources');
let graphNodes = db.edgeCollection('graphNodes');
let edges = db.edgeCollection('edges');

let resIdFromUrlRecursive = function(url) {
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
      return {resource_id: graphNodeId, path_left}
    } else if (cursor._result.length > 0) {
      leftoverPath = (cursor._result[0].is_resource) ? '' : leftoverPath+'/'+urlArray[i]
      return recursiveQuery(urlArray,i+1,cursor._result[0]._key, leftoverPath)
    } else return null
  })
}

let lookupFromUrl = function(url) {
  let pieces = pointer.parse(url)
  pieces.splice(0, 1)
  let bindVars = {
    value0: pieces.length-1,
    value1: 'graphNodes/'+pieces[0],
  }
  pieces.splice(0, 1)
// Create a filter for each segment of the url
  const filters = pieces.map((urlPiece, i) => {
    let bindVarA = 'value' + (2+(i*2)).toString()
    let bindVarB = 'value' + (2+(i*2)+1).toString()
    bindVars[bindVarA] = i;
    bindVars[bindVarB] = urlPiece;
    return `FILTER p.edges[@${bindVarA}].name == @${bindVarB} || p.edges[@${bindVarA}].name == null`
  }).join(' ')
  let query = `FOR v, e, p IN 0..@value0
      OUTBOUND @value1 
      edges
      ${filters}
      RETURN p`
  return db.query({query, bindVars})
// Handle query output
  .then((cursor) => {
    let resource_id = ''
    let meta_id = ''
    let path_left = '' 
    if (cursor._result.length < 1) return (resource_id, meta_id, path_left)
    let res =_.reduce(cursor._result, (result, value, key) => {
      if (result.vertices.length > value.vertices.length) return result
      return value
    })
    resource_id = res.vertices[res.vertices.length-1].resource_id;
    meta_id = res.vertices[res.vertices.length-1].meta_id;
    if (res.vertices.length-1 < pieces.length) {
      let extras = pieces.length - (res.vertices.length-1)
      path_left = pointer.compile(pieces.slice(0-extras))
    } else path_left = res.vertices[res.vertices.length-1].path
    
    return {resource_id, meta_id, path_left}
  })
}

module.exports = {
  lookupFromUrl,
}
