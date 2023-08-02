import { DataQuery, DataSourceJsonData, FieldType } from '@grafana/data';
import { Filter } from '@material-table/core';

export type QueryLanguage = 'jsonpath' | 'jsonata';

export interface JsonField {
  name?: string;
  jsonPath: string;
  type?: FieldType;
  language?: QueryLanguage;
}

export type Pair<T, K> = [T, K];

export interface Table {
  title: string;
  data: any[];
  columns: any[];
  filters: Array<Filter<any>>;
  pageSize: number;
  count: number;
  page: number;
  clickedRow?: any;
}

export const defaultTable: Table = {
  title: "",
  data: [],
  columns: [],
  filters: [],
  pageSize: 5,
  count: 0,
  page: 0,
};

export interface JsonApiQuery extends DataQuery {
  fields: JsonField[];
  method: string;
  urlPath: string;
  queryParams: string;
  params: Array<Pair<string, string>>;
  headers: Array<Pair<string, string>>;
  body: string;
  cacheDurationSeconds: number;

  // Keep for backwards compatibility with older version of variables query editor.
  jsonPath?: string;

  // Experimental
  experimentalGroupByField?: string;
  experimentalMetricField?: string;
  experimentalVariableTextField?: string;
  experimentalVariableValueField?: string;

}

export const defaultQuery: Partial<JsonApiQuery> = {
  cacheDurationSeconds: 300,
  method: 'GET',
  queryParams: '',
  urlPath: '',
  fields: [
    { name: 'Time', jsonPath: '$.value[*].phenomenonTime.start', type:FieldType.time, language: 'jsonpath'}, 
    { name: 'Result', jsonPath: '$.value[*].result', type:FieldType.number, language: 'jsonpath' }
  ],
};


export interface JsonApiDataSourceOptions extends DataSourceJsonData {
  queryParams?: string;
}
