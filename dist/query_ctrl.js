'use strict';

System.register(['app/plugins/sdk', './css/query-editor.css!'], function (_export, _context) {
    "use strict";

    var QueryCtrl, _createClass, GenericDatasourceQueryCtrl;

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    return {
        setters: [function (_appPluginsSdk) {
            QueryCtrl = _appPluginsSdk.QueryCtrl;
        }, function (_cssQueryEditorCss) {}],
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

            _export('GenericDatasourceQueryCtrl', GenericDatasourceQueryCtrl = function (_QueryCtrl) {
                _inherits(GenericDatasourceQueryCtrl, _QueryCtrl);

                function GenericDatasourceQueryCtrl($scope, $injector) {
                    _classCallCheck(this, GenericDatasourceQueryCtrl);

                    var _this = _possibleConstructorReturn(this, (GenericDatasourceQueryCtrl.__proto__ || Object.getPrototypeOf(GenericDatasourceQueryCtrl)).call(this, $scope, $injector));

                    _this.scope = $scope;
                    _this.target.panelType = _this.scope.ctrl.panel.type;

                    _this.target.type = _this.target.type || 'Sensor';

                    // sensor init start
                    _this.target.senTarget = _this.target.senTarget || 'select a sensor';
                    _this.allSensors = {};
                    _this.target.selectedSensorId = _this.target.selectedSensorId || 0;
                    // sensor init end

                    // thing init start
                    _this.target.thingTarget = _this.target.thingTarget || 'select a thing';
                    _this.allThings = {};
                    _this.target.selectedThingId = _this.target.selectedThingId || 0;
                    // thing init end

                    // datasource init start
                    _this.target.dsTarget = _this.target.dsTarget || 'select metric';
                    _this.allDataSources = {};
                    _this.target.datastreamID = _this.target.datastreamID || 0;
                    // datasource init end

                    // Location init start
                    _this.target.locationTarget = _this.target.locationTarget || 0;
                    _this.target.selectedLocation = _this.target.selectedLocation || 'select a location';
                    _this.allLocations = {};
                    // Location init end
                    return _this;
                }

                _createClass(GenericDatasourceQueryCtrl, [{
                    key: 'sleep',
                    value: function sleep(delay) {
                        var start = new Date().getTime();
                        while (new Date().getTime() < start + delay) {};
                    }
                }, {
                    key: 'getOptions',
                    value: function getOptions(query) {
                        var self = this;
                        var targetUrl = "";
                        if (this.target.type == 'Sensor') {
                            targetUrl = "/Sensors(" + this.target.selectedSensorId + ")/Datastreams";
                        } else {
                            targetUrl = "/Things(" + this.target.selectedThingId + ")/Datastreams";
                        }
                        return this.datasource.metricFindQuery(query || '', targetUrl).then(function (result) {
                            self.allDataSources = result;
                            return result;
                        });
                    }
                }, {
                    key: 'showSensors',
                    value: function showSensors() {
                        return this.target.type == 'Sensor';
                    }
                }, {
                    key: 'showThings',
                    value: function showThings() {
                        return this.target.type == 'Thing';
                    }
                }, {
                    key: 'showLocations',
                    value: function showLocations() {
                        return this.target.type == 'Location' && this.target.panelType == 'table';
                    }
                }, {
                    key: 'getSensors',
                    value: function getSensors(query) {
                        var self = this;
                        return this.datasource.metricFindQuery(query || '', "/Sensors").then(function (result) {
                            self.allSensors = result;
                            return result;
                        });
                    }
                }, {
                    key: 'toggleEditorMode',
                    value: function toggleEditorMode() {
                        this.target.rawQuery = !this.target.rawQuery;
                    }
                }, {
                    key: 'onChangeInternal',
                    value: function onChangeInternal(query) {
                        var selectedDataSource = _.find(this.allDataSources, { 'value': this.target.dsTarget });
                        if (selectedDataSource) {
                            this.target.datastreamID = selectedDataSource.id;
                        } else {
                            this.target.datastreamID = 0;
                        }
                        this.panelCtrl.refresh();
                    }
                }, {
                    key: 'onSensorChange',
                    value: function onSensorChange(query) {
                        this.target.dsTarget = "select metric";
                        var selectedSensor = _.find(this.allSensors, { 'value': this.target.senTarget });
                        if (selectedSensor) {
                            this.target.selectedSensorId = selectedSensor.id;
                        } else {
                            this.target.selectedSensorId = 0;
                        }
                        this.onChangeInternal();
                    }
                }, {
                    key: 'typeChanged',
                    value: function typeChanged(type) {
                        // resetting and refreshing panel if type(sensor or thing) changed
                        this.target.dsTarget = "select metric";
                        this.target.senTarget = "select a sensor";
                        this.target.thingTarget = "select a thing";
                        this.target.selectedSensorId = 0;
                        this.target.selectedThingId = 0;
                        this.onChangeInternal();
                    }
                }, {
                    key: 'getThings',
                    value: function getThings(query) {
                        var self = this;
                        return this.datasource.metricFindQuery(query || '', "/Things").then(function (result) {
                            self.allThings = result;
                            return result;
                        });
                    }
                }, {
                    key: 'onThingChange',
                    value: function onThingChange(query) {
                        this.target.dsTarget = "select metric";
                        var selectedThing = _.find(this.allThings, { 'value': this.target.thingTarget });
                        if (selectedThing) {
                            this.target.selectedThingId = selectedThing.id;
                        } else {
                            this.target.selectedThingId = 0;
                        }
                        this.onChangeInternal();
                    }
                }, {
                    key: 'getLocations',
                    value: function getLocations(query) {
                        var self = this;
                        return this.datasource.LocationFindQuery(query || '', "/Locations").then(function (result) {
                            self.allLocations = result;
                            return result;
                        });
                    }
                }, {
                    key: 'onLocationChange',
                    value: function onLocationChange(locationTarget) {
                        this.target.selectedLocation = _.find(this.allLocations, { 'value': locationTarget }).text;
                        this.panelCtrl.refresh();
                    }
                }]);

                return GenericDatasourceQueryCtrl;
            }(QueryCtrl));

            _export('GenericDatasourceQueryCtrl', GenericDatasourceQueryCtrl);

            GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
        }
    };
});
//# sourceMappingURL=query_ctrl.js.map
