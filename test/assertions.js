/*jshint expr: true*/

"use strict";

require("../src/metaclass");

var chai = require("chai"),
    expect = chai.expect;


exports.assertParseResultCorrect = function(expected, actual) {
  expect(actual.name).to.equal(expected.name);
  expect(actual.type).to.equal(expected.type);

  switch (expected.type) {
    case "array":
    case "array-ref":
      if (expected.value.isEmpty()) {
        expect(actual.value.isEmpty()).to.be.true;
      }
      else {
        compareArrayContents(expected.value, actual.value);
      }

      return;

    case "hash":
    case "hash-ref":
      if (expected.value.isEmpty()) {
        expect(actual.value.isEmpty()).to.be.true;
      }
      else {
        compareHashContents(expected.value, actual.value);
      }

      return;

    default:
      compareScalar(expected, actual);
  }
};

exports.compareArrayContents = compareArrayContents;
exports.compareHashContents = compareHashContents;

function compareArrayContents(expected, actual) {
  expect(actual.type).to.equal(expected.type);
  expect(actual.length).to.equal(expected.length);

  for (var i = 0; i < expected.length; i++) {
    compareScalar(expected[i].value, actual[i].value);
  }
}

function compareHashContents(expected, actual) {
  expect(actual.type).to.equal(expected.type);
  expect(actual.length).to.equal(expected.length);

  for (var i = 0; i < expected.length; i++) {
    compareKeyValuePair(expected[i], actual[i]);
  }
}

function compareKeyValuePair(expected, actual) {
  compareScalar(expected.key, actual.key);

  var expectedValue = expected.value,
      actualValue = actual.value;

  if (/hash.*/.test(expectedValue.type)) {
    return compareHashContents(expectedValue, actualValue);
  }

  if (/array.*/.test(expectedValue.type)) {
    return compareArrayContents(expectedValue, actualValue);
  }

  if (/code.*/.test(expectedValue.type)) {
    return compareCodeContents(expectedValue, actualValue);
  }

  compareScalar(expectedValue, actualValue);
}

function compareCodeContents(expected, actual) {
  expect(actual.type).to.equal(expected.type);

  compareScalar(expected.value[0], actual.value[0]);
}

function compareScalar(expected, actual) {
  expect(actual.type).to.equal(expected.type);
  expect(actual.value).to.equal(expected.value);
}