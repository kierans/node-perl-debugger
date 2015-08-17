"use strict";

var TransformStream = require("stream").Transform,
    util = require("util");

var DebuggerVariableParser = require("./DebuggerVariableParser"),
    Logger = require("./logger"),
    StreamEmitter = require("./StreamEmitter");

util.inherits(DebuggerParser, TransformStream);
StreamEmitter.mixin(DebuggerParser);

module.exports = DebuggerParser;

DebuggerParser.SCAN_MODE = "scan";
DebuggerParser.PARSE_MODE = "parse";

/**
 * @typedef {Object} DebuggerParserConfiguration
 * @property {string|Writable} log - If a string, path to a log file, else a Writable stream.
 */
/**
 * Parses text from the Perl debugger into events.
 * <p>
 * This should not be used directly
 *
 * @param {DebuggerParserConfiguration} [config]
 * @constructor
 */
function DebuggerParser(config) {
  TransformStream.call(this, { objectMode: true });

  this._mode = DebuggerParser.SCAN_MODE;
  /** @type {DebuggerVariableParser} */
  this._variableParser = new DebuggerVariableParser(config);
  this._variableParser.on("readable", this._eventProxy(this._variableParser));

  this._logger = Logger.initLogger(config);
}

//noinspection JSUnusedGlobalSymbols
DebuggerParser.prototype._transform = function(chunk, encoding, done) {
  if (/^[$@%]/.test(chunk) || this._mode === DebuggerParser.PARSE_MODE) {
    // we're parsing variables
    if (this._mode !== DebuggerParser.PARSE_MODE) {
      this._logger("Beginning parse");
      this._variableParser.reset();
    }

    this._mode = DebuggerParser.PARSE_MODE;
    this._variableParser.write(chunk, encoding);

    done();

    return;
  }

  chunk.split("\n").forEach(this._scan.bind(this));
  done();
};

//noinspection JSUnusedGlobalSymbols
DebuggerParser.prototype._flush = function(done) {
  if (this._mode === DebuggerParser.PARSE_MODE) {
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
    this.push(readable.read());
  }.bind(this);
};