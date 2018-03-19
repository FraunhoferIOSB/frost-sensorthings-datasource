"use strict";

System.register(["lodash", "moment"], function (_export, _context) {
  "use strict";

  var _, moment, _createClass, GenericDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_moment) {
      moment = _moment.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export("GenericDatasource", GenericDatasource = function () {
        function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
          _classCallCheck(this, GenericDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.withCredentials = instanceSettings.withCredentials;
          this.headers = { 'Content-Type': 'application/json' };
          if (typeof instanceSettings.basicAuth === 'string' && instanceSettings.basicAuth.length > 0) {
            this.headers['Authorization'] = instanceSettings.basicAuth;
          }
        }

        _createClass(GenericDatasource, [{
          key: "query",
          value: function query(options) {

            console.log(options);
            // var query = this.buildQueryParameters(options);
            // query.targets = query.targets.filter(t => !t.hide);
            //
            // if (query.targets.length <= 0) {
            //   return this.q.when({data: []});
            // }
            //
            var allPromises = [];
            var allTargetResults = { data: [] };
            var self = this;
            var results = [1, 2, 3];

            _.forEach(options.targets, function (target) {
              var targetid = target.target;
              allPromises.push(this.doRequest({
                url: this.url + '/Datastreams(' + targetid.toString() + ')/Observations',
                // data: query,
                method: 'GET'
              }).then(function (response) {
                // console.log(response.data.value);
                // let values = response.data.value;
                var filtered = _.map(response.data.value, function (value, index) {
                  return [value.result, moment(new Date(value.resultTime)).format('x')];
                });
                // response.data = {
                //   'target' : 18,
                //   'datapoints' : filtered
                // };
                return {
                  'target': 18,
                  'datapoints': filtered
                };
              }));
            }.bind(this));

            return Promise.all(allPromises).then(function (values) {
              // console.log(allTargetResults);
              _.forEach(values, function (value) {
                // console.log(self.allTargetResults);
                allTargetResults.data.push(value);
              });
              console.log(allTargetResults);
              return allTargetResults;
              // console.log("resolved all promises");
              // console.log(allTargetResults);
              // return allTargetResults;
            });
            // console.log(randdsf);
            // console.log(allTargetResults);
            // console.log(allPromises);
            // return result;
          }
        }, {
          key: "testDatasource",
          value: function testDatasource() {
            return this.doRequest({
              url: this.url,
              method: 'GET'
            }).then(function (response) {
              if (response.status === 200) {
                return { status: "success", message: "Data source is working", title: "Success" };
              }
            });
          }
        }, {
          key: "annotationQuery",
          value: function annotationQuery(options) {
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
            }).then(function (result) {
              return result.data;
            });
          }
        }, {
          key: "metricFindQuery",
          value: function metricFindQuery(query, suburl) {
            var interpolated = {
              target: this.templateSrv.replace(query, null, 'regex')
            };

            return this.doRequest({
              url: this.url + suburl,
              data: interpolated,
              method: 'GET'
            }).then(this.mapToTextValue);
          }
        }, {
          key: "mapToTextValue",
          value: function mapToTextValue(result) {
            return _.map(result.data.value, function (data, index) {
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
        }, {
          key: "doRequest",
          value: function doRequest(options) {
            options.withCredentials = this.withCredentials;
            options.headers = this.headers;

            return this.backendSrv.datasourceRequest(options);
          }
        }, {
          key: "buildQueryParameters",
          value: function buildQueryParameters(options) {
            var _this = this;

            //remove placeholder targets
            options.targets = _.filter(options.targets, function (target) {
              return target.target !== 'select metric';
            });

            var targets = _.map(options.targets, function (target) {
              return {
                target: _this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
                refId: target.refId,
                hide: target.hide,
                type: target.type || 'timeserie'
              };
            });

            options.targets = targets;
            return options;
          }
        }]);

        return GenericDatasource;
      }());

      _export("GenericDatasource", GenericDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
