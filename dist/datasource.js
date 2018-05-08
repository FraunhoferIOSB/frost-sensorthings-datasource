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
                    value: function getTimeFilter(options) {
                        var from = options.range.from.format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
                        var to = options.range.to.format("YYYY-MM-DDTHH:mm:ss.SSS") + "Z";
                        return "phenomenonTime gt " + from + " and phenomenonTime lt " + to;
                    }
                }, {
                    key: "sleep",
                    value: function sleep(delay) {
                        var start = new Date().getTime();
                        while (new Date().getTime() < start + delay) {};
                    }
                }, {
                    key: "query",
                    value: function query(options) {
                        // console.log(options);

                        // Filter targets that are set to hidden
                        options.targets = _.filter(options.targets, function (target) {
                            return target.hide != true;
                        });

                        var allPromises = [];
                        var allTargetResults = { data: [] };
                        var self = this;
                        var timeFilter = this.getTimeFilter(options);

                        // /Datastreams(16)/Observations?$filter=phenomenonTime%20gt%202018-03-14T16:00:12.749Z%20and%20phenomenonTime%20lt%202018-03-14T17:00:12.749Z&$select=result,phenomenonTime

                        _.forEach(options.targets, function (target) {

                            var self = this;

                            var suburl = '';

                            if (_.isEqual(target.type, "Location(HL)")) {
                                if (target.selectedLocationId == 0) return;
                                suburl = '/Locations(' + target.selectedLocationId + ')/HistoricalLocations?$expand=Things';
                            } else {
                                if (target.selectedDatastreamId == 0) return;
                                suburl = '/Datastreams(' + target.selectedDatastreamId + ')/Observations?' + '$filter=' + timeFilter;
                            }

                            allPromises.push(this.doRequest({
                                url: this.url + suburl,
                                method: 'GET'
                            }).then(function (response) {
                                var transformedResults = [];
                                if (_.isEqual(target.type, "Location(HL)")) {
                                    transformedResults = self.transformThings(target, response.data.value);
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
                    key: "transformDataSource",
                    value: function transformDataSource(target, values) {
                        return {
                            'target': target.selectedDatastreamName.toString(),
                            'datapoints': _.map(values, function (value, index) {
                                return [value.result, parseInt(moment(value.resultTime, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                            })
                        };
                    }
                }, {
                    key: "transformThings",
                    value: function transformThings(target, values) {
                        return {
                            'target': target.selectedLocation.toString(),
                            'datapoints': _.map(values, function (value, index) {
                                return [value.Thing.name, parseInt(moment(value.time, "YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                            })
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
                    key: "annotationQuery",
                    value: function annotationQuery(options) {
                        var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
                        var annotationQuery = {
                            range: options.range,
                            annotation: {
                                name: options.annotation.name,
                                datasource: options.annotation.datasource,
                                enable: options.annotation.enable,
                                iconColor: options.annotation.iconColor,
                                query: query
                            },
                            rangeRaw: options.rangeRaw
                        };

                        return this.doRequest({
                            url: this.url + '/annotations',
                            method: 'POST',
                            data: annotationQuery
                        }).then(function (result) {
                            return result.data;
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
                }, {
                    key: "buildQueryParameters",
                    value: function buildQueryParameters(options) {
                        var _this2 = this;

                        //remove placeholder targets
                        options.targets = _.filter(options.targets, function (target) {
                            return target.dsTarget !== 'select metric';
                        });

                        var targets = _.map(options.targets, function (target) {
                            return {
                                target: _this2.templateSrv.replace(target.dsTarget.toString(), options.scopedVars, 'regex'),
                                refId: target.refId,
                                hide: target.hide,
                                type: target.type || 'timeserie'
                            };
                        });

                        options.targets = targets;
                        console.log(options);
                        return options;
                    }
                }]);

                return GenericDatasource;
            }());

            _export("GenericDatasource", GenericDatasource);
        }
    };
});
//# sourceMappingURL=datasource.js.map
