# OCG SensorThings Datasource Plugin
[Grafana](http://grafana.org/) datasource plugin for [OCG SensorThings Datasource](http://developers.sensorup.com/docs/).

## Deployment

### Install via grafana-cli
```
sudo grafana-cli plugins install grafana-sensorthings-datasource
```

### Install from source

* Clone the repository into Grafana's [plugin directory](http://docs.grafana.org/plugins/installation/#grafana-plugin-directory):
```
git clone https://code.linksmart.eu/scm/gst/grafana-sensorthings-datasource.git grafana-sensorthings-datasource
```
* Restart Grafana server to see the newly added datasource.



### Dev setup

This plugin requires node 6.10.0

`npm install -g yarn`
`yarn install`
`npm run build`
