/*! @license ©2014 Ruben Verborgh - Multimedia Lab / iMinds / Ghent University */
/* A TriplePatternIterator builds bindings by reading matches for a triple pattern. */


//var predicates = ['http://db.uwaterloo.ca/~galuc/wsdbm/hasGenre'];


var MultiTransformIterator = require('../iterators/MultiTransformIterator'),
    rdf = require('../util/RdfUtil'),
    Logger = require('../util/ExecutionLogger')('TriplePatternIterator')
    Iterator = require('../iterators/Iterator'),
    BloomFilter = require('bloem').Bloem
    base64 = require('base64-arraybuffer').decode,
    _ = require('lodash');

var args = require('minimist')(process.argv.slice(2));

// Creates a new TriplePatternIterator
function TriplePatternIterator(parent, pattern, options) {
  if (!(this instanceof TriplePatternIterator))
    return new TriplePatternIterator(parent, pattern, options);
  MultiTransformIterator.call(this, parent, options);

  this._pattern = pattern;
  this._client = this._options.fragmentsClient;
  this._filter = "";
}
MultiTransformIterator.inherits(TriplePatternIterator);
/*
// Creates a fragment with triples that match the binding of the iterator's triple pattern
TriplePatternIterator.prototype._createTransformer = function (bindings, options) {
  // Apply the bindings to the iterator's triple pattern
  var boundPattern = rdf.applyBindings(bindings, this._pattern);

  // Retrieve the fragment that corresponds to the resulting pattern
  var fragment = this._client.getFragmentByPattern(boundPattern);
  Logger.logFragment(this, fragment, bindings);
  fragment.on('error', function (error) { Logger.warning(error.message); });
  return fragment;
};
*/

TriplePatternIterator.prototype._createTransformer = function (bindings, options) {
  var boundPattern = rdf.applyBindings(bindings, this._pattern);
  var fragment;

  this._bpattern = bindings._pattern;

  if(!rdf.hasVariables(boundPattern)) {
    this._filter = bindings._filter;
    this._rsource = this._source;
    this._rpattern = boundPattern;

    while(this._rpattern && !rdf.hasVariables(this._rpattern) && (typeof this._rsource !== "undefined") && (!this._filter || this._filter == "")) {
      this._rpattern = this._rsource._pattern;
      this._bpattern = this._rsource._bpattern;
      this._filter = this._rsource._filter;
      this._rsource = this._rsource._source;
    }

    fragment = new Iterator.PassthroughIterator();
    var obstaja = true;

    var pfilter = true;
    if(args.z) { pfilter = false; }


    if(this._bpattern && this._filter && pfilter/* && _.contains(predicates, boundPattern["predicate"])*/) {

      var filterFields = this._filter.split(',');

      var filterStr = new Buffer(filterFields[2], 'base64');

      // filterFields[1,2] = m, k
      var bloomFilter =  new BloomFilter(filterFields[0], filterFields[1], filterStr);



      if(!rdf.isVariable(this._bpattern.predicate) && (!rdf.isVariable(this._bpattern.subject) || !rdf.isVariable(this._bpattern.object))) {

        var testStr = boundPattern.subject + "|" + boundPattern.predicate + "|" + boundPattern.object;

        if(filterFields[0] == 0) {
          obstaja = false;
        } else {
          obstaja = bloomFilter.has(Buffer(testStr));
        }
      } else if(!rdf.isVariable(this._bpattern.predicate)) {
        var parent = rdf.removeBindings(bindings, this._pattern);

        if(parent["subject"] != this._bpattern.object && parent["object"] != this._bpattern.object) {

          var testStr = boundPattern.subject + "|" + boundPattern.predicate + "|" + boundPattern.object;

          if(filterFields[0] == 0) {
            obstaja = false;
          } else {
            obstaja = bloomFilter.has(Buffer(testStr));
          }
        }
      }

    }

    if (obstaja) {
      fragment.setSource(this._client.getFragmentByPattern(boundPattern));
    } else {
    /*  if(typeof global.reseno === "undefined")  {
        global.reseno=0;
      }
      global.reseno++;

      console.log(global.reseno);*/
      fragment.setSource(Iterator.empty());
    }
  } else {
    fragment = this._client.getFragmentByPattern(boundPattern);
  }

  Logger.logFragment(this, fragment, bindings);
  fragment.on('error', function (error) { Logger.warning(error.message); });

  return fragment;
};

/*
// Reads a binding from the given fragment
TriplePatternIterator.prototype._readTransformer = function (fragment, fragmentBindings) {
  // Read until we find a triple that leads to consistent bindings
  var triple;
  while (triple = fragment.read()) {
    // Extend the bindings such that they bind the iterator's pattern to the triple
    try { return rdf.extendBindings(fragmentBindings, this._pattern, triple); }
    catch (bindingError) { /- non-data triple, didn't match the bindings -/ }
  }
  // No consistent bindings were available (yet)
  return null;
};
*/


// Reads a binding from the given fragment
TriplePatternIterator.prototype._readTransformer = function (fragment, fragmentBindings) {
  // Read until we find a triple that leads to consistent bindings
  var triple;
  while (triple = fragment.read()) {
    // Extend the bindings such that they bind the iterator's pattern to the triple
    try {
       var r = rdf.extendBindings(fragmentBindings, this._pattern, triple);
       r._filter = triple.filter;
       r._pattern = this._pattern;
       return r;
     }
    catch (bindingError) { /* non-data triple, didn't match the bindings */ }
  }
  // No consistent bindings were available (yet)
  return null;
};
// Generates a textual representation of the iterator
TriplePatternIterator.prototype.toString = function () {
  return '[' + this.constructor.name +
         ' {' + rdf.toQuickString(this._pattern) + ')}' +
         '\n  <= ' + this.getSourceString();
};

module.exports = TriplePatternIterator;
