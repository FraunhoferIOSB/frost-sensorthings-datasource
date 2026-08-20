import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings, InlineField, InlineFieldRow, Input, Select } from '@grafana/ui';
import React, { ChangeEvent } from 'react';
import { JsonApiDataSourceOptions } from '../types';

type Props = DataSourcePluginOptionsEditorProps<JsonApiDataSourceOptions>;

/**
 * ConfigEditor lets the user configure connection details like the URL or
 * authentication.
 */
export const ConfigEditor: React.FC<Props> = ({ options, onOptionsChange }) => {
  const onParamsChange = (e: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        queryParams: e.currentTarget.value,
      },
    });
  };

  const onTimePropertyChange = (value?: string) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        timeProperty: value,
      },
    });
  };

  return (
    <>
      {/* DataSourceHttpSettings handles most the settings for connecting over
      HTTP. */}
      <DataSourceHttpSettings
        defaultUrl="http://localhost:8080/FROST-Server/v1.1/"
        dataSourceConfig={options}
        onChange={onOptionsChange}
      />

      {/* The Grafana proxy strips query parameters from the URL set in
      DataSourceHttpSettings. To support custom query parameters, the user need
      to set them explicitly.  */}
      <h3 className="page-heading">Misc</h3>
      <InlineFieldRow>
        <InlineField label="Query string" tooltip="Add a custom query string to your queries.">
          <Input
            width={50}
            value={options.jsonData.queryParams}
            onChange={onParamsChange}
            spellCheck={false}
            placeholder="page=1&limit=100"
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Time property"
          tooltip="SensorThings property used for the automatically added time filter. Defaults to phenomenonTime."
        >
          <Select
            width={50}
            value={options.jsonData.timeProperty ?? 'phenomenonTime'}
            onChange={(option) => onTimePropertyChange(option.value)}
            options={[
              { label: 'phenomenonTime', value: 'phenomenonTime' },
              { label: 'resultTime', value: 'resultTime' },
            ]}
            allowCustomValue
          />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
