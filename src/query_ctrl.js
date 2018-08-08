import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'
export class GenericDatasourceQueryCtrl extends QueryCtrl {

    constructor($scope, $injector)  {
        super($scope, $injector);

        this.scope = $scope;
        this.target.panelType = this.scope.ctrl.panel.type;

        this.target.type = this.target.type || 'Sensors';

        // datasource init start
        this.target.selectedDatastreamId = this.target.selectedDatastreamId || 0;
        this.target.selectedDatastreamName = this.target.selectedDatastreamName || 'select a datastream';
        this.allDataSources  = {};
        // datasource init end

        // sensor init start
        this.target.selectedSensorId = this.target.selectedSensorId || 0;
        this.target.selectedSensorName = this.target.selectedSensorName || 'select a sensor';
        this.allSensors  = {};
        // sensor init end

        // thing init start
        this.target.selectedThingId = this.target.selectedThingId || 0;
        this.target.selectedThingName = this.target.selectedThingName || 'select a thing';
        this.allThings  = {};
        // thing init end


        // Location init start
        this.target.selectedLocationId = this.target.selectedLocationId || 0;
        this.target.selectedLocationName = this.target.selectedLocationName || 'select a location';
        this.allLocations = {};
        // Location init end
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
        });
    }

    onSensorChange(query,selectedSensorId) {
        this.target.selectedSensorName =_.find(this.allSensors, { 'value' : this.target.selectedSensorId }).text;
        this.resetDataSource();
    }
    //sensor ends

    //datastream starts
    showDatastreams(){
        return (this.target.selectedSensorId!=0 || this.target.selectedThingId!=0) &&
                (this.target.type == "Sensors" || this.target.type == "Things") &&
                (this.target.panelType != 'grafana-worldmap-panel');
    }

    getDataSources(query) {
        let self = this;
        let targetUrl = "";
        if (this.target.type == 'Sensors') {
            targetUrl = "/Sensors("+this.target.selectedSensorId+")/Datastreams";
        } else {
            targetUrl = "/Things("+this.target.selectedThingId+")/Datastreams";
        }
        return this.datasource.metricFindQuery((query || ''),targetUrl,'datastream').then((result)=>{
            self.allDataSources = result;
            return result;
        });
    }

    onDataSourceChange(query) {
        this.target.selectedDatastreamName =_.find(this.allDataSources, { 'value' : this.target.selectedDatastreamId }).text;
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
        });
    }

    onThingChange(query) {
        this.target.selectedThingName =_.find(this.allThings, { 'value' : this.target.selectedThingId }).text;
        this.resetDataSource();
    }
    //thing ends

    //location starts
    showLocations(){
        return this.target.type == 'Locations';
    }

    getLocations(query) {
        return this.datasource.metricFindQuery((query || ''),"/Locations",'location').then(((result)=>{
            this.allLocations = result;
            return result;
        }).bind(this));
    }

    onLocationChange(query) {
        // find and store the selected location name to use it as column name (refer datasource.js->transformThings())
        this.target.selectedLocationName =_.find(this.allLocations, { 'value' : this.target.selectedLocationId }).text;
        this.panelCtrl.refresh();
    }
    //location ends

}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
