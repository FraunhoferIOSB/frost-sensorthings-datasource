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
  }

  getOptions(query,ogcType) {
    let metricTypes = {
      'sensors' : "/Sensors",
      'datastreams' : "/Datastreams",
    };
    this.target.ogcType = ogcType;
    this.target.ogcUrl = metricTypes[ogcType];
    return this.datasource.metricFindQuery((query || ''),metricTypes[ogcType]);
  }

  toggleEditorMode() {
    this.target.rawQuery = !this.target.rawQuery;
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}

GenericDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';
