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
import { createTheme, CssBaseline, Grid, ThemeProvider } from '@material-ui/core';
import { JsonDataSource } from 'datasource';
import defaults from 'lodash/defaults';
import React, { useState } from 'react';
import { defaultQuery, defaultTable, JsonApiQuery, Table } from '../types';
import { getTableHeaders } from '../createHeader';

import { PathEditor } from './PathEditor';
import EntrypointTable from './EntrypointTable';
import DatastreamTable from './DatastreamTable';

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

const darkTheme = createTheme({
  palette: {
    type: 'dark',
  },
});

export const TabbedQueryEditor = ({ query, onChange, onRunQuery, fieldsTab, datasource, range }: Props) => {
  const [tabIndex, setTabIndex] = useState(0);
  const [orderbyWarning, setOrderByWarning] = useState(false);
  const [filterWarning, setFilterWarning] = useState(false);

  const [entrypoint, setEntrypoint] = useState<string | undefined>(undefined);
  const [entrypointTable, setEntrypointTable] = useState<Table>(defaultTable);
  const [datastreamTable, setDatastreamTable] = useState<Table>(defaultTable);

  const q = defaults(query, defaultQuery);

  //const onTypeahead = (value: string) =>
  //  onSuggest({ value } as TypeaheadInput, () => datasource.metadataRequest(query, range));

  const onEntrypointChange = async ({ value }: SelectableValue<string>) => {
    setEntrypoint(value);
    let result = await datasource.selectionRequest(
      { ...query, urlPath: `/${value!}?` },
      [],
      0,
      entrypointTable.pageSize
    );

    setEntrypointTable({
      ...entrypointTable,
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
        return false;
      }
      return true;
    });
  };

  const onRowClick = async (evt: any, row: any) => {
    setEntrypointTable({ ...entrypointTable, clickedRow: row });
    let id = row['@iot.id'];

    if (id === undefined) {
      return;
    }

    let result = await datasource.selectionRequest(
      { ...q, urlPath: `/${entrypoint}(${id})/Datastreams?` },
      [],
      0,
      datastreamTable.pageSize
    );

    setDatastreamTable({
      ...datastreamTable,
      data: result.value,
      count: result.count,
      columns: filterColumns(getTableHeaders(result.value)).map((col) => ({ title: col, field: col })),
      page: 0,
      clickedRow: undefined,
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
              value={{ label: entrypoint, value: entrypoint }}
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
                  {entrypoint !== undefined ? (
                    <EntrypointTable
                      table={entrypointTable}
                      entrypoint={entrypoint}
                      datasource={datasource}
                      onEntrypointChange={setEntrypointTable}
                      query={query}
                      onRowClick={onRowClick}
                    />
                  ) : null}
                </Grid>
                <Grid item xs={6}>
                  {entrypoint !== undefined && entrypointTable.clickedRow !== undefined ? (
                    <DatastreamTable
                      table={datastreamTable}
                      query={query}
                      selectedEntrypoint={entrypointTable.clickedRow}
                      entrypoint={entrypoint}
                      datasource={datasource}
                      onChange={onChange}
                      onTableChange={setDatastreamTable}
                      onRunQuery={onRunQuery}
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
