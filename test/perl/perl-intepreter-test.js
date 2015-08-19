"use strict";

var DebuggerHost = require("../../src/DebuggerHost");

var debug = new DebuggerHost({
  port: 12345
});

debug.on("disconnection", function() {
  debug.close();
});

debug.on("close", function() {
  console.log("Finished");
});

debug.listen();

var commands = debug.commands();

commands.on("ready", function() {
  commands.break("Calculator.pm", 10)
      .then(function() {
        return commands.break("test.pl", 45);
      })
      .then(function() {
        return commands.continue();
      })
      .then(function() {
        return commands.stacktrace();
      })
      .then(log)
      .then(function() {
        return commands.continue();
      })
      .then(function() {
        return commands.variables();
      })
      .then(log)
      .then(function() {
        return commands.quit();
      })
      .catch(console.error);
});

function log(json) {
  console.log(JSON.stringify(json, null, 2));
}