"use strict";

System.register(["lodash", "moment", "./external/jsonpath.js"], function (_export, _context) {
    "use strict";

    var _, moment, JSONPath, _typeof, _createClass, GenericDatasource;

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
        }, function (_externalJsonpathJs) {
            JSONPath = _externalJsonpathJs.JSONPath;
        }],
        execute: function () {
            _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
                return typeof obj;
            } : function (obj) {
                return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
            };

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
                function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv, alertSrv, contextSrv, dashboardSrv) {
                    _classCallCheck(this, GenericDatasource);

                    this.type = instanceSettings.type;
                    this.url = instanceSettings.url;
                    this.name = instanceSettings.name;
                    this.q = $q;
                    this.backendSrv = backendSrv;
                    this.templateSrv = templateSrv;
                    this.withCredentials = instanceSettings.withCredentials;
                    this.headers = { 'Content-Type': 'application/json' };
                    this.alertSrv = alertSrv;
                    this.contextSrv = contextSrv;
                    this.dashboardSrv = dashboardSrv;
                    this.notificationShowTime = 5000;
                    this.topCount = 1000;
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
                    key: "getFormatedId",
                    value: function getFormatedId(id) {
                        return Number.isInteger(id) || !isNaN(id) ? id : "'" + id + "'";
                    }
                }, {
                    key: "query",
                    value: function query(options) {
                        var _this = this;

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
                                suburl = '/Things(' + this.getFormatedId(target.selectedThingId) + ')/HistoricalLocations?' + '$filter=' + timeFilter + '&$expand=Locations($select=name,location)&$top=1&$select=time';

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

                        var testPromises = options.targets.map(async function (target) {
                            var self = _this;
                            var suburl = '';
                            var thisTargetResult = {
                                'target': target.selectedDatastreamName.toString(),
                                'datapoints': []
                            };

                            if (target.selectedDatastreamDirty) {
                                return thisTargetResult;
                            }

                            if (_.isEqual(target.type, "Locations")) {
                                if (target.selectedLocationId == 0) return thisTargetResult;
                                var timeFilter = _this.getTimeFilter(options, "time");
                                suburl = '/Locations(' + _this.getFormatedId(target.selectedLocationId) + ')/HistoricalLocations?' + '$filter=' + timeFilter + '&$expand=Things($select=name)&$select=time';
                            } else if (_.isEqual(target.type, "Historical Locations")) {
                                if (target.selectedThingId == 0) return thisTargetResult;
                                var _timeFilter = _this.getTimeFilter(options, "time");
                                suburl = '/Things(' + _this.getFormatedId(target.selectedThingId) + ')/HistoricalLocations?' + '$filter=' + _timeFilter + '&$expand=Locations($select=name)&$select=time';
                            } else {
                                if (target.selectedDatastreamId == 0) return thisTargetResult;
                                var _timeFilter2 = _this.getTimeFilter(options, "phenomenonTime");
                                suburl = '/Datastreams(' + _this.getFormatedId(target.selectedDatastreamId) + ')/Observations?' + ("$filter=" + _timeFilter2 + "&$select=phenomenonTime,result");
                            }

                            var transformedResults = [];
                            var hasNextLink = true;
                            var fullUrl = _this.url + suburl + ("&$top=" + _this.topCount);

                            while (hasNextLink) {
                                var response = await _this.doRequest({
                                    url: fullUrl,
                                    method: 'GET'
                                });

                                hasNextLink = _.has(response.data, "@iot.nextLink");
                                if (hasNextLink) {
                                    suburl = suburl.split('?')[0];
                                    fullUrl = _this.url + suburl + "?" + response.data["@iot.nextLink"].split('?')[1];
                                }

                                if (_.isEqual(target.type, "Locations")) {
                                    transformedResults = transformedResults.concat(self.transformThings(target, response.data.value));
                                } else if (_.isEqual(target.type, "Historical Locations")) {
                                    transformedResults = transformedResults.concat(self.transformLocations(target, response.data.value));
                                } else {
                                    transformedResults = transformedResults.concat(self.transformDataSource(target, response.data.value));
                                }
                            }

                            thisTargetResult.datapoints = transformedResults;

                            return thisTargetResult;
                        });

                        return Promise.all(testPromises).then(function (values) {
                            allTargetResults.data = values;
                            return allTargetResults;
                        });
                    }
                }, {
                    key: "transformLocationsCoordinates",
                    value: function transformLocationsCoordinates(target, targetIndex, value) {
                        var result = [];
                        var timestamp = "";
                        var lastLocation = false;
                        var lastLocationValue = "";

                        if (value == null || value == undefined) {
                            console.log("Invalid data...");
                            return result;
                        }

                        if (Array.isArray(value)) {
                            if (value.length == 0) {
                                return result;
                            } else {
                                value = value[0];
                            }
                        }

                        if (value) {
                            var _lastLocation = value.Locations[0];
                            result.push({
                                "key": _lastLocation.name,
                                "latitude": _lastLocation.location.coordinates[0],
                                "longitude": _lastLocation.location.coordinates[1],
                                "name": _lastLocation.name + " | " + target.selectedThingName + " | " + moment(value.time, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('YYYY-MM-DD HH:mm:ss.SSS'),
                                "value": targetIndex + 1
                            });
                        }
                        return result;
                    }
                }, {
                    key: "transformDataSource",
                    value: function transformDataSource(target, values) {
                        var self = this;

                        if (self.isOmObservationType(target.selectedDatastreamObservationType) && _.isEmpty(target.jsonQuery)) {
                            return [];
                        }

                        var datapoints = _.map(values, function (value, index) {

                            if (self.isOmObservationType(target.selectedDatastreamObservationType)) {

                                var result = JSONPath({ json: value.result, path: target.jsonQuery });

                                if (target.panelType == "table" || target.panelType == "singlestat") {
                                    result = _typeof(result[0]) === "object" ? JSON.stringify(result[0]) : result[0];
                                    return [result, parseInt(moment(value.phenomenonTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                                } else {
                                    return [result[0], parseInt(moment(value.phenomenonTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                                }
                            } else {

                                if (target.panelType == "table") {
                                    return [_.isEmpty(value.result.toString()) ? '-' : value.result, parseInt(moment(value.phenomenonTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                                } else {
                                    return [value.result, parseInt(moment(value.phenomenonTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                                }
                            }
                        });

                        datapoints = _.filter(datapoints, function (datapoint) {
                            return typeof datapoint[0] === "string" || typeof datapoint[0] === "number" || Number(datapoint[0]) === datapoint[0] && datapoint[0] % 1 !== 0;
                        });

                        return datapoints;
                    }
                }, {
                    key: "isOmObservationType",
                    value: function isOmObservationType(type) {
                        if (_.isEmpty(type)) {
                            return false;
                        }

                        if (!type.includes('om_observation')) {
                            return false;
                        }

                        return true;
                    }
                }, {
                    key: "transformThings",
                    value: function transformThings(target, values) {

                        return _.map(values, function (value) {
                            return [_.isEmpty(value.Thing.name) ? '-' : value.Thing.name, parseInt(moment(value.time, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                        });
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
                        return result;
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
                    value: async function metricFindQuery(query, suburl, type) {

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
                            value: 0,
                            type: ''
                        }];

                        var hasNextLink = true;
                        var selectParam = type == "datastream" ? "$select=name,id,observationType" : "$select=name,id";
                        var fullUrl = this.url + suburl + ("?$top=" + this.topCount + "&" + selectParam);

                        while (hasNextLink) {
                            var result = await this.doRequest({
                                url: fullUrl,
                                method: 'GET'
                            });
                            hasNextLink = _.has(result.data, "@iot.nextLink");
                            if (hasNextLink) {
                                fullUrl = this.url + suburl + "?" + result.data["@iot.nextLink"].split('?')[1];
                            }
                            transformedMetrics = transformedMetrics.concat(this.transformMetrics(result.data.value, type));
                        }

                        return transformedMetrics;
                    }
                }, {
                    key: "transformMetrics",
                    value: function transformMetrics(metrics, type) {

                        var transformedMetrics = [];

                        _.forEach(metrics, function (metric, index) {
                            transformedMetrics.push({
                                text: metric.name + " ( " + metric['@iot.id'] + " )",
                                value: metric['@iot.id'],
                                type: metric['observationType']
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
