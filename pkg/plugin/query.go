package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

var (
	fromPattern = regexp.MustCompile(`(?i)__from`)
	toPattern   = regexp.MustCompile(`(?i)__to`)
)

const (
	// isoFormat matches JavaScript's Date.toISOString(): always three
	// millisecond digits and a trailing Z.
	isoFormat = "2006-01-02T15:04:05.000Z"

	unixEpochFromPattern = `$__unixEpochFrom()`
	unixEpochToPattern   = `$__unixEpochTo()`
	isoFromPattern       = `$__isoFrom()`
	isoToPattern         = `$__isoTo()`
)

// executeQuery runs a single query against the SensorThings API and returns
// the resulting data frames. This is a server-side port of the frontend's
// doRequest() method, so that panels keep working on externally shared
// dashboards where only the plugin backend is executed.
func (d *DataSource) executeQuery(ctx context.Context, q JsonApiQuery, tr backend.TimeRange) (data.Frames, error) {
	// Automatically add time filter.
	//
	// Note: Grafana always sends a time range for panel queries, so the
	// frontend guards checking for an undefined range are not needed here.
	urlPath := q.URLPath

	if containsIgnoreCase(urlPath, "__from") {
		urlPath = fromPattern.ReplaceAllString(urlPath, tr.From.UTC().Format(isoFormat))
	}
	if containsIgnoreCase(urlPath, "__to") {
		urlPath = toPattern.ReplaceAllString(urlPath, tr.To.UTC().Format(isoFormat))
	}

	if !(containsIgnoreCase(urlPath, "expand") || containsIgnoreCase(urlPath, "filter")) {
		urlPath = strings.TrimSpace(urlPath) +
			"&$filter=phenomenonTime ge " + tr.From.UTC().Format(isoFormat) +
			" and phenomenonTime le " + tr.To.UTC().Format(isoFormat)
	}

	// Default page size.
	if !strings.Contains(urlPath, "top") {
		urlPath = urlPath + "&$top=1000"
	}

	// Turn a leading "&" into "?" so that paths without an explicit query
	// string still produce a valid query string. For example
	// "/Things&$top=1000" becomes "/Things?$top=1000". This is a slight
	// improvement over the frontend, which appends "&" unconditionally.
	if !strings.Contains(urlPath, "?") {
		if idx := strings.Index(urlPath, "&"); idx >= 0 {
			urlPath = urlPath[:idx] + "?" + urlPath[idx+1:]
		}
	}

	// Substitute time macros. The URL path may use Grafana macros such as
	// $__isoFrom() which need to be replaced with the actual time range.
	urlPath = replaceMacros(urlPath, tr)

	json, err := d.fetchJSON(ctx, q, urlPath)
	if err != nil {
		return nil, err
	}

	// Implements OGC paging:
	// https://docs.opengeospatial.org/is/15-078r6/15-078r6.html#57
	for {
		nextLink, ok := json["@iot.nextLink"].(string)
		if !ok || nextLink == "" {
			break
		}

		// The next link contains the full query string; combine it with the
		// base path of the original request.
		pageURL := ""
		if idx := strings.LastIndex(nextLink, "?"); idx >= 0 {
			pageURL = nextLink[idx+1:]
		}

		newURL := q.URLPath
		if idx := strings.Index(newURL, "?"); idx >= 0 {
			newURL = newURL[:idx]
		}
		if pageURL != "" {
			newURL = newURL + "?" + pageURL
		}

		if pageURL == "" {
			// No query string in the next link; the whole thing is already a
			// path.
			newURL = nextLink
		}

		json2, err := d.fetchJSON(ctx, q, newURL)
		if err != nil {
			return nil, err
		}

		value1, _ := json["value"].([]interface{})
		value2, _ := json2["value"].([]interface{})

		json["value"] = append(value1, value2...)

		if next2, ok := json2["@iot.nextLink"].(string); ok && next2 != "" {
			json["@iot.nextLink"] = next2
		} else {
			delete(json, "@iot.nextLink")
		}
	}

	fields, err := extractFields(q, json)
	if err != nil {
		return nil, err
	}

	frames, err := buildFrames(q, fields)
	if err != nil {
		return nil, err
	}

	return frames, nil
}

// fetchJSON fetches the response for the given URL path and returns the
// decoded JSON document, using the cache if configured.
func (d *DataSource) fetchJSON(ctx context.Context, q JsonApiQuery, urlPath string) (map[string]interface{}, error) {
	method := q.Method
	if method == "" {
		method = http.MethodGet
	}

	// Merge the configured query string and the query parameters. The
	// parameters configured on the query override the ones in the query
	// string appended to the path (this mirrors the frontend, where explicit
	// query parameters are appended to the URL).
	params, err := parseURLQuery(urlPathQueryString(urlPath))
	if err != nil {
		return nil, fmt.Errorf("invalid query string: %w", err)
	}

	url, err := d.buildURL(urlPathBase(urlPath), params)
	if err != nil {
		return nil, err
	}

	get := func() (map[string]interface{}, error) {
		code, responseBody, err := d.fetch(ctx, method, url, q.Headers, q.Body)
		if err != nil {
			return nil, err
		}
		if code < 200 || code > 299 {
			return nil, fmt.Errorf("request failed with status %d", code)
		}

		var result map[string]interface{}
		if err := json.Unmarshal(responseBody, &result); err != nil {
			return nil, fmt.Errorf("could not parse response as JSON: %w", err)
		}
		return result, nil
	}

	if q.CacheDurationSeconds <= 0 {
		return get()
	}

	cached, err := d.cache.Get(url)
	if err != nil {
		return nil, err
	}
	if cached != nil {
		var result map[string]interface{}
		if err := json.Unmarshal(cached, &result); err != nil {
			return nil, fmt.Errorf("could not parse cached response: %w", err)
		}
		return result, nil
	}

	result, err := get()
	if err != nil {
		return nil, err
	}

	raw, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	d.cache.Put(url, raw, q.CacheDurationSeconds)

	return result, nil
}

// buildFrames creates the data frames from the extracted fields.
func buildFrames(q JsonApiQuery, fields []field) (data.Frames, error) {
	fieldsLen := -1
	for _, f := range fields {
		if fieldsLen == -1 {
			fieldsLen = len(f.values)
		} else if fieldsLen != len(f.values) {
			return nil, fmt.Errorf("fields have different lengths")
		}
	}

	frame := data.NewFrame(q.RefID, toDataFields(fields)...)
	frame.RefID = q.RefID

	if groupByField := q.isGroupBy(); groupByField != "" {
		return groupBy(frame, groupByField, q.isMetricField()), nil
	}

	if metricField := q.isMetricField(); metricField != "" {
		for _, f := range frame.Fields {
			if f.Name == metricField {
				f.Config = &data.FieldConfig{DisplayNameFromDS: frame.Name}
			}
		}
	}

	return data.Frames{frame}, nil
}

// replaceMacros substitutes all available Grafana time macros with their
// current value. This mirrors the frontend's replaceMacros().
func replaceMacros(str string, tr backend.TimeRange) string {
	str = strings.ReplaceAll(str, unixEpochFromPattern, fmt.Sprintf("%d", tr.From.Unix()))
	str = strings.ReplaceAll(str, unixEpochToPattern, fmt.Sprintf("%d", tr.To.Unix()))
	str = strings.ReplaceAll(str, isoFromPattern, tr.From.UTC().Format(isoFormat))
	str = strings.ReplaceAll(str, isoToPattern, tr.To.UTC().Format(isoFormat))
	return str
}

// urlPathBase returns the part of the path before the query string.
func urlPathBase(path string) string {
	if idx := strings.Index(path, "?"); idx >= 0 {
		return path[:idx]
	}
	return path
}

// urlPathQueryString returns the query string part of the path without the
// leading "?".
func urlPathQueryString(path string) string {
	if idx := strings.Index(path, "?"); idx >= 0 {
		return path[idx+1:]
	}
	return ""
}

func containsIgnoreCase(s, substr string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(substr))
}
