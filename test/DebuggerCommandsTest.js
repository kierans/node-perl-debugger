/*jshint expr: true*/

"use strict";

//noinspection JSUnresolvedVariable
var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var clone = require("clone");

var StringBuffer = require("./StringBuffer");

var DebuggerCommands = require("../src/DebuggerCommands"),
    DebuggerParser = require("../src/DebuggerParser");

describe("DebuggerCommands Tests", function() {
  var client,
      commands;

  function emit(event) {
    commands._parser.push(event);
  }

  function emitBreak(file, line) {
    file = file || "foo.txt";
    line = line || "231";

    emit({ name: "break", args: [ file, line ] });
  }

  // fakes a prompt from the perl debugger.
  function emitPrompt() {
    emit({ name: "prompt" });
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

    emitBreak(filename, line);
  });

  should("swallow break when debugger loaded for first time", function(done) {
    commands = new DebuggerCommands(client);

    commands.on("break", function() {
      done(new Error("Break event emitted"));
    });

    commands.on("prompt", done);

    emitBreak();
    process.nextTick(emitPrompt);
  });

  should("issue variables command", function(done) {
    commands.variables();

    checkBuffer("y\n", done);
  });

  should("set debugger parser into variables mode when issuing variables command", function() {
    commands.variables();

    expect(commands._parser.getMode()).to.equal(DebuggerParser.VARIABLE_PARSE_MODE);
  });

  should("return no variables when parser issues prompt event", function(done) {
    var variables = commands.variables();

    variables
      .then(function(vars) {
        expect(vars.length).to.equal(0);
      })
      .then(done)
      .catch(done);

    emitPrompt();
  });

  should("return variables when parser issues variables event", function(done) {
    var variables = commands.variables(),
        expected = [
          {
            name: "$scalar",
            type: "string",
            value: "Hello World"
          }
        ];

    variables
      .then(function(vars) {
        expect(vars.length).to.equal(1);
        expect(vars[0]).to.equal(expected[0]);
      })
      .then(done)
      .catch(done);

    emit({ name: "variables", args: [ expected ] });
    emitPrompt();
  });

  should("return no variables when parser issues parsing error", function(done) {
    var variables = commands.variables();

    variables
      .then(function() {
        done(new Error("Promise resolved"));
      })
      .catch(function(err) {
        expect(err).to.not.be.undefined;
        done();
      });

    emit({ name: "parsingerror", args: [ new Error() ]});
    emitPrompt();
  });

  should("issue stack trace command", function(done) {
    commands.stacktrace();

    checkBuffer("T\n", done);
  });

  should("set debugger parser into stacktrace mode when issuing stacktrace command", function() {
    commands.stacktrace();

    expect(commands._parser.getMode()).to.equal(DebuggerParser.STACK_TRACE_PARSE_MODE);
  });

  should("return trace when parser issues stacktrace event", function(done) {
    var stacktrace = commands.stacktrace(),
        file = "Bar.pm",
        line = "12",
        expected = [
          {
            sub: "Baz::baz()",
            location: {
              file: file,
              line: line
            }
          },
          {
            sub: "Bar::bar()",
            location: {
              file: "Bar.pm",
              line: "12"
            }
          }
        ];

    stacktrace
        .then(function(trace) {
          assertTraceCorrect(expected, trace);
        })
        .then(done)
        .catch(done);

    /*
     * The actual event emitted from the parser doesn't have the current location that the program
     * has paused at (ie: a breakpoint).  This is due to how the debugger outputs it's stack trace.
     * Consequently the commands will have to augment the result from the parser, and we should test
     * for that.
     */
    var event = clone(expected);
    event[0].location = null;

    commands._listenForBreak();
    emitBreak(file, line);
    emit({ name: "stacktrace", args: [ event ] });
    emitPrompt();
  });

  should("return current location when no trace available from parser", function(done) {
    var stacktrace = commands.stacktrace(),
        file = "main.pl",
        line = "3",
        expected = [
          {
            sub: null,
            location: {
              file: file,
              line: line
            }
          }
        ];

    stacktrace
        .then(function(trace) {
          assertTraceCorrect(expected, trace);
        })
        .then(done)
        .catch(done);

    commands._listenForBreak();
    emitBreak(file, line);
    emitPrompt();
  });

  should("return no stacktrace when parser issues parsing error", function(done) {
    var variables = commands.variables();

    variables
        .then(function() {
          done(new Error("Promise resolved"));
        })
        .catch(function(err) {
          expect(err).to.not.be.undefined;
          done();
        });

    emit({ name: "parsingerror", args: [ new Error() ]});
    emitPrompt();
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
      emitBreak();
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
      emit({ name: event, args: [ filename ] });
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
      emit({ name: event, args: [ line ] });
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
    emit({ name: "terminated" });

    checkBuffer("q\n", done);
  });

  should("emit terminated event when perl program ends", function(done) {
    commands.on("terminated", done);

    emit({ name: "terminated" });
  });

  function assertTraceCorrect(expected, actual) {
    expect(actual.length).to.equal(expected.length);

    for(var i = 0; i < expected.length; i++) {
      var e = expected[i],
          a = actual[i];

      expect(a.sub).to.equal(e.sub);

      expect(a.location).to.not.be.undefined;

      if (e.location === null) {
        expect(a.location).to.be.null;
      }
      else {
        expect(a.location.file).to.equal(e.location.file);
        expect(a.location.line).to.equal(e.location.line);
      }
    }
  }
});