import {QueryCtrl} from 'app/plugins/sdk';
import './css/query-editor.css!'

export class GenericDatasourceQueryCtrl extends QueryCtrl {

  constructor($scope, $injector)  {
    super($scope, $injector);

    this.scope = $scope;
    this.target.target = this.target.target || 'select metric';
    this.target.type = this.target.type || 'timeserie';
    this.target.ogcType = this.target.ogcType || "";
    this.target.ogcUrl = this.target.ogcUrl || "";
    this.allDataSources  = {};
  }

  sleep(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay){

    };
  }

  getOptions(query,ogcType) {
    console.log("getOptions");
    // this.sleep(2000);
    // console.log("slept for 2 seconds");
    let metricTypes = {
      'sensors' : "/Sensors",
      'datastreams' : "/Datastreams",
    };
    let self = this;
    this.target.ogcType = ogcType;
    this.target.ogcUrl = metricTypes[ogcType];
    return this.datasource.metricFindQuery((query || ''),metricTypes[ogcType]).then((result)=>{
      // console.log(this.target.target);
      self.allDataSources = result;
      // console.log(result);
      return result;
    });
  }

  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  onChangeInternal(query) {
    // console.log(query);
    console.log("internal changed");
    console.log(this.allDataSources);
    // this.target.target = "changed" ;
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
