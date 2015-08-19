"use strict";

// jshint freeze:false

module.exports = (function() {
  Object.prototype.isEmpty = Object.prototype.isEmpty || function() {
    return Object.keys(this).length === 0;
  };

  Array.prototype.isEmpty = Array.prototype.isEmpty || function() {
    return this.length === 0;
  };

  Array.prototype.top = Array.prototype.top || function() {
    if (this.length > 0) {
      return this[this.length - 1];
    }

    return null;
  };
}());