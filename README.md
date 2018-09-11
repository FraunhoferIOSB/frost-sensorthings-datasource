# LinkSmart SensorThings Data Source Plugin
This plugin enables the visualization of sensor and location data from an [OGC SensorThings](https://github.com/opengeospatial/sensorthings) server on [Grafana](http://grafana.org/).

It provides:
* Time-series visualization on [Graph](https://grafana.com/plugins/graph)
* Time-series and location history in [Table](https://grafana.com/plugins/table)
* Sensor data in [Singlestat](https://grafana.com/plugins/singlestat)
* Location of things on [Worldmap Panel](https://grafana.com/plugins/grafana-worldmap-panel)

## Demo
A live dashboard showing SensorThings data in Grafana panels: [SensorThings Dashboard](https://demo.linksmart.eu/grafana/d/OUQUMYDmz/ogc-sensorthings)

[![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/dashboard_small.png)](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/dashboard.png)

## Installation

### Install via grafana-cli
```
sudo grafana-cli plugins install linksmart-sensorthings-datasource
```

### Install from source

* Clone the repository into Grafana's [plugin directory](http://docs.grafana.org/plugins/installation/#grafana-plugin-directory):
```
git clone https://code.linksmart.eu/scm/ogc-st/grafana-sensorthings-datasource.git linksmart-sensorthings-datasource
```
* Restart Grafana server to see the newly added datasource.

## Setup

1. Go to Grafana Configuration.
2. Select `Add data source`.
3. Provide the necessary details to connect with OGC SensorThings server.

Name | Description
------------ | -------------
Name | The data source name.
Default | Set this as the default plugin for new panels.
Type | Choose SensorThings Datasource.
Url | OGC SensorThings API root URL (e.g. http://localhost:8080/v1.0). Note the URL has no trailing slash ("/").
Access | Proxy: Let Grafana server proxy the requests to OGC SensorThings API server.
Basic Auth | Authenticate to OGC SensorThings API server (if required, provide User and Password)

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/datasource_setup.png)

4. Save & Test, you should see this confirmation:  
![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/datasource_setup_confirmation.png)

## Query Configuration

### Graph view
To visualize the observations from OGC SensorThings server,

1. Add a graph panel.
2. Select the SensorThings Datasource.
3. Select `Sensor` or `Things` to get the list of sensors or things which are available in your SensorThings server.
4. Select a specific sensor or thing from the list, to get the list of datastreams.
5. Select a datastream to visualize the observations in the graph.

See the demo below for better understanding:

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/graph_demo.gif)

### Table view
Using table view, one can see list of observation recorded based on Sensors/Things, and also list of Locations visited by a Thing or list of Things that has been in a specific Location.

1. Add a table panel.
2. Select the SensorThings Datasource.
3. Select `Sensors`, `Things`, `Locations`, or `Historical Locations` from the initial dropdown list.

See the demo below for better understanding:

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/table_demo.gif)

### World Map view
Using world map view, one can see the current Location of a Thing on the map.

1. Install world map panel from grafana plugin store.
2. Add a world map panel in dashboard
3. In "Worldmap" tab:
    * Select `Center`->`Last GeoHash`
    * Set `Min Circle Size` and `Max Circle Size` to 5
    * Select `Location Data`->`json result`  
![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/worldmap_config.png)

4. In "Metrics" tab:
    * Select the OGC SensorThings Datasource.
    * Select a "Thing" from dropdown list.

See the demo below for better understanding:

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/worldmap_demo.gif)



### Dev setup

This plugin requires node 6.10.0
```
npm install -g yarn
yarn install
npm run build
```

## Issues
Please report any issues on [LinkSmart Boards](https://boards.linksmart.eu).