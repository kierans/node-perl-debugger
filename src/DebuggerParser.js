"use strict";

var TransformStream = require("stream").Transform,
    util = require("util");

var DebuggerVariableParser = require("./DebuggerVariableParser"),
    DebuggerStackTraceParser = require("./DebuggerStackTraceParser"),
    Logger = require("./logger"),
    StreamEmitter = require("./StreamEmitter");

util.inherits(DebuggerParser, TransformStream);
StreamEmitter.mixin(DebuggerParser);

module.exports = DebuggerParser;

DebuggerParser.SCAN_MODE = "scan";
DebuggerParser.VARIABLE_PARSE_MODE = "variable-parse";
DebuggerParser.STACK_TRACE_PARSE_MODE = "stacktrace-parse";

/**
 * Parses text from the Perl debugger into events.
 *
 * @param {ParserConfiguration} [config]
 * @constructor
 * @private
 */
function DebuggerParser(config) {
  TransformStream.call(this, { objectMode: true });

  this._mode = DebuggerParser.SCAN_MODE;
  this._logger = Logger.initLogger(config);

  /** @type {DebuggerVariableParser} */
  this._variableParser = new DebuggerVariableParser(config);
  this._variableParser.on("readable", this._eventProxy(this._variableParser));

  /** @type {DebuggerStackTraceParser} */
  this._stackTraceParser = new DebuggerStackTraceParser(config);
  this._stackTraceParser.on("readable", this._eventProxy(this._stackTraceParser));
}

DebuggerParser.prototype.getMode = function() {
  return this._mode;
};

DebuggerParser.prototype.setMode = function(mode) {
  this._mode = mode;

  if (this._mode === DebuggerParser.VARIABLE_PARSE_MODE) {
    this._logger("Beginning variable parse");
    this._variableParser.reset();
  }

  if (this._mode === DebuggerParser.STACK_TRACE_PARSE_MODE) {
    this._logger("Beginning stacktrace parse");
    this._stackTraceParser.reset();
  }
};

//noinspection JSUnusedGlobalSymbols
DebuggerParser.prototype._transform = function(chunk, encoding, done) {
  switch (this._mode) {
    case DebuggerParser.VARIABLE_PARSE_MODE:
      this._variableParser.write(chunk, encoding);
        break;

    case DebuggerParser.STACK_TRACE_PARSE_MODE:
      this._stackTraceParser.write(chunk, encoding);
      break;

    default:
      chunk.split("\n").forEach(this._scan.bind(this));
  }

  done();
};

//noinspection JSUnusedGlobalSymbols
DebuggerParser.prototype._flush = function(done) {
  if (this._mode === DebuggerParser.VARIABLE_PARSE_MODE) {
    this._variableParser.end();
  }

  done();
};

DebuggerParser.prototype._scan = function(line) {
  var matches;

  matches = /^.*::.*\((.*):(\d+)\):/.exec(line);
  if (matches && matches.length > 0) {
    return this._event("break", matches[1], matches[2]);
  }

  matches = /\s*DB<(\d+)>\s*$/.exec(line);
  if (matches && matches.length > 0) {
    return this._event("prompt", matches[1]);
  }

  if (/Debugged program terminated/.test(line)) {
    return this._event("terminated");
  }

  matches = /No file matching '(.*)' is loaded/.exec(line);
  if (matches && matches.length > 0) {
    return this._event("filenotfound", matches[1]);
  }

  matches = /Line (\d+) of '.*' not breakable/.exec(line);
  if (matches && matches.length > 0) {
    return this._event("notbreakable", matches[1]);
  }
};

DebuggerParser.prototype._eventProxy = function(readable) {
  return function() {
    this._mode = DebuggerParser.SCAN_MODE;
    this.push(readable.read());
  }.bind(this);
};