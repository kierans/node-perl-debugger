# node-perl-debugger

An interface to allow Node programs to debug Perl scripts.

This module uses the Perl debugger's remote capabilities to debug a Perl program.

# Caveats

This has only been tested on perl 5.16.3  If the debugger changes the way data is printed between Perl versions,
this module may not work correctly.

# Usage

    $ npm install
    
To run the tests:

    $ grunt
    
To generate the API doc:

    $ grunt doc
    
## Starting a Debugger Host

An example of how to use the module is in the `test/perl` folder.
 
To start a host for the Perl debugger to connect to, use the `DebuggerHost` class.  Once a host is `listening` a Perl
process can be connected using the `PERLDB_OPTS` env variable eg:

    $ pwd
    ~/node-perl-debugger/test/perl
    
    $ PERLDB_OPTS=RemotePort=localhost:12345 perl -d test.pl
    
## Using the commands interface

The `DebuggerCommands` class can be used to issue commands to the debugger.  It uses an instance of `DebuggerParser` to
understand output from the debugger.

Clients should wait for the `ready` event before issuing commands.

The commands utilise [Javascript](http://www.html5rocks.com/en/tutorials/es6/promises/) [Promises](https://github.com/kriskowal/q)
to coordinate the sending, and receiving of data with the debugger.  While clients can listen for events emitted after
commands have been issued, in practise any event emitted will also be processed in order to settle a Promise returned
from a command function.

For example, the `break` event is used to resolve the Promise returned from the `continue()` function since the
Perl programming is continuing it's execution until a breakpoint is hit (assuming one has been set).

See the API docs, and the example test Perl program to see the commands in action.

# Example

This example is used to debug the test Perl program in the `test/perl` program

```javascript
"use strict";

var DebuggerHost = require("node-perl-debugger").DebuggerHost;

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
```
