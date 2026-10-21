package main

import (
	"context"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"

	"github.com/FObersteiner/frost-sensorthings-datasource/pkg/plugin"
)

func main() {
	// Start listening to requests sent from Grafana. This call is blocking so
	// it won't finish until an interrupt or kill signal is sent.
	if err := datasource.Manage("iosb-sensorthings-datasource", newDataSourceInstance, datasource.ManageOpts{}); err != nil {
		log.DefaultLogger.Error(err.Error())
		os.Exit(1)
	}
}

// newDataSourceInstance returns a datasource instance, which is shared for all
// queries issued against a single data source configuration. Grafana makes
// sure that instances are created and disposed per data source.
func newDataSourceInstance(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	return plugin.NewDataSource(ctx, settings)
}
