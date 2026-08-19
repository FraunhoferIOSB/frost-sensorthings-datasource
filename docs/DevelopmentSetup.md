# Development Setup

1. Make sure you have a working Docker setup.
2. (Optional) Start a local FROST Server, e.g. using Docker
3. Build the plugin frontend and Go backend:

   ```bash
   yarn install
   make build
   ```

4. Start Grafana with docker-compose (make sure you are in the project folder):

   ```bash
   docker-compose up
   ```

Grafana is now reachable on [`http://localhost:3000`](http://localhost:3000).

## Development

For frontend development, start webpack in watch mode (connect over livereload with grafana):

```bash
yarn dev
```

For backend development, rebuild the Go plugin and restart Grafana:

```bash
make backend
```

## Use the plugin in Grafana directly from GitHub (pinned to a commit)

You can build and use the plugin in a Grafana instance **without a local
Node.js/Go setup at all**: the plugin source is fetched directly from GitHub
at an exact commit and compiled inside a Docker build. This is useful when you
want to use a feature of a fork (or an unreleased state of the upstream
plugin) that is not available on grafana.com yet, e.g. the public/shared
dashboards support, and you want exactly the state of a specific commit.

### 1. Pick the commit to pin

- Find the commit on GitHub and copy its **full 40-character SHA** (short
  SHAs become ambiguous over time).
- The commit must be **pushed to GitHub first**. If your work is still local,
  commit and push it to your fork before pinning the commit — otherwise
  `git checkout` will fail.
- For the public dashboards feature (Go backend), the pinned commit must
  contain the `Makefile`; the Dockerfile below falls back to a frontend-only
  build for older upstream commits without it.

### 2. Create the Dockerfile

Save the following file, e.g. as `Grafana.Dockerfile`:

```dockerfile
# Builds a Grafana image containing the plugin, built directly from GitHub at
# a pinned commit.
ARG GRAFANA_IMAGE=grafana-enterprise
ARG GRAFANA_VERSION=11.6.16

# Build stage: fetch the plugin source from GitHub at the pinned commit and
# compile the frontend bundle and the Go backend.
FROM golang:1.26-bookworm AS build

ARG GIT_REPO=https://github.com/FObersteiner/frost-sensorthings-datasource.git
# Use the full 40-character commit SHA of a pushed commit. Branches and tags
# work too.
ARG PINNED_COMMIT=master

RUN apt-get update \
 && apt-get install -y --no-install-recommends git curl unzip nodejs npm \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g yarn@1.22.22

WORKDIR /build
RUN git clone "$GIT_REPO" plugin \
 && git -C plugin checkout "$PINNED_COMMIT"

WORKDIR /build/plugin
# Defensive: commits before the dependency cleanup carry a malformed
# "packageManager": "yarn@" field that yarn classic refuses to work with.
# Strip it if present (no-op on fixed commits).
RUN node -e 'const fs=require("fs");const f="package.json";const j=JSON.parse(fs.readFileSync(f));delete j.packageManager;fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n")'

RUN yarn install --frozen-lockfile \
 # Commits with a Makefile (fork's Go backend) build backend + frontend via
 # "make build"; older upstream commits fall back to a frontend-only build.
 && (if [ -f Makefile ]; then make build; else yarn build; fi)

# Grafana expects the plugin files directly under
# /var/lib/grafana/plugins/<plugin-id>/.
RUN mkdir -p /install/iosb-sensorthings-datasource \
 && cp -r dist/* /install/iosb-sensorthings-datasource/

# Final stage: stock Grafana image plus the plugin built from the pinned
# commit.
FROM grafana/${GRAFANA_IMAGE}:${GRAFANA_VERSION}

# The plugin is unsigned; allow Grafana to load it.
ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=iosb-sensorthings-datasource

COPY --from=build /install/ /var/lib/grafana/plugins/
```

### 3. Build and run

```bash
docker build \
  -f Grafana.Dockerfile \
  --build-arg PINNED_COMMIT=<full-commit-sha> \
  -t grafana-frost-plugin \
  .

docker run -d --name grafana-frost-plugin -p 3000:3000 grafana-frost-plugin
```

Grafana is now reachable on [`http://localhost:3000`](http://localhost:3000).
Add a data source of type _FROST SensorThings API Plugin_ and verify the
connection; a successful health check confirms that the Go backend compiled
from the pinned commit is running.

### Notes

- **Unsigned plugin:** the Dockerfile sets
  `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=iosb-sensorthings-datasource`
  because the plugin is not signed for self-hosted use. This is fine for
  local/testing setups; do not run unsigned plugins on production instances.
- **GitHub archive URLs don't work for URL-based installs:** pointing Grafana
  at `https://github.com/<owner>/<repo>/archive/<sha>.zip` does **not** work
  for this plugin, because that archive is source code (no built `dist/`,
  no `plugin.json` at the archive root). A URL install needs a zip of the
  _built_ plugin, i.e. a zip containing `plugin.json` at its root — exactly
  what the release workflow produces
  (`iosb-sensorthings-datasource-<version>.zip`) and what the Dockerfile
  above produces inside its build stage.
- If your fork publishes such a built zip (e.g. as a GitHub release asset),
  the stock Grafana image can install it at startup instead:
  `GF_INSTALL_PLUGINS="<url-to-zip>;<plugin-id>"` (this is how the official
  image's `/run.sh` invokes `grafana-cli --pluginUrl`). Note that release
  assets are pinned by tag — for pinning by commit, use the Dockerfile above.
- Old upstream commits (before the Go backend was added) build a
  frontend-only plugin. It can still be used as a data source, but public
  dashboards and the backend health check require the fork's backend.

## Makefile

The `Makefile` centralizes the plugin's build and tooling commands. Run
`yarn install` once so that the frontend dependencies are available; the
backend targets additionally need a Go toolchain (see
[Requirements](#requirements)).

| Target              | Description                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make` / `make all` | Alias for `make build`.                                                                                                                                                                    |
| `make build`        | Builds the frontend bundle **and** the Go backend into `dist/`. Run this before `docker-compose up`, since the dev Grafana mounts `./dist`.                                                |
| `make backend`      | Compiles the Go backend for the host OS/architecture into `dist/gpx_iosb-sensorthings-datasource_<GOOS>_<GOARCH>`.                                                                         |
| `make backend-all`  | Cross-compiles the backend for all platforms supported by Grafana (linux amd64/arm64, darwin amd64/arm64, windows amd64). Used by the release workflow to package installable plugin zips. |
| `make frontend`     | Builds only the frontend bundle (`yarn build`).                                                                                                                                            |
| `make test`         | Runs the Go backend unit tests.                                                                                                                                                            |
| `make format`       | Formats all Go source code with gofmt.                                                                                                                                                     |

Examples:

```bash
# Full build (what CI does, and what you need before docker-compose up)
make build

# Iterate on the backend only: rebuild the Go plugin, then restart Grafana
make backend
```

Notes:

- The backend binary name encodes the target platform, e.g.
  `gpx_iosb-sensorthings-datasource_linux_amd64`; Windows binaries get a
  `.exe` suffix.
- CI (`.github/workflows/ci.yml`) uses `make test` and `make build` to
  validate every change.

## Tests

The Go backend has its own unit tests:

```bash
make test
```

The frontend tests run with:

```bash
yarn test:ci
```

## Requirements

- Node.js 18+ and yarn
- Go 1.26+ (only required for the backend component)
