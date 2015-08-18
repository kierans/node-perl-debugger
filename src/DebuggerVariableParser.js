"use strict";

var util = require("util");

var Logger = require("./logger"),
    Parser = require("./Parser"),
    StreamEmitter = require("./StreamEmitter");

util.inherits(DebuggerVariableParser, Parser);
StreamEmitter.mixin(DebuggerVariableParser);

module.exports = DebuggerVariableParser;

// tokens.
DebuggerVariableParser.ASSIGNMENT = "assignment";
DebuggerVariableParser.FAT_COMMA = "fat-comma";
DebuggerVariableParser.DEREFERENCE = "dereference";
DebuggerVariableParser.OPEN_BRACKET = "open-bracket";
DebuggerVariableParser.CLOSE_BRACKET = "close-bracket";

DebuggerVariableParser.IDENTIFIER = "identifier";
DebuggerVariableParser.STRING = "string";
DebuggerVariableParser.NUMBER = "number";
DebuggerVariableParser.SUB_REF = "sub-ref";
DebuggerVariableParser.ARRAY_REF = "array-ref";
DebuggerVariableParser.HASH_REF = "hash-ref";
DebuggerVariableParser.CODE_REF = "code-ref";
DebuggerVariableParser.EMPTY_NON_SCALAR = "empty-non-scalar";
DebuggerVariableParser.WHITESPACE = Parser.WHITESPACE;
DebuggerVariableParser.INDENT = "indent";
DebuggerVariableParser.PROMPT = Parser.PROMPT;

// virtual tokens.
DebuggerVariableParser.ARRAY = "array";
DebuggerVariableParser.ARRAY_ITEM = "array-item";
DebuggerVariableParser.ARRAY_INDEX = "array-index";
DebuggerVariableParser.ARRAY_RESULT = "array-result";
DebuggerVariableParser.HASH = "hash";
DebuggerVariableParser.HASH_PAIR = "hash-pair";
DebuggerVariableParser.HASH_RESULT = "hash-result";
DebuggerVariableParser.END = "end";

// Follow sets.
DebuggerVariableParser.REF = [ DebuggerVariableParser.ARRAY_REF, DebuggerVariableParser.HASH_REF, DebuggerVariableParser.CODE_REF ];
DebuggerVariableParser.START_NON_SCALAR = [ DebuggerVariableParser.OPEN_BRACKET ];
DebuggerVariableParser.END_NON_SCALAR = [ DebuggerVariableParser.CLOSE_BRACKET ];
DebuggerVariableParser.EXPRESSION = [ DebuggerVariableParser.STRING, DebuggerVariableParser.NUMBER ].concat(DebuggerVariableParser.REF)
    .concat(DebuggerVariableParser.START_NON_SCALAR);
DebuggerVariableParser.ARRAY_POS = [ DebuggerVariableParser.NUMBER ];
DebuggerVariableParser.KEY = [ DebuggerVariableParser.STRING, DebuggerVariableParser.NUMBER ];
DebuggerVariableParser.VALUE = [ DebuggerVariableParser.STRING, DebuggerVariableParser.NUMBER ].concat(DebuggerVariableParser.REF);
DebuggerVariableParser.NON_SCALAR_ITEM = DebuggerVariableParser.KEY_VALUE_PAIR = DebuggerVariableParser.ARRAY_ENTRY =
    [ DebuggerVariableParser.INDENT, DebuggerVariableParser.EMPTY_NON_SCALAR ];

DebuggerVariableParser.INDENT_LENGTH = 3;

/**
 * Parses the listing of variables from the Perl debugger.
 * <p>
 * This should not be used directly
 *
 * @param {ParserConfiguration} [config]
 * @constructor
 * @private
 */
function DebuggerVariableParser(config) {
  Parser.call(this);

  this._variables = null;
  this._logger = Logger.initLogger(config);

  this.reset();
}

DebuggerVariableParser.prototype.reset = function() {
  Parser.prototype.reset.call(this);

  this._variables = [];
};

DebuggerVariableParser.prototype._tokenise = function() {
  switch (this._tokenType) {
    case DebuggerVariableParser.IDENTIFIER:
      return this._continueIdentifier();

    case DebuggerVariableParser.STRING:
      return this._continueString();

    case DebuggerVariableParser.NUMBER:
      return this._continueNumber();

    case DebuggerVariableParser.WHITESPACE:
      return this._continueWhitespace();

    case DebuggerVariableParser.HASH_REF:
    case DebuggerVariableParser.ARRAY_REF:
    case DebuggerVariableParser.CODE_REF:
    case DebuggerVariableParser.SUB_REF:
      return this._continueReference();

    case DebuggerVariableParser.EMPTY_NON_SCALAR:
      return this._continueEmptyNonScalar();

    case DebuggerVariableParser.PROMPT:
      return this._continuePrompt();

    default:
      this._beginToken();
  }
};

DebuggerVariableParser.prototype._beginToken = function() {
  switch (this._next[0]) {
    case "$":
    case "@":
    case "%":
      return this._newToken(DebuggerVariableParser.IDENTIFIER);

    case "=":
      if (!this._matchAssignment()) {
        this._matchFatComma();
      }

      return;

    case "-":
      return this._matchDereference();

    case "'":
      return this._newToken(DebuggerVariableParser.STRING);

    case "(":
      return this._matchOpenBracket();

    case ")":
      return this._matchCloseBracket();

    case "&":
      return this._newToken(DebuggerVariableParser.SUB_REF);

    case " ":
      return this._newToken(DebuggerVariableParser.WHITESPACE);

    case "\n":
      // don't care.
      return this._consumeChar();

    case "e":
      return this._newToken(DebuggerVariableParser.EMPTY_NON_SCALAR);

    case "A":
      return this._newToken(DebuggerVariableParser.ARRAY_REF);

    case "H":
      return this._newToken(DebuggerVariableParser.HASH_REF);

    case "C":
      return this._newToken(DebuggerVariableParser.CODE_REF);

    case "D":
      return this._newToken(DebuggerVariableParser.PROMPT);

    case "0":
    case "1":
    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      return this._newToken(DebuggerVariableParser.NUMBER);

    default:
      // we don't know what we're dealing with.
      throw new Error("Don't know what token is being recognised '" + this._next[0] + "'");
  }
};

DebuggerVariableParser.prototype._continueIdentifier = function() {
  if (this._next[0] === " ") {
    return this._matchIdentifier();
  }

  this._continueToken();
};

DebuggerVariableParser.prototype._matchIdentifier = function() {
  var symbol = this._tokenValue.substring(0, 1);

  switch (symbol) {
    case "$":
      symbol = "scalar";
      break;

    case "@":
      symbol = "array";
      break;

    case "%":
      symbol = "hash";
      break;
  }

  this._endToken({
    vartype: symbol
  });

  this._consumeChar();
};

DebuggerVariableParser.prototype._continueString = function() {
  if (this._next[0] === "'" && this._lastChar !== "\\") {
    this._continueToken();
    this._endToken();

    return;
  }

  this._continueToken();
};

DebuggerVariableParser.prototype._continueNumber = function() {
  if (/\d|\./.test(this._next[0])) {
    this._continueToken();

    return;
  }

  this._endToken();

  // we may have started another token
  this._tokenise();
};

DebuggerVariableParser.prototype._continueWhitespace = function() {
  if (this._next[0] !== " ") {
    var valueLength = this._tokenValue.length;

    if (valueLength >= DebuggerVariableParser.INDENT_LENGTH) {
      // normalise the indent
      valueLength -= valueLength % DebuggerVariableParser.INDENT_LENGTH;

      this._tokenType = DebuggerVariableParser.INDENT;
      this._endToken({
        length: valueLength
      });

      /*
       * Don't consume as we may have started another token.
       */
    }
    else {
      /*
       * We're not getting anymore whitespace, so toss what we've got.
       */
      this._resetToken();
    }

    this._tokenise();
  }
  else {
    this._continueToken();
  }
};

DebuggerVariableParser.prototype._continueReference = function() {
  if (this._next[0] !== "\n") {
    return this._continueToken();
  }

  return this._endToken();
};

DebuggerVariableParser.prototype._continueEmptyNonScalar = function() {
  if (this._next[0] === "\n") {
    this._endToken();
    return this._consumeChar();
  }

  return this._continueToken();
};

DebuggerVariableParser.prototype._matchAssignment = function() {
  if (this._next[1] && this._next[1] !== ">") {
    this._newToken(DebuggerVariableParser.ASSIGNMENT);
    this._endToken();

    return true;
  }

  return false;
};

/**
 * @ignore
 *
 * @see https://en.wikipedia.org/wiki/Fat_comma
 * @private
 */
DebuggerVariableParser.prototype._matchFatComma = function() {
  if (this._next[1] && this._next[1] === ">") {
    this._newToken(DebuggerVariableParser.FAT_COMMA);
    this._continueToken();
    this._endToken();
  }
};

DebuggerVariableParser.prototype._matchDereference = function() {
  if (this._next[1] && this._next[1] === ">") {
    this._newToken(DebuggerVariableParser.DEREFERENCE);
    this._continueToken();
    this._endToken();

    return true;
  }

  return false;
};

DebuggerVariableParser.prototype._matchOpenBracket = function() {
  this._newToken(DebuggerVariableParser.OPEN_BRACKET);
  this._endToken();
};

DebuggerVariableParser.prototype._matchCloseBracket = function() {
  this._newToken(DebuggerVariableParser.CLOSE_BRACKET);
  this._endToken();
};

DebuggerVariableParser.prototype._parse = function(token) {
  this._logger("Follow rules: " + stringify(this._parserAllowedFollow));
  this._logger("Parsing: " + stringify(token));

  if (!this._startRule(token)) {
    if (!this._followRules(token)) {
      throw new Error("Don't know what to do with '" + token.type + "'");
    }
  }
};

DebuggerVariableParser.prototype._startRule = function(token) {
  if (!this._parserAllowedFollow) {
    if (token.type === DebuggerVariableParser.IDENTIFIER) {
      return this._pushIdentifier(token);
    }

    if (token.type === DebuggerVariableParser.PROMPT) {
      // we've finished parsing variables
      this._event("variables", this._variables);
      this._event("prompt");

      return true;
    }

    throw new Error("Illegal START token: " + token.type);
  }
  else {
    if (token.type === DebuggerVariableParser.IDENTIFIER || token.type === DebuggerVariableParser.PROMPT) {
      /*
       * Unfortunately for anonymous/referenced non scalars we may not know we've finished the
       * data structure until we hit another start token.
       */
      this._reduceTokens();
      this._parse(token);

      return true;
    }
  }

  return false;
};

DebuggerVariableParser.prototype._followRules = function(token) {
  for (var i = 0; i < this._parserAllowedFollow.length; i++) {
    var type = this._parserAllowedFollow[i];

    if (type === token.type) {
      switch (type) {
        case DebuggerVariableParser.ASSIGNMENT:
          return this._pushAssignment(token);

        case DebuggerVariableParser.FAT_COMMA:
          return this._pushFatComma(token);

        case DebuggerVariableParser.DEREFERENCE:
          return this._pushDereference(token);

        case DebuggerVariableParser.STRING:
        case DebuggerVariableParser.NUMBER:
          return this._pushScalar(token);

        case DebuggerVariableParser.OPEN_BRACKET:
          return this._pushNonScalar(token);

        case DebuggerVariableParser.CLOSE_BRACKET:
          this._reduceNonRef();
          return true;

        case DebuggerVariableParser.HASH_REF:
          return this._pushHashRef(token);

        case DebuggerVariableParser.ARRAY_REF:
          return this._pushArrayRef(token);

        case DebuggerVariableParser.CODE_REF:
          return this._pushCodeRef(token);

        case DebuggerVariableParser.SUB_REF:
          return this._pushSubRef(token);

        case DebuggerVariableParser.INDENT:
          return this._pushIndent(token);

        case DebuggerVariableParser.EMPTY_NON_SCALAR:
          return this._pushEmptyNonScalar(token);
      }
    }
  }

  return false;
};

DebuggerVariableParser.prototype._pushIdentifier = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = [ DebuggerVariableParser.ASSIGNMENT ];

  return true;
};

DebuggerVariableParser.prototype._pushAssignment = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = DebuggerVariableParser.EXPRESSION;

  return true;
};

DebuggerVariableParser.prototype._pushFatComma = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = DebuggerVariableParser.VALUE;

  return true;
};

DebuggerVariableParser.prototype._pushDereference = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = [ DebuggerVariableParser.SUB_REF ];

  return true;
};

DebuggerVariableParser.prototype._pushScalar = function(token) {
  var top = this._topToken();

  switch (top.type) {
    case DebuggerVariableParser.ASSIGNMENT:
      this._pushToken(token);
      return true;

    case DebuggerVariableParser.ARRAY_ITEM:
      return this._pushArrayOperator(token);

    case DebuggerVariableParser.ARRAY_INDEX:
      return this._pushValue(token);

    case DebuggerVariableParser.FAT_COMMA:
      return this._pushValue(token);

    case DebuggerVariableParser.HASH_PAIR:
      return this._pushKey(token);
  }

  return false;
};

DebuggerVariableParser.prototype._pushArrayRef = function(token) {
  this._pushToken(token);
  this._pushRef(token);
  this._parserAllowedFollow = DebuggerVariableParser.ARRAY_ENTRY.concat(DebuggerVariableParser.PROMPT);

  return true;
};

DebuggerVariableParser.prototype._pushHashRef = function(token) {
  this._pushToken(token);
  this._pushRef(token);
  this._parserAllowedFollow = DebuggerVariableParser.KEY_VALUE_PAIR.concat(DebuggerVariableParser.PROMPT);

  return true;
};

DebuggerVariableParser.prototype._pushCodeRef = function(token) {
  this._pushToken(token);
  this._pushRef(token);
  this._parserAllowedFollow = DebuggerVariableParser.NON_SCALAR_ITEM;

  return true;
};

DebuggerVariableParser.prototype._pushSubRef = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = DebuggerVariableParser.NON_SCALAR_ITEM.concat(DebuggerVariableParser.END_NON_SCALAR);

  return true;
};

DebuggerVariableParser.prototype._pushRef = function(token) {
  this._parserAux.symbolStack.push(token);
};

DebuggerVariableParser.prototype._pushNonScalar = function(token) {
  // what data structure are we starting?
  var id = this._findLatestIdentifier();

  switch (id.vartype) {
    case "array":
      return this._pushArray(token);

    case "hash":
      return this._pushHash(token);
  }

  return false;
};

DebuggerVariableParser.prototype._pushIndent = function(token) {
  var currentIndent = this._parserAux.indent,
      i;

  if (currentIndent) {
    // are we increasing or decreasing the indentation length?
    if (token.length < currentIndent.length) {
      // we've finished an array or hash
      for (i = token.length; i < currentIndent.length; i += DebuggerVariableParser.INDENT_LENGTH) {
        this._pushToken({
          type: DebuggerVariableParser.END
        });

        this._parserAux.symbolStack.pop();
      }
    }
  }

  this._parserAux.indent = token;

  // what type of non scalar, non ended variable are we in?
  var tok = this._parserAux.symbolStack.top();
  switch (tok.type) {
    case DebuggerVariableParser.ARRAY:
    case DebuggerVariableParser.ARRAY_REF:
      return this._pushArrayItem(token);

    case DebuggerVariableParser.HASH:
    case DebuggerVariableParser.HASH_REF:
      return this._pushKeyValuePair(token);

    case DebuggerVariableParser.CODE_REF:
      this._parserAllowedFollow = [ DebuggerVariableParser.DEREFERENCE ];
      return true;
  }

  return false;
};

DebuggerVariableParser.prototype._pushEmptyNonScalar = function() {
  // what type of non scalar variable are we in?
  for (var i = this._parserStack.length - 1; i >=0; i--) {
    var tok = this._parserStack[i];

    switch (tok.type) {
      case DebuggerVariableParser.ARRAY:
      case DebuggerVariableParser.HASH:
        this._parserAllowedFollow = DebuggerVariableParser.END_NON_SCALAR;
        return true;

      case DebuggerVariableParser.ARRAY_REF:
      case DebuggerVariableParser.HASH_REF:
        this._parserAllowedFollow = [ DebuggerVariableParser.INDENT ];
        return true;
    }
  }

  return false;
};

DebuggerVariableParser.prototype._pushArray = function(token) {
  var virtToken = {
    type: DebuggerVariableParser.ARRAY,
    value: token
  };

  this._pushToken(virtToken);
  this._parserAux.symbolStack.push(virtToken);

  this._parserAllowedFollow = DebuggerVariableParser.ARRAY_ENTRY;

  return true;
};

/**
 * @ignore
 *
 * This fakes an operator for when the array is reduced.
 * @private
 */
DebuggerVariableParser.prototype._pushArrayOperator = function(token) {
  this._pushToken({
    type: DebuggerVariableParser.ARRAY_INDEX,
    value: token
  });

  this._parserAllowedFollow = DebuggerVariableParser.VALUE;

  return true;
};

DebuggerVariableParser.prototype._pushArrayItem = function(token) {
  this._pushToken({
    type: DebuggerVariableParser.ARRAY_ITEM,
    value: token
  });

  this._parserAllowedFollow = DebuggerVariableParser.ARRAY_POS.concat(DebuggerVariableParser.EMPTY_NON_SCALAR);

  return true;
};

DebuggerVariableParser.prototype._pushHash = function(token) {
  var virtToken = {
    type: DebuggerVariableParser.HASH,
    value: token
  };

  this._pushToken(virtToken);
  this._parserAux.symbolStack.push(virtToken);

  this._parserAllowedFollow = DebuggerVariableParser.KEY_VALUE_PAIR;

  return true;
};

DebuggerVariableParser.prototype._pushKeyValuePair = function(token) {
  this._pushToken({
    type: DebuggerVariableParser.HASH_PAIR,
    value: token
  });

  this._parserAllowedFollow = DebuggerVariableParser.KEY.concat(DebuggerVariableParser.EMPTY_NON_SCALAR);

  return true;
};

DebuggerVariableParser.prototype._pushKey = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = [ DebuggerVariableParser.FAT_COMMA ];

  return true;
};

DebuggerVariableParser.prototype._pushValue = function(token) {
  this._pushToken(token);
  this._parserAllowedFollow = DebuggerVariableParser.NON_SCALAR_ITEM.concat(DebuggerVariableParser.END_NON_SCALAR);

  return true;
};

DebuggerVariableParser.prototype._reduceNonRef = function() {
  this._reduceTokens();
  this._parserAux.symbolStack.pop();
};

DebuggerVariableParser.prototype._reduceTokens = function() {
  this._logger("Reducing tokens" + stringify(this._parserStack.map(function(token) {
        return token.type;
      })));

  this._variables.push(this._reduce());

  if (this._parserStack.length > 0) {
    // we didn't reduce all the tokens, so we're stuffed.
    throw Error("Reduction failed to reduce all tokens");
  }

  this._parserAllowedFollow = null;
  this._parserAux.indent = null;
};

DebuggerVariableParser.prototype._reduce = function() {
  var lhs, op, rhs,
      items = [];

  var token, next;

  do {
    token = this._shiftToken();

    if (token) {
      switch (token.type) {
        case DebuggerVariableParser.END:
          // we're done with this data structure.
          return items;

        case DebuggerVariableParser.IDENTIFIER:
          lhs = token;
          break;

        case DebuggerVariableParser.ASSIGNMENT:
        case DebuggerVariableParser.FAT_COMMA:
          op = token.type;
          break;

        case DebuggerVariableParser.DEREFERENCE:
          // do nothing
          break;

        case DebuggerVariableParser.STRING:
        case DebuggerVariableParser.NUMBER:
          if (!lhs) {
            lhs = token;
          }
          else {
            rhs = token;
          }

          break;

        case DebuggerVariableParser.ARRAY:
        case DebuggerVariableParser.ARRAY_REF:
        case DebuggerVariableParser.HASH:
        case DebuggerVariableParser.HASH_REF:
        case DebuggerVariableParser.CODE_REF:
          rhs = token;
          next = this._peekAtToken();

          switch (next.type) {
            case DebuggerVariableParser.ARRAY_ITEM:
            case DebuggerVariableParser.HASH_PAIR:
            case DebuggerVariableParser.DEREFERENCE:
              rhs.value = this._reduce();
              break;

            default:
              rhs.value = [];
          }

          break;

        case DebuggerVariableParser.ARRAY_INDEX:
          op = token.type;
          break;

        case DebuggerVariableParser.ARRAY_ITEM:
          next = this._peekAtToken();

          if (DebuggerVariableParser.ARRAY_INDEX === next.type) {
            // dummy assignment
            lhs = token;
          }

          /*
           * Else we have an empty array.
           * This empty array can "end" either when there are no more tokens, in which case the default
           * return value of this function is an empty array.  Or there will be an "end" token which will return
           * an empty array for us.
           */
          break;

        case DebuggerVariableParser.HASH_PAIR:
          next = this._peekAtToken();

          if (DebuggerVariableParser.KEY.indexOf(next.type) !== -1) {
            items.push(this._reduce());
          }

          /*
           * Else we have no pairs (and an empty hash).
           * See ARRAY_ITEM as to why we don't return here.
           */
          break;

        case DebuggerVariableParser.SUB_REF:
          items.push(token);
      }

      if (lhs && rhs) {
        try {
          switch (op) {
            case DebuggerVariableParser.ASSIGNMENT:
              return {
                name: lhs.value,
                type: rhs.type,
                value: rhs.value
              };

            case DebuggerVariableParser.FAT_COMMA:
              return {
                key: lhs,
                value: rhs
              };

            case DebuggerVariableParser.ARRAY_INDEX:
            case DebuggerVariableParser.DEREFERENCE:
              items.push(rhs);

              break;
          }
        }
        finally {
          lhs = null;
          rhs = null;
          op = null;
        }
      }
    }
  }
  while(token);

  // we've got no more tokens
  if (lhs || op || rhs) {
    // we haven't reduced successfully
    throw Error("Can't reduce expression due to no more tokens");
  }

  // return what we've got.
  return items;
};

DebuggerVariableParser.prototype._findLatestIdentifier = function() {
  for (var i = this._parserStack.length - 1; i >= 0; i--) {
    var token = this._parserStack[i];

    if (token.type === DebuggerVariableParser.IDENTIFIER) {
      return token;
    }
  }

  throw Error("No IDENTIFIER in parser stack");
};

function stringify(token) {
  return JSON.stringify(token, null, 2);
}