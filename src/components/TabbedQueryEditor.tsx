import { SelectableValue, TimeRange } from '@grafana/data';
import {
  InfoBox,
  InlineField,
  InlineFieldRow,
  RadioButtonGroup,
  CollapsableSection,
  Label,
  Segment,
  CodeEditor,
  Container,
} from '@grafana/ui';
import MaterialTable, { Filter } from '@material-table/core';
import { createTheme, CssBaseline, Grid, ThemeProvider } from '@material-ui/core';
import { JsonDataSource } from 'datasource';
import defaults from 'lodash/defaults';
import React, { useState } from 'react';
import { defaultQuery, JsonApiQuery } from '../types';
import { getTableHeaders } from '../createHeader';

import { PathEditor } from './PathEditor';

interface Props {
  onChange: (query: JsonApiQuery) => void;
  onRunQuery: () => void;
  editorContext: string;
  query: JsonApiQuery;
  limitFields?: number;
  datasource: JsonDataSource;
  range?: TimeRange;

  fieldsTab: React.ReactNode;
}

interface Table {
  data: any[];
  columns: any[];
  filters: Array<Filter<any>>;
  pageSize: number;
  count: number;
  page: number;
}

const defaultTable: Table = {
  data: [],
  columns: [],
  filters: [],
  pageSize: 5,
  count: 0,
  page: 0,
};

const darkTheme = createTheme({
  palette: {
    type: 'dark',
  },
});

export const TabbedQueryEditor = ({ query, onChange, onRunQuery, fieldsTab, datasource, range }: Props) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [orderbyWarning, setOrderByWarning] = useState(false);
  const [filterWarning, setFilterWarning] = useState(false);

  const [entrypoint, setEntrypoint] = useState<Table>(defaultTable);

  const [datastream, setDatastream] = useState<Table>(defaultTable);

  const q = defaults(query, defaultQuery);

  //const onTypeahead = (value: string) =>
  //  onSuggest({ value } as TypeaheadInput, () => datasource.metadataRequest(query, range));

  const getSelection = async (
    urlPath: string,
    filters?: Array<Filter<any>>,
    skip?: number,
    top?: number
  ): Promise<{ value: any[]; count: number }> => {
    if (urlPath === '') {
      return { value: [], count: 0 };
    }
    q.urlPath = urlPath;
    let result = await datasource.selectionRequest(q, filters ?? [], skip, top);
    //let result = await datasource.metadataRequest(q)
    let value: any[] = result['value'];
    let count = result['@iot.count'];

    return { value, count };
  };

  const onEntrypointChange = async ({ value }: SelectableValue<string>) => {
    let newQuery: JsonApiQuery = {
      ...query,
      entrypointUrlPath: value!,
      //selectedDatastream: '',
      //selectedEntrypoint: '',
    };

    onChange(newQuery);
    let result = await getSelection('/' + value! + '?', [], 0, entrypoint.pageSize);

    setEntrypoint({
      ...entrypoint,
      data: result.value,
      count: result.count,
      columns: filterColumns(getTableHeaders(result.value)).map((col) => ({ title: col, field: col })),
      page: 0,
    });
  };

  const filterColumns = (columns: string[]) => {
    return columns.filter((value) => {
      if (
        value.endsWith('@iot.navigationLink') ||
        value.startsWith('properties') ||
        value.startsWith('@iot.selfLink')
      ) {
        //problem with ui, if attribute 'properties' is added - TODO: Fix
        return false;
      }
      return true;
    });
  };

  const onRowClick = async (evt: any, row: any) => {
    let id = row['@iot.id'];

    if (id === undefined) {
      return;
    }
    let newQuery: JsonApiQuery = {
      ...query,
      selectedEntrypoint: row,
    };
    onChange(newQuery);
    let result = await getSelection(
      '/' + query.entrypointUrlPath + '(' + id + ')' + '/Datastreams?',
      [],
      0,
      datastream.pageSize
    );

    setDatastream({
      ...datastream,
      data: result.value,
      count: result.count,
      columns: filterColumns(getTableHeaders(result.value)).map((col) => ({ title: col, field: col })),
      page: 0,
    });
  };

  const onRowClickDatastream = (evt: any, row: any) => {
    let id = row['@iot.id'];

    if (id === undefined) {
      return;
    }

    onChange({
      ...query,
      urlPath: '/Datastreams(' + id + ')' + '/Observations?$orderby=phenomenonTime asc',
      selectedDatastream: row,
      fields: [
        { name: 'Time', jsonPath: '$.value[*].phenomenonTime', language: 'jsonpath' },
        {
          name: row['unitOfMeasurement']['symbol'] ? row['unitOfMeasurement']['symbol'] : 'Result',
          jsonPath: '$.value[*].result',
          language: 'jsonpath',
        },
      ],
    });
    onRunQuery();
  };

  const onFilterChangeEntry = async (filters: Array<Filter<any>>) => {
    let result = await getSelection('/' + query.entrypointUrlPath + '?', filters, 0, entrypoint.pageSize);

    if (result === undefined) {
      return;
    }

    setEntrypoint({ ...entrypoint, data: result.value, count: result.count, page: 0, filters: filters });

    /*let headers = getTableHeaders(result);
    headers = filterColumns(headers);
    let newColumns = entrypointColumns.concat(headers);
    setEntrypointColumns([...new Set(newColumns)]); - When new headers are added - old inputs are deleted?
    

    setDatastreams([]);
    setDatastreamColumns([]);*/

    onChange({ ...query });
  };

  const onFilterChangeDatastream = async (filters: Array<Filter<any>>) => {
    let id = query.selectedEntrypoint['@iot.id'];

    if (id === undefined) {
      return;
    }

    let result = await getSelection(
      '/' + query.entrypointUrlPath + '(' + id + ')/Datastreams' + '?',
      filters,
      0,
      datastream.pageSize
    );

    if (result === undefined) {
      return;
    }

    setDatastream({ ...datastream, data: result.value, count: result.count, page: 0, filters: filters });
  };

  const onPageChangeEntrypoint = async (page: number, pageSize: number) => {
    let result = await getSelection('/' + query.entrypointUrlPath + '?', entrypoint.filters, page * pageSize, pageSize);

    if (result === undefined) {
      return;
    }

    setEntrypoint({
      ...entrypoint,
      data: result.value,
      count: result.count,
      //columns: filterColumns(getTableHeaders(result.value)),
      page: page,
    });
  };

  const onPageChangeDatastream = async (page: number, pageSize: number) => {
    let id = query.selectedEntrypoint['@iot.id'];

    if (id === undefined) {
      return;
    }

    let result = await getSelection(
      '/' + query.entrypointUrlPath + '(' + id + ')/Datastreams' + '?',
      datastream.filters,
      page * pageSize,
      pageSize
    );

    if (result === undefined) {
      return;
    }

    setDatastream({
      ...datastream,
      data: result.value,
      count: result.count,
      //columns: filterColumns(getTableHeaders(result.value)),
      page: page,
    });
  };

  const checkURL = (oldURL: string) => {
    let splitURL = oldURL.split(/[/?&]+/);
    console.log(splitURL);
    if (splitURL.includes('Observations') || splitURL.includes('Observations')) {
      if (splitURL.includes('$orderby=phenomenonTime asc')) {
        setOrderByWarning(false);
      } else {
        console.log('Oderby not correct');
        setOrderByWarning(true);
      }
    } else {
      console.log('No Observation, we need orderby');
      //Add orderBy muss vorhanden sein
      setOrderByWarning(true);
    }
    if (
      splitURL.includes('$expand') ||
      splitURL.includes('$Expand') ||
      splitURL.includes('$filter') ||
      splitURL.includes('$Filter')
    ) {
      setFilterWarning(true);
    } else {
      setFilterWarning(false);
    }
    return oldURL;
  };

  const tabs = [
    {
      title: 'Basic',
      /* (<EntityEditor
      entity={q.method ?? 'Sensors'}
      specifics={q.method ?? 'Specifics'}
      onEntityChange={(method) => {
        onChange({ ...q, method });
        onRunQuery();
      }}
      onSpecificsChange={(method) => {
        onChange({ ...q, method });
        onRunQuery();
      }}
      datasource={datasource}
    />) */
      content: (
        <>
          <Label> Select Entrypoint</Label>
          <InlineField label={'Entrypoint'} tooltip={''}>
            <Segment
              value={{ label: query.entrypointUrlPath, value: query.entrypointUrlPath }}
              options={['Things', 'ObservedProperties', 'Sensors'].map((value) => ({
                label: value,
                value: value,
                description: '',
              }))}
              onChange={onEntrypointChange}
              placeholder={'Select Entrypoint'}
            />
          </InlineField>
          <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Container>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  {query.entrypointUrlPath !== '' ? (
                    <MaterialTable
                      title={query.entrypointUrlPath}
                      columns={entrypoint.columns}
                      data={entrypoint.data}
                      totalCount={entrypoint.count}
                      page={entrypoint.page}
                      onRowClick={onRowClick}
                      onPageChange={onPageChangeEntrypoint}
                      onFilterChange={onFilterChangeEntry}
                      onRowsPerPageChange={(pageSize: number) => {
                        setEntrypoint({ ...entrypoint, pageSize: pageSize });
                      }}
                      options={{
                        filtering: true,
                        pageSize: 5,
                        pageSizeOptions: [5, 10, 20],
                        search: false,
                        showEmptyDataSourceMessage: true,
                        headerStyle: {
                          position: 'sticky',
                          top: 0,
                        },
                        maxBodyHeight: '500px',
                      }}
                    />
                  ) : null}
                </Grid>
                <Grid item xs={6}>
                  {query.selectedEntrypoint !== '' ? (
                    <MaterialTable
                      title="Datastreams"
                      columns={datastream.columns}
                      data={datastream.data}
                      totalCount={datastream.count}
                      page={datastream.page}
                      onPageChange={onPageChangeDatastream}
                      onRowClick={onRowClickDatastream}
                      onFilterChange={onFilterChangeDatastream}
                      onRowsPerPageChange={(pageSize: number) => {
                        setDatastream({ ...datastream, pageSize: pageSize });
                      }}
                      options={{
                        filtering: true,
                        pageSize: 5,
                        pageSizeOptions: [5, 10, 20],
                        search: false,
                        showEmptyDataSourceMessage: true,
                        headerStyle: {
                          position: 'sticky',
                          top: 0,
                        },
                        maxBodyHeight: '500px',
                      }}
                    />
                  ) : null}
                </Grid>
              </Grid>
            </Container>
          </ThemeProvider>
        </>
      ),
    },
    {
      title: 'Advanced',
      content: (
        <>
          <div>
            <InlineField
              label="Cache Time"
              tooltip="Time in seconds that the response will be cached in Grafana after receiving it."
            >
              <Segment
                value={{ label: formatCacheTimeLabel(q.cacheDurationSeconds), value: q.cacheDurationSeconds }}
                options={[0, 5, 10, 30, 60, 60 * 2, 60 * 5, 60 * 10, 60 * 30, 3600, 3600 * 2, 3600 * 5].map(
                  (value) => ({
                    label: formatCacheTimeLabel(value),
                    value,
                    description: value ? '' : 'Response is not cached at all',
                  })
                )}
                onChange={({ value }) => onChange({ ...q, cacheDurationSeconds: value! })}
              />
            </InlineField>
          </div>
          <Label>Enter SensorThings URL here</Label>
          <PathEditor
            method="GET"
            onMethodChange={(method) => {
              onChange({ ...q, method });
              onRunQuery();
            }}
            path={q.urlPath ?? ''}
            onPathChange={(path) => {
              const fixedURL = checkURL(path);
              onChange({ ...q, urlPath: fixedURL });
              onRunQuery();
            }}
          />
          {orderbyWarning ? (
            <InfoBox severity="warning" style={{ maxWidth: '700px', whiteSpace: 'normal' }}>
              {
                <>
                  <p>
                    The Query should probably be ordered by your time axis variable. You probably want to add
                    ?$orderby=phenomenonTime asc to your URL.
                  </p>
                  <label>Code:</label>
                  <CodeEditor value="?$orderby=phenomenonTime asc" readOnly={true} language={''} height={25} />
                </>
              }
            </InfoBox>
          ) : null}
          {filterWarning ? (
            <InfoBox severity="info" style={{ whiteSpace: 'normal' }}>
              {
                <>
                  <p>
                    You are using filter or expand. Values will not automatically be filtered according to the Dashboard
                    settings. If you want to filter the requested Values by time (__from and __to are the dashboard
                    variables), try adding:
                  </p>
                  <label>Code:</label>
                  <CodeEditor
                    value="&$filter=phenomenonTime ge __from and  and phenomenonTime le __to"
                    readOnly={true}
                    language={''}
                    height={55}
                  />
                </>
              }
            </InfoBox>
          ) : null}
          <CollapsableSection label="Manually Assign Fields" isOpen={false}>
            <>
              <p>Enter the Fields that you want to display here. Make sure one of them is a TimeRange!!!</p> {fieldsTab}
            </>
          </CollapsableSection>
        </>
      ),
    },
  ];
  return (
    <>
      <InlineFieldRow>
        <InlineField>
          <RadioButtonGroup
            onChange={(e) => setTabIndex(e ?? 0)}
            value={tabIndex}
            options={tabs.map((tab, idx) => ({ label: tab.title, value: idx }))}
          />
        </InlineField>
      </InlineFieldRow>
      {/* <InlineFieldRow>
        {advanced ? (
          <div>
            <InlineField
              label="Cache Time"
              tooltip="Time in seconds that the response will be cached in Grafana after receiving it."
            >
              <Segment
                value={{ label: formatCacheTimeLabel(q.cacheDurationSeconds), value: q.cacheDurationSeconds }}
                options={[0, 5, 10, 30, 60, 60 * 2, 60 * 5, 60 * 10, 60 * 30, 3600, 3600 * 2, 3600 * 5].map(
                  (value) => ({
                    label: formatCacheTimeLabel(value),
                    value,
                    description: value ? '' : 'Response is not cached at all',
                  })
                )}
                onChange={({ value }) => onChange({ ...q, cacheDurationSeconds: value! })}
              />
            </InlineField>
          </div>
        ) : (null)}
      </InlineFieldRow>
      {q.method === 'GET' && q.body && (
        <InfoBox severity="warning" style={{ maxWidth: '700px', whiteSpace: 'normal' }}>
          {"GET requests can't have a body. The body you've defined will be ignored."}
        </InfoBox>
      )}
      {(q.headers ?? []).map(([key, _]) => key.toLowerCase()).find((_) => sensitiveHeaders.includes(_)) && (
        <InfoBox severity="warning" style={{ maxWidth: '700px', whiteSpace: 'normal' }}>
          {
            "It looks like you're adding credentials in the header. Since queries are stored unencrypted, it's strongly recommended that you add any secrets to the data source config instead."
          }
        </InfoBox>
      )} */}
      {tabs[tabIndex].content}
    </>
  );
};

export const putIdinPath = (urlPath: string, newId: string) => {
  let preIndex = urlPath.indexOf('(');
  let postIndex = urlPath.indexOf(')');

  if (preIndex === -1 || postIndex === -1) {
    return urlPath + '(' + newId + ')';
  }

  let preId = urlPath.substring(0, preIndex);
  let postId = urlPath.substring(postIndex);

  return preId + '(' + newId + postId;
};

export const extractEntryPointFromUrl = (urlPath: string) => {
  return urlPath.split('(')[0];
};

export const extractIDfromPath = (urlPath: string) => {
  let preIndex = urlPath.indexOf('(');
  let postIndex = urlPath.indexOf(')');

  if (preIndex === -1 || postIndex === -1) {
    return '';
  }

  return urlPath.substring(preIndex + 1, postIndex);
};

export const formatCacheTimeLabel = (s: number) => {
  if (s < 60) {
    return s + 's';
  } else if (s < 3600) {
    return s / 60 + 'm';
  }

  return s / 3600 + 'h';
};
