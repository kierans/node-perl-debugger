"use strict";

var newStream = require("resumer");

/**
 * @param {string} content
 * @return {Readable}
 */
exports.createStream = function(content) {
	//noinspection JSUnresolvedFunction
	return newStream().queue(content).end();
};
