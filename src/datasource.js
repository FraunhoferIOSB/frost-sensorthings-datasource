import _ from 'lodash';
import moment from 'moment';

import {JSONPath} from './external/jsonpath.js'; // copied with grunt
export class GenericDatasource {

    constructor(instanceSettings, $q, backendSrv, templateSrv, alertSrv, contextSrv, dashboardSrv) {

        this.type = instanceSettings.type;
        this.url = instanceSettings.url;
        this.name = instanceSettings.name;
        this.q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.withCredentials = instanceSettings.withCredentials;
        this.headers = { 'Content-Type': 'application/json' };
        this.alertSrv = alertSrv;
        this.contextSrv = contextSrv;
        this.dashboardSrv = dashboardSrv;
        this.notificationShowTime = 5000;
        this.topCount = 1000;

        if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
        }
    }

    getTimeFilter(options, key) {
        let from = options.range.from.utc().format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
        let to = options.range.to.utc().format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
        return key + ' gt ' + from + ' and ' + key + ' lt ' + to;
    }

    getFormatedId(id) {
        return (Number.isInteger(id) || !isNaN(id)) ? id : '"' + id + '"';
    }

    query(options) {

        options.targets = _.filter(options.targets, target => target.hide !== true);

        let allTargetResults = { data: [] };

        let testPromises = options.targets.map(async target => {

          let self = this;
          let subUrl = '';
          let thisTargetResult = {
            'target' : target.selectedDatastreamName.toString(),
            'datapoints' : [],
          };

          if (target.selectedDatastreamDirty) {
              return thisTargetResult;
          }

          if (target.type=="Locations") {
              if (target.selectedLocationId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"time");
              subUrl = `/Locations(${this.getFormatedId(target.selectedLocationId)})/HistoricalLocations?$filter=${timeFilter}&$expand=Things($select=name)&$select=time&$top=${this.topCount}`;
          } else if(target.type=="Things" && target.selectedThingOption=="Historical Locations") {
              if (target.selectedThingId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"time");
              subUrl = `/Things(${this.getFormatedId(target.selectedThingId)})/HistoricalLocations?$filter=${timeFilter}&$expand=Locations($select=name)&$select=time&$top=${this.topCount}`;
          } else if(target.type=="Things" && target.selectedThingOption=="Last Location Coordinates") {
              if (target.selectedThingId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"time");
              subUrl = `/Things(${this.getFormatedId(target.selectedThingId)})/HistoricalLocations?$filter=${timeFilter}&$expand=Locations($select=name,location)&$select=time&$top=1`;
          } else {
              if (target.selectedDatastreamId == 0) return thisTargetResult;
              let timeFilter = this.getTimeFilter(options,"phenomenonTime");
              subUrl = `/Datastreams(${this.getFormatedId(target.selectedDatastreamId)})/Observations?$filter=${timeFilter}&$select=phenomenonTime,result&$orderby=phenomenonTime desc&$top=${this.topCount}`;
          }
          console.log("subUrl:", subUrl);

          let transformedResults = [];
          let hasNextLink = true;
          let fullUrl = this.url + subUrl;

          while(hasNextLink) {
            let response = await this.doRequest({
              url: fullUrl,
              method: 'GET'
            });

            hasNextLink = _.has(response.data, "@iot.nextLink");
            if (hasNextLink) {
              subUrl = subUrl.split('?')[0];
              fullUrl = this.url + subUrl + "?" + response.data["@iot.nextLink"].split('?')[1];
            }

            if (target.type=='Locations') {
              transformedResults = transformedResults.concat(self.transformThings(target, response.data.value));
            } else if (target.type=="Things" && target.selectedThingOption=="Historical Locations") {
              transformedResults = transformedResults.concat(self.transformLocations(target,response.data.value));
            } else if (target.type=="Things" && target.selectedThingOption=="Last Location Coordinates"){
                // stop here, as we only need 1 value
                return self.transformLocationsCoordinates(target, response.data.value);
            } else {
              transformedResults = transformedResults.concat(self.transformDataSource(target,response.data.value));
            }
          }

            thisTargetResult.datapoints = transformedResults;

            return thisTargetResult;

        });

        return Promise.all(testPromises).then(function (values) {
            allTargetResults.data = values;
            return allTargetResults;
        });

    }

    transformLocationsCoordinates(target, value) {
        if (!value) {
            console.error('Invalid location data for Thing ' + target.selectedThingId);
            return [];
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                console.log('No location for Thing ' + target.selectedThingId);
                return [];
            } else {
                value = value[0];
            }
        }

        let locationName = value.Locations[0].name;
        let location = value.Locations[0].location;
        let coordinates;
        if (location.type === 'Feature' && location.geometry.type === 'Point') {
            coordinates = location.geometry.coordinates;
        } else if (location.type === 'Point') {
            coordinates = location.coordinates;
        } else {
            console.error('Unsupported location type for Thing ' + target.selectedThingId + '. Expected GeoJSON Feature.Point or Point.');
            return [];
        }

        const metricColumn = 1; // this determines the size and color of the circle
        return {
          columnMap: {},
          columns: [
            {text: "Time", type: "time"},
            {text: "longitude"},
            {text: "latitude"},
            {text: "metric"},
            {text: "name"}
          ],
          meta: {},
          refId: target.refId,
          rows: [
            [value.time, coordinates[0], coordinates[1], metricColumn, target.selectedThingName]
          ],
          type: "table"
        }
    }

    transformDataSource(target, values) {
        let self = this;

        if (self.isOmObservationType(target.selectedDatastreamObservationType) && _.isEmpty(target.jsonQuery)) {
            return [];
        }

        let datapoints = _.map(values, function (value, index) {

            if (self.isOmObservationType(target.selectedDatastreamObservationType)) {

                var result = new JSONPath({ json: value.result, path: target.jsonQuery });

                if (target.panelType === 'table' || target.panelType === 'singlestat') {
                    result = (typeof result[0] === 'object') ? JSON.stringify(result[0]) : result[0];
                    return [result, parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                } else {
                    return [result[0], parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                }

            } else {

                if (target.panelType === 'table') {
                    return [_.isEmpty(value.result.toString()) ? '-' : value.result, parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                } else {
                    return [value.result, parseInt(moment(value.phenomenonTime, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
                }

            }
        });

        datapoints = _.filter(datapoints, function (datapoint) {
            return (typeof datapoint[0] === 'string' || typeof datapoint[0] === 'number' || (Number(datapoint[0]) === datapoint[0] && datapoint[0] % 1 !== 0));
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

    transformThings(target, values) {

        return _.map(values, value => {
            return [_.isEmpty(value.Thing.name) ? '-' : value.Thing.name, parseInt(moment(value.time, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))];
        });

    }

    transformLocations(target, values) {
        let result = [];
        _.forEach(values, function (value) {
            _.forEach(value.Locations, function (location) {
                result.push([_.isEmpty(location.name) ? '-' : location.name, parseInt(moment(value.time, 'YYYY-MM-DDTHH:mm:ss.SSSZ').format('x'))]);
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
                return { status: 'success', message: 'Data source is working', title: 'Success' };
            }
        });
    }

    async metricFindQuery(query, subUrl, type) {

        let placeholder = 'select a sensor';

        if (type === 'thing') {
            placeholder = 'select a thing';
        } else if (type === 'datastream') {
            placeholder = 'select a datastream';
        } else if (type === 'location') {
            placeholder = 'select a location';
        }

        let transformedMetrics = [{
            text: placeholder,
            value: 0,
            type: ''
        }];


        let hasNextLink = true;
        let selectParam = (type === 'datastream') ? '$select=name,id,observationType' : '$select=name,id';
        let fullUrl = this.url + subUrl + `?$top=${this.topCount}&${selectParam}`;

        while (hasNextLink) {
            let result = await this.doRequest({
                url: fullUrl,
                method: 'GET',
            });
            hasNextLink = _.has(result.data, '@iot.nextLink');
            if (hasNextLink) {
                fullUrl = this.url + subUrl + '?' + result.data['@iot.nextLink'].split('?')[1];
            }
            transformedMetrics = transformedMetrics.concat(this.transformMetrics(result.data.value, type));
        }

        return transformedMetrics;
    }

    transformMetrics(metrics, type) {

        let transformedMetrics = [];

        _.forEach(metrics, (metric, index) => {
            transformedMetrics.push({
                text: metric.name + ' ( ' + metric['@iot.id'] + ' )',
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