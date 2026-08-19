package main

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestNewDataSourceInstance(t *testing.T) {
	instance, err := newDataSourceInstance(context.Background(), backend.DataSourceInstanceSettings{
		URL:      "http://example.org",
		JSONData: []byte(`{}`),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if instance == nil {
		t.Fatal("expected a data source instance")
	}
}
