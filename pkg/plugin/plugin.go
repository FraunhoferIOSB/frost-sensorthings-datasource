package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

// QueryLanguage the language used to extract a field from the JSON document.
type QueryLanguage string

const (
	// QueryLanguageJSONPath extracts fields using JSONPath.
	QueryLanguageJSONPath QueryLanguage = "jsonpath"
	// QueryLanguageJSONata extracts fields using JSONata.
	QueryLanguageJSONata QueryLanguage = "jsonata"
)

// JsonField describes a single field to extract from the SensorThings JSON
// response. It mirrors the frontend's JsonField type.
type JsonField struct {
	Name     string        `json:"name"`
	JSONPath string        `json:"jsonPath"`
	Type     string        `json:"type"`
	Language QueryLanguage `json:"language"`
}

// JsonApiQuery describes a single query. It mirrors the frontend's JsonApiQuery
// type so that queries saved by the frontend query editor can be executed
// server-side. This is required for externally shared dashboards (public
// dashboards), where only the plugin backend is executed.
type JsonApiQuery struct {
	RefID     string `json:"refId"`
	QueryType string `json:"queryType"`

	Fields []JsonField `json:"fields"`

	Method      string `json:"method"`
	URLPath     string `json:"urlPath"`
	QueryParams string `json:"queryParams"`

	Params               [][2]string `json:"params"`
	Headers              [][2]string `json:"headers"`
	Body                 string      `json:"body"`
	CacheDurationSeconds int         `json:"cacheDurationSeconds"`

	// Kept for backwards compatibility with older versions of the variables
	// query editor.
	JSONPath string `json:"jsonPath"`

	// Experimental options.
	ExperimentalGroupByField       string `json:"experimentalGroupByField"`
	ExperimentalMetricField        string `json:"experimentalMetricField"`
	ExperimentalVariableTextField  string `json:"experimentalVariableTextField"`
	ExperimentalVariableValueField string `json:"experimentalVariableValueField"`
}

// hasPath returns true if the field declares a JSON path to extract.
func (f JsonField) hasPath() bool {
	return f.JSONPath != ""
}

// isGroupBy returns the name of the field to group by, or an empty string.
func (q JsonApiQuery) isGroupBy() string {
	return q.ExperimentalGroupByField
}

// isMetricField returns the name of the field to treat as the metric, or an
// empty string.
func (q JsonApiQuery) isMetricField() string {
	return q.ExperimentalMetricField
}

// DataSource is the shared instance for a single data source configuration.
// It is created once per data source id and reused for all queries, so it has
// to be safe for concurrent use.
type DataSource struct {
	settings   backend.DataSourceInstanceSettings
	httpClient *http.Client

	cache *TTLCache
}

// NewDataSource creates a new data source instance.
func NewDataSource(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	opts, err := settings.HTTPClientOptions(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not create http client options: %w", err)
	}

	client, err := httpclient.New(opts)
	if err != nil {
		return nil, fmt.Errorf("could not create http client: %w", err)
	}

	return &DataSource{
		settings:   settings,
		httpClient: client,
		cache:      NewTTLCache(),
	}, nil
}

// Dispose cleans up the data source instance.
func (d *DataSource) Dispose() {
	d.cache.Flush()
}

// QueryData implements backend.QueryDataHandler.
func (d *DataSource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	log.DefaultLogger.Debug("QueryData called", "queries", len(req.Queries))

	// The response buffer.
	resp := backend.NewQueryDataResponse()

	for _, q := range req.Queries {
		// Annotation queries are not executed server-side by this plugin. The
		// frontend never emitted annotations for this data source either, so an
		// empty response preserves the existing behavior.
		if q.QueryType == "annotations" {
			resp.Responses[q.RefID] = backend.DataResponse{Frames: nil}
			continue
		}

		resp.Responses[q.RefID] = d.query(ctx, req.PluginContext, q)
	}

	return resp, nil
}

// query executes a single query and returns the data response for it.
func (d *DataSource) query(ctx context.Context, pCtx backend.PluginContext, dataQuery backend.DataQuery) backend.DataResponse {
	var q JsonApiQuery
	if err := json.Unmarshal(dataQuery.JSON, &q); err != nil {
		return backend.DataResponse{Error: fmt.Errorf("could not unmarshal query JSON: %w", err)}
	}

	frames, err := d.executeQuery(ctx, q, dataQuery.TimeRange)
	if err != nil {
		return backend.DataResponse{Error: err}
	}

	return backend.DataResponse{Frames: frames}
}

// CheckHealth implements backend.CheckHealthHandler.
func (d *DataSource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	status := backend.HealthStatusOk
	message := "Success"

	err := d.healthCheck(ctx)
	if err != nil {
		status = backend.HealthStatusError
		message = err.Error()
	}

	return &backend.CheckHealthResult{
		Status:  status,
		Message: message,
	}, nil
}

// healthCheck performs a GET request against the configured base URL and
// reports whether the data source is reachable.
func (d *DataSource) healthCheck(ctx context.Context) error {
	url, err := d.buildURL("", nil)
	if err != nil {
		return err
	}

	responseCode, _, err := d.fetch(ctx, http.MethodGet, url, nil, "")
	if err != nil {
		return err
	}

	if responseCode != http.StatusOK {
		return fmt.Errorf("unexpected response status %d", responseCode)
	}

	return nil
}

// buildDataSourceSettings returns the base URL and the configured default
// query parameters for the data source.
func (d *DataSource) buildDataSourceSettings() (baseURL string, configParams map[string]string, err error) {
	baseURL = d.settings.URL
	if baseURL == "" {
		return "", nil, fmt.Errorf("missing data source URL")
	}

	configParams = map[string]string{}
	// The JSONData may contain an arbitrary set of properties added by the
	// data source config editor. Only the ones relevant for this plugin are
	// read here (the raw bytes are parsed instead of unmarshaling into a
	// typed struct to stay flexible).
	var jsonData map[string]json.RawMessage
	if err := json.Unmarshal(d.settings.JSONData, &jsonData); err != nil {
		return "", nil, fmt.Errorf("could not parse data source settings: %w", err)
	}
	if raw, ok := jsonData["queryParams"]; ok {
		var queryParams string
		if err := json.Unmarshal(raw, &queryParams); err == nil && queryParams != "" {
			values, perr := parseURLQuery(queryParams)
			if perr != nil {
				return "", nil, fmt.Errorf("invalid query string configured in the data source: %w", perr)
			}
			for k, v := range values {
				configParams[k] = v
			}
		}
	}

	return baseURL, configParams, nil
}

// buildURL assembles the full request URL from the data source base URL, the
// query path and the query parameters. It mirrors the URL assembly performed
// by the frontend Api implementation.
func (d *DataSource) buildURL(path string, queryParams map[string]string) (string, error) {
	baseURL, configParams, err := d.buildDataSourceSettings()
	if err != nil {
		return "", err
	}

	// Join the base URL and the query path with a single slash, deduplicating
	// any duplicate slashes so e.g. "/v1.1//Things" becomes "/v1.1/Things".
	url := strings.TrimRight(baseURL, "/") + "/" + strings.TrimLeft(path, "/")

	params := map[string]string{}
	for k, v := range queryParams {
		params[k] = v
	}
	// Parameters configured on the data source override the ones set on the
	// query.
	for k, v := range configParams {
		params[k] = v
	}

	if len(params) > 0 {
		sep := "?"
		if strings.Contains(url, "?") {
			sep = "&"
		}
		url += sep + encodeParams(params)
	}

	return url, nil
}

// fetch performs the HTTP request and returns the response status code and
// body.
func (d *DataSource) fetch(ctx context.Context, method, url string, headers [][2]string, body string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, strings.NewReader(body))
	if err != nil {
		return 0, nil, err
	}

	if method != http.MethodGet && body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	for _, kv := range headers {
		if kv[0] != "" {
			req.Header.Set(kv[0], kv[1])
		}
	}

	res, err := d.httpClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("request to %s failed: %w", url, err)
	}
	defer res.Body.Close()

	responseBody, err := io.ReadAll(res.Body)
	if err != nil {
		return 0, nil, fmt.Errorf("could not read response body: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode > 299 {
		return res.StatusCode, responseBody, fmt.Errorf("request failed with status %d: %s", res.StatusCode, truncate(string(responseBody), 500))
	}

	return res.StatusCode, responseBody, nil
}

// parseFloat is a small helper to parse strings to floats, mirroring JS
// parseFloat (partial keys are accepted).
func parseFloat(s string) (float64, error) {
	s = strings.TrimSpace(s)
	i := 0
	// Strip a sign.
	if i < len(s) && (s[i] == '-' || s[i] == '+') {
		i++
	}
	// Strip valid digits and a decimal point.
	seenDigit := false
	seenDot := false
	for ; i < len(s); i++ {
		c := s[i]
		if c >= '0' && c <= '9' {
			seenDigit = true
			continue
		}
		if c == '.' && !seenDot {
			seenDot = true
			continue
		}
		break
	}
	if !seenDigit {
		return 0, fmt.Errorf("%q is not a number", s)
	}
	return strconv.ParseFloat(s[:i], 64)
}

// truncate limits the length of a string.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
