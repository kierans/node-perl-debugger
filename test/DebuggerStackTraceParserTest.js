/*jshint expr: true*/

"use strict";

var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var StringStream = require("./StringStream");

var DebuggerStackTraceParser = require("../src/DebuggerStackTraceParser");

describe("DebuggerStackTraceParser Tests", function() {
  var parser;

  beforeEach(function() {
    parser = new DebuggerStackTraceParser({
      log: process.stdout
    });
  });

  function eventReader(callback) {
    return function() {
      process.nextTick(function() {
        callback(parser.read());
      });
    };
  }

  should("parse stack trace", function(done) {
    var stacktrace = ". = Baz::baz() called from file 'Bar.pm' line 12\n. = Bar::bar() called from file 'Foo.pm' line 12\n. = Foo::foo() called from file 'main.pl' line 3",
        expected = [
          {
            sub: "Baz::baz()",
            location: null
          },
          {
            sub: "Bar::bar()",
            location: {
              file: "Bar.pm",
              line: "12"
            }
          },
          {
            sub: "Foo::foo()",
            location: {
              file: "Foo.pm",
              line: "12"
            }
          },
          {
            sub: null,
            location: {
              file: "main.pl",
              line: "3"
            }
          }
        ];

    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("stacktrace");
      expect(event.args[0][0], "Got no trace").to.not.be.undefined;

      var trace = event.args[0];
      expect(trace.length).to.equal(expected.length);

      for (var i = 0; i < expected.length; i++) {
        expect(trace[i].sub).to.equal(expected[i].sub);

        if (expected[i].location !== null) {
          expect(trace[i].location.file).to.equal(expected[i].location.file);
          expect(trace[i].location.line).to.equal(expected[i].location.line);
        }
        else {
          expect(trace[i].location).to.be.null;
        }
      }

      done();
    }));

    StringStream.createStream(stacktrace + "\n  DB<18> ").pipe(parser);
  });
});