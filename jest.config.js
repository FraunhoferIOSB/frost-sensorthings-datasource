// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = 'UTC';

const { grafanaESModules, nodeModulesToTransform } = require('./.config/jest/utils');

module.exports = {
  // Jest configuration provided by Grafana scaffolding
  ...require('./.config/jest.config'),
  // Inform jest to also transform node_modules packages that only ship an ESM
  // build (or a build that requires transformation).
  transformIgnorePatterns: [nodeModulesToTransform([...grafanaESModules, 'jsonpath-plus', 'jsonata'])],
};
