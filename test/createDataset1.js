let createDb = require('../createDb.js');
let _ = require('lodash');
let uuid = require('uuid/v4');
let {resources, graphNodes, edges} = createDb.resources;

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
var createResource = function createResource(data) {
  var data = _.merge({}, {_oada_rev: "0-0"}, data);
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
    return createResource(data);
  });
}

var createGraphNode = function createGraphNode(resourceId, isResource) {
  isResource = (isResource == null) ? true : false;
  var data = _.merge({}, {resource_id: resourceId, is_resource: isResource});
  return resources.save(data);
}


var addData = function addData() {
  return createDb.destroy().then(() => {
    return createDb.create();
  }).then(()=> {
    return createRocks.then(function(rocks) {
      return Promise.map(rocks, function(rock) {
        //Create graph node for each rock
        return createGraphNode(rock._key, true);
      }).then((gNodes)=>{
        //Create 'Rocks' resource
        var rocksResource = {
          'rocks-index': {}
        };
        _.forEach(rocks, function(rock) {
          rocksResource['rocks-index'][uuid()] = {
            _id: rock._key
          }
        });
        return createResource(rocksResource).then(() => {
          //Create 'rocks-index' gNode
          return createGraphNode(rocksResource._key, false).then((rockIndexGnode)=> {
            //Create edge for rocks resource to rocksIndex resource
            return edges.save({
              _to: rockIndexGnode._key,
              _from: rocksResource._key,
              name: 'rocks-index'
            }).then(function() {
              //Create edges for rocks
              return Promise.map(rocksResource['rocks-index'], function(rockResourceKey, key) {
                return edges.save({
                  _to: rockResourceKey._id,
                  _from: rockIndexGnode._key,
                  name: key
                });
              });
            });
          });
        })
      });
    });
  });
}

if (require.main === module) {
  console.log('Adding Dataset1 to the database.');
  return addData();
}
modules.exports = {
  addData: addData
};
