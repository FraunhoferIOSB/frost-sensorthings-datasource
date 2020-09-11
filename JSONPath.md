# JSONPATH Examples

When a DataStream has observationType set to [OM_Observation](http://docs.opengeospatial.org/is/15-078r6/15-078r6.html#table_12),
the metric configuration will include a field to set a JSONPath expression.

The JSONPath expression is applied to the value of Observation's `value.result`.

## Examples

### Object
Observations:
```json
{
    "value": [
      {
        "phenomenonTime": "2020-07-21T09:52:05.062Z",
        "result": {
          "x": 1,
          "y": 2,
          "z": 3
        }
      },
      {
        "phenomenonTime": "2020-07-21T09:54:14.962Z",
        "result": {
          "x": 6,
          "y": 6,
          "z": 6
        }
      }
    ]
}
```

JSONPath to select `x` values:
```
$.x
```

### Object with array of objects
Observations:
```json
{
    "value": [
      {
        "phenomenonTime": "2020-07-21T09:52:05.062Z",
        "result": {
          "entries":[
            {
              "name":"x",
              "measurement":10
            },
            {
              "name":"y",
              "measurement":2
            }
          ]
        }
      },
      {
        "phenomenonTime": "2020-07-21T09:54:14.962Z",
        "result": {
          "entries":[
            {
              "name":"x",
              "measurement":20
            },
            {
              "name":"y",
              "measurement":2
            }
          ]
        }
      }
    ]
}
```

JSONPath to select `measurement` values of objects with `x` name:
```
$.entries[?(@.name=='x')].measurement
```
