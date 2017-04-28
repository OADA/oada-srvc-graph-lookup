let createDb = require('../admin/createDb.js');
let _ = require('lodash');
let Promise = require('bluebird')
let {resources, graphNodes, edges} = createDb.collections;

/*
  /resources/6/rocks/rocks-index/123

  Resources:
  {
    _id: 6,
    _oada_rev: "0-0",
    _meta: {
      _id: "meta:6",
      _rev: "0-0"
    },
    picked_up: false
  }

  graphNodes:
  {

  }

*/
var rockRandNumber=1;
var createResource = function createResource(data) {
  data = _.merge({}, {_oada_rev: "0-0"}, data);
  return resources.save(data).then((resource)=> {
    return resources.update(resource, {
      _meta: {
        _oada_rev: "0-0",
        _id: "meta:" + resource._key
      }
    });
  });
}

var createRocks = function createRocks() {
  var rocks = [
    {
      picked_up: false
    }
  ];
  return Promise.map(rocks, (rock)=>{
    return createResource(rock);
  });
}

var createGraphNode = function createGraphNode(resourceId, isResource) {
  isResource = (isResource == null || isResource) ? true : false;
  var data = _.merge({}, {resource_id: resourceId, is_resource: isResource});
  return graphNodes.save(data);
}

var addData = function addData() {

  return createDb.destroy().then(() => {
    return createDb.create();
  }).then(()=> {
    return createRocks().then(function(rocks) {
      return Promise.map(rocks, function(rock) {
        //Create graph node for each rock
        return createGraphNode(rock._key, true);
      }).then((gNodes)=>{
        //Create 'Rocks' resource
        var rocksResource = {
          'rocks-index': {}
        };
        _.forEach(rocks, function(rock) {
          rocksResource['rocks-index'][rockRandNumber] = {
            _id: rock._key
          }
          rockRandNumber++;
        });
        return createResource(rocksResource).then((rocksResourceSaved) => {
          rocksResource = _.merge({}, rocksResource, rocksResourceSaved);
          //Create resource for bookmarks
          var a = createResource({_key: '6', rocks: {_id: rocksResource._id}}).then(function(r) {
            //Create gNode for bookmarks
            return createGraphNode(r._key, true);
          });
          //Create gNode for rocksResource
          var b = createGraphNode(rocksResource._key, true);

          var c = Promise.all([a,b]).spread(function(aNode, bNode) {
            //Create link from aNode to bNode with name: rocks
            return edges.save({
              _to: bNode._id,
              _from: aNode._id,
              name: 'rocks'
            });
          });

          //Create 'rocks-index' gNode
          var d = createGraphNode(rocksResource._key, false).then((rockIndexGnode)=> {
            //Create edge for rocks resource to rocksIndex resource
            return edges.save({
              _to: rockIndexGnode._id,
              _from: rocksResource._id,
              name: 'rocks-index'
            }).then(function() {
              //Create edges for rocks
              return Promise.map(Object.keys(rocksResource['rocks-index']), function(key) {
                return edges.save({
                  _to: 'resources/'+rocksResource['rocks-index'][key]._id,
                  _from: rockIndexGnode._id,
                  name: key
                });
              });
            });
          });

          return Promise.all([c,d]);
        })
      });
    });
  });
}

if (require.main === module) {
  console.log('Adding Dataset1 to the database.');
  return addData();
}
module.exports = {
  addData: addData
};
