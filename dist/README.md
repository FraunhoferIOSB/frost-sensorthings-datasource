# OGC SensorThings Data Source Plugin
This plugin enables the visualization of sensor and location data from an [OGC SensorThings](https://github.com/opengeospatial/sensorthings) on [Grafana](http://grafana.org/).

It provides:
* Time-series visualization on [Graph](https://grafana.com/plugins/graph)
* Time-series and location history in [Table](https://grafana.com/plugins/table)
* Sensor data in [Singlestat](https://grafana.com/plugins/singlestat)
* Location of things on [Worldmap Panel](https://grafana.com/plugins/grafana-worldmap-panel)

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
2. Click "Add data source".
3. Then, provide the necessary details to connect with OGC SensorThings server. Look at the image below for reference.

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/datasource_setup.png)

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
2. Select "OGC SensorThings Datasource".
3. Select "Sensor" or "Things" to get the list of sensors or things which is already available in your sensorthings database.
4. Then select a specific sensor or thing from the list, to get the list of datastreams.
5. Finally, select a datastream to visualize the observations in the graph.
6. See the demo below for better understanding.

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/graph_demo.gif)

### Table view
Using table view, one can see list of observation recorded based on Sensors/Things, and also list of historical Locations visited by a "Thing" or list of historical things that has been in a specific "Location".

1. Add a table panel.
2. Select "OGC SensorThings Datasource".
3. Select "Sensors" or "Things" or "Locations" or "Historical Locations" from the intial dropdown list.
4. See the demo below for better understanding.

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/table_demo.gif)

### World Map view
Using world map view, one can see the current location of a thing in the map with live status.

1. Install world map panel from grafana plugin store.
2. Add a world map panel in dashboard
3. Select "OGC SensorThings Datasource".
4. Go to "Worldmap" tab.
5. Under "Map Data Options", select "json result" for "Location Data"
6. Set "Min Circle size" and "Max Circle size" as "5".
7. Select "Last GeoHash" for "Center".
8. Now come back to "Metrics" section and select a "Thing" from dropdown list.
9. See the demo below for better understanding.

![](https://code.linksmart.eu/projects/OGC-ST/repos/grafana-sensorthings-datasource/raw/img/map_demo.gif)


Name | Description
------------ | -------------
Sensors | A Sensor in SensorThings API is an instrument that observes a property or phenomenon with the goal of producing an estimate of the value of the property.
Things | A Thing is an object of the physical world (physical Things) or the information world (virtual Things) that is capable of being identified and integrated into communication networks [ITU-T Y.2060].
Locations | Returns list of historical things that has been attached/visited in the selected location.
Historical Locations | Returns list of historical locations that has been  attached/visited in the selected thing

### Dev setup

This plugin requires node 6.10.0
```
npm install -g yarn
yarn install
npm run build
```
