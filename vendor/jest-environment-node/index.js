'use strict';

class JestEnvironmentNode {
  constructor(config = {}) {
    this.global = global;
    this.testPath = config.testPath || '';
    this.projectConfig = config.projectConfig || {};
  }

  async setup() {
    return this.global;
  }

  async teardown() {}

  getVmContext() {
    return null;
  }
}

module.exports = JestEnvironmentNode;
module.exports.default = JestEnvironmentNode;
