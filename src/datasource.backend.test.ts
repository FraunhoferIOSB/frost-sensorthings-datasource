import { DataQueryRequest, DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { of } from 'rxjs';
import { JsonDataSource } from './datasource';
import { JsonApiDataSourceOptions, JsonApiQuery } from './types';

// Mock the template service used by applyTemplateVariables, but keep the
// real DataSourceWithBackend so the instanceof check below works.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => ({
      replace: (str: string) => str.replace(/\$var/g, 'VALUE'),
      getVariables: () => [],
    }),
  };
});

const settings = {
  id: 1,
  uid: 'iosb-sensorthings-datasource-test',
  type: 'iosb-sensorthings-datasource',
  name: 'SensorThings',
  access: 'proxy',
  url: 'https://example.com',
  jsonData: {},
  meta: {},
} as unknown as DataSourceInstanceSettings<JsonApiDataSourceOptions>;

const query = (overrides: Partial<JsonApiQuery> = {}): JsonApiQuery => ({
  refId: 'A',
  fields: [{ name: 'Time', jsonPath: '$.value[*].phenomenonTime' }],
  method: 'GET',
  urlPath: '/Datastreams(1)/Observations',
  queryParams: '',
  params: [],
  headers: [],
  body: '',
  cacheDurationSeconds: 0,
  ...overrides,
});

describe('JsonDataSource (DataSourceWithBackend refactor)', () => {
  it('extends DataSourceWithBackend', () => {
    const ds = new JsonDataSource(settings);
    expect(ds).toBeInstanceOf(DataSourceWithBackend);
  });

  it('delegates to the backend and filters hidden queries', () => {
    const ds = new JsonDataSource(settings);
    const baseQuery = jest
      .spyOn(DataSourceWithBackend.prototype, 'query')
      .mockReturnValue(of({ data: [] }));

    const visible = query({ refId: 'A' });
    const hidden = query({ refId: 'B', hide: true });
    const request = {
      targets: [visible, hidden],
    } as unknown as DataQueryRequest<JsonApiQuery>;

    ds.query(request).subscribe();

    expect(baseQuery).toHaveBeenCalledTimes(1);
    const delegatedTargets = baseQuery.mock.calls[0][0].targets;
    expect(delegatedTargets).toEqual([visible]);
  });

  it('interpolates template variables into the query before sending it to the backend', () => {
    const ds = new JsonDataSource(settings);
    const scopedVars: ScopedVars = { var: { value: 'VALUE', text: 'VALUE' } };

    const result = ds.applyTemplateVariables(
      query({
        urlPath: '/Datastreams($var)/Observations',
        params: [['$var', '$var']],
        headers: [['X-Key', '$var']],
        body: '{"key": "$var"}',
        fields: [{ name: '$var', jsonPath: '$.value[$var]' }],
      }),
      scopedVars
    );

    expect(result.urlPath).toBe('/Datastreams(VALUE)/Observations');
    expect(result.params).toEqual([['VALUE', 'VALUE']]);
    expect(result.headers).toEqual([['X-Key', 'VALUE']]);
    expect(result.body).toBe('{"key": "VALUE"}');
    expect(result.fields).toEqual([{ name: 'VALUE', jsonPath: '$.value[VALUE]' }]);
  });
});
