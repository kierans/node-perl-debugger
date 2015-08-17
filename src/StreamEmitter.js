"use strict";

exports.mixin = function (cls) {
  cls.prototype._event = function() {
    var args = Array.prototype.slice.call(arguments),
        event = {
          name: args[0],
          args: args.slice(1)
        };

    this.push(event);
  };
};