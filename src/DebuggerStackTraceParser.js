"use strict";

var util = require("util");

var Parser = require("./Parser");

util.inherits(DebuggerStackTraceParser, Parser);

module.exports = DebuggerStackTraceParser;

DebuggerStackTraceParser.WHITESPACE = Parser.WHITESPACE;
DebuggerStackTraceParser.LINE = "line";
DebuggerStackTraceParser.PROMPT = Parser.PROMPT;

/**
 * Parses a stack trace from the Perl debugger
 *
 * @constructor
 * @private
 */
function DebuggerStackTraceParser() {
  Parser.call(this);

  this.reset();
}

DebuggerStackTraceParser.prototype.reset = function() {
  Parser.prototype.reset.call(this);

  this._trace = [];
  this._traceElement = {
    location: null
  };
};

DebuggerStackTraceParser.prototype._tokenise = function() {
  switch(this._tokenType) {
    case DebuggerStackTraceParser.WHITESPACE:
      return this._continueWhitespace();

    case DebuggerStackTraceParser.LINE:
      return this._continueLine();

    case DebuggerStackTraceParser.PROMPT:
      return this._continuePrompt();

    default:
      return this._beginToken();
  }
};

DebuggerStackTraceParser.prototype._beginToken = function() {
  switch (this._next[0]) {
    case " ":
      return this._newToken(DebuggerStackTraceParser.WHITESPACE);

    case "D":
      return this._newToken(DebuggerStackTraceParser.PROMPT);

    default:
      this._newToken(DebuggerStackTraceParser.LINE);
  }
};

DebuggerStackTraceParser.prototype._continueWhitespace = function() {
  if (this._next[0] !== " ") {
    this._endToken();

    // don't consume as we're starting another token
    return;
  }

  this._continueToken();
};

DebuggerStackTraceParser.prototype._continueLine = function() {
  if (this._next[0] === "\n") {
    this._endToken();
    this._consumeChar();

    return;
  }

  this._continueToken();
};

DebuggerStackTraceParser.prototype._parse = function(token) {
  switch (token.type) {
    case DebuggerStackTraceParser.WHITESPACE:
      // don't care
      return;

    case DebuggerStackTraceParser.PROMPT:
      // add the last location which is the entry point to the Perl program
      this._pushStackTraceElement(null, this._traceElement.location);

      this._event("stacktrace", this._trace);
      this._event("prompt");

      return;

    case DebuggerStackTraceParser.LINE:
      var matches = /^.*? = (.*?\(.*?\)) called from file '(.+?)' line (\d+).*$/.exec(token.value);
      if (matches && matches.length > 0) {
        this._pushStackTraceElement(matches[1], this._traceElement.location);

        this._traceElement.lastsub = matches[1];
        this._traceElement.location = {
          file: matches[2],
          line: matches[3]
        };
      }
  }
};

DebuggerStackTraceParser.prototype._pushStackTraceElement = function(sub, location) {
  this._trace.push({
    sub: sub,
    location: location
  });
};