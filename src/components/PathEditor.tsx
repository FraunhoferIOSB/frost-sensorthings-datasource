import {} from '@emotion/core';
import { InlineField, InlineFieldRow, Input } from '@grafana/ui';
import React from 'react';

interface Props {
  method: string;
  onMethodChange: (method: string) => void;
  path: string;
  onPathChange: (path: string) => void;
}

export const PathEditor = ({ method, onMethodChange, path, onPathChange }: Props) => {
  return (
    <InlineFieldRow>
      <InlineField grow>
        <Input
          placeholder="/Datastreams(1)/Observations"
          value={path}
          onChange={(e) => onPathChange(e.currentTarget.value)}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
