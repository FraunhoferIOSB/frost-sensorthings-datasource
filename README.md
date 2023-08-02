# FROST SensorThings API data source for Grafana
[![Build](https://github.com/FraunhoferIOSB/frost-sensorthings-datasource/workflows/CI/badge.svg)](https://github.com/FraunhoferIOSB/frost-sensorthings-datasource/actions?query=workflow%3A%22CI%22)
[![Release](https://github.com/FraunhoferIOSB/frost-sensorthings-datasource/workflows/Release/badge.svg)](https://github.com/FraunhoferIOSB/frost-sensorthings-datasource/actions?query=workflow%3ARelease)
[![Marketplace](https://img.shields.io/badge/dynamic/json?logo=grafana&color=F47A20&label=marketplace&prefix=v&query=%24.items%5B%3F%28%40.slug%20%3D%3D%20%22iosb-sensorthings-datasource%22%29%5D.version&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins)](https://grafana.com/grafana/plugins/iosb-sensorthings-datasource)
[![Downloads](https://img.shields.io/badge/dynamic/json?logo=grafana&color=F47A20&label=downloads&query=%24.items[%3F(%40.slug%20%3D%3D%20%22iosb-sensorthings-datasource%22)].downloads&url=https%3A%2F%2Fgrafana.com%2Fapi%2Fplugins)](https://grafana.com/grafana/plugins/iosb-sensorthings-datasource)
[![License](https://img.shields.io/github/license/fraunhoferiosb/frost-sensorthings-datasource)](LICENSE)

A data source plugin for loading OGC SensorThings API data into [Grafana](https://grafana.com).

![NO2 Values in Karlsruhe](https://raw.githubusercontent.com/FraunhoferIOSB/frost-sensorthings-datasource/master/src/img/sensorthings-demo.gif)

## Using the Plugin
1. Click the _Gear_ icon in Grafana to enter the configuration menu, select Plugins, and add _FROST SensorThings Plugin_
2. Go back and select _Data Sources_. Click _Add data source_, choose _FROST SensorThings API Plugin_
3. Enter a name for the datasource, and enter the base URL to a SensorThings API server, e.g. `https://airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de/v1.1/`
4. Add authentication settings if needed and click "Save & Test".
5. Create a new dashboard, under _Dashboards_, _Browse_, _New Dashboard_.
6. Add a panel (bar icon with plus on the top right)
7. Make sure the correct datasource is chosen.
8. Choose Advanced mode and select the desired cache time. Add your path to the Observations you want to visualize (without the baseURL, but keeping the leading _/_) e.g. `/Datastreams(1)/Observations`. It is recommended to order the Observations by phenomenonTime (`?$orderby=phenomenonTime`).


## Further Documentation
Full documentation for the plugin is available on [website](https://github.com/FraunhoferIOSB/frost-sensorthings-datasource). The developer documentation can be found on [GitHub](https://github.com/FraunhoferIOSB/frost-sensorthings-datasource/tree/master/docs/DevelopmentSetup.md).

## Contributions
This plugin is based on the [JSON API data source for Grafana](https://github.com/marcusolsson/grafana-json-datasource) by Marcus Olsson.
It is the successor of the initial [Grafana SensorThings Datasource Plugin](https://github.com/linksmart/grafana-sensorthings-datasource) by LinkSmart.
