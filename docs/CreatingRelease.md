# Creating a release of the plugin

1. Update the `CHANGELOG.md`.
2. Make sure the `package.json` contains the version number to be released.
   The version in `src/plugin.json` is filled in automatically at build time
   (the `%VERSION%` placeholder is replaced with the `package.json` version by
   webpack when the plugin is built).
3. Tag the release `git tag -a v0.1.0 -m "Release version 0.1.0."`
4. Push the tagged release `git push --tags`
5. Wait for the build. The release workflow also cross-compiles the Go backend
   for all supported platforms (`make backend-all`) and packages the frontend
   and the backend binaries into the release archive.
6. Review the generated draft release and publish it.
7. Submit the release artifacts to Grafana.
8. Prepare for the next development cycle (update the version number).
