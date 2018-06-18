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
        let from = options.range.from.format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        let to = options.range.to.format("YYYY-MM-DDTHH:mm:ss.SSS")+"Z";
        return key + " gt " + from + " and "+ key + " lt " + to;
    }

    sleep(delay) {
        var start = new Date().getTime();
        while (new Date().getTime() < start + delay){

        };
    }

    query(options) {

//         let allCoordinates = [ { "key": "fraunhofer cafeteria", "latitude": 50.7495107, "longitude": 7.1948428, "name": "fraunhofer cafeteria",value:2 }, { "key": "charleroi", "latitude": 50.4108, "longitude": 4.4446, "name": "Charleroi",value:3}, { "key": "frankfurt", "latitude": 50.110924, "longitude": 8.682127, "name": "Frankfurt", }, { "key": "london", "latitude": 51.503399, "longitude": -0.119519, "name": "London", }, { "key": "paris", "latitude": 48.864716, "longitude": 2.349014, "name": "Paris" } ];
// return {data: allCoordinates};
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


        // /Datastreams(16)/Observations?$filter=phenomenonTime%20gt%202018-03-14T16:00:12.749Z%20and%20phenomenonTime%20lt%202018-03-14T17:00:12.749Z&$select=result,phenomenonTime

        _.forEach(options.targets,function(target){
            let self = this;
            let suburl = '';

            if (_.isEqual(target.type,"Location(HL)")) {
                if (target.selectedLocationId == 0) return;
                let timeFilter = this.getTimeFilter(options,"time");
                suburl = '/Locations(' + target.selectedLocationId + ')/HistoricalLocations?'+'$filter='+timeFilter+'&$expand=Things';
            } else if(_.isEqual(target.type,"Thing(HL)")){
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
                if (_.isEqual(target.type,"Location(HL)")) {
                    transformedResults = self.transformThings(target,response.data.value);
                } else if(_.isEqual(target.type,"Thing(HL)")){
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
        _.forEach(values,function(value,index) {
            _.forEach(value.Locations,function(location,locationIndex) {
                timestamp = moment(value.time,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('YYYY-MM-DD HH:mm:ss.SSS');
                lastLocationValue = (!lastLocation) ? ("(Last seen)") : "";
                result.push({
                            "key": location.name,
                            "latitude": location.location.coordinates[0],
                            "longitude": location.location.coordinates[1],
                            "name": location.name + " | " +target.selectedThingName + " | " + timestamp + lastLocationValue,
                            "value": targetIndex+1,
                        });
                if (index == 0 && locationIndex == 0 ) {
                    lastLocation = true;
                }
            });
        });
        return result;
    }

    transformDataSource(target,values){
        return {
            'target' : target.selectedDatastreamName.toString(),
            'datapoints' : _.map(values,function(value,index){
                if (target.panelType == "table") {
                    return [_.isEmpty(value.result.toString()) ? '-' : value.result ,parseInt(moment(value.resultTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
                }
                // graph panel type expects the value in float/double/int and not as strings
                return [value.result,parseInt(moment(value.resultTime,"YYYY-MM-DDTHH:mm:ss.SSSZ").format('x'))];
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

    buildQueryParameters(options) {
        //remove placeholder targets
        options.targets = _.filter(options.targets, target => {
            return target.dsTarget !== 'select metric';
        });

        var targets = _.map(options.targets, target => {
            return {
                target: this.templateSrv.replace(target.dsTarget.toString(), options.scopedVars, 'regex') ,
                refId: target.refId,
                hide: target.hide,
                type: target.type || 'timeserie'
            };
        });

        options.targets = targets;
        return options;
    }
}
