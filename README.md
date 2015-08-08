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

The `DebuggerCommands` class can be used to issue commands to the debugger.  It uses an instance of `DebuggerParser`
understand output from the debugger.

Clients should wait for the `ready` event before issuing commands.

The commands utilise [Javascript](http://www.html5rocks.com/en/tutorials/es6/promises/) [Promises](https://github.com/kriskowal/q)
to coordinate the sending, and receiving of data with the debugger.  While clients can listen for events emitted after
commands have been issued, in practise any event emitted will also be processed in order to settle a Promise returned
from a command function.

For example, the `break` event is also used to resolve the Promise returned from the `continue()` function since the
Perl programming is continuing it's execution until a breakpoint is hit (assuming one has been set).

See the API docs, and the example test Perl program to see the commands in action.
