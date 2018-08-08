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

    getTimeFilter(options,key){
        let from = options.range.from.utc().format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        let to = options.range.to.utc().format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        return key + " gt " + from + " and "+ key + " lt " + to;
    }

    query(options) {
        // Filter targets that are set to hidden
        options.targets = _.filter(options.targets, target => {
            return target.hide != true;
        });

        let allPromises = [];

        if (_.find(options.targets, {"panelType" : 'grafana-worldmap-panel'})) {
            _.forEach(options.targets,function(target,targetIndex){
                let self = this;
                let suburl = '';

                if (target.selectedThingId == 0) return;
                let timeFilter = this.getTimeFilter(options,"time");
                suburl = '/Things(' + target.selectedThingId + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Locations';

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

        _.forEach(options.targets,function(target){
            let self = this;
            let suburl = '';

            if (_.isEqual(target.type,"Locations")) {
                if (target.selectedLocationId == 0) return;
                let timeFilter = this.getTimeFilter(options,"time");
                suburl = '/Locations(' + target.selectedLocationId + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Things';
            } else if(_.isEqual(target.type,"Historical Locations")){
                if (target.selectedThingId == 0) return;
                let timeFilter = this.getTimeFilter(options,"time");
                suburl = '/Things(' + target.selectedThingId + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Locations';
            } else {
                if (target.selectedDatastreamId == 0) return;
                let timeFilter = this.getTimeFilter(options,"phenomenonTime");
                suburl = '/Datastreams('+target.selectedDatastreamId+')/Observations?'+'$filter='+timeFilter;
            }

            allPromises.push(this.doRequest({
                url: this.url + suburl,
                method: 'GET'
            }).then(function(response){
                let transformedResults = [];
                if (_.isEqual(target.type,"Locations")) {
                    transformedResults = self.transformThings(target,response.data.value);
                } else if(_.isEqual(target.type,"Historical Locations")){
                    transformedResults = self.transformLocations(target,response.data.value);
                } else {
                    transformedResults = self.transformDataSource(target,response.data.value);
                }
                return transformedResults;
            }));

        }.bind(this));

        return Promise.all(allPromises).then(function(values) {
            _.forEach(values,function(value){
                allTargetResults.data.push(value);
            });
            return allTargetResults;
        });
    }

    transformLocationsCoordinates(target,targetIndex,values){
        let result = [];
        let timestamp = "";
        let lastLocation = false;
        let lastLocationValue = "";
        if (values.length > 0) {
            let lastLocation = values[0].Locations[0];
            result.push({
                "key": lastLocation.name,
                "latitude": lastLocation.location.coordinates[0],
                "longitude": lastLocation.location.coordinates[1],
                "name": lastLocation.name + " | " +target.selectedThingName + " | " + moment(values[0].time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('YYYY-MM-DD HH:mm:ss.SSS'),
                "value": targetIndex+1,
            });
        }
        return result;
    }

    transformDataSource(target,values){
        return {
            'target' : target.selectedDatastreamName.toString(),
            'datapoints' : _.map(values,function(value,index){
                if (target.panelType == "table") {
                    return [_.isEmpty(value.result.toString()) ? '-' : value.result ,parseInt(moment(value.phenomenonTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                }
                // graph panel type expects the value in float/double/int and not as strings
                return [value.result,parseInt(moment(value.phenomenonTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
            })
        };
    }

    transformThings(target,values){
        return {
            'target' : target.selectedLocationName.toString(),
            'datapoints' : _.map(values,function(value,index){
                return [_.isEmpty(value.Thing.name) ? '-' : value.Thing.name,parseInt(moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
            })
        };
    }

    transformLocations(target,values) {
        let result = [];
        _.forEach(values,function(value) {
            _.forEach(value.Locations,function(location) {
                result.push([_.isEmpty(location.name) ? '-' : location.name,parseInt(moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))]);
            });
        });
        return {
            'target' : target.selectedThingName.toString(),
            'datapoints' : result
        };
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

    metricFindQuery(query,suburl,type) {
        return this.doRequest({
            url: this.url + suburl,
            method: 'GET',
        }).then((result) => {
            return this.transformMetrics(result.data.value,type);
        });
    }

    transformMetrics(metrics,type) {
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
            value: 0
        }];
        _.forEach(metrics, (metric,index) => {
            transformedMetrics.push({
                text: metric.name + " ( " + metric['@iot.id'] + " )",
                value: metric['@iot.id']
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
