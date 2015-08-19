/*jshint expr: true*/

"use strict";

var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var StringStream = require("./StringStream");

var DebuggerParser = require("../src/DebuggerParser");

describe("DebuggerParser Tests", function() {
  var parser;

  beforeEach(function() {
    parser = new DebuggerParser({
      log: process.stdout
    });
  });

  function eventReader(callback) {
    return function() {
      callback(parser.read());
    };
  }

  should("push break event when debugger paused", function(done) {
    var filename = "test.pl",
        line = "3";

    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("break");
      expect(event.args[0]).to.equal(filename);
      expect(event.args[1]).to.equal(line);

      done();
    }));

    StringStream.createStream("main::(" + filename + ":" + line + "):	$result = add(2, 4);").pipe(parser);
  });

  should("push prompt event when debugger awaiting input", function(done) {
    var promptNumber = "23";

    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("prompt");
      expect(event.args[0]).to.equal(promptNumber);

      done();
    }));

    StringStream.createStream("  DB<" + promptNumber + ">").pipe(parser);
  });

  should("push terminated event when debugged perl program terminates", function(done) {
    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("terminated");

      done();
    }));

    StringStream.createStream("  DB<1> Debugged program terminated.  Use q to quit or R to restart,\n").pipe(parser);
  });

  should("push file not found event when file not in perl path", function(done) {
    var file = "foo";

    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("filenotfound");
      expect(event.args[0]).to.equal(file);

      done();
    }));

    StringStream.createStream("No file matching '" + file + "' is loaded.\n").pipe(parser);
  });

  should("push not breakable event when line is not breakable", function(done) {
    var line = "23";

    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("notbreakable");
      expect(event.args[0]).to.equal(line);

      done();
    }));

    StringStream.createStream("Line " + line + " of 'test.pl' not breakable.\n").pipe(parser);
  });

  should("reset variables parser when setting mode to parse variables", function(done) {
    parser._variableParser.reset = function() {
      done();
    };

    parser.setMode(DebuggerParser.VARIABLE_PARSE_MODE);
  });

  should("pass event from variables parser through to listeners", function(done) {
    var variables = {
      name: "variables",
      args: []
    };

    parser.once("readable", eventReader(function(event) {
      expect(event).to.equal(variables);

      done();
    }));

    parser._variableParser.push(variables);
  });

  should("reset parser to scan mode when variables parser emits result", function(done) {
    parser.setMode(DebuggerParser.VARIABLE_PARSE_MODE);

    parser.once("readable", eventReader(function() {
      expect(parser.getMode()).to.equal(DebuggerParser.SCAN_MODE);

      done();
    }));

    parser._variableParser.push({
      name: "variables",
      args: []
    });
  });

  should("reset stacktrace parser when setting mode to parse stacktrace", function(done) {
    parser._stackTraceParser.reset = function() {
      done();
    };

    parser.setMode(DebuggerParser.STACK_TRACE_PARSE_MODE);
  });

  should("pass event from stacktrace parser through to listeners", function(done) {
    var stacktrace = {
      name: "stacktrace",
      args: []
    };

    parser.once("readable", eventReader(function(event) {
      expect(event).to.equal(stacktrace);

      done();
    }));

    parser._stackTraceParser.push(stacktrace);
  });

  should("reset parser to scan mode when stacktrace parser emits result", function(done) {
    parser.setMode(DebuggerParser.STACK_TRACE_PARSE_MODE);

    parser.once("readable", eventReader(function() {
      expect(parser.getMode()).to.equal(DebuggerParser.SCAN_MODE);

      done();
    }));

    parser._variableParser.push({
      name: "stacktrace",
      args: []
    });
  });
});