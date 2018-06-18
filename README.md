# OGC SensorThings Datasource Plugin
[Grafana](http://grafana.org/) datasource plugin for [OGC SensorThings Datasource](http://developers.sensorup.com/docs/).

## How to install OGC SensorThings Datasource Plugin?

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

## How to setup OGC SensorThings Datasource?

1. Go to Grafana Configuration.
2. Click "Add data source".
3. Then, provide the necessary details to connect with OGC SensorThings server. Look at the image below for reference.

<p align="center">
  <img src="https://code.linksmart.eu/projects/GST/repos/grafana-sensorthings-datasource/raw/img/datasource_setup.png">
</p>

![](https://code.linksmart.eu/projects/GST/repos/grafana-sensorthings-datasource/raw/img/datasource_setup.png)

Name | Description
------------ | -------------
Name | The data source name.
Default | Set this as the default plugin for new panels.
Type | Choose SensorThings Datasource.
Url | OGC SensorThings API root URL (for e.g, http://localhost:8080/v1.0). Note that, do not add "/" at the end of URL (for e.g, this is not allowed http://localhost:8080/v1.0/)
Access | Proxy: Let Grafana server proxy the requests to OGC SensorThings API server.
Basic Auth | Authenticate to OGC SensorThings API server (if required, provide User and Password)

### Dev setup

This plugin requires node 6.10.0

`npm install -g yarn`
`yarn install`
`npm run build`
