# Grafana OGC SensorThings Plugin
This plugin enables the visualization of sensor and location data from an [OGC SensorThings](https://github.com/opengeospatial/sensorthings) server on [Grafana](http://grafana.org/).

It provides:
* Time-series visualization on [Graph](https://grafana.com/plugins/graph)
* Time-series and location history in [Table](https://grafana.com/plugins/table)
* Sensor data in [Singlestat](https://grafana.com/plugins/singlestat)
* Location of things on [Worldmap Panel](https://grafana.com/plugins/grafana-worldmap-panel)
* [JSONPath](https://goessner.net/articles/JsonPath/index.html#e2) support for extracting values from [OM_Observation](http://docs.opengeospatial.org/is/15-078r6/15-078r6.html#table_12) observations (See [examples](https://github.com/linksmart/grafana-sensorthings-datasource/blob/master/JSONPath.md))

## Demo
A live dashboard showing SensorThings data in Grafana panels: [SensorThings Dashboard](https://demo.linksmart.eu/grafana/d/OUQUMYDmz/ogc-sensorthings)

[![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/dashboard_small.png)](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/dashboard.png)

## Installation

### Install the latest release
Using grafana-cli:
```
sudo grafana-cli plugins install linksmart-sensorthings-datasource
```
If using [Grafana Docker Image](https://hub.docker.com/r/grafana/grafana/), set container environment variable instead:
```
GF_INSTALL_PLUGINS=linksmart-sensorthings-datasource
```

Restart Grafana server.

### Install the latest build from source
Clone the repository into Grafana's [plugin directory](http://docs.grafana.org/plugins/installation/#grafana-plugin-directory):
```
git clone https://github.com/linksmart/grafana-sensorthings-datasource.git linksmart-sensorthings-datasource
```
If using [Grafana Docker Image](https://hub.docker.com/r/grafana/grafana/), set container environment variable instead:
```
GF_INSTALL_PLUGINS=https://github.com/linksmart/grafana-sensorthings-datasource/archive/master.zip;linksmart-sensorthings-datasource
```

Restart Grafana server.


## Setup

1. Go to Grafana Configuration.
2. Select `Add data source`.
3. Provide the necessary details to connect with OGC SensorThings server.

Name | Description
------------ | -------------
Name | The data source name.
Default | Set this as the default plugin for new panels.
Type | Choose SensorThings Datasource.
Url | OGC SensorThings API root URL (e.g. `http://localhost:8080/v1.0`). Note the URL has no trailing slash ("/").
Access | Proxy: Let Grafana server proxy the requests to OGC SensorThings API server.
Basic Auth | Authenticate to OGC SensorThings API server (if required, provide User and Password)

![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/datasource_setup.png)

4. Save & Test, you should see this confirmation:  
![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/datasource_setup_confirmation.png)

## Query Configuration

### Graph view
To visualize the observations from OGC SensorThings server,

1. Add a graph panel.
2. Select the SensorThings Datasource.
3. Select `Sensor` or `Things` to get the list of sensors or things which are available in your SensorThings server.
4. Select a specific sensor or thing from the list, to get the list of datastreams.
5. Select a datastream to visualize the observations in the graph.

See the demo below for better understanding:

![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/graph_demo.gif)

### Table view
Using table view, one can see list of observation recorded based on Sensors/Things, and also list of Locations visited by a Thing or list of Things that has been in a specific Location.

1. Add a table panel.
2. Select the SensorThings Datasource.
3. Select `Sensors`, `Things`, `Locations`, or `Historical Locations` from the initial dropdown list.

See the demo below for better understanding:

![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/table_demo.gif)

### Map view
Using the [Grafana Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel), one can see the last Location of a Thing on the map.

1. Install world map panel from grafana plugin store.
2. Add the map panel in dashboard
3. Under `Worldmap` tab of the panel configuration:
    * `Map Visual Options`:
        * Set `Center` to `Last GeoHash`
        * Set `Max Circle Size` to 5
               
    * `Map Data Options`:
        * Set `Location Data` to `Table`
        
    * `Field Mapping`:
        * Set `Table Query Format` to `coordinates`
        * Set `Location Name Field` to `name`

4. In "Query" tab:
    * Select the LinkSmart SensorThings Datasource.
    * Select `Things` and pick a Thing from from the dropdown list.
    * Select `Last Location Coordinates`

![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/worldmap_config.jpg)

### Dev setup
```
npm install
npm run watch
```

## Links
* [Changelog](https://github.com/linksmart/grafana-sensorthings-datasource/blob/master/CHANGELOG.md)
* [License](https://github.com/linksmart/grafana-sensorthings-datasource/blob/master/LICENSE)
* [Issues](https://github.com/linksmart/grafana-sensorthings-datasource/issues)
* [SensorThings faker for testing](https://github.com/linksmart/sensorthings-faker)
* [Plugin page on Grafana Labs](https://grafana.com/plugins/linksmart-sensorthings-datasource)
