import MaterialTable, { Filter } from '@material-table/core';
import { useTheme } from '@material-ui/core';
import React from 'react';
import { JsonApiQuery, Table } from 'types';
import { JsonDataSource } from '../datasource';

interface Props {
  query: JsonApiQuery;
  table: Table;
  selectedEntrypoint: any;
  entrypoint: string;
  datasource: JsonDataSource;
  onTableChange: (table: Table) => void;
  onChange: (query: JsonApiQuery) => void;
  onRunQuery: () => void;
}

export default function DatastreamTable({
  query,
  table,
  selectedEntrypoint,
  entrypoint,
  datasource,
  onTableChange,
  onChange,
  onRunQuery,
}: Props) {
  const theme = useTheme();

  const onRowClickDatastream = (evt: any, row: any) => {
    onTableChange({ ...table, clickedRow: row });
    let id = row['@iot.id'];

    if (id === undefined) {
      return;
    }

    onChange({
      ...query,
      urlPath: `/Datastreams(${id})/Observations?$orderby=phenomenonTime asc`,
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

  const onFilterChangeDatastream = async (filters: Array<Filter<any>>) => {
    let id = selectedEntrypoint['@iot.id'];

    if (id === undefined) {
      return;
    }

    let result = await datasource.selectionRequest(
      { ...query, urlPath: `/${entrypoint}(${id})/Datastreams?` },
      filters,
      0,
      table.pageSize
    );

    if (result === undefined) {
      return;
    }

    onTableChange({ ...table, data: result.value, count: result.count, page: 0, filters: filters });
  };

  const onPageChangeDatastream = async (page: number, pageSize: number) => {
    let id = selectedEntrypoint['@iot.id'];

    if (id === undefined) {
      return;
    }

    let result = await datasource.selectionRequest(
      { ...query, urlPath: `/${entrypoint}(${id})/Datastreams?` },
      table.filters,
      page * pageSize,
      pageSize
    );

    if (result === undefined) {
      return;
    }

    onTableChange({
      //Does not change columns because of some entries does not have all columns
      ...table,
      data: result.value,
      count: result.count,
      page: page,
    });
  };

  return (
    <MaterialTable
      title="Datastreams"
      columns={table.columns}
      data={table.data}
      totalCount={table.count}
      page={table.page}
      onPageChange={onPageChangeDatastream}
      onRowClick={onRowClickDatastream}
      onFilterChange={onFilterChangeDatastream}
      onRowsPerPageChange={(pageSize: number) => {
        onTableChange({ ...table, pageSize: pageSize });
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
        rowStyle: (rowData) => {
          let selected = table.clickedRow && table.clickedRow['@iot.id'] === rowData['@iot.id'];
          return {
            backgroundColor: selected ? theme.palette.action.selected : theme.palette.background.default,
            color: theme.palette.text.primary,
          };
        },
      }}
    />
  );
}
