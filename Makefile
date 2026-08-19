# Build tooling for the plugin. The Go backend is required for panel queries
# to be executed server-side, which in turn is required for externally shared
# (public) dashboards.

PLUGIN_ID := iosb-sensorthings-datasource
EXECUTABLE := gpx_$(PLUGIN_ID)

HOST_OS := $(shell go env GOOS)
HOST_ARCH := $(shell go env GOARCH)

.PHONY: all backend frontend build test format

all: build

# Builds both the frontend bundle and the backend binary into dist/.
build: backend frontend

# Compiles the Go plugin backend for the host platform.
backend:
	cd pkg && go build -o ../dist/$(EXECUTABLE)_$(HOST_OS)_$(HOST_ARCH) .

# Cross-compiles the Go plugin backend for the platforms supported by Grafana.
backend-all:
	cd pkg && \
		GOOS=linux GOARCH=amd64 go build -o ../dist/$(EXECUTABLE)_linux_amd64 . && \
		GOOS=linux GOARCH=arm64 go build -o ../dist/$(EXECUTABLE)_linux_arm64 . && \
		GOOS=darwin GOARCH=amd64 go build -o ../dist/$(EXECUTABLE)_darwin_amd64 . && \
		GOOS=darwin GOARCH=arm64 go build -o ../dist/$(EXECUTABLE)_darwin_arm64 . && \
		GOOS=windows GOARCH=amd64 go build -o ../dist/$(EXECUTABLE)_windows_amd64.exe .

# Builds the frontend bundle into dist/.
frontend:
	yarn build

# Runs the Go backend tests.
test:
	cd pkg && go test ./...

# Formats the Go source code.
format:
	cd pkg && gofmt -w .
