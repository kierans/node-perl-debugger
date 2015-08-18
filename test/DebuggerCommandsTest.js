/*jshint expr: true*/

"use strict";

//noinspection JSUnresolvedVariable
var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var StringBuffer = require("./StringBuffer");

var DebuggerCommands = require("../src/DebuggerCommands");

describe("DebuggerCommands Tests", function() {
  var client,
      commands;

  // fakes a prompt from the perl debugger.
  function emitPrompt() {
    commands._parser.push({ name: "prompt" });
  }

  beforeEach(function(done) {
    client = new StringBuffer();
    commands = new DebuggerCommands(client);

    commands.on("ready", done);

    emitPrompt();
  });

  function checkBuffer(expected, done) {
    process.nextTick(function() {
      expect(client.getData()).to.equal(expected);

      done();
    });
  }

  should("throw error is no stream piped before commands issued", function() {
    commands = new DebuggerCommands();

    expect(function() {
      commands.continue();
    }).to.throw(Error);
  });

  should("emit break event when parser does", function(done) {
    var filename = "foo.pl",
        line = 342;

    commands.on("break", function(f, l) {
      expect(f).to.equal(filename);
      expect(l).to.equal(line);

      done();
    });

    commands._parser.push({ name: "break", args: [ filename, line ] });
  });

  should("swallow break when debugger loaded for first time", function(done) {
    commands = new DebuggerCommands(client);

    commands.on("break", function() {
      done(new Error("Break event emitted"));
    });

    commands.on("prompt", done);

    commands._parser.push({ name: "break", args: [ "foo.pl", 123 ] });
    process.nextTick(emitPrompt);
  });

  should("issue step into command", function(done) {
    commands.stepInto();

    checkBuffer("s\n", done);
  });

  should("issue step over command", function(done) {
    commands.stepOver();

    checkBuffer("n\n", done);
  });

  should("issue step out command", function(done) {
    commands.stepOut();

    checkBuffer("r\n", done);
  });

  should("issue continue command", function(done) {
    commands.continue();

    checkBuffer("c\n", done);
  });

  should("continue to position", function(done) {
    var filename = "foo.txt",
        line = 231;

    client.on("write", function() {
      commands._parser.push({ name: "break", args: [ "foo.txt", "231" ]});
      emitPrompt();
    });

    commands.continue(filename, line)
        .then(function() {
          checkBuffer("f " + filename + "\nc " + line + "\n", done);
        });
  });

  should("issue quit command", function(done) {
    commands.quit();

    checkBuffer("q\n", done);
  });

  should("issue break command", function(done) {
    var filename = "foo.txt",
        line = 231;

    client.on("write", function() {
      emitPrompt();
    });

    commands.break(filename, line)
      .then(function() {
        checkBuffer("f " + filename + "\nb " + line + "\n", done);
      });
  });

  should("return file not found when file not in perl path", function(done) {
    var event = "filenotfound",
        filename = "foo";

    client.on("write", function() {
      commands._parser.push({ name: event, args: [ filename ] });
    });

    commands.break(filename, 1)
        .catch(function(err) {
          expect(err.name).to.equal(event);
          expect(err.args[0]).to.equal(filename);

          done();
        });
  });

  should("return not breakable when line is not breakable", function(done) {
    var event = "notbreakable",
        line = 123;

    client.on("write", function() {
      commands._parser.push({ name: event, args: [ line ] });
    });

    commands.break("foo.pl", line)
        .catch(function(err) {
          expect(err.name).to.equal(event);
          expect(err.args[0]).to.equal(line);

          done();
        });
  });

  should("remove break command", function(done) {
    var filename = "foo.txt",
        line = 231;

    client.on("write", function() {
      emitPrompt();
    });

    commands.removeBreak(filename, line)
        .then(function() {
          checkBuffer("f " + filename + "\nB " + line + "\n", done);
        });
  });

  should("instruct perl interpreter to exit when perl program ends", function(done) {
    commands._parser.push({ name: "terminated" });

    checkBuffer("q\n", done);
  });

  should("emit terminated event when perl program ends", function(done) {
    commands.on("terminated", done);

    commands._parser.push({ name: "terminated" });
  });
});