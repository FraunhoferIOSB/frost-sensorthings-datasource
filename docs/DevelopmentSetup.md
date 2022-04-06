# Development Setup

1. Make sure you have a working Docker setup.
2. (Optional) Start a local FROST Server, e.g. using Docker
3. start Grafana with Docker (on Windows you may need to replace `$pwd` with the actual path using the right syntax, like `'c:\Grafana\plugings'` or `c:\\Grafana\\plugings`):
```bash
docker run -d --rm \
    -v $(pwd):/var/lib/grafana/plugins \
    -e GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=iosb-sensorthings-datasource \
    -p 3000:3000 \
    --name grafana-sensorthings \
    grafana/grafana:latest
```
Grafana is now reachable on [`http://localhost:3000`](http://localhost:3000).
4. If not available, install yarn. Either installing using `npm`
```bash
npm install yarn -g
```
or as Debian/Ubuntu package
```bash
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt update && sudo apt install yarn
```
5. Build the plugin and restart the docker container:
```bash
  yarn install
  yarn dev && docker restart grafana-sensorthings
```
6. You can use
```bash
  yarn watch
```
during development (build has lesser strict requirements), some changes need to rerun `yarn dev` like in step 5.
