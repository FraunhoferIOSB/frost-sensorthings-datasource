"use strict";

System.register(["lodash", "moment"], function (_export, _context) {
    "use strict";

    var _, moment, _createClass, GenericDatasource;

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    return {
        setters: [function (_lodash) {
            _ = _lodash.default;
        }, function (_moment) {
            moment = _moment.default;
        }],
        execute: function () {
            _createClass = function () {
                function defineProperties(target, props) {
                    for (var i = 0; i < props.length; i++) {
                        var descriptor = props[i];
                        descriptor.enumerable = descriptor.enumerable || false;
                        descriptor.configurable = true;
                        if ("value" in descriptor) descriptor.writable = true;
                        Object.defineProperty(target, descriptor.key, descriptor);
                    }
                }

                return function (Constructor, protoProps, staticProps) {
                    if (protoProps) defineProperties(Constructor.prototype, protoProps);
                    if (staticProps) defineProperties(Constructor, staticProps);
                    return Constructor;
                };
            }();

            _export("GenericDatasource", GenericDatasource = function () {
                function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
                    _classCallCheck(this, GenericDatasource);

                    this.type = instanceSettings.type;
                    this.url = instanceSettings.url;
                    this.name = instanceSettings.name;
                    this.q = $q;
                    this.backendSrv = backendSrv;
                    this.templateSrv = templateSrv;
                    this.withCredentials = instanceSettings.withCredentials;
                    this.headers = { 'Content-Type': 'application/json' };
                    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
                        this.headers['Authorization'] = instanceSettings.basicAuth;
                    }
                }

                _createClass(GenericDatasource, [{
                    key: "getTimeFilter",
                    value: function getTimeFilter(options, key) {
                        var from = options.range.from.utc().format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
                        var to = options.range.to.utc().format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
                        return key + " gt " + from + " and " + key + " lt " + to;
                    }
                }, {
                    key: "query",
                    value: function query(options) {
                        // Filter targets that are set to hidden
                        options.targets = _.filter(options.targets, function (target) {
                            return target.hide != true;
                        });

                        var allPromises = [];

                        if (_.find(options.targets, { "panelType": 'grafana-worldmap-panel' })) {
                            _.forEach(options.targets, function (target, targetIndex) {
                                var self = this;
                                var suburl = '';

                                if (target.selectedThingId == 0) return;
                                var timeFilter = this.getTimeFilter(options, "time");
                                suburl = '/Things(' + target.selectedThingId + ')/HistoricalLocations?' + '$filter=' + timeFilter + '&$expand=Locations';

                                allPromises.push(this.doRequest({
                                    url: this.url + suburl,
                                    method: 'GET'
                                }).then(function (response) {
                                    return self.transformLocationsCoordinates(target, targetIndex, response.data.value);
                                }));
                            }.bind(this));

                            return Promise.all(allPromises).then(function (values) {
                                var allCoordinates = [];
                                _.forEach(values, function (value) {
                                    allCoordinates = allCoordinates.concat(value);
                                });
                                return { data: allCoordinates };
                            });
                        }

                        var self = this;
                        var allTargetResults = { data: [] };

                        _.forEach(options.targets, function (target) {
                            var self = this;
                            var suburl = '';

                            if (_.isEqual(target.type, "Locations")) {
                                if (target.selectedLocationId == 0) return;
                                var timeFilter = this.getTimeFilter(options, "time");
                                suburl = '/Locations(' + target.selectedLocationId + ')/HistoricalLocations?' + '$filter=' + timeFilter + '&$expand=Things';
                            } else if (_.isEqual(target.type, "Historical Locations")) {
                                if (target.selectedThingId == 0) return;
                                var _timeFilter = this.getTimeFilter(options, "time");
                                suburl = '/Things(' + target.selectedThingId + ')/HistoricalLocations?' + '$filter=' + _timeFilter + '&$expand=Locations';
                            } else {
                                if (target.selectedDatastreamId == 0) return;
                                var _timeFilter2 = this.getTimeFilter(options, "phenomenonTime");
                                suburl = '/Datastreams(' + target.selectedDatastreamId + ')/Observations?' + '$filter=' + _timeFilter2;
                            }

                            allPromises.push(this.doRequest({
                                url: this.url + suburl,
                                method: 'GET'
                            }).then(function (response) {
                                var transformedResults = [];
                                if (_.isEqual(target.type, "Locations")) {
                                    transformedResults = self.transformThings(target, response.data.value);
                                } else if (_.isEqual(target.type, "Historical Locations")) {
                                    transformedResults = self.transformLocations(target, response.data.value);
                                } else {
                                    transformedResults = self.transformDataSource(target, response.data.value);
                                }
                                return transformedResults;
                            }));
                        }.bind(this));

                        return Promise.all(allPromises).then(function (values) {
                            _.forEach(values, function (value) {
                                allTargetResults.data.push(value);
                            });
                            return allTargetResults;
                        });
                    }
                }, {
                    key: "transformLocationsCoordinates",
                    value: function transformLocationsCoordinates(target, targetIndex, values) {
                        var result = [];
                        var timestamp = "";
                        var lastLocation = false;
                        var lastLocationValue = "";
                        if (values.length > 0) {
                            var _lastLocation = values[0].Locations[0];
                            result.push({
                                "key": _lastLocation.name,
                                "latitude": _lastLocation.location.coordinates[0],
                                "longitude": _lastLocation.location.coordinates[1],
                                "name": _lastLocation.name + " | " + target.selectedThingName + " | " + moment(values[0].time, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('YYYY-MM-DD HH:mm:ss.SSS'),
                                "value": targetIndex + 1
                            });
                        }
                        return result;
                    }
                }, {
                    key: "transformDataSource",
                    value: function transformDataSource(target, values) {
                        return {
                            'target': target.selectedDatastreamName.toString(),
                            'datapoints': _.map(values, function (value, index) {
                                if (target.panelType == "table") {
                                    return [_.isEmpty(value.result.toString()) ? '-' : value.result, parseInt(moment(value.phenomenonTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                                }
                                // graph panel type expects the value in float/double/int and not as strings
                                return [value.result, parseInt(moment(value.phenomenonTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                            })
                        };
                    }
                }, {
                    key: "transformThings",
                    value: function transformThings(target, values) {
                        return {
                            'target': target.selectedLocationName.toString(),
                            'datapoints': _.map(values, function (value, index) {
                                return [_.isEmpty(value.Thing.name) ? '-' : value.Thing.name, parseInt(moment(value.time, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                            })
                        };
                    }
                }, {
                    key: "transformLocations",
                    value: function transformLocations(target, values) {
                        var result = [];
                        _.forEach(values, function (value) {
                            _.forEach(value.Locations, function (location) {
                                result.push([_.isEmpty(location.name) ? '-' : location.name, parseInt(moment(value.time, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))]);
                            });
                        });
                        return {
                            'target': target.selectedThingName.toString(),
                            'datapoints': result
                        };
                    }
                }, {
                    key: "testDatasource",
                    value: function testDatasource() {
                        return this.doRequest({
                            url: this.url,
                            method: 'GET'
                        }).then(function (response) {
                            if (response.status === 200) {
                                return { status: "success", message: "Data source is working", title: "Success" };
                            }
                        });
                    }
                }, {
                    key: "metricFindQuery",
                    value: function metricFindQuery(query, suburl, type) {
                        var _this = this;

                        return this.doRequest({
                            url: this.url + suburl,
                            method: 'GET'
                        }).then(function (result) {
                            return _this.transformMetrics(result.data.value, type);
                        });
                    }
                }, {
                    key: "transformMetrics",
                    value: function transformMetrics(metrics, type) {
                        var placeholder = "select a sensor";
                        if (type == "thing") {
                            placeholder = "select a thing";
                        } else if (type == "datastream") {
                            placeholder = "select a datastream";
                        } else if (type == "location") {
                            placeholder = "select a location";
                        }
                        var transformedMetrics = [{
                            text: placeholder,
                            value: 0
                        }];
                        _.forEach(metrics, function (metric, index) {
                            transformedMetrics.push({
                                text: metric.name + " ( " + metric['@iot.id'] + " )",
                                value: metric['@iot.id']
                            });
                        });
                        return transformedMetrics;
                    }
                }, {
                    key: "doRequest",
                    value: function doRequest(options) {
                        options.withCredentials = this.withCredentials;
                        options.headers = this.headers;

                        return this.backendSrv.datasourceRequest(options);
                    }
                }]);

                return GenericDatasource;
            }());

            _export("GenericDatasource", GenericDatasource);
        }
    };
});
//# sourceMappingURL=datasource.js.map
