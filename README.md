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

## Query Configuration

### Graph view
To visualize the observations from OGC SensorThings server,

1. Add a graph panel.
2. Select "OGC SensorThings Datasource" datasource.
3. Select "Sensor" or "Things" to get the list of sensors or things which is already available in your sensorthings database.
4. Then select a sensor or things from the list, to get the list of datastreams.
5. Finally, select a datastream to visualize the observations in the graph.

![](https://code.linksmart.eu/projects/GST/repos/grafana-sensorthings-datasource/raw/img/graph_demo.gif)


Name | Description
------------ | -------------
Sensor | A Sensor in SensorThings API is an instrument that observes a property or phenomenon with the goal of producing an estimate of the value of the property.
Thing | A Thing is an object of the physical world (physical Things) or the information world (virtual Things) that is capable of being identified and integrated into communication networks [ITU-T Y.2060].

### Dev setup

This plugin requires node 6.10.0

`npm install -g yarn`
`yarn install`
`npm run build`
