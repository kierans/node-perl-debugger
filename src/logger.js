"use strict";

var fs = require("fs");

exports.initLogger = function(config) {
  var logger = function() {},
      log;

  if (config && config.log) {
    if (typeof config.log === "string") {
      log = fs.createWriteStream(config.log);
    }

    //noinspection JSUnresolvedVariable
    if (typeof config.log._writableState === "object") {
      // we have a Writable stream.
      log = config.log;
    }

    logger = function(message) {
      log.write(message + "\n");
    };

    logger.log = log;
  }

  return logger;
};
