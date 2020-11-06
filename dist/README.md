# Grafana OGC SensorThings Plugin
A Grafana Data Source plugin to query observation and location data from an [OGC SensorThings](https://github.com/opengeospatial/sensorthings) server for visualization on [Grafana](http://grafana.org/) panels.

It provides:
* Observations for panels such as [Graph](https://grafana.com/plugins/graph), [Table](https://grafana.com/plugins/table), [Singlestat](https://grafana.com/plugins/singlestat)
* Historical Locations (along with coordinates and Observations) for panels such as [Table](https://grafana.com/plugins/table), [Worldmap Panel](https://grafana.com/plugins/grafana-worldmap-panel)
* JSONPath expression support for selection of values from result objects

## Demo
A live dashboard showing SensorThings data in Grafana panels: [SensorThings Dashboard](https://demo.linksmart.eu/grafana/d/OUQUMYDmz/ogc-sensorthings)

[![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/dashboard_small.png)](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/dashboard.png)

## Data Source Configuration

1. Install the plugin (see below)
2. Go to Grafana Configuration.
3. Select `Add data source`.
4. Provide the necessary details to connect to the OGC SensorThings server. Note that the URL field must be set to OGC SensorThings API root endpoint (e.g. `http://localhost:8080/v1.0`), without trailing slash.
5. Save & Test, you should see this confirmation:  
![](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/datasource_setup_confirmation.png)

## Query Configuration
There are several ways to query Observations and Locations. The Observations are sorted descendingly by phenomenonTime. 

The queries options are:
* (A) Get Observations by Thing/Datastream
* (B) Get Historical Locations by Things
* (C) Get Historical Locations, coordinates, and Observations by Thing
* (D) Get Observations by Sensor
* (E) Get Things by Location

![Query Options](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/query_options.jpg)

If the Datastream has [OM_Observation](http://docs.opengeospatial.org/is/15-078r6/15-078r6.html#table_12) for observationType, the particular values can be selected from the result object inside each Observation. The selection can be done using [JSONPath](https://goessner.net/articles/JsonPath/index.html#e2) expressions. Few examples are available [here](https://github.com/linksmart/grafana-sensorthings-datasource/blob/master/JSONPath.md).

![JSONPath Queries](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/query_jsonpath.jpg)

### Map view
Using the [Grafana Worldmap Panel](https://grafana.com/grafana/plugins/grafana-worldmap-panel), one can see latest Locations of Things on the map. Currently, only a single Thing can be visualized.

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
    * Select `Historical Locations with Coordinates`
    * Select a Datastream if you want to query the latest observation (per Historical Location) and use that value as metric field. This metric value will determine the size and color of each circle and can be viewed by hovering on the circle.
    * Select a Limit value to set how many locations should be retrieved from the history.

![Worldmap Configuration](https://raw.githubusercontent.com/linksmart/grafana-sensorthings-datasource/master/img/worldmap_config.jpg)

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
GF_INSTALL_PLUGINS="https://github.com/linksmart/grafana-sensorthings-datasource/archive/master.zip;linksmart-sensorthings-datasource"
```

Restart Grafana server.

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
