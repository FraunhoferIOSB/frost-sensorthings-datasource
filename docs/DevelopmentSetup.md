# Development Setup

1. Make sure you have a working Docker setup.
2. (Optional) Start a local FROST Server, e.g. using Docker
3. Start Grafana with docker-comopse (make sure you are in the project folder):
```bash 
docker-compose up
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
5. Build the plugin and start livereload: (connect over livereload with grafana)
```bash
yarn install
yarn dev 
```

Now if you do a code change, yarn automatically build a new version, and sync it with Grafana.

Hint: If you use yarn in wsl and but your project is on windows, livereload doesn't work.