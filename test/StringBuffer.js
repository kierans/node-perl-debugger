"use strict";

var DuplexStream = require("stream").Duplex,
    util = require("util");

util.inherits(StringBuffer, DuplexStream);

module.exports = StringBuffer;

function StringBuffer() {
  DuplexStream.call(this, { objectMode: true });

  this.data = "";
}

StringBuffer.prototype.getData = function() {
  return this.data;
};

//noinspection JSUnusedGlobalSymbols
/**
 * @ignore
 *
 * Do nothing.  This is an interface implementation because this class is a Duplex stream.
 */
StringBuffer.prototype._read = function() {

};

//noinspection JSUnusedGlobalSymbols
StringBuffer.prototype._write = function(chunk, encoding, done) {
  this.data += chunk;

  // do in next tick so event handlers are registered.
  process.nextTick(function() {
    this.emit("write");
  }.bind(this));

  done();
};