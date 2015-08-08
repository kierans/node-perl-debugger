/*jshint expr: true*/

"use strict";

var net = require("net");

//noinspection JSUnresolvedVariable
var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var DebuggerHost = require("../src/DebuggerHost");

describe("DebuggerHost Test", function() {
  var PORT = 45367,
      debug;

  beforeEach(function(done) {
    debug = new DebuggerHost({ port: PORT });
    debug.on("listening", done);

    debug.listen();
  });

  afterEach(function(done) {
    debug.on("close", done);

    debug.close();
  });

  should("throw error creating host without specifying a port", function() {
    expect(function() {
      new DebuggerHost(); // jshint ignore:line
    }).to.throw(Error);
  });

  should("emit connection event when client connects", function(done) {
    var client;

    debug.on("connection", function() {
      // destroy the client
      client.destroy();

      done();
    });

    client = net.createConnection({ port: PORT });
  });

  should("emit disconnection event when client disconnects", function(done) {
    debug.on("disconnection", function() {
      done();
    });

    var client = net.createConnection({ port: PORT });
    client.on("connect", function() {
      client.destroy();
    });
  });
});