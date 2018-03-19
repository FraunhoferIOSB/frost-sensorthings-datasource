import _ from "lodash";
import moment from "moment";

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.withCredentials = instanceSettings.withCredentials;
    this.headers = {'Content-Type': 'application/json'};
    if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
      this.headers['Authorization'] = instanceSettings.basicAuth;
    }
  }

  query(options) {
    
    let allPromises = [];
    let allTargetResults = {data:[]};
    let self = this;

    _.forEach(options.targets,function(target){
      allPromises.push(this.doRequest({
        url: this.url + '/Datastreams('+target.target.toString()+')/Observations',
        // data: query,
        method: 'GET'
      }).then(function(response){
        let filtered = _.map(response.data.value,function(value,index){
          return [value.result,moment(new Date(value.resultTime)).format('x')];
        });
        return {
          'target' : target.target.toString(),
          'datapoints' : filtered
        };
      }));

    }.bind(this));

    return Promise.all(allPromises).then(function(values) {
      _.forEach(values,function(value){
        allTargetResults.data.push(value);
      });
      return allTargetResults;
    });
  }

  testDatasource() {
    return this.doRequest({
      url: this.url,
      method: 'GET',
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  annotationQuery(options) {
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
    }).then(result => {
      return result.data;
    });
  }

  metricFindQuery(query,suburl) {
    var interpolated = {
        target: this.templateSrv.replace(query, null, 'regex')
    };

    return this.doRequest({
      url: this.url + suburl,
      data: interpolated,
      method: 'GET',
    }).then(this.mapToTextValue);
  }

  mapToTextValue(result) {
    return _.map(result.data.value, (data,index) => {
      return {
        text: data.name,
        value: data['@iot.id']
      };
    });
    // return _.map(result.data, (d, i) => {
    //   if (d && d.text && d.value) {
    //     return { text: d.text, value: d.value };
    //   } else if (_.isObject(d)) {
    //     return { text: d, value: i};
    //   }
    //   return { text: d, value: d };
    // });
  }

  doRequest(options) {
    options.withCredentials = this.withCredentials;
    options.headers = this.headers;

    return this.backendSrv.datasourceRequest(options);

  }

  buildQueryParameters(options) {
    //remove placeholder targets
    options.targets = _.filter(options.targets, target => {
      return target.target !== 'select metric';
    });

    var targets = _.map(options.targets, target => {
      return {
        target: this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
        refId: target.refId,
        hide: target.hide,
        type: target.type || 'timeserie'
      };
    });

    options.targets = targets;
    return options;
  }
}
