import _ from "lodash";
import moment from "moment";

import {JSONPath} from './external/jsonpath.js'; // copied with grunt

export class GenericDatasource {

    constructor(instanceSettings, $q, backendSrv, templateSrv,alertSrv, contextSrv, dashboardSrv) {

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.withCredentials = instanceSettings.withCredentials;
        this.headers = {'Content-Type': 'application/json'};
        this.alertSrv = alertSrv;
        this.contextSrv = contextSrv;
        this.dashboardSrv = dashboardSrv;
        this.notificationShowTime = 5000;
        this.topCount = 1000;
        if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
        }
    }

    getTimeFilter(options,key){
        let from = options.range.from.utc().format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        let to = options.range.to.utc().format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        return key + " gt " + from + " and "+ key + " lt " + to;
    }

    getFormatedId(id) {
        return (Number.isInteger(id) || !isNaN(id)) ? id : "'"+id+"'";
    }

    query(options) {

        options.targets = _.filter(options.targets, target => target.hide != true);

        let allPromises = [];

        if (_.find(options.targets, {"panelType" : 'grafana-worldmap-panel'})) {
            _.forEach(options.targets,function(target,targetIndex){
                let self = this;
                let suburl = '';

                if (target.selectedThingId == 0) return;
                let timeFilter = this.getTimeFilter(options,"time");
                suburl = '/Things(' + this.getFormatedId(target.selectedThingId) + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Locations($select=name,location)&$top=1&$select=time';

                allPromises.push(this.doRequest({
                    url: this.url + suburl,
                    method: 'GET'
                }).then(function(response){
                    return self.transformLocationsCoordinates(target,targetIndex,response.data.value);
                }));

            }.bind(this));

            return Promise.all(allPromises).then(function(values) {
                let allCoordinates = [];
                _.forEach(values,function(value){
                    allCoordinates = allCoordinates.concat(value);
                });
                return {data: allCoordinates};
            });
        }

        let self = this;
        let allTargetResults = {data:[]};

        let testPromises = options.targets.map(async target => {

          let self = this;
          let suburl = '';
          let thisTargetResult = {
            'target' : target.selectedDatastreamName.toString(),
            'datapoints' : [],
          };

          if (target.selectedDatastreamDirty) {
              return thisTargetResult;
          }

          if (_.isEqual(target.type,"Locations")) {
              if (target.selectedLocationId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"time");
              suburl = '/Locations(' + this.getFormatedId(target.selectedLocationId) + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Things($select=name)&$select=time';
          } else if(_.isEqual(target.type,"Historical Locations")){
              if (target.selectedThingId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"time");
              suburl = '/Things(' + this.getFormatedId(target.selectedThingId) + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Locations($select=name)&$select=time';
          } else {
              if (target.selectedDatastreamId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"phenomenonTime");
              suburl = '/Datastreams('+this.getFormatedId(target.selectedDatastreamId)+')/Observations?'+ `$filter=${timeFilter}&$select=phenomenonTime,result`;
          }

          let transformedResults = [];
          let hasNextLink = true;
          let fullUrl = this.url + suburl + `&$top=${this.topCount}`;

          while(hasNextLink) {
            let response = await this.doRequest({
              url: fullUrl,
              method: 'GET'
            });

            hasNextLink = _.has(response.data,"@iot.nextLink");
            if (hasNextLink) {
              suburl = suburl.split('?')[0];
              fullUrl = this.url + suburl + "?" + response.data["@iot.nextLink"].split('?')[1];
            }

            if (_.isEqual(target.type,"Locations")) {
                transformedResults = transformedResults.concat(self.transformThings(target,response.data.value));
            } else if(_.isEqual(target.type,"Historical Locations")){
                transformedResults = transformedResults.concat(self.transformLocations(target,response.data.value));
            } else {
                transformedResults = transformedResults.concat(self.transformDataSource(target,response.data.value));
            }
          }

          thisTargetResult.datapoints = transformedResults

          return thisTargetResult;

        });

        return Promise.all(testPromises).then(function(values) {
          allTargetResults.data = values;
          return allTargetResults;
        });

    }

    transformLocationsCoordinates(target,targetIndex,value){
        let result = [];
        let timestamp = "";
        let lastLocation = false;
        let lastLocationValue = "";

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
          let lastLocation = value.Locations[0];
          result.push({
            "key": lastLocation.name,
            "latitude": lastLocation.location.coordinates[0],
            "longitude": lastLocation.location.coordinates[1],
            "name": lastLocation.name + " | " +target.selectedThingName + " | " + moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('YYYY-MM-DD HH:mm:ss.SSS'),
            "value": targetIndex+1,
          });
        }
        return result;
      }

    transformDataSource(target,values){
        let self = this;

        if (self.isOmObservationType(target.selectedDatastreamObservationType) && _.isEmpty(target.jsonQuery)) {
          return [];
        }

        let datapoints = _.map(values,function(value,index){

            if (self.isOmObservationType(target.selectedDatastreamObservationType)) {

                var result = JSONPath({json: value.result, path: target.jsonQuery});

                if (target.panelType == "table" || target.panelType == "singlestat") {
                    result = (typeof result[0]==="object") ? JSON.stringify(result[0]) : result[0];
                    return [result,parseInt(moment(value.phenomenonTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                } else {
                    return [result[0],parseInt(moment(value.phenomenonTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                }

            } else {

                if (target.panelType == "table") {
                    return [_.isEmpty(value.result.toString()) ? '-' : value.result ,parseInt(moment(value.phenomenonTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                } else {
                    return [value.result,parseInt(moment(value.phenomenonTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                }

            }
        });

        datapoints = _.filter(datapoints, function(datapoint) {
             return (typeof datapoint[0] === "string" || typeof datapoint[0] === "number" || (Number(datapoint[0]) === datapoint[0] && datapoint[0] % 1 !== 0));
         });

         return datapoints;
    }

    isOmObservationType(type) {
        if (_.isEmpty(type)) {
            return false;
        }

        if (!type.includes('om_observation')) {
            return false;
        }

        return true;
    }

    transformThings(target,values){

      return _.map(values,value => {
          return [_.isEmpty(value.Thing.name) ? '-' : value.Thing.name,parseInt(moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
      })

    }

    transformLocations(target,values) {
        let result = [];
        _.forEach(values,function(value) {
            _.forEach(value.Locations,function(location) {
                result.push([_.isEmpty(location.name) ? '-' : location.name,parseInt(moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))]);
            });
        });
        return result;
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

    async metricFindQuery(query,suburl,type) {

      let placeholder = "select a sensor";

      if (type == "thing") {
          placeholder = "select a thing";
      } else if (type == "datastream") {
          placeholder = "select a datastream";
      } else if (type == "location") {
          placeholder = "select a location";
      }

      let transformedMetrics = [{
          text: placeholder,
          value: 0,
          type: ''
      }];


      let hasNextLink = true;
      let selectParam = (type == "datastream") ? "$select=name,id,observationType" : "$select=name,id";
      let fullUrl = this.url + suburl + `?$top=${this.topCount}&${selectParam}`;

      while(hasNextLink) {
        let result = await this.doRequest({
            url: fullUrl,
            method: 'GET',
        });
        hasNextLink = _.has(result.data,"@iot.nextLink");
        if (hasNextLink) {
          fullUrl = this.url + suburl + "?" + result.data["@iot.nextLink"].split('?')[1];
        }
        transformedMetrics = transformedMetrics.concat(this.transformMetrics(result.data.value,type));
      }

      return transformedMetrics;
    }

    transformMetrics(metrics,type) {

        let transformedMetrics = [];

        _.forEach(metrics, (metric,index) => {
            transformedMetrics.push({
                text: metric.name + " ( " + metric['@iot.id'] + " )",
                value: metric['@iot.id'],
                type: metric['observationType']
            });
        });

        return transformedMetrics;
    }

    doRequest(options) {
        options.withCredentials = this.withCredentials;
        options.headers = this.headers;

        return this.backendSrv.datasourceRequest(options);

    }
}
