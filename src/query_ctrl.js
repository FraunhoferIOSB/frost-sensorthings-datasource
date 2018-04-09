import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'
export class GenericDatasourceQueryCtrl extends QueryCtrl {

    constructor($scope, $injector)  {
        super($scope, $injector);

        this.scope = $scope;

        this.target.type = this.target.type || 'timeserie';

        this.target.senTarget = this.target.senTarget || 'select sensor';
        this.allSensors  = {};
        this.target.selectedSensorId = this.target.selectedSensorId || 0;

        this.target.dsTarget = this.target.dsTarget || 'select metric';
        this.target.datastreamID = this.target.datastreamID || 0;
        this.allDataSources  = {};
    }

    sleep(delay) {
        var start = new Date().getTime();
        while (new Date().getTime() < start + delay){

        };
    }


    getOptions(query) {
        let self = this;
        return this.datasource.metricFindQuery((query || ''),"/Sensors("+this.target.selectedSensorId+")/Datastreams").then((result)=>{
            self.allDataSources = result;
            return result;
        });
    }

    getSensors(query) {
        let self = this;
        return this.datasource.metricFindQuery((query || ''),"/Sensors").then((result)=>{
            self.allSensors = result;
            return result;
        });
    }

    toggleEditorMode() {
        this.target.rawQuery = !this.target.rawQuery;
    }

    onChangeInternal(query) {
        let selectedDataSource =_.find(this.allDataSources, { 'value' : this.target.dsTarget });
        if (selectedDataSource) {
            this.target.datastreamID = selectedDataSource.id ;
        } else {
            this.target.datastreamID = 0 ;
        }
        this.panelCtrl.refresh();
    }

    onSensorChange(query) {
        this.target.dsTarget = "select metric";
        let selectedSensor =_.find(this.allSensors, { 'value' : this.target.senTarget });
        if (selectedSensor) {
            this.target.selectedSensorId = selectedSensor.id ;
        } else {
            this.target.selectedSensorId = 0 ;
        }
        this.onChangeInternal();
    }
}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
