"use strict";

var DebuggerHost = require("../../src/DebuggerHost");

var debug = new DebuggerHost({
  log: process.stdout,
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
  commands.break("test.pl", 45)
      .then(function() {
        return commands.continue();
      })
      .then(function() {
        return commands.variables();
      })
      .then(function(vars) {
        console.log(JSON.stringify(vars, null ,2));
      })
      .then(function() {
        return commands.quit();
      })
      .catch(console.error);
});