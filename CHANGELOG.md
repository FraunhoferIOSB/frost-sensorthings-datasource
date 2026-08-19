# Changelog

## Version 0.1.0

- Added Go plugin backend, which enables executing panel queries server-side.
  This is required for externally shared (public) dashboards, see
  <https://github.com/FraunhoferIOSB/frost-sensorthings-datasource/issues/450>
- Added `alerting` support (the queries supported by the plugin can now be
  used in Grafana alert rules).
- Updated the Grafana frontend packages to 11.x and React to 18.
- Replaced the unmaintained `memory-cache` package with a small in-repo
  implementation.
- Removed unused dependencies and cleaned up the build configuration.

## Version 0.0.5

- Fixed bug when `Manually Assign Fields` is empty
- Added default mapping for fields
- Updated dependencies

## Version 0.0.4

- Simplified configuration while selecting Datastream
- Updated dependencies

## Version 0.0.3

- Updated dependencies
- Added Signing Plugin for release

## Version 0.0.2

- Updated dependencies
- Build Plugin for submission

## Version 0.0.1

First version of rewritten plugin
