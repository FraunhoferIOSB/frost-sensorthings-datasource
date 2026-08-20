package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// newTestDataSource creates a data source pointing at the given server URL.
func newTestDataSource(t *testing.T, serverURL string) *DataSource {
	t.Helper()

	ds, err := NewDataSource(context.Background(), backend.DataSourceInstanceSettings{
		URL:      serverURL,
		JSONData: json.RawMessage(`{}`),
	})
	if err != nil {
		t.Fatalf("could not create data source: %v", err)
	}

	return ds.(*DataSource)
}

// sampleObservations returns a FROST-style Observations response.
func sampleObservations() map[string]interface{} {
	return map[string]interface{}{
		"@iot.count": 2,
		"value": []interface{}{
			map[string]interface{}{
				"@iot.id":        1,
				"phenomenonTime": "2021-05-17T20:48:09.000Z",
				"result":         0.5,
				"resultTime":     "2021-05-17T20:48:10.000Z",
			},
			map[string]interface{}{
				"@iot.id":        2,
				"phenomenonTime": "2021-05-17T20:49:09.000Z",
				"result":         1.5,
				"resultTime":     "2021-05-17T20:49:10.000Z",
			},
		},
	}
}

// mustJSON marshals the value as JSON.
func mustJSON(t *testing.T, v interface{}) []byte {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("could not marshal JSON: %v", err)
	}
	return raw
}

func TestDataSource_ExecuteQuery_basicJSONPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	frames, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time"},
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(frames) != 1 {
		t.Fatalf("expected 1 frame, got %d", len(frames))
	}
	frame := frames[0]
	if frame.RefID != "A" {
		t.Errorf("expected refId A, got %q", frame.RefID)
	}
	if frame.Name != "A" {
		t.Errorf("expected frame name A, got %q", frame.Name)
	}
	if len(frame.Fields) != 2 {
		t.Fatalf("expected 2 fields, got %d", len(frame.Fields))
	}

	timeField := frame.Fields[0]
	if timeField.Name != "Time" {
		t.Errorf("expected field Time, got %q", timeField.Name)
	}
	if !timeField.Type().Nullable() {
		t.Errorf("expected nullable time field")
	}
	if timeField.Len() != 2 {
		t.Fatalf("expected 2 values, got %d", timeField.Len())
	}
	firstTime, ok := timeField.At(0).(*time.Time)
	if !ok {
		t.Fatalf("expected *time.Time, got %T", timeField.At(0))
	}
	expected := time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC)
	if !firstTime.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, firstTime)
	}

	resultField := frame.Fields[1]
	if resultField.Name != "Result" {
		t.Errorf("expected field Result, got %q", resultField.Name)
	}
	if resultField.Len() != 2 {
		t.Fatalf("expected 2 values, got %d", resultField.Len())
	}
	firstResult, ok := resultField.At(0).(*float64)
	if !ok {
		t.Fatalf("expected *float64, got %T", resultField.At(0))
	}
	if *firstResult != 0.5 {
		t.Errorf("expected 0.5, got %v", *firstResult)
	}
}

func TestDataSource_ExecuteQuery_timeFilterApplied(t *testing.T) {
	var gotPath, gotFilter string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		gotPath = r.URL.Path
		gotFilter = r.URL.Query().Get("$filter")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	_, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotPath != "/Datastreams(1)/Observations" {
		t.Errorf("unexpected path: %q", gotPath)
	}

	expectedFilter := "phenomenonTime ge 2021-05-17T20:47:00.000Z and phenomenonTime le 2021-05-17T20:51:00.000Z"
	if gotFilter != expectedFilter {
		t.Errorf("expected filter %q, got %q", expectedFilter, gotFilter)
	}
}

func TestDataSource_ExecuteQuery_customTimeProperty(t *testing.T) {
	var gotFilter string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		gotFilter = r.URL.Query().Get("$filter")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds, err := NewDataSource(context.Background(), backend.DataSourceInstanceSettings{
		URL:      server.URL,
		JSONData: json.RawMessage(`{"timeProperty": "resultTime"}`),
	})
	if err != nil {
		t.Fatalf("could not create data source: %v", err)
	}

	_, err = ds.(*DataSource).executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expectedFilter := "resultTime ge 2021-05-17T20:47:00.000Z and resultTime le 2021-05-17T20:51:00.000Z"
	if gotFilter != expectedFilter {
		t.Errorf("expected filter %q, got %q", expectedFilter, gotFilter)
	}
}

func TestDataSource_ExecuteQuery_explicitFilterSkipsAutoFilter(t *testing.T) {
	var gotFilter string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		gotFilter = r.URL.Query().Get("$filter")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds, err := NewDataSource(context.Background(), backend.DataSourceInstanceSettings{
		URL:      server.URL,
		JSONData: json.RawMessage(`{"timeProperty": "resultTime"}`),
	})
	if err != nil {
		t.Fatalf("could not create data source: %v", err)
	}

	_, err = ds.(*DataSource).executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations?$filter=resultTime ge 2021-05-17T20:47:00.000Z and resultTime le 2021-05-17T20:51:00.000Z",
		Fields: []JsonField{
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// An explicit filter in the URL path suppresses the automatic filter.
	if gotFilter != "resultTime ge 2021-05-17T20:47:00.000Z and resultTime le 2021-05-17T20:51:00.000Z" {
		t.Errorf("unexpected filter: %q", gotFilter)
	}
}

func TestDataSource_ExecuteQuery_paging(t *testing.T) {
	type observation struct {
		ID     int    `json:"@iot.id"`
		Time   string `json:"phenomenonTime"`
		Result float64
	}

	pageRange := func(r *http.Request) map[string]interface{} {
		from := r.URL.Query().Get("$skip")
		if from == "" {
			from = "0"
		}
		switch from {
		case "0":
			return map[string]interface{}{
				"value": []interface{}{
					map[string]interface{}{"@iot.id": 1, "phenomenonTime": "2021-05-17T20:48:09.000Z", "result": 1.0},
				},
				"@iot.nextLink": "http://example.com/v1.1/Datastreams(1)/Observations?$skip=1&$top=1",
			}
		default:
			return map[string]interface{}{
				"value": []interface{}{
					map[string]interface{}{"@iot.id": 2, "phenomenonTime": "2021-05-17T20:49:09.000Z", "result": 2.0},
				},
			}
		}
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, pageRange(r)))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	frames, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time"},
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	resultField, _ := frames[0].FieldByName("Result")
	if resultField == nil {
		t.Fatal("missing Result field")
	}
	if resultField.Len() != 2 {
		t.Fatalf("expected 2 concatenated values, got %d", resultField.Len())
	}
}

func TestDataSource_ExecuteQuery_typeDetectionAndSeconds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, map[string]interface{}{
			"value": []interface{}{
				map[string]interface{}{"phenomenonTime": 1621284489, "result": 1},
				map[string]interface{}{"phenomenonTime": 1621284549, "result": 2},
			},
		}))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	frames, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			// No explicit type: the type is auto-detected from the values.
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	timeField, _ := frames[0].FieldByName("Time")
	if timeField == nil {
		t.Fatal("missing Time field")
	}
	// Seconds must be converted to milliseconds.
	first, ok := timeField.At(0).(*time.Time)
	if !ok {
		t.Fatalf("expected *time.Time, got %T", timeField.At(0))
	}
	expected := time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC)
	if !first.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, first)
	}
}

func TestDataSource_ExecuteQuery_groupBy(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, map[string]interface{}{
			"value": []interface{}{
				map[string]interface{}{"phenomenonTime": "2021-05-17T20:48:09.000Z", "result": 1, "thing": "A"},
				map[string]interface{}{"phenomenonTime": "2021-05-17T20:48:10.000Z", "result": 2, "thing": "A"},
				map[string]interface{}{"phenomenonTime": "2021-05-17T20:48:11.000Z", "result": 3, "thing": "B"},
			},
		}))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	frames, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:                    "A",
		URLPath:                  "/Datastreams(1)/Observations",
		ExperimentalGroupByField: "Thing",
		ExperimentalMetricField:  "Result",
		Fields: []JsonField{
			{Name: "Thing", JSONPath: "$.value[*].thing", Type: "string"},
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time"},
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(frames) != 2 {
		t.Fatalf("expected 2 frames, got %d", len(frames))
	}

	// The frames should not contain the group-by field anymore.
	for _, frame := range frames {
		thingField, _ := frame.FieldByName("Thing")
		if thingField != nil {
			t.Errorf("expected frame without group-by field, got %q", frame.Name)
		}
		result, _ := frame.FieldByName("Result")
		if result == nil {
			t.Fatalf("missing Result field in frame %q", frame.Name)
		}
		config := result.Config
		if config == nil || config.DisplayNameFromDS == "" {
			t.Errorf("expected displayNameFromDS on frame %q", frame.Name)
		}
	}
}

func TestDataSource_ExecuteQuery_jsonata(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	frames, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			{Name: "Times", JSONPath: "$.value.phenomenonTime", Type: "time", Language: QueryLanguageJSONata},
			{Name: "Results", JSONPath: "$.value.result", Type: "number", Language: QueryLanguageJSONata},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	timesField, _ := frames[0].FieldByName("Times")
	if timesField == nil {
		t.Fatal("missing Times field")
	}
	if timesField.Len() != 2 {
		t.Fatalf("expected 2 values, got %d", timesField.Len())
	}
	firstTime, ok := timesField.At(0).(*time.Time)
	if !ok {
		t.Fatalf("expected *time.Time, got %T", timesField.At(0))
	}
	expectedTime := time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC)
	if !firstTime.Equal(expectedTime) {
		t.Errorf("expected %v, got %v", expectedTime, firstTime)
	}

	resultsField, _ := frames[0].FieldByName("Results")
	if resultsField == nil {
		t.Fatal("missing Results field")
	}
	if resultsField.Len() != 2 {
		t.Fatalf("expected 2 values, got %d", resultsField.Len())
	}
}

func TestDataSource_ExecuteQuery_timeMacros(t *testing.T) {
	var gotFrom string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		gotFrom = r.URL.Query().Get("$fromtime")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	_, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations?$filter=phenomenonTime ge __from&$fromtime=$__isoFrom()",
		Fields: []JsonField{
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotFrom != "2021-05-17T20:47:00.000Z" {
		t.Errorf("expected macro substitution, got %q", gotFrom)
	}
}

func TestDataSource_ExecuteQuery_caching(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	query := JsonApiQuery{
		RefID:                "A",
		URLPath:              "/Datastreams(1)/Observations",
		CacheDurationSeconds: 60,
		Fields: []JsonField{
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}

	_, err := ds.executeQuery(context.Background(), query, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_, err = ds.executeQuery(context.Background(), query, backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if requestCount != 1 {
		t.Errorf("expected 1 request due to caching, got %d", requestCount)
	}
}

func TestDataSource_QueryData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	queryJSON := mustJSON(t, JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations",
		Fields: []JsonField{
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time"},
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	})

	resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
		PluginContext: backend.PluginContext{},
		Queries: []backend.DataQuery{
			{
				RefID: "A",
				JSON:  queryJSON,
				TimeRange: backend.TimeRange{
					From: time.Date(2021, 5, 17, 20, 47, 0, 0, time.UTC),
					To:   time.Date(2021, 5, 17, 20, 51, 0, 0, time.UTC),
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(resp.Responses) != 1 {
		t.Fatalf("expected 1 response, got %d", len(resp.Responses))
	}
	dataResponse := resp.Responses["A"]
	if dataResponse.Error != nil {
		t.Fatalf("unexpected response error: %v", dataResponse.Error)
	}
	if len(dataResponse.Frames) != 1 {
		t.Fatalf("expected 1 frame, got %d", len(dataResponse.Frames))
	}
}

func TestDataSource_CheckHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != backend.HealthStatusOk {
		t.Errorf("expected ok status, got %v", result.Status)
	}
}

func TestDataSource_CheckHealth_failure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != backend.HealthStatusError {
		t.Errorf("expected error status, got %v", result.Status)
	}
}

func TestDataSource_AnnotationsNotExecuted(t *testing.T) {
	ds := newTestDataSource(t, "http://example.com")

	resp, err := ds.QueryData(context.Background(), &backend.QueryDataRequest{
		Queries: []backend.DataQuery{
			{
				RefID:     "A",
				QueryType: "annotations",
				JSON:      []byte(`{}`),
			},
		},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	dataResponse := resp.Responses["A"]
	if dataResponse.Error != nil {
		t.Fatalf("unexpected response error: %v", dataResponse.Error)
	}
	if len(dataResponse.Frames) != 0 {
		t.Fatalf("expected no frames for annotation queries, got %d", len(dataResponse.Frames))
	}
}

func TestBuildURL_queryParams(t *testing.T) {
	ds := &DataSource{settings: backend.DataSourceInstanceSettings{
		URL:      "https://example.org/v1.1/",
		JSONData: json.RawMessage(`{"queryParams": "user=admin&password=secret"}`),
	}}

	url, err := ds.buildURL("/Datastreams(1)/Observations", map[string]string{"$top": "10"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := "https://example.org/v1.1/Datastreams(1)/Observations?%24top=10&password=secret&user=admin"
	if url != expected {
		t.Errorf("expected %q, got %q", expected, url)
	}
}

func TestReplaceMacros(t *testing.T) {
	tr := backend.TimeRange{
		From: time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC),
		To:   time.Date(2021, 5, 17, 20, 50, 23, 0, time.UTC),
	}

	testCases := map[string]string{
		"$__isoFrom()":       "2021-05-17T20:48:09.000Z",
		"$__isoTo()":         "2021-05-17T20:50:23.000Z",
		"$__unixEpochFrom()": "1621284489",
		"$__unixEpochTo()":   "1621284623",
	}

	for input, expected := range testCases {
		got := replaceMacros(input, tr)
		if got != expected {
			t.Errorf("replaceMacros(%q) = %q, expected %q", input, got, expected)
		}
	}
}

func TestParseValues_number(t *testing.T) {
	values, err := parseValues([]interface{}{"1.5", "2", nil}, data.FieldTypeFloat64)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := []interface{}{1.5, 2.0, nil}
	if fmt.Sprintf("%v", values) != fmt.Sprintf("%v", expected) {
		t.Errorf("expected %v, got %v", expected, values)
	}
}

func TestParseValues_boolean(t *testing.T) {
	values, err := parseValues([]interface{}{"true", "False", 0}, data.FieldTypeBool)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := []interface{}{true, false, false}
	if fmt.Sprintf("%v", values) != fmt.Sprintf("%v", expected) {
		t.Errorf("expected %v, got %v", expected, values)
	}
}

func TestDetectFieldType(t *testing.T) {
	testCases := []struct {
		name     string
		values   []interface{}
		expected data.FieldType
	}{
		{"timestamps", []interface{}{"2021-05-17T20:48:09.000Z", "2021-05-17T20:48:10.000Z"}, data.FieldTypeTime},
		{"numbers", []interface{}{1.0, 2.0}, data.FieldTypeFloat64},
		{"booleans", []interface{}{true, false}, data.FieldTypeBool},
		{"strings", []interface{}{"a", "b"}, data.FieldTypeString},
		{"nulls", []interface{}{nil, nil}, data.FieldTypeString},
		{"mixed", []interface{}{1.0, "b"}, data.FieldTypeString},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := detectFieldType(tc.values)
			if got != tc.expected {
				t.Errorf("expected %v, got %v", tc.expected, got)
			}
		})
	}
}

func TestTTLCache(t *testing.T) {
	cache := NewTTLCache()

	cache.Put("key", []byte("value"), 60)
	if _, err := cache.Get("key"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	cache.Del("key")
	value, _ := cache.Get("key")
	if value != nil {
		t.Errorf("expected nil after Del, got %q", value)
	}

	// Expired entries are removed.
	cache.Put("expired", []byte("value"), 0)
	cache.mu.Lock()
	// The entry expires immediately with a 0-second TTL.
	cache.items["expired"] = cacheItem{value: []byte("value"), expires: time.Now().Add(-time.Second)}
	cache.mu.Unlock()

	value, _ = cache.Get("expired")
	if value != nil {
		t.Errorf("expected nil after expiry, got %q", value)
	}
}
