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

                    _this.target.type = _this.target.type || 'Sensors';

                    // datasource init start
                    _this.target.selectedDatastreamId = _this.target.selectedDatastreamId || 0;
                    _this.target.selectedDatastreamName = _this.target.selectedDatastreamName || 'select a datastream';
                    _this.allDataSources = {};
                    // datasource init end

                    // sensor init start
                    _this.target.selectedSensorId = _this.target.selectedSensorId || 0;
                    _this.target.selectedSensorName = _this.target.selectedSensorName || 'select a sensor';
                    _this.allSensors = {};
                    // sensor init end

                    // thing init start
                    _this.target.selectedThingId = _this.target.selectedThingId || 0;
                    _this.target.selectedThingName = _this.target.selectedThingName || 'select a thing';
                    _this.allThings = {};
                    // thing init end


                    // Location init start
                    _this.target.selectedLocationId = _this.target.selectedLocationId || 0;
                    _this.target.selectedLocationName = _this.target.selectedLocationName || 'select a location';
                    _this.allLocations = {};
                    // Location init end
                    return _this;
                }

                _createClass(GenericDatasourceQueryCtrl, [{
                    key: 'getTargetTypes',
                    value: function getTargetTypes() {
                        var targetTypes = ['Sensors', 'Things'];
                        if (this.target.panelType == 'table') {
                            targetTypes.push('Locations', 'Historical Locations');
                        }
                        return targetTypes;
                    }
                }, {
                    key: 'showControlTypes',
                    value: function showControlTypes() {
                        return this.target.panelType != 'grafana-worldmap-panel';
                    }
                }, {
                    key: 'toggleEditorMode',
                    value: function toggleEditorMode() {
                        this.target.rawQuery = !this.target.rawQuery;
                    }
                }, {
                    key: 'showSensors',
                    value: function showSensors() {
                        return this.target.type == 'Sensors' && this.target.panelType != 'grafana-worldmap-panel';
                    }
                }, {
                    key: 'getSensors',
                    value: function getSensors(query) {
                        var self = this;
                        return this.datasource.metricFindQuery(query || '', "/Sensors", 'sensor').then(function (result) {
                            self.allSensors = result;
                            return result;
                        });
                    }
                }, {
                    key: 'onSensorChange',
                    value: function onSensorChange(query, selectedSensorId) {
                        this.target.selectedSensorName = _.find(this.allSensors, { 'value': this.target.selectedSensorId }).text;
                        this.resetDataSource();
                    }
                }, {
                    key: 'showDatastreams',
                    value: function showDatastreams() {
                        return (this.target.selectedSensorId != 0 || this.target.selectedThingId != 0) && (this.target.type == "Sensors" || this.target.type == "Things") && this.target.panelType != 'grafana-worldmap-panel';
                    }
                }, {
                    key: 'getDataSources',
                    value: function getDataSources(query) {
                        var self = this;
                        var targetUrl = "";
                        if (this.target.type == 'Sensors') {
                            targetUrl = "/Sensors(" + this.target.selectedSensorId + ")/Datastreams";
                        } else {
                            targetUrl = "/Things(" + this.target.selectedThingId + ")/Datastreams";
                        }
                        return this.datasource.metricFindQuery(query || '', targetUrl, 'datastream').then(function (result) {
                            self.allDataSources = result;
                            return result;
                        });
                    }
                }, {
                    key: 'onDataSourceChange',
                    value: function onDataSourceChange(query) {
                        this.target.selectedDatastreamName = _.find(this.allDataSources, { 'value': this.target.selectedDatastreamId }).text;
                        this.panelCtrl.refresh();
                    }
                }, {
                    key: 'resetDataSource',
                    value: function resetDataSource() {
                        this.target.selectedDatastreamId = 0;
                        this.target.selectedDatastreamName = "select a datastream";
                        this.panelCtrl.refresh();
                    }
                }, {
                    key: 'typeChanged',
                    value: function typeChanged(type) {
                        this.target.selectedSensorId = 0;
                        this.target.selectedThingId = 0;
                        this.resetDataSource();
                    }
                }, {
                    key: 'showThings',
                    value: function showThings() {
                        return this.target.type == 'Things' || this.target.type == 'Historical Locations' || this.target.panelType == 'grafana-worldmap-panel';
                    }
                }, {
                    key: 'getThings',
                    value: function getThings(query) {
                        var self = this;
                        return this.datasource.metricFindQuery(query || '', "/Things", 'thing').then(function (result) {
                            self.allThings = result;
                            return result;
                        });
                    }
                }, {
                    key: 'onThingChange',
                    value: function onThingChange(query) {
                        this.target.selectedThingName = _.find(this.allThings, { 'value': this.target.selectedThingId }).text;
                        this.resetDataSource();
                    }
                }, {
                    key: 'showLocations',
                    value: function showLocations() {
                        return this.target.type == 'Locations';
                    }
                }, {
                    key: 'getLocations',
                    value: function getLocations(query) {
                        var _this2 = this;

                        return this.datasource.metricFindQuery(query || '', "/Locations", 'location').then(function (result) {
                            _this2.allLocations = result;
                            return result;
                        }.bind(this));
                    }
                }, {
                    key: 'onLocationChange',
                    value: function onLocationChange(query) {
                        // find and store the selected location name to use it as column name (refer datasource.js->transformThings())
                        this.target.selectedLocationName = _.find(this.allLocations, { 'value': this.target.selectedLocationId }).text;
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
