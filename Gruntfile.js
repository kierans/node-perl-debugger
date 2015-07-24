"use strict";

module.exports = function(grunt) {
  require("load-grunt-tasks")(grunt);

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: ".jshintrc",
        reporter: require("jshint-stylish")
      },
      gruntfile: {
        src: "Gruntfile.js"
      },
      src: {
        src: [ "src/**/*.js" ]
      },
      test: {
        src: [ "test/**/*.js" ]
      }
    },
    simplemocha: {
      options: {
        timeout: 2000,
        ignoreLeaks: false,
        ui: "bdd",
        reporter: "progress"
      },

      all: {
        src: "test/**/*.js"
      }
    },
    jsdoc: {
      dist: {
        src: ["src/*.js"],
        dest: "doc"
      }
    }
  });

  grunt.registerTask("lint", [ "jshint" ]);
  grunt.registerTask("test", [ "simplemocha:all" ]);
  grunt.registerTask("doc", [ "jsdoc:dist" ]);
  grunt.registerTask("default", [ "lint", "test" ]);
};
