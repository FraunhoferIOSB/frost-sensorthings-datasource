import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!';

import { appEvents} from 'app/core/core';
import { AlertSrv} from 'app/core/core';

export class GenericDatasourceQueryCtrl extends QueryCtrl {

    constructor($scope, $injector,alertSrv)  {

        super($scope, $injector);

        this.scope = $scope;
        this.alertSrv = alertSrv;
        this.notificationShowTime = 5000;

        this.target.panelType = this.scope.ctrl.panel.type;

        this.target.type = this.target.type || 'Sensors';

        // datasource init start
        this.target.selectedDatastreamId = this.target.selectedDatastreamId || 0;
        this.target.selectedDatastreamName = this.target.selectedDatastreamName || 'select a datastream';
        this.target.selectedDatastreamDirty = this.target.selectedDatastreamDirty || false;
        this.allDataSources  = {};
        // datasource init end

        // sensor init start
        this.target.selectedSensorId = this.target.selectedSensorId || 0;
        this.target.selectedSensorName = this.target.selectedSensorName || 'select a sensor';
        this.target.selectedSensorDirty = this.target.selectedSensorDirty || false;
        this.allSensors  = {};
        // sensor init end

        // thing init start
        this.target.selectedThingId = this.target.selectedThingId || 0;
        this.target.selectedThingName = this.target.selectedThingName || 'select a thing';
        this.target.selectedThingDirty = this.target.selectedThingDirty || false;
        this.allThings  = {};
        // thing init end


        // Location init start
        this.target.selectedLocationId = this.target.selectedLocationId || 0;
        this.target.selectedLocationName = this.target.selectedLocationName || 'select a location';
        this.target.selectedLocationDirty = this.target.selectedLocationDirty || false;
        this.allLocations = {};
        // Location init end

        this.panelCtrl.events.on('data-received', this.onDataReceived.bind(this), $scope);
        this.panelCtrl.events.on('data-error', this.onDataError.bind(this), $scope);
        // appEvents.emit('alert-success', ['Test notification sent', '']);

        if (this.target.selectedThingDirty) {
            this.alertSrv.set("Thing Not Found", this.target.selectedThingId + " is not a valid thing name", 'error', this.notificationShowTime);
        }

        if (this.target.selectedSensorDirty) {
            this.alertSrv.set("Sensor Not Found", this.target.selectedSensorId + " is not a valid sensor name", 'error', this.notificationShowTime);
        }

        if (this.target.selectedDatastreamDirty) {
            this.alertSrv.set("Datastream Not Found", this.target.selectedDatastreamName + " is not a valid datastream name", 'error', this.notificationShowTime);
        }

        if (this.target.selectedLocationDirty) {
            this.alertSrv.set("Location Not Found", this.target.selectedLocationId + " is not a valid location name", 'error', this.notificationShowTime);
        }

    }

    onDataReceived(dataList) {
        this.lastQueryError = null;
    }

    onDataError(err) {
        // console.log(err);
        this.handleQueryCtrlError(err);
    }

    handleQueryCtrlError(err) {
        if (err.query && err.query.refId && err.query.refId !== this.target.refId) {
            return;
        }

        if (err.error && err.error.data && err.error.data.error) {
            this.lastQueryError = err.error.data.error.message;
        } else if (err.error && err.error.data) {
            this.lastQueryError = err.error.data.message;
        } else if (err.data && err.data.error) {
            this.lastQueryError = err.data.error.message;
        } else if (err.data && err.data.message) {
            this.lastQueryError = err.data.message;
        } else {
            this.lastQueryError = err;
        }
    }

    getTargetTypes() {
        let targetTypes = ['Sensors', 'Things'];
        if (this.target.panelType == 'table') {
            targetTypes.push('Locations','Historical Locations');
        }
        return targetTypes;
    }

    showControlTypes(){
        return (this.target.panelType != 'grafana-worldmap-panel');
    }

    toggleEditorMode() {
        this.target.rawQuery = !this.target.rawQuery;
    }


    //sensor starts
    showSensors(){
        return this.target.type == 'Sensors' &&
                (this.target.panelType != 'grafana-worldmap-panel');
    }

    getSensors(query) {
        let self = this;
        return this.datasource.metricFindQuery((query || ''),"/Sensors",'sensor').then((result)=>{
            self.allSensors = result;
            return result;
        }).catch(this.handleQueryCtrlError.bind(this));
    }

    onSensorChange(query,selectedSensorId) {
        let sensor = _.find(this.allSensors, { 'value' : this.target.selectedSensorId });

        if(sensor) {
            this.target.selectedSensorName =sensor.text;
            this.target.selectedSensorDirty = false;
        } else {
            this.target.selectedSensorDirty = true;
            this.target.selectedDatastreamId = 0;
            this.alertSrv.set("Sensor Not Found", this.target.selectedSensorId + " is not a valid sensor name", 'error', this.notificationShowTime);
        }
        this.resetDataSource();
    }
    //sensor ends

    //datastream starts
    showDatastreams(){
        return (this.target.selectedSensorId!=0 || this.target.selectedThingId!=0) &&
                (this.target.type == "Sensors" || this.target.type == "Things") &&
                (this.target.panelType != 'grafana-worldmap-panel');
    }
// TODO: show errors below each query editor
    getDataStreams(query) {
        let self = this;
        let targetUrl = "";
        if (this.target.selectedThingDirty || this.target.selectedSensorDirty) {
            return [{
                text: "select a datastream",
                value: 0
            }];
        }
        if (this.target.type == 'Sensors') {
            targetUrl = "/Sensors("+this.target.selectedSensorId+")/Datastreams";
        } else {
            targetUrl = "/Things("+this.target.selectedThingId+")/Datastreams";
        }
        return this.datasource.metricFindQuery((query || ''),targetUrl,'datastream').then((result)=>{
            self.allDataSources = result;
            return result;
        }).catch(this.handleQueryCtrlError.bind(this));
    }

    onDataStreamChange(query) {
        if (this.target.selectedThingDirty || this.target.selectedSensorDirty) {
            return;
        }
        let datastream = _.find(this.allDataSources, { 'value' : this.target.selectedDatastreamId });
        if(datastream) {
            this.target.selectedDatastreamName = _.find(this.allDataSources, { 'value' : this.target.selectedDatastreamId }).text;
            this.target.selectedDatastreamDirty = false;
        } else {
            this.target.selectedDatastreamDirty = true;
            this.target.selectedDatastreamName = this.target.selectedDatastreamId;
            this.alertSrv.set("Datastream Not Found", this.target.selectedDatastreamName + " is not a valid datastream name", 'error', this.notificationShowTime);
        }
        this.panelCtrl.refresh();
    }

    resetDataSource(){
        this.target.selectedDatastreamId = 0;
        this.target.selectedDatastreamName = "select a datastream";
        this.panelCtrl.refresh();
    }
    //datastream ends

    typeChanged(type) {
        this.target.selectedSensorId = 0;
        this.target.selectedThingId = 0;
        this.resetDataSource();
    }

    //thing starts
    showThings(){
        return this.target.type == 'Things' || this.target.type == 'Historical Locations' || (this.target.panelType == 'grafana-worldmap-panel');
    }

    getThings(query) {
        let self = this;
        return this.datasource.metricFindQuery((query || ''),"/Things",'thing').then((result)=>{
            self.allThings = result;
            return result;
        }).catch(this.handleQueryCtrlError.bind(this));
    }

    onThingChange(query) {

        let thing = _.find(this.allThings, { 'value' : this.target.selectedThingId });
        if(thing) {
            this.target.selectedThingName = thing.text;
            this.target.selectedThingDirty = false;
        } else {
            this.target.selectedThingDirty = true;
            this.target.selectedDatastreamId = 0;
            this.alertSrv.set("Thing Not Found", this.target.selectedThingId + " is not a valid thing name", 'error', this.notificationShowTime);
        }
        this.resetDataSource();
    }
    //thing ends

    //location starts
    showLocations(){
        return this.target.type == 'Locations';
    }

    getLocations(query) {
        let self = this;
        return this.datasource.metricFindQuery((query || ''),"/Locations",'location').then((result)=>{
            self.allLocations = result;
            return result;
        }).catch(this.handleQueryCtrlError.bind(this));
    }

    onLocationChange(query) {
        // find and store the selected location name to use it as column name (refer datasource.js->transformThings())
        let location = _.find(this.allLocations, { 'value' : this.target.selectedLocationId });

        if (location) {
            this.target.selectedLocationName = location.text;
            this.target.selectedLocationDirty = false;
        } else {
            this.target.selectedLocationDirty = true;
            this.alertSrv.set("Location Not Found", this.target.selectedLocationId + " is not a valid location name", 'error', this.notificationShowTime);
        }

        this.panelCtrl.refresh();
    }
    //location ends

}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
