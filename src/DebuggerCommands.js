"use strict";

var events = require("events");

var Q = require("q");

var DebuggerParser = require("./DebuggerParser");

module.exports = DebuggerCommands;

/**
 * @typedef {Object} DebuggerCommandsConfiguration
 * @property {string|Writable} log - If a string, path to a log file, else a Writable stream.
 */

/**
 * Issues commands to a Perl Debugger.
 *
 * Clients must wait until the "ready" event is emitted.  This event signals that the Perl debugger is ready
 * to accept commands.  If commands are issued before "ready" is emitted, an error will be thrown.
 *
 * The "terminated" event is emitted when the Perl program is terminated.
 *
 * @param {Duplex} [stream] The stream representing the Perl debugger.
 * @param {DebuggerCommandsConfiguration} [config]
 * @constructor
 */
function DebuggerCommands(stream, config) {
  /**
   * @ignore
   * @type {DebuggerParser}
   */
  this._parser = new DebuggerParser(config);
  this._emitter = new events.EventEmitter();
  this._ready = false;
  this._currentLocation = null;

  if (stream) {
    this.connect(stream);
  }

  /*
   * We process events on the next tick in case an error is thrown, otherwise the error
   * may bubble back into the source stream.
   *
   * Remember, listeners by default have 'this' bound to the EventEmitter
   */
  this._parser.on("readable", this._onNextTick(this._onEvent.bind(this)));
}

/**
 * Listen for events.
 * @param {string} event
 * @param {function} handler
 */
DebuggerCommands.prototype.on = function(event, handler) {
  this._emitter.on(event, handler);
};

/**
 * Connects this command interface to a Perl Debugger via the stream.
 *
 * @param {Duplex} stream
 */
DebuggerCommands.prototype.connect = function(stream) {
  stream.pipe(this._parser);

  // wait until we have a prompt before sending data to the debugger
  this._emitter.once("prompt", function() {
    /** @type {Duplex} */
    this._socket = stream;

    this._ready = true;
    this._emitter.emit("ready");
  }.bind(this));
};

/**
 * @return {Promise} Get the variables in the current lexical scope.
 */
DebuggerCommands.prototype.variables = function() {
  var message = this._send("y");
  message.then(function() {
    /*
     * If this promise is resolved before a variables event is emitted, there are no variables.
     */
    deferred.resolve([]);
  });

  var deferred = Q.defer();
  this._emitter.once("variables", deferred.resolve);
  this._emitter.once("parsingerror", deferred.reject);

  // tell the parser it will expecting variable data
  this._parser.setMode(DebuggerParser.VARIABLE_PARSE_MODE);

  //noinspection JSValidateTypes
  return deferred.promise;
};

/**
 * @return {Promise} Get the stacktrace.
 */
DebuggerCommands.prototype.stacktrace = function() {
  var self = this,
      deferred = Q.defer(),
      message = this._send("T");

  message.then(function() {
    var trace = [];
    self._addCurrentLocationToStackTrace(trace);

    deferred.resolve(trace);
  });

  this._emitter.once("stacktrace", function(trace) {
    self._addCurrentLocationToStackTrace(trace);

    deferred.resolve(trace);
  });

  this._emitter.once("parsingerror", deferred.reject);

  // tell the parser it will expecting stacktrace data
  this._parser.setMode(DebuggerParser.STACK_TRACE_PARSE_MODE);

  //noinspection JSValidateTypes
  return deferred.promise;
};

/**
 * @return {Promise}
 */
DebuggerCommands.prototype.stepInto = function() {
  return this._send("s");
};

/**
 * @return {Promise}
 */
DebuggerCommands.prototype.stepOver = function() {
  return this._send("n");
};

/**
 * @return {Promise}
 */
DebuggerCommands.prototype.stepOut = function() {
  return this._send("r");
};

/**
 * Asks the debugger to continue.
 * <p>
 * The returned Promise is not resolved if the perl program being debugged terminates.<br>
 * Clients are free to dispose of the Promise if the "terminated" event is emitted.
 * Nothing else is going to happen.
 *
 * @param {string} [filename] Only required if wanting to continue to a location.
 * @param {int} [line] Only required if wanting to continue to a location.
 * @return {Promise} - The promise is resolved when a breakpoint is hit.
 */
DebuggerCommands.prototype.continue = function(filename, line) {
  var commandResult,
      continueCommand = "c";

  if (!filename || !line) {
    commandResult = this._send(continueCommand);
  }
  else {
    commandResult = this._breakpoint(filename, line, continueCommand);
  }

  var breakPromise = this._listenForBreak();

  /*
   * We only want the consumer to send another command when both a break event and a prompt event have
   * been received.
   */
  //noinspection JSValidateTypes
  return Q.all([ commandResult, breakPromise ]);
};

/**
 * Asks the debugger to quit.  If successful the {@link DebuggerHost} will notify about socket related events.
 */
DebuggerCommands.prototype.quit = function() {
  this._send("q");
};

/**
 * Issues a breakpoint.
 *
 * @param {string} filename
 * @param {int} line
 * @return {Promise} Whether or not the setting of the breakpoint succeeded.
 */
DebuggerCommands.prototype.break = function(filename, line) {
  return this._breakpoint(filename, line, "b");
};

/**
 * @param {string} filename
 * @param {line} line
 * @return {Promise} Whether or not the removing of the breakpoint succeeded.
 */
DebuggerCommands.prototype.removeBreak = function(filename, line) {
  return this._breakpoint(filename, line, "B");
};

/**
 * @ignore
 *
 * Sends a command to the Perl debugger.
 *
 * @return {Promise} The promise is resolved once a "prompt" event has been received from the parser.
 * @private
 */
DebuggerCommands.prototype._send = function(message) {
  if (!this._socket) {
    throw new Error("No Perl Debugger attached");
  }

  this._socket.write(message + "\n");

  var deferred = Q.defer();
  this._emitter.once("prompt", deferred.resolve);

  //noinspection JSValidateTypes
  return deferred.promise;
};

DebuggerCommands.prototype._onNextTick = function(func) {
  return function() {
    process.nextTick(func);
  };
};

DebuggerCommands.prototype._onEvent = function() {
  var event;

  do {
    event = this._parser.read();

    if (event) {
      switch (event.name) {
        case "terminated":
          this.quit();
          break;

        case "break":
          if (!this._ready) {
            // swallow the event
            continue;
          }

          break;
      }

      /*
       * Allow any internal event listeners a chance to process the message.
       */
      var args = event.args || [];
      args.unshift(event.name);

      this._emitter.emit.apply(this._emitter, args);
    }
  }
  while (event);
};

DebuggerCommands.prototype._reject = function(deferred) {
  var self = this;

  return {
    on: function(event) {
      self._emitter.once(event, function() {
        var args = Array.prototype.slice.apply(arguments);
        deferred.reject({
          name: event,
          args: args
        });
      });

      return this;
    }
  };
};

DebuggerCommands.prototype._breakpoint = function(filename, line, flag) {
  var self = this,
      deferred = Q.defer();

  this._send("f " + filename)
      .then(function() {
        return self._send(flag + " " + line);
      })
      .then(deferred.resolve)
      .catch(deferred.reject);

  // listen for all the error cases
  this._reject(deferred)
      .on("filenotfound")
      .on("notbreakable");

  return deferred.promise;
};

DebuggerCommands.prototype._listenForBreak = function() {
  var deferred = Q.defer(),
      self = this;

  this._emitter.once("break", function(file, line) {
    // resolve can only take a single value.
    self._currentLocation = {
      file: file,
      line: line
    };

    deferred.resolve(self._currentLocation);
  });

  return deferred.promise;
};

DebuggerCommands.prototype._addCurrentLocationToStackTrace = function(trace) {
  if (trace.isEmpty()) {
    // we're in the "main" script
    trace.push({
      sub: null,
      location: this._currentLocation
    });

    return;
  }

  // update the first element with location information
  var element = trace[0];
  element.location = element.location || this._currentLocation;
};