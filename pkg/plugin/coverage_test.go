package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/PaesslerAG/jsonpath"
	"github.com/blues/jsonata-go"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// ---------------------------------------------------------------------------
// extractFields
// ---------------------------------------------------------------------------

func TestExtractFields_autoNamingAndTypeDetection(t *testing.T) {
	fields, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{JSONPath: "$.value[*].result"},
			{JSONPath: "$.value[*].phenomenonTime"},
		},
	}, sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(fields) != 2 {
		t.Fatalf("expected 2 fields, got %d", len(fields))
	}
	if fields[0].name != "result0" || fields[1].name != "result1" {
		t.Errorf("expected auto-generated names result0/result1, got %q/%q", fields[0].name, fields[1].name)
	}
	if fields[0].ftype != data.FieldTypeFloat64 {
		t.Errorf("expected detected Float64 type, got %v", fields[0].ftype)
	}
	if fields[1].ftype != data.FieldTypeTime {
		t.Errorf("expected detected Time type, got %v", fields[1].ftype)
	}
}

func TestExtractFields_singleUnnamedFieldGetsResult(t *testing.T) {
	fields, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{JSONPath: "$.value[*].result"},
		},
	}, sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fields) != 1 || fields[0].name != "result" {
		t.Fatalf("expected single field named result, got %+v", fields)
	}
}

func TestExtractFields_emptyPathSkipped(t *testing.T) {
	fields, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "NoPath", JSONPath: ""},
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number"},
		},
	}, sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fields) != 1 {
		t.Fatalf("expected 1 field, got %d", len(fields))
	}
	if fields[0].name != "Result" {
		t.Errorf("expected field Result, got %q", fields[0].name)
	}
}

func TestExtractFields_pathWithoutDollarGetsPrefix(t *testing.T) {
	// JSONPath without a leading "$" is accepted by jsonpath-plus but not by
	// the Go implementation; the path must be prefixed with "$.".
	fields, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "Result", JSONPath: "value[*].result", Type: "number"},
		},
	}, sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fields) != 1 || len(fields[0].values) != 2 {
		t.Fatalf("expected 1 field with 2 values, got %+v", fields)
	}
}

func TestExtractFields_jsonataCompileError(t *testing.T) {
	_, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "X", JSONPath: "(", Language: QueryLanguageJSONata},
		},
	}, sampleObservations())
	if err == nil {
		t.Fatal("expected error for invalid JSONata expression")
	}
	if !strings.Contains(err.Error(), "could not compile JSONata expression") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestExtractFields_jsonataEvalError(t *testing.T) {
	// $.missing evaluates to "no results found".
	_, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "X", JSONPath: "$.missing", Language: QueryLanguageJSONata},
		},
	}, sampleObservations())
	if err == nil {
		t.Fatal("expected error for JSONata expression without results")
	}
	if !strings.Contains(err.Error(), "JSONata evaluation failed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestExtractFields_jsonpathError(t *testing.T) {
	_, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "X", JSONPath: "$["},
		},
	}, sampleObservations())
	if err == nil {
		t.Fatal("expected error for invalid JSONPath")
	}
	if !strings.Contains(err.Error(), "JSONPath evaluation failed") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestExtractFields_invalidFieldType(t *testing.T) {
	_, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "X", JSONPath: "$.value[*].result", Type: "banana"},
		},
	}, sampleObservations())
	if err == nil {
		t.Fatal("expected error for unsupported field type")
	}
	if !strings.Contains(err.Error(), `unsupported field type "banana"`) {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestExtractFields_parseValuesErrorPropagation(t *testing.T) {
	// Mixed numbers and strings in a time field cannot be parsed.
	doc := map[string]interface{}{
		"value": []interface{}{
			map[string]interface{}{"phenomenonTime": 123, "result": 1},
			map[string]interface{}{"phenomenonTime": "2021-05-17T20:48:09.000Z", "result": 2},
		},
	}
	_, err := extractFields(JsonApiQuery{
		Fields: []JsonField{
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time"},
		},
	}, doc)
	if err == nil {
		t.Fatal("expected error for mixed time values")
	}
	if !strings.Contains(err.Error(), "unsupported time property") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestFieldTypeFromString(t *testing.T) {
	testCases := []struct {
		in   string
		want data.FieldType
	}{
		{"time", data.FieldTypeTime},
		{"number", data.FieldTypeFloat64},
		{"string", data.FieldTypeString},
		{"boolean", data.FieldTypeBool},
	}

	for _, tc := range testCases {
		got, err := fieldTypeFromString(tc.in)
		if err != nil {
			t.Errorf("fieldTypeFromString(%q): unexpected error: %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("fieldTypeFromString(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}

	if _, err := fieldTypeFromString("banana"); err == nil {
		t.Error("expected error for unsupported field type")
	}
}

// ---------------------------------------------------------------------------
// toDataField / toDataFields
// ---------------------------------------------------------------------------

func TestToDataField_numberFieldWithNonNumber(t *testing.T) {
	f := toDataField(field{name: "N", ftype: data.FieldTypeFloat64, values: []interface{}{nil, "not-a-number", 1.5}})
	if f.Type() != data.FieldTypeNullableFloat64 {
		t.Fatalf("expected nullable float64 field, got %v", f.Type())
	}
	if !f.NilAt(0) || !f.NilAt(1) {
		t.Errorf("expected nulls at indices 0 and 1")
	}
	if v, ok := f.At(2).(*float64); !ok || *v != 1.5 {
		t.Errorf("expected 1.5 at index 2, got %v", f.At(2))
	}
}

func TestToDataField_boolFieldWithNonBool(t *testing.T) {
	f := toDataField(field{name: "B", ftype: data.FieldTypeBool, values: []interface{}{true, "nope"}})
	if f.Type() != data.FieldTypeNullableBool {
		t.Fatalf("expected nullable bool field, got %v", f.Type())
	}
	if !f.NilAt(1) {
		t.Errorf("expected null at index 1")
	}
	if v, ok := f.At(0).(*bool); !ok || !*v {
		t.Errorf("expected true at index 0, got %v", f.At(0))
	}
}

func TestToDataField_stringFieldCoercesValues(t *testing.T) {
	f := toDataField(field{name: "S", ftype: data.FieldTypeString, values: []interface{}{"plain", 1.5, true, nil}})
	if f.Type() != data.FieldTypeNullableString {
		t.Fatalf("expected nullable string field, got %v", f.Type())
	}
	expected := []string{"plain", "1.5", "true", ""}
	for i, e := range expected {
		if i == 3 {
			if !f.NilAt(3) {
				t.Errorf("expected null at index 3")
			}
			continue
		}
		v, ok := f.At(i).(*string)
		if !ok || *v != e {
			t.Errorf("expected %q at index %d, got %v", e, i, f.At(i))
		}
	}
}

func TestToDataField_timeFieldWithNonNumber(t *testing.T) {
	f := toDataField(field{name: "T", ftype: data.FieldTypeTime, values: []interface{}{"not-ms", float64(time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC).UnixMilli())}})
	if f.Type() != data.FieldTypeNullableTime {
		t.Fatalf("expected nullable time field, got %v", f.Type())
	}
	if !f.NilAt(0) {
		t.Errorf("expected null at index 0")
	}
	if v, ok := f.At(1).(*time.Time); !ok || !v.Equal(time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC)) {
		t.Errorf("unexpected value at index 1: %v", f.At(1))
	}
}

func TestToDataFields_empty(t *testing.T) {
	fields := toDataFields(nil)
	if len(fields) != 0 {
		t.Fatalf("expected no fields, got %d", len(fields))
	}
}

// ---------------------------------------------------------------------------
// nullableType
// ---------------------------------------------------------------------------

func TestNullableType(t *testing.T) {
	testCases := []struct {
		name string
		in   data.FieldType
		want data.FieldType
	}{
		{"time", data.FieldTypeTime, data.FieldTypeNullableTime},
		{"already nullable time", data.FieldTypeNullableTime, data.FieldTypeNullableTime},
		{"float32", data.FieldTypeFloat32, data.FieldTypeNullableFloat64},
		{"float64", data.FieldTypeFloat64, data.FieldTypeNullableFloat64},
		{"int64", data.FieldTypeInt64, data.FieldTypeNullableFloat64},
		{"uint8", data.FieldTypeUint8, data.FieldTypeNullableFloat64},
		{"bool", data.FieldTypeBool, data.FieldTypeNullableBool},
		{"string", data.FieldTypeString, data.FieldTypeNullableString},
		{"default", data.FieldTypeJSON, data.FieldTypeNullableString},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nullableType(tc.in); got != tc.want {
				t.Errorf("nullableType(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// wrap / toArray
// ---------------------------------------------------------------------------

func TestWrap(t *testing.T) {
	// A whole array selected by the path is returned as-is.
	arr, err := jsonpath.Get("$.value", sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	wrapped := wrap(arr)
	if len(wrapped) != 2 {
		t.Fatalf("expected 2 values, got %d", len(wrapped))
	}

	// A single scalar match is wrapped into a single-element array.
	scalar, err := jsonpath.Get("$.value[0].result", sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	wrapped = wrap(scalar)
	if len(wrapped) != 1 || wrapped[0] != 0.5 {
		t.Errorf("expected single wrapped value 0.5, got %v", wrapped)
	}
}

func TestToArray(t *testing.T) {
	// An array result is passed through.
	expr, err := jsonata.Compile("$.value.result")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	result, err := expr.Eval(sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if arr := toArray(result); len(arr) != 2 {
		t.Errorf("expected 2 values, got %d", len(arr))
	}

	// A scalar result is wrapped.
	expr, err = jsonata.Compile("$count($.value.result)")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	result, err = expr.Eval(sampleObservations())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	arr := toArray(result)
	if len(arr) != 1 {
		t.Fatalf("expected 1 value, got %d", len(arr))
	}
	if n, ok := arr[0].(int); !ok || n != 2 {
		t.Errorf("expected count 2, got %v (%T)", arr[0], arr[0])
	}
}

// ---------------------------------------------------------------------------
// parseValues
// ---------------------------------------------------------------------------

func TestParseValues_stringObjectCoercedToJSON(t *testing.T) {
	values, err := parseValues([]interface{}{map[string]interface{}{"a": 1}, "plain", nil}, data.FieldTypeString)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := []interface{}{`{"a":1}`, "plain", nil}
	if fmt.Sprintf("%v", values) != fmt.Sprintf("%v", expected) {
		t.Errorf("expected %v, got %v", expected, values)
	}
}

func TestParseValues_numberError(t *testing.T) {
	_, err := parseValues([]interface{}{"abc"}, data.FieldTypeFloat64)
	if err == nil {
		t.Fatal("expected error for non-numeric value")
	}
	if !strings.Contains(err.Error(), "'abc' is not a number") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseValues_booleanError(t *testing.T) {
	_, err := parseValues([]interface{}{"maybe"}, data.FieldTypeBool)
	if err == nil {
		t.Fatal("expected error for non-boolean value")
	}
	if !strings.Contains(err.Error(), "found non-boolean values") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseValues_unsupportedType(t *testing.T) {
	_, err := parseValues([]interface{}{1.0}, data.FieldTypeJSON)
	if err == nil {
		t.Fatal("expected error for unsupported field type")
	}
	if !strings.Contains(err.Error(), "unsupported field type") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseValues_numberTypes(t *testing.T) {
	// Non-float64 numeric types are accepted for number fields.
	values, err := parseValues([]interface{}{3, int64(4), nil}, data.FieldTypeInt64)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := []interface{}{3.0, 4.0, nil}
	if fmt.Sprintf("%v", values) != fmt.Sprintf("%v", expected) {
		t.Errorf("expected %v, got %v", expected, values)
	}
}

// ---------------------------------------------------------------------------
// parseTimeValues
// ---------------------------------------------------------------------------

func TestParseTimeValues_interval(t *testing.T) {
	// Intervals are not implemented; the interval start is used and null
	// values are dropped.
	values, err := parseTimeValues([]interface{}{
		"2021-05-17T20:48:09.000Z/2021-05-17T20:48:19.000Z",
		nil,
		"2021-05-17T20:48:29.000Z/P1D",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(values) != 2 {
		t.Fatalf("expected 2 values (null dropped), got %d", len(values))
	}
	expected := float64(time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC).UnixMilli())
	if values[0] != expected {
		t.Errorf("expected %v, got %v", expected, values[0])
	}
}

func TestParseTimeValues_intervalUnparseable(t *testing.T) {
	_, err := parseTimeValues([]interface{}{"not-a-date/foo"})
	if err == nil {
		t.Fatal("expected error for unparseable interval start")
	}
	if !strings.Contains(err.Error(), "could not parse time value") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseTimeValues_unparseableString(t *testing.T) {
	_, err := parseTimeValues([]interface{}{"not-a-date"})
	if err == nil {
		t.Fatal("expected error for unparseable time value")
	}
	if !strings.Contains(err.Error(), `could not parse time value "not-a-date"`) {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseTimeValues_mixedTypes(t *testing.T) {
	_, err := parseTimeValues([]interface{}{"2021-05-17T20:48:09.000Z", 1.0})
	if err == nil {
		t.Fatal("expected error for mixed time values")
	}
	if !strings.Contains(err.Error(), "unsupported time property") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestParseTimeValues_millisecondsPassthrough(t *testing.T) {
	// Values >= 1e12 are already milliseconds and pass through untouched.
	values, err := parseTimeValues([]interface{}{float64(1621284489000), nil, 1.0})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := []interface{}{float64(1621284489000), nil, 1000.0}
	if fmt.Sprintf("%v", values) != fmt.Sprintf("%v", expected) {
		t.Errorf("expected %v, got %v", expected, values)
	}
}

func TestParseTimeValues_empty(t *testing.T) {
	// A query that returns no observations must not fail: the frontend passes
	// an empty array through, so the backend has to do the same (otherwise
	// alert rules evaluated over a range without data error out).
	values, err := parseTimeValues([]interface{}{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(values) != 0 {
		t.Errorf("expected empty values, got %v", values)
	}
}

func TestParseTimeValues_allNull(t *testing.T) {
	// All-null values are preserved, mirroring the frontend.
	values, err := parseTimeValues([]interface{}{nil, nil})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if fmt.Sprintf("%v", values) != "[<nil> <nil>]" {
		t.Errorf("expected two nulls, got %v", values)
	}
}

func TestParseTimeValues_extractFieldsEmptyResult(t *testing.T) {
	// Regression test: extractFields on a response without observations used
	// to fail with `field "Time": unsupported time property`, breaking alert
	// rule evaluation whenever the evaluated time range had no data.
	q := JsonApiQuery{
		Fields: []JsonField{
			{Name: "Time", JSONPath: "$.value[*].phenomenonTime", Type: "time", Language: "jsonpath"},
			{Name: "Result", JSONPath: "$.value[*].result", Type: "number", Language: "jsonpath"},
		},
	}
	fields, err := extractFields(q, map[string]interface{}{"@iot.count": 0, "value": []interface{}{}})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(fields) != 2 {
		t.Fatalf("expected 2 fields, got %d", len(fields))
	}
	if len(fields[0].values) != 0 || len(fields[1].values) != 0 {
		t.Errorf("expected empty field values, got %v / %v", fields[0].values, fields[1].values)
	}
}

// ---------------------------------------------------------------------------
// helpers used by parse* / groupBy
// ---------------------------------------------------------------------------

func TestToFloat64(t *testing.T) {
	testCases := []struct {
		name string
		in   interface{}
		want float64
	}{
		{"float64", float64(1.5), 1.5},
		{"float32", float32(1.5), 1.5},
		{"int", 42, 42},
		{"int8", int8(1), 1},
		{"int16", int16(2), 2},
		{"int32", int32(3), 3},
		{"int64", int64(4), 4},
		{"uint", uint(5), 5},
		{"uint8", uint8(6), 6},
		{"uint16", uint16(7), 7},
		{"uint32", uint32(8), 8},
		{"uint64", uint64(9), 9},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := toFloat64(tc.in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Errorf("toFloat64(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}

	if _, err := toFloat64("nope"); err == nil {
		t.Error("expected error for non-numeric value")
	}
}

func TestDayjsValueOf(t *testing.T) {
	// Numeric strings are interpreted as epoch milliseconds.
	ms, err := dayjsValueOf("1621284489000")
	if err != nil || ms != 1621284489000 {
		t.Errorf("expected 1621284489000, got %d (err %v)", ms, err)
	}

	iso, err := dayjsValueOf("2021-05-17T20:48:09.000Z")
	if err != nil || iso != time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC).UnixMilli() {
		t.Errorf("unexpected ISO parse result: %d (err %v)", iso, err)
	}

	space, err := dayjsValueOf("2021-05-17 20:48:09")
	if err != nil || space != time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC).UnixMilli() {
		t.Errorf("unexpected space-format parse result: %d (err %v)", space, err)
	}

	dateOnly, err := dayjsValueOf("2021-05-17")
	if err != nil || dateOnly != time.Date(2021, 5, 17, 0, 0, 0, 0, time.UTC).UnixMilli() {
		t.Errorf("unexpected date-only parse result: %d (err %v)", dateOnly, err)
	}

	if _, err := dayjsValueOf("nope"); err == nil {
		t.Error("expected error for unparseable value")
	}
}

func TestToJSONString(t *testing.T) {
	got := toJSONString(map[string]interface{}{"a": 1})
	if got != `{"a":1}` {
		t.Errorf("expected %q, got %q", `{"a":1}`, got)
	}

	// Values that cannot be marshaled fall back to fmt.Sprintf.
	ch := make(chan int)
	fallback := toJSONString(ch)
	if fallback != fmt.Sprintf("%v", ch) {
		t.Errorf("expected fallback %q, got %q", fmt.Sprintf("%v", ch), fallback)
	}
}

func TestNonNullValues(t *testing.T) {
	if got := nonNullValues([]interface{}{nil, nil}); got != nil {
		t.Errorf("expected nil for all-null input, got %v", got)
	}
	got := nonNullValues([]interface{}{nil, 1.0})
	if len(got) != 1 || got[0] != 1.0 {
		t.Errorf("expected [1] filtered values, got %v", got)
	}
}

func TestIsNumberValue(t *testing.T) {
	for _, v := range []interface{}{1, int64(2), uint(3), float32(4), float64(5)} {
		if !isNumberValue(v) {
			t.Errorf("expected %v (%T) to be a number value", v, v)
		}
	}
	if isNumberValue("5") {
		t.Error("expected string to not be a raw number value")
	}
}

func TestAllValidISO(t *testing.T) {
	valid := []interface{}{"2021-05-17T20:48:09.000Z", nil}
	if !allValidISO(valid) {
		t.Error("expected valid ISO values to pass")
	}
	for name, values := range map[string][]interface{}{
		"too short":   {"short"},
		"non-string":  {1.0},
		"invalid ISO": {"2021-99-99T99:99:99.000Z"},
	} {
		if allValidISO(values) {
			t.Errorf("expected %s values to fail", name)
		}
	}
}

func TestAllNull(t *testing.T) {
	if !allNull(nil) {
		t.Error("expected empty slice to be all null")
	}
	if !allNull([]interface{}{nil, nil}) {
		t.Error("expected all-nil slice to be all null")
	}
	if allNull([]interface{}{nil, 1.0}) {
		t.Error("expected slice with a value to not be all null")
	}
}

func TestIsValidISO(t *testing.T) {
	for _, s := range []string{
		"2021-05-17T20:48:09.000Z",
		"2021-05-17T20:48:09Z",
		"2021-05-17T20:48:09",
		"2021-05-17 20:48:09",
		"2021-05-17",
	} {
		if !isValidISO(s) {
			t.Errorf("expected %q to be a valid ISO timestamp", s)
		}
	}
	if isValidISO("not a date") {
		t.Error("expected invalid timestamp to fail")
	}
}

// ---------------------------------------------------------------------------
// valueString / derefValue
// ---------------------------------------------------------------------------

func TestValueString(t *testing.T) {
	f := 1.5
	now := time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC)

	testCases := []struct {
		name string
		in   interface{}
		want string
	}{
		{"nil", nil, "<nil>"},
		{"float64", float64(1.5), "1.5"},
		{"float32", float32(1.5), "1.5"},
		{"int64", int64(42), "42"},
		{"int", 42, "42"},
		{"bool", true, "true"},
		{"time", now, "2021-05-17T20:48:09.000Z"},
		{"pointer", &f, "1.5"},
		{"string", "x", "x"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := valueString(tc.in); got != tc.want {
				t.Errorf("valueString(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestDerefValue(t *testing.T) {
	if got := derefValue(nil); got != nil {
		t.Errorf("expected nil, got %v", got)
	}

	var nilPtr *int
	if got := derefValue(nilPtr); got != nil {
		t.Errorf("expected nil for nil pointer, got %v", got)
	}

	if got := derefValue(42); got != 42 {
		t.Errorf("expected pass-through, got %v", got)
	}

	// Single dereference.
	v := 42
	if got := derefValue(&v); got != 42 {
		t.Errorf("expected 42, got %v", got)
	}

	// Nested pointers are dereferenced recursively.
	p := &v
	pp := &p
	if got := derefValue(pp); got != 42 {
		t.Errorf("expected 42 after nested dereference, got %v", got)
	}
}

// ---------------------------------------------------------------------------
// parseURLQuery / url helpers
// ---------------------------------------------------------------------------

func TestParseURLQuery(t *testing.T) {
	testCases := []struct {
		name     string
		in       string
		expected map[string]string
	}{
		{"leading question mark", "?a=1&b=2", map[string]string{"a": "1", "b": "2"}},
		{"empty segments skipped", "a=1&&b=2", map[string]string{"a": "1", "b": "2"}},
		{"key without value", "a", map[string]string{"a": ""}},
		{"empty string", "", map[string]string{}},
		{"only question mark", "?", map[string]string{}},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseURLQuery(tc.in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if fmt.Sprintf("%v", got) != fmt.Sprintf("%v", tc.expected) {
				t.Errorf("expected %v, got %v", tc.expected, got)
			}
		})
	}

	// Invalid percent escapes in a key and in a value must produce errors.
	for _, in := range []string{"%zz=1", "a=%zz"} {
		if _, err := parseURLQuery(in); err == nil {
			t.Errorf("expected error for invalid percent escape in %q", in)
		}
	}
}

func TestURLPathBaseAndQueryString(t *testing.T) {
	if got := urlPathBase("/Things?$top=5"); got != "/Things" {
		t.Errorf("expected /Things, got %q", got)
	}
	if got := urlPathBase("/Things"); got != "/Things" {
		t.Errorf("expected /Things, got %q", got)
	}
	if got := urlPathQueryString("/Things?$top=5"); got != "$top=5" {
		t.Errorf("expected $top=5, got %q", got)
	}
	if got := urlPathQueryString("/Things"); got != "" {
		t.Errorf("expected empty query string, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// buildFrames / groupBy
// ---------------------------------------------------------------------------

func TestBuildFrames_metricField(t *testing.T) {
	frames, err := buildFrames(JsonApiQuery{RefID: "A", ExperimentalMetricField: "Result"}, []field{
		{name: "Time", ftype: data.FieldTypeTime, values: []interface{}{float64(time.Date(2021, 5, 17, 20, 48, 9, 0, time.UTC).UnixMilli())}},
		{name: "Result", ftype: data.FieldTypeFloat64, values: []interface{}{1.0}},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(frames) != 1 {
		t.Fatalf("expected 1 frame, got %d", len(frames))
	}

	resultField, _ := frames[0].FieldByName("Result")
	if resultField == nil {
		t.Fatal("missing Result field")
	}
	if resultField.Config == nil || resultField.Config.DisplayNameFromDS != "A" {
		t.Errorf("expected displayNameFromDS to be the frame name, got %+v", resultField.Config)
	}
}

func TestBuildFrames_fieldsWithDifferentLengths(t *testing.T) {
	_, err := buildFrames(JsonApiQuery{RefID: "A"}, []field{
		{name: "A", ftype: data.FieldTypeFloat64, values: []interface{}{1.0}},
		{name: "B", ftype: data.FieldTypeFloat64, values: []interface{}{1.0, 2.0}},
	})
	if err == nil {
		t.Fatal("expected error for fields with different lengths")
	}
	if !strings.Contains(err.Error(), "fields have different lengths") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestGroupBy_missingFieldReturnsFrame(t *testing.T) {
	frame := data.NewFrame("A", data.NewField("X", nil, []float64{1, 2}))
	frames := groupBy(frame, "Missing", "")
	if len(frames) != 1 || frames[0] != frame {
		t.Fatalf("expected the original frame to be returned unchanged")
	}
}

// ---------------------------------------------------------------------------
// cache lifecycle
// ---------------------------------------------------------------------------

func TestTTLCache_lifecycle(t *testing.T) {
	cache := NewTTLCache()
	cache.Put("a", []byte("1"), 60)
	cache.Put("b", []byte("2"), 60)
	if cache.Len() != 2 {
		t.Fatalf("expected 2 items, got %d", cache.Len())
	}

	cache.Flush()
	if cache.Len() != 0 {
		t.Fatalf("expected 0 items after flush, got %d", cache.Len())
	}

	// A zero-duration entry expires immediately.
	cache.Put("c", []byte("3"), 0)
	if got, _ := cache.Get("c"); got != nil {
		t.Errorf("expected expired entry to be gone, got %q", got)
	}
	if cache.Len() != 0 {
		t.Errorf("expected expired entry to be evicted from Len, got %d", cache.Len())
	}
}

func TestDataSource_Dispose(t *testing.T) {
	ds := newTestDataSource(t, "http://example.org")
	ds.cache.Put("k", []byte("v"), 60)
	ds.Dispose()
	if ds.cache.Len() != 0 {
		t.Errorf("expected cache to be empty after dispose, got %d", ds.cache.Len())
	}
}

func TestFetchJSON_corruptCachedResponse(t *testing.T) {
	ds := newTestDataSource(t, "http://example.org")

	urlPath := "/Things?$filter=phenomenonTime ge 2021-05-17T20:47:00.000Z and phenomenonTime le 2021-05-17T20:51:00.000Z&$top=1000"
	params, err := parseURLQuery(urlPathQueryString(urlPath))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cacheKey, err := ds.buildURL(urlPathBase(urlPath), params)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ds.cache.Put(cacheKey, []byte("{broken"), 60)

	_, err = ds.fetchJSON(context.Background(), JsonApiQuery{
		URLPath:              "/Things",
		CacheDurationSeconds: 60,
	}, urlPath)
	if err == nil {
		t.Fatal("expected error for corrupt cached response")
	}
	if !strings.Contains(err.Error(), "could not parse cached response") {
		t.Errorf("unexpected error: %v", err)
	}
}

// ---------------------------------------------------------------------------
// fetch / truncate / parseFloat
// ---------------------------------------------------------------------------

func TestFetch_methodsHeadersAndErrors(t *testing.T) {
	var gotMethod, gotContentType, gotCustom string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotContentType = r.Header.Get("Content-Type")
		gotCustom = r.Header.Get("X-Custom")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(strings.Repeat("a", 600)))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	// POST with a body sets the Content-Type header.
	_, _, err := ds.fetch(context.Background(), http.MethodPost, server.URL, [][2]string{{"X-Custom", "yes"}}, `{"a":1}`)
	if err == nil {
		t.Fatal("expected error for non-2xx response")
	}
	if !strings.Contains(err.Error(), "request failed with status 400") {
		t.Errorf("expected status in error, got: %v", err)
	}
	if !strings.Contains(err.Error(), "...") {
		t.Errorf("expected truncated body in error, got: %v", err)
	}
	if gotMethod != http.MethodPost || gotContentType != "application/json" {
		t.Errorf("expected POST with application/json, got %s (%s)", gotMethod, gotContentType)
	}
	if gotCustom != "yes" {
		t.Errorf("expected custom header, got %q", gotCustom)
	}

	// GET without a body does not set the Content-Type header.
	_, _, err = ds.fetch(context.Background(), http.MethodGet, server.URL, nil, "")
	if err == nil {
		t.Fatal("expected error for non-2xx response")
	}
	if gotContentType != "" {
		t.Errorf("expected no content type for GET, got %q", gotContentType)
	}
}

func TestFetch_invalidRequestURL(t *testing.T) {
	ds := newTestDataSource(t, "http://example.org")
	if _, _, err := ds.fetch(context.Background(), http.MethodGet, "://bad", nil, ""); err == nil {
		t.Error("expected error for invalid request URL")
	}
}

func TestTruncate(t *testing.T) {
	if got := truncate("short", 500); got != "short" {
		t.Errorf("expected short string passthrough, got %q", got)
	}
	long := strings.Repeat("a", 600)
	got := truncate(long, 500)
	if len(got) != 503 || !strings.HasSuffix(got, "...") {
		t.Errorf("expected truncated prefix with ellipsis, got %q", got)
	}
}

func TestParseFloat(t *testing.T) {
	testCases := []struct {
		in   string
		want float64
	}{
		{"1.5", 1.5},
		{"1.5abc", 1.5},
		{"-1.5", -1.5},
		{"+2.5", 2.5},
		{" 3.14 ", 3.14},
		{"42", 42},
	}

	for _, tc := range testCases {
		got, err := parseFloat(tc.in)
		if err != nil {
			t.Errorf("parseFloat(%q): unexpected error: %v", tc.in, err)
			continue
		}
		if got != tc.want {
			t.Errorf("parseFloat(%q) = %v, want %v", tc.in, got, tc.want)
		}
	}

	for _, in := range []string{"abc", " ", "."} {
		if _, err := parseFloat(in); err == nil {
			t.Errorf("expected error for %q", in)
		}
	}
}

// ---------------------------------------------------------------------------
// query / executeQuery edge cases
// ---------------------------------------------------------------------------

func TestDataSource_queryMalformedJSON(t *testing.T) {
	ds := newTestDataSource(t, "http://example.org")
	resp := ds.query(context.Background(), backend.PluginContext{}, backend.DataQuery{
		RefID: "A",
		JSON:  []byte("{"),
	})
	if resp.Error == nil {
		t.Fatal("expected error for malformed query JSON")
	}
	if !strings.Contains(resp.Error.Error(), "could not unmarshal query JSON") {
		t.Errorf("unexpected error: %v", resp.Error)
	}
}

func TestDataSource_ExecuteQuery_pagingWithoutQueryStringInNextLink(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		var body map[string]interface{}
		if r.URL.Path == "/nextpage" {
			body = map[string]interface{}{
				"value": []interface{}{
					map[string]interface{}{"phenomenonTime": "2021-05-17T20:49:09.000Z", "result": 2.0},
				},
			}
		} else {
			body = map[string]interface{}{
				"value": []interface{}{
					map[string]interface{}{"phenomenonTime": "2021-05-17T20:48:09.000Z", "result": 1.0},
				},
				// A next link without a query string: the whole value is used
				// as the next path.
				"@iot.nextLink": "nextpage",
			}
		}
		_, _ = w.Write(mustJSON(t, body))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	frames, err := ds.executeQuery(context.Background(), JsonApiQuery{
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

	resultField, _ := frames[0].FieldByName("Result")
	if resultField == nil {
		t.Fatal("missing Result field")
	}
	if resultField.Len() != 2 {
		t.Fatalf("expected 2 concatenated values, got %d", resultField.Len())
	}
}

func TestDataSource_CheckHealth_missingURL(t *testing.T) {
	ds := &DataSource{cache: NewTTLCache()}
	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != backend.HealthStatusError {
		t.Errorf("expected error status, got %v", result.Status)
	}
	if !strings.Contains(result.Message, "missing data source URL") {
		t.Errorf("unexpected message: %q", result.Message)
	}
}

func TestDataSource_queryNetworkError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := server.URL
	server.Close()

	ds := newTestDataSource(t, url)
	resp := ds.query(context.Background(), backend.PluginContext{}, backend.DataQuery{
		RefID: "A",
		JSON:  mustJSON(t, JsonApiQuery{RefID: "A", URLPath: "/Things", Fields: []JsonField{{Name: "R", JSONPath: "$.value[*].result", Type: "number"}}}),
	})
	if resp.Error == nil {
		t.Fatal("expected error for unreachable server")
	}
}

func TestDataSource_ExecuteQuery_pathWithExpandSkipsAutoFilter(t *testing.T) {
	var gotFilter string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		gotFilter = r.URL.Query().Get("$filter")
		_, _ = w.Write(mustJSON(t, sampleObservations()))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)

	// When the path already contains an expand or filter clause, and a page
	// size, neither is appended automatically.
	_, err := ds.executeQuery(context.Background(), JsonApiQuery{
		RefID:   "A",
		URLPath: "/Datastreams(1)/Observations?$expand=Datastream&$top=5",
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

	if gotFilter != "" {
		t.Errorf("expected no auto-appended filter, got %q", gotFilter)
	}
}

func TestFetchJSON_fetchError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := server.URL
	server.Close()

	ds := newTestDataSource(t, url)
	_, err := ds.fetchJSON(context.Background(), JsonApiQuery{
		URLPath:              "/Things",
		CacheDurationSeconds: 60,
	}, "/Things?$top=1000")
	if err == nil {
		t.Fatal("expected error for unreachable server")
	}
}

func TestFetchJSON_nonJSONResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("this is not json"))
	}))
	defer server.Close()

	ds := newTestDataSource(t, server.URL)
	_, err := ds.fetchJSON(context.Background(), JsonApiQuery{
		URLPath: "/Things",
	}, "/Things?$top=1000")
	if err == nil {
		t.Fatal("expected error for non-JSON response")
	}
	if !strings.Contains(err.Error(), "could not parse response as JSON") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestNewDataSource_httpClientOptionsError(t *testing.T) {
	// Invalid JSONData makes the SDK's HTTPClientOptions (and therewith
	// NewDataSource) fail.
	_, err := NewDataSource(context.Background(), backend.DataSourceInstanceSettings{
		URL:      "http://example.org",
		JSONData: json.RawMessage(`{`),
	})
	if err == nil {
		t.Fatal("expected error for invalid settings JSON")
	}
}

func TestDataSource_CheckHealth_networkError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	url := server.URL
	server.Close()

	ds := newTestDataSource(t, url)
	result, err := ds.CheckHealth(context.Background(), &backend.CheckHealthRequest{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != backend.HealthStatusError {
		t.Errorf("expected error status, got %v", result.Status)
	}
}

// ---------------------------------------------------------------------------
// buildDataSourceSettings / buildURL
// ---------------------------------------------------------------------------

func TestBuildDataSourceSettings_missingURL(t *testing.T) {
	ds := &DataSource{settings: backend.DataSourceInstanceSettings{JSONData: json.RawMessage(`{}`)}}
	if _, _, err := ds.buildDataSourceSettings(); err == nil {
		t.Fatal("expected error for missing data source URL")
	}
}

func TestBuildDataSourceSettings_invalidJSON(t *testing.T) {
	ds := &DataSource{settings: backend.DataSourceInstanceSettings{
		URL:      "http://example.org",
		JSONData: json.RawMessage(`{`),
	}}
	if _, _, err := ds.buildDataSourceSettings(); err == nil {
		t.Fatal("expected error for invalid settings JSON")
	}
}

func TestBuildDataSourceSettings_invalidQueryParams(t *testing.T) {
	ds := &DataSource{settings: backend.DataSourceInstanceSettings{
		URL:      "http://example.org",
		JSONData: json.RawMessage(`{"queryParams": "%zz"}`),
	}}
	if _, _, err := ds.buildDataSourceSettings(); err == nil {
		t.Fatal("expected error for invalid query params")
	}
}

func TestBuildDataSourceSettings_nonStringQueryParamsIgnored(t *testing.T) {
	ds := &DataSource{settings: backend.DataSourceInstanceSettings{
		URL:      "http://example.org",
		JSONData: json.RawMessage(`{"queryParams": 5}`),
	}}
	baseURL, params, err := ds.buildDataSourceSettings()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if baseURL != "http://example.org" || len(params) != 0 {
		t.Errorf("expected URL and no params, got %q %v", baseURL, params)
	}
}

func TestBuildURL_pathWithExistingQueryString(t *testing.T) {
	ds := &DataSource{settings: backend.DataSourceInstanceSettings{
		URL:      "https://example.org/v1.1",
		JSONData: json.RawMessage(`{}`),
	}}

	url, err := ds.buildURL("/Observations?$top=5", map[string]string{"$skip": "5"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := "https://example.org/v1.1/Observations?$top=5&%24skip=5"
	if url != expected {
		t.Errorf("expected %q, got %q", expected, url)
	}

	// A trailing slash on the base URL and a leading slash on the path must
	// not produce a double slash.
	url, err = ds.buildURL("/Things", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://example.org/v1.1/Things" {
		t.Errorf("expected joined URL, got %q", url)
	}
}
