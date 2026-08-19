# Creating a release of the plugin

1. Update the `CHANGELOG.md`.
2. Make sure the `src/plugin.json` contains the version number to be released.
3. Make sure the `package.json` contains the version number to be released.
4. Tag the release `git tag -a v0.0.X -m "Release version 0.0.X."`
5. Push the tagged release `git push --tags`
6. Wait for the build
7. Submit the release artifacts to Grafana.
8. Prepare for new development cycle (update version number).
