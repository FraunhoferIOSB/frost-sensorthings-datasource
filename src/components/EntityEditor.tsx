import { TimeRange } from '@grafana/data';
import { Select } from '@grafana/ui';
//import { getPropertiesForVariant } from '@grafana/ui/components/Button';
//import React, { useState, useEffect } from 'react';
import React, { useState } from 'react';
import { JsonDataSource } from 'datasource';
//import { lastIndexOf } from 'lodash';
import { cloneDeep } from 'lodash';

interface Props {
  entity: string;
  specifics: string;
  range?: TimeRange;
  datasource: JsonDataSource;

  onEntityChange: (entity: string) => void;
  onSpecificsChange: (specifics: string) => void;
}

export const EntityEditor = ({ entity, specifics, onEntityChange, onSpecificsChange, datasource }: Props) => {
  //const [data, setData] = useState<any[]>([[{ name: 'noData', url: 'noURL' }]]);
  const [data] = useState<any[]>([[{ name: 'noData', url: 'noURL' }]]);
  const [selections, updateSelection] = useState<String[]>(['noData']);
  /*const fetchData = async (path: string, override: boolean) => {
    try {
      //setData(await datasource.sensorThingsQuery("/"));
      if (override) {
        setData([
          await datasource.sensorThingsQuery(path).then(function (value) {
            return value.value;
          }),
        ]);
      } else {
        setData([
          data,
          ...(await datasource.sensorThingsQuery(path).then(function (value) {
            return value.value;
          })),
        ]);
      }
    } catch (error) {
      console.log('failed getting data from OGC Server', error);
    }
  };
  /*useEffect(() => {
    //Fetch Data on first Render
    fetchData('/', true);
    //console.log('Fetched data' + JSON.stringify(data));
  }, []);
  useEffect(() => {
    //Selection has Changed
    console.log('Selection has changed');
    console.log(selections);
    if (selections[0] !== 'noData') {
      fetchData('/' + selections.join('/'), false);
      console.log('fetched selection' + selections.join('/'));
    }
  }, [selections]);
  useEffect(() => {
    console.log(JSON.stringify(data[data.length - 1]));
  }, [data]);

  /* const updateFieldChanged = async (index: number, queryString: string, datasource: JsonDataSource) => {
    //console.log('index:' + index);
    let newArray = cloneDeep(data); //copying old data
    newArray[0] =
    console.log(newArray);
    setData(await Promise.all(newArray));
    console.log(await Promise.all(data));
  }; */
  /*   const selectionChanged = (index: number, selected: any) => {
    //console.log('Updateindex' + index);
    let newArray = cloneDeep(selections);
    newArray[index] = selected;
    updateSelection(newArray);
  }; */

  //selectionChanged(1, 1);
  //console.log(selections);
  //console.log('Generating');

  // const expandOn TODO: */

  /* const handleChange = (f: SelectableValue) => {
    const fetchData = async () => {
      let newData = [...data];
      setData2((await datasource.sensorThingsQuery('/' + f.label)).value);
      //setData2([{ value: { '@iot.id': '1' }, label: 'TEST' }]);
      console.log(data);
      console.log(data2);
    };
    fetchData();
    console.log(data2!);
    return;
  }; */

  const childToParent = (childdata: any, childdataIndex: any) => {
    let newArray = cloneDeep(selections);
    newArray[childdataIndex] = childdata.split('/').pop();
    updateSelection(newArray);
  };

  return (
    <div>
      {(data[0] === undefined || data[0].name === 'noData') && <div>Loading spinner goes here</div>}
      {!(data[0] === undefined) && !(data[0].name === 'noData') && (
        <div>
          <Dropdown index={0} childToParent={childToParent} dataToChild={data} />
          <Dropdown index={1} childToParent={childToParent} dataToChild={data} />
          <Dropdown index={2} childToParent={childToParent} dataToChild={data} />
        </div>
      )}
    </div>
    /*  {JSON.stringify(selections)} */
  );
};
function Dropdown(props: any) {
  if (
    props.dataToChild.length - 1 > props.index ||
    props.dataToChild[props.index] === null ||
    props.dataToChild[props.index] === undefined
  ) {
    return null;
  }
  if (props.dataToChild[props.index][0].name !== null && props.dataToChild[props.index][0].name !== undefined) {
    console.log('index1' + props.index + JSON.stringify(props.dataToChild[props.index]));
    return (
      <Select
        options={props.dataToChild[props.index].map((t: any) => ({ value: t.url, label: t.name }))}
        onChange={(v) => props.childToParent(v.value, props.index)}
      />
    );
  } else if (
    props.dataToChild[props.index][0]['@iot.id'] !== null &&
    props.dataToChild[props.index]?.[0]['@iot.id'] !== undefined
  ) {
    console.log('index2' + props.index + JSON.stringify(props.dataToChild[props.index]));
    return (
      <Select
        options={props.dataToChild[props.index].map((t: any) => ({ value: t['@iot.id'], label: t['@iot.selfLink'] }))}
        onChange={(v) => props.childToParent(v.value, props.index)}
      />
    );
  } else {
    console.log('nothing case');
    return null;
  }
}
