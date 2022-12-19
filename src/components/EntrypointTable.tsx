import MaterialTable, { Filter } from '@material-table/core';
import { useTheme } from '@material-ui/core';
import { JsonDataSource } from 'datasource';
import React from 'react';
import { JsonApiQuery, Table } from 'types';

interface Props {
  query: JsonApiQuery;
  table: Table;
  entrypoint: string;
  datasource: JsonDataSource;
  onEntrypointChange: (table: Table) => void;
  onRowClick: (evt: any, row: any) => void;
}

export default function EntrypointTable({
  query,
  table,
  entrypoint,
  datasource,
  onEntrypointChange,
  onRowClick,
}: Props) {
  const theme = useTheme();

  const onFilterChange = async (filters: Array<Filter<any>>) => {
    let result = await datasource.selectionRequest(
      { ...query, urlPath: `/${entrypoint}?` },
      filters,
      0,
      table.pageSize
    );

    if (result === undefined) {
      return;
    }

    onEntrypointChange({ ...table, data: result.value, count: result.count, page: 0, filters: filters });
  };

  const onPageChangeEntrypoint = async (page: number, pageSize: number) => {
    let result = await datasource.selectionRequest(
      { ...query, urlPath: `/${entrypoint}?` },
      table.filters,
      page * pageSize,
      pageSize
    );

    if (result === undefined) {
      return;
    }

    onEntrypointChange({
      ...table,
      data: result.value, //Does not change columns because of some entries does not have all columns
      count: result.count,
      page: page,
    });
  };

  return (
    <MaterialTable
      title={entrypoint}
      columns={table.columns}
      data={table.data}
      totalCount={table.count}
      page={table.page}
      onRowClick={onRowClick}
      onPageChange={onPageChangeEntrypoint}
      onFilterChange={onFilterChange}
      onRowsPerPageChange={(pageSize: number) => {
        onEntrypointChange({ ...table, pageSize: pageSize });
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
