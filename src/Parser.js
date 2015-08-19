"use strict";

require("../src/metaclass");

var TransformStream = require("stream").Transform,
    util = require("util");

var merge = require("merge");

var Logger = require("./logger"),
    StreamEmitter = require("./StreamEmitter");

util.inherits(Parser, TransformStream);
StreamEmitter.mixin(Parser);

module.exports = Parser;

Parser.WHITESPACE = "whitespace";
Parser.PROMPT = "prompt";

/**
 * @typedef {Object} ParserConfiguration
 * @property {string|Writable} log - If a string, path to a log file, else a Writable stream.
 */
/**
 * Abstract Base class for Parsers.
 *
 * @param {ParserConfiguration} [config]
 * @constructor
 * @abstract
 */
function Parser(config) {
  TransformStream.call(this, { objectMode: true });

  this._variables = null;
  this._logger = Logger.initLogger(config);

  this.reset();
}

Parser.prototype.reset = function() {
  this._resetParser();
};

//noinspection JSUnusedGlobalSymbols
Parser.prototype._transform = function(chunk, encoding, done) {
  try {
    try {
      chunk.split("").forEach(this._character.bind(this));

      // flush through any remaining chars
      this._flush(function() {});
    }
    catch (err) {
      this._event("parsingerror", err);
    }
  }
  finally {
    done();
  }
};

//noinspection JSUnusedGlobalSymbols
Parser.prototype._flush = function(done) {
  try {
    while (this._next.length) {
      this._tokenise();
    }
  }
  catch (err) {
    this._event("parsingerror", err);
  }

  done();
};

Parser.prototype._character = function(char) {
  this._next.push(char);

  // this method is abstract.
  this._tokenise();
};

Parser.prototype._tokenise = function() {
  throw new Error("Not implemented");
};

Parser.prototype._newToken = function(tokenType) {
  this._tokenType = tokenType;
  this._tokenValue = this._next[0];
  this._consumeChar();
};

Parser.prototype._continueToken = function() {
  this._tokenValue += this._next[0];
  this._consumeChar();
};

/**
 * @ignore
 *
 * @param [properties] Optional properties to place into the token
 * @protected
 */
Parser.prototype._endToken = function(properties) {
  var token = merge(properties, {
    type: this._tokenType,
    value: this._tokenValue
  });

  this._resetToken();

  // this method is abstract
  this._parse(token);
};

Parser.prototype._resetToken = function() {
  this._tokenType = null;
  this._tokenValue = null;
};

Parser.prototype._continuePrompt = function() {
  if (this._next[0] === " ") {
    this._endToken();
    this._consumeChar();

    return;
  }

  this._continueToken();
};

Parser.prototype._consumeChar = function(numChars) {
  numChars = numChars || 1;

  while (numChars) {
    this._lastChar = this._next.shift();

    numChars--;
  }
};

//noinspection JSUnusedLocalSymbols
Parser.prototype._parser = function(token) { // jshint ignore:line
  throw new Error("Not implemented");
};

/**
 * @ignore
 *
 * @param pos From the bottom of the stack
 * @protected
 */
Parser.prototype._peekAtToken = function(pos) {
  pos = pos || 0;

  return this._parserStack[pos] || {
        type: null,
        value: null
      };
};

Parser.prototype._topToken = function() {
  return this._parserStack.top();
};

Parser.prototype._shiftToken = function() {
  return this._parserStack.shift();
};

Parser.prototype._pushToken = function(token) {
  this._parserStack.push(token);
};

Parser.prototype._resetParser = function() {
  this._next = [];
  this._tokenType = null;
  this._parserAllowedFollow = null;

  this._parserStack = [];

  // semantic info storage during a parse
  this._parserAux = {
    symbolStack: []
  };

  this._tokenValue = null;
  this._lastChar = null;
};