"use strict";

var events = require("events"),
    net = require("net");

var DebuggerCommands = require("./DebuggerCommands"),
    Logger = require("./logger");

module.exports = DebuggerHost;

DebuggerHost.CONNECTION_EVENT = "connection";
DebuggerHost.DISCONNECTION_EVENT = "disconnection";
DebuggerHost.LISTENING_EVENT = "listening";
DebuggerHost.CLOSE_EVENT = "close";

/**
 * @typedef {Object} DebuggerHostConfiguration
 * @property {string|Writable} log - If a string, path to a log file, else a Writable stream.
 * @property {int} port - The port to listen on.
 */

/**
 * A TCP based host that a Perl debugger can connect to.
 * <p>
 * Emits the following events:
 * <ul>
 *  <li>connection - When a client connects to the TCP server.</li>
 *  <li>disconnection - When a client disconnects from the TCP server.</li>
 *  <li>listening - When the TCP server is ready for clients.</li>
 *  <li>close - When the TCP server shuts down.</li>
 * </ul>
 * @param {DebuggerHostConfiguration} config
 * @constructor
 */
function DebuggerHost(config) {
  if (!config.port) {
    throw new Error("Can't start a DebuggerHost without a port");
  }

  this._config = config;
  this._logger = Logger.initLogger(config);

  this._emitter = new events.EventEmitter();
  this._commands = this._createTcpServer({
    log: this._logger.log
  });

  this._proxyServerEvents();
}

/**
 * Listen for events.
 * @param {string} event
 * @param {function} handler
 */
DebuggerHost.prototype.on = function(event, handler) {
  this._emitter.on(event, handler);
};

/**
 * Instruct the host to start listening for clients.
 * <p>
 * Proxies net.Server.listen
 */
DebuggerHost.prototype.listen = function() {
  var port = this._config.port;

  this._server.listen(port);
  this._logger("Listening on port " + port);
};

/**
 * Instruct the host to stop listening for clients
 * <p>
 * Proxies net.Server.close
 */
DebuggerHost.prototype.close = function() {
  this._server.close();
};

/**
 * @returns {DebuggerCommands} An interface for executing commands on the perl debugger.
 */
DebuggerHost.prototype.commands = function() {
  return this._commands;
};

DebuggerHost.prototype._createTcpServer = function(config) {
  var self = this,
      commands = new DebuggerCommands(null, config);

  this._server = net.createServer();

  this._server.on("connection", function(socket) {
    self._logger("Client connected");

    socket.setEncoding("utf8");
    commands.connect(socket);

    socket.on("end", function () {
      self._logger("Client disconnected");

      self._emitter.emit(DebuggerHost.DISCONNECTION_EVENT);
    });

    if (self._logger.log) {
      socket.pipe(self._logger.log);
    }

    self._emitter.emit(DebuggerHost.CONNECTION_EVENT);
  });

  return commands;
};

DebuggerHost.prototype._proxyServerEvents = function() {
  var self = this;

  [ DebuggerHost.LISTENING_EVENT, DebuggerHost.CLOSE_EVENT ].forEach(function(event) {
    self._server.on(event, function() {
      self._emitter.emit(event);
    });
  });
};