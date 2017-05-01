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

          var rocksResourceGnode;
          var c = Promise.all([a,b]).spread(function(aNode, rocksResourceGnode) {
            //Create 'rocks-index' gNode
            var d = createGraphNode(rocksResource._key, false).then((rockIndexGnode)=> {
              console.log(rocksResource)
              //Create edge for rocks resource to rocksIndex resource
              return edges.save({
                _to: rockIndexGnode._id,
                _from: rocksResourceGnode._id,
                name: 'rocks-index'
              }).then(function() {
                //Create edges for rocks
                return Promise.map(gNodes, function(rockGnode) {
                  var m = _.findKey(rocksResource['rocks-index'], rockGnode.resource_id);
                  console.log(m)
                  return edges.save({
                    _to: rockGnode._id,
                    _from: rockIndexGnode._id,
                    name: m 
                  });
                });
              });
            });

            //Create link from aNode to bNode with name: rocks
            return edges.save({
              _to: rocksResourceGnode._id,
              _from: aNode._id,
              name: 'rocks'
            });
          });
          return Promise.all([c]);
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
