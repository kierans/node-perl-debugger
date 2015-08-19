/*jshint expr: true*/

"use strict";

require("../src/metaclass");

var chai = require("chai"),
    expect = chai.expect,
    should = require("mocha-should");

var StringStream = require("./StringStream"),
    assertions = require("./assertions");

var DebuggerVariableParser = require("../src/DebuggerVariableParser");

describe("DebuggerVariablesParser Tests", function() {
  var parser;

  beforeEach(function() {
    parser = new DebuggerVariableParser({
      log: process.stdout
    });
  });

  function eventReader(callback) {
    return function() {
      process.nextTick(function() {
        eventDelegate(parser.read(), callback);
      });
    };
  }

  function eventDelegate(event, callback) {
    if (event.name === "parsingerror") {
      throw event.args[0];
    }

    callback(event);
  }

  should("parse string assignment", function(done) {
    var varName = "$scalar",
        varValue = "'Hello World'",
        expected = {
          name: varName,
          type: "string",
          value: varValue
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.name).to.equal("variables");
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse string assignment with escaped quote", function(done) {
    var varName = "$scalar",
        varValue = "'It\\'s a rainy day today.'";

    parser.once("readable", eventReader(function(event) {
      var variable = event.args[0][0];
      expect(variable.value).to.equal(varValue);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse numerical assignment", function(done) {
    var varName = "$scalar",
        varValue = "1.3141",
        expected = {
          name: varName,
          type: "number",
          value: varValue
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse empty hash assignment", function(done) {
    var varName = "%hash",
        varValue = "(\n     empty hash\n)",
        expected = {
          name: varName,
          type: "hash",
          value: []
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse hash assignment", function(done) {
    var varName = "%hash",
        varValue = "(\n   1 => 'b'\n   'c' => 255)",
        expected = {
          name: varName,
          type: "hash",
          value: [
            {
              key: {
                type: "number",
                value: "1"
              },
              value: {
                type: "string",
                value: "'b'"
              }
            },
            {
              key: {
                type: "string",
                value: "'c'"
              },
              value: {
                type: "number",
                value: "255"
              }
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse empty hash ref assignment", function(done) {
    var varName = "$hash",
        varValue = "HASH(0x7fd61b02ba98)\n     empty hash",
        expected = {
          name: varName,
          type: "hash-ref",
          value: []
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
   });

  /*
   * This tests that when reducing non scalar refs that the end tokens are processed correctly.
   * This also tests an indent value is normalised correctly when dealing with an empty hash ref.
   */
  should("parse empty hash ref in hash", function(done) {
    var varName = "%hash",
        varValue = "(\n   'empty' => HASH(0x7fc2518b5b90)\n        empty hash\n   'scalar' => 'Hello World'\n)",
        expected = {
          name: varName,
          type: "hash",
          value: [
            {
              key: {
                type: "string",
                value: "'empty'"
              },
              value: {
                type: "hash-ref",
                value: []
              }
            },
            {
              key: {
                type: "string",
                value: "'scalar'"
              },
              value: {
                type: "string",
                value: "'Hello World'"
              }
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse hash ref assignment", function(done) {
    var varName = "$hash",
        varValue = "HASH(0x7fd61b02ba98)\n   'a' => 'b'",
        expected = {
          name: varName,
          type: "hash-ref",
          value: [
            {
              key: {
                type: "string",
                value: "'a'"
              },
              value: {
                type: "string",
                value: "'b'"
              }
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse empty array assignment", function(done) {
    var varName = "@arr",
        varValue = "(\n     empty array\n)",
        expected = {
          name: varName,
          type: "array",
          value: []
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse array assignment", function(done) {
    var varName = "@arr",
        varValue = "(\n   0  255\n   1  'hello')",
        expected = {
          name: varName,
          type: "array",
          value: [
            {
              type: "number",
              value: "255"
            },
            {
              type: "string",
              value: "'hello'"
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse empty array ref assignment", function(done) {
    var varName = "$arr",
        varValue = "ARRAY(0x7fd61b02ba98)\n     empty array",
        expected = {
          name: varName,
          type: "array-ref",
          value: []
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  /*
   * This tests that when reducing non scalar refs that the end tokens are processed correctly.
   * This also tests an indent value is normalised correctly when dealing with an empty array ref.
   */
  should("parse empty array ref in hash", function(done) {
    var varName = "%hash",
        varValue = "(\n   'empty' => ARRAY(0x7fc2518b5b90)\n        empty array\n   'scalar' => 'Hello World'\n)",
        expected = {
          name: varName,
          type: "hash",
          value: [
            {
              key: {
                type: "string",
                value: "'empty'"
              },
              value: {
                type: "array-ref",
                value: []
              }
            },
            {
              key: {
                type: "string",
                value: "'scalar'"
              },
              value: {
                type: "string",
                value: "'Hello World'"
              }
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse array ref assignment", function(done) {
    var varName = "$arr",
        varValue = "ARRAY(0x7fbb4b02ba08)\n   0  255",
        expected = {
          name: varName,
          type: "array-ref",
          value: [
            {
              type: "number",
              value: "255"
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse hash containing references", function(done) {
    var varName = "%hash",
        varValue = "(\n   'anon' => HASH(0x7febea80a098)\n      'key' => 'value'\n   'scalar' => 'Hello World'\n)",
        expected = {
          name: varName,
          type: "hash",
          value: [
            {
              key: {
                type: "string",
                value: "'anon'"
              },
              value: {
                type: "hash-ref",
                value: [
                  {
                    key: {
                      type: "string",
                      value: "'key'"
                    },
                    value: {
                      type: "string",
                      value: "'value"
                    }
                  }
                ]
              }
            },
            {
              key: {
                type: "string",
                value: "'scalar'"
              },
              value: {
                type: "string",
                value: "'Hello World'"
              }
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse array containing references", function(done) {
    var varName = "@arr",
        varValue = "(\n   0  HASH(0x7febea835c78)\n      'foo' => HASH(0x7febeb04fbb8)\n         'a' => 'b'\n   1  HASH(0x7fc1d1963bb8)\n      'bar' => HASH(0x7fc1d182ba98)\n         'key' => 'value')",
        expected = {
          name: varName,
          type: "array",
          value: [
            {
              type: "hash-ref",
              value: [
                {
                  key: {
                    type: "string",
                    value: "'foo'"
                  },
                  value: [
                    {
                      type: "hash-ref",
                      value: [
                        {
                          key: {
                            type: "string",
                            value: "'a'"
                          },
                          value: {
                            type: "string",
                            value: "'b'"
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              type: "hash-ref",
              value: [
                {
                  key: {
                    type: "string",
                    value: "'bar'"
                  },
                  value: [
                    {
                      type: "hash-ref",
                      value: [
                        {
                          key: {
                            type: "string",
                            value: "'key'"
                          },
                          value: {
                            type: "string",
                            value: "'value'"
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("parse hash containing code reference", function(done) {
    var varName = "%hash",
        varValue = "(\n   'code' => CODE(0x7fc1d18bac10)\n      -> &Calculator::add in Calculator.pm:9-16\n)",
        expected = {
          name: varName,
          type: "hash",
          value: [
            {
              key: {
                type: "string",
                value: "'code'"
              },
              value: {
                type: "code-ref",
                value: [
                  {
                    type: "sub-ref",
                    value: "&Calculator::add in Calculator.pm:9-16"
                  }
                ]
              }
            }
          ]
        };

    parser.once("readable", eventReader(function(event) {
      expect(event.args[0][0], "Got no variable").to.not.be.undefined;

      var variable = event.args[0][0];
      assertions.assertParseResultCorrect(expected, variable);

      done();
    }));

    StringStream.createStream(varName + " = " + varValue + "\n  DB<18> ").pipe(parser);
  });

  should("emit error when expression can not be reduced", function(done) {
    parser.once("readable", function() {
      var event = parser.read();

      expect(event.name).to.equal("parsingerror");
      expect((event.args[0] instanceof Error)).to.be.true;

      done();
    });

    StringStream.createStream("$foo\n   \n  DB<18> ").pipe(parser);
  });
});