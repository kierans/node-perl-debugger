/*jshint expr: true*/

"use strict";

var TransformStream = require("stream").Transform,
    util = require("util");

var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var StreamEmitter = require("../src/StreamEmitter");

util.inherits(DummyStream, TransformStream);
StreamEmitter.mixin(DummyStream);

function DummyStream() {
  TransformStream.call(this, { objectMode: true });
}

describe("StreamEmitter Tests", function() {
  var stream;

  beforeEach(function() {
    stream = new DummyStream();
  });

  should("serialise error into object for streaming", function(done) {
    var eventName = "someevent",
        arg1 = "foo",
        arg2 = 123;

    stream.on("readable", function() {
      var event = stream.read();

      expect(event.name).to.equal(eventName);
      expect(event.args.length).to.equal(2);
      expect(event.args[0]).to.equal(arg1);
      expect(event.args[1]).to.equal(arg2);

      done();
    });

    stream._event(eventName, arg1, arg2);
  });
});