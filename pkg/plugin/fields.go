package plugin

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/PaesslerAG/jsonpath"
	"github.com/blues/jsonata-go"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// field is an extracted, typed column of values.
type field struct {
	name   string
	ftype  data.FieldType
	values []interface{} // nil entries represent null values
}

// fieldTypeFromString maps the field type strings stored by the frontend
// query editor to the corresponding SDK field types.
func fieldTypeFromString(s string) (data.FieldType, error) {
	switch s {
	case "time":
		return data.FieldTypeTime, nil
	case "number":
		return data.FieldTypeFloat64, nil
	case "string":
		return data.FieldTypeString, nil
	case "boolean":
		return data.FieldTypeBool, nil
	default:
		return data.FieldTypeString, fmt.Errorf("unsupported field type %q", s)
	}
}

// extractFields evaluates every declared field of the query against the JSON
// document and returns the resulting columns. This is a server-side port of
// the frontend's doRequest() field extraction.
func extractFields(q JsonApiQuery, json map[string]interface{}) ([]field, error) {
	var fields []field

	for index, f := range q.Fields {
		if !f.hasPath() {
			continue
		}

		var values []interface{}

		switch f.Language {
		case QueryLanguageJSONata:
			expression, err := jsonata.Compile(f.JSONPath)
			if err != nil {
				return nil, fmt.Errorf("field %d: could not compile JSONata expression: %w", index, err)
			}
			result, err := expression.Eval(json)
			if err != nil {
				return nil, fmt.Errorf("field %d: JSONata evaluation failed: %w", index, err)
			}
			// Ensure that we always return an array.
			values = toArray(result)
		default:
			path := f.JSONPath
			if !strings.HasPrefix(strings.TrimSpace(path), "$") && !strings.HasPrefix(strings.TrimSpace(path), "@") {
				// jsonpath-plus accepts paths without a leading "$", the Go
				// implementation does not.
				path = "$." + path
			}
			result, err := jsonpath.Get(path, json)
			if err != nil {
				return nil, fmt.Errorf("field %d: JSONPath evaluation failed: %w", index, err)
			}
			values = wrap(result)
		}

		name := f.Name
		if name == "" {
			if len(q.Fields) > 1 {
				name = fmt.Sprintf("result%d", index)
			} else {
				name = "result"
			}
		}

		ftype := data.FieldTypeString
		if f.Type != "" {
			var err error
			ftype, err = fieldTypeFromString(f.Type)
			if err != nil {
				return nil, fmt.Errorf("field %d: %w", index, err)
			}
		} else {
			ftype = detectFieldType(values)
		}

		typedValues, err := parseValues(values, ftype)
		if err != nil {
			return nil, fmt.Errorf("field %q: %w", name, err)
		}

		fields = append(fields, field{
			name:   name,
			ftype:  ftype,
			values: typedValues,
		})
	}

	return fields, nil
}

// toArray wraps a non-array JSONata result into a single-element array, but
// keeps arrays as-is.
func toArray(result interface{}) []interface{} {
	if arr, ok := asArray(result); ok {
		return arr
	}
	return []interface{}{result}
}

// wrap mirrors the behavior of jsonpath-plus' default "wrap" option: the
// result of a JSONPath evaluation is always an array. A single match gets
// wrapped in an array, multiple matches are returned as an array. If the
// single match is itself an array (e.g. the path selects a whole array
// property), the match is wrapped, i.e. an array containing the array.
func wrap(result interface{}) []interface{} {
	if arr, ok := asArray(result); ok {
		return arr
	}
	return []interface{}{result}
}

// asArray returns the value as an array if it is one.
func asArray(value interface{}) ([]interface{}, bool) {
	arr, ok := value.([]interface{})
	return arr, ok
}

// nullableType returns the nullable field type corresponding to the given
// field type, preserving null values in the resulting field.
func nullableType(ftype data.FieldType) data.FieldType {
	switch ftype {
	case data.FieldTypeTime, data.FieldTypeNullableTime:
		return data.FieldTypeNullableTime
	case data.FieldTypeFloat32, data.FieldTypeNullableFloat32,
		data.FieldTypeFloat64, data.FieldTypeNullableFloat64,
		data.FieldTypeInt8, data.FieldTypeNullableInt8,
		data.FieldTypeInt16, data.FieldTypeNullableInt16,
		data.FieldTypeInt32, data.FieldTypeNullableInt32,
		data.FieldTypeInt64, data.FieldTypeNullableInt64,
		data.FieldTypeUint8, data.FieldTypeNullableUint8,
		data.FieldTypeUint16, data.FieldTypeNullableUint16,
		data.FieldTypeUint32, data.FieldTypeNullableUint32,
		data.FieldTypeUint64, data.FieldTypeNullableUint64:
		return data.FieldTypeNullableFloat64
	case data.FieldTypeBool, data.FieldTypeNullableBool:
		return data.FieldTypeNullableBool
	default:
		return data.FieldTypeNullableString
	}
}

// toDataFields converts the extracted fields into Grafana data fields.
func toDataFields(fields []field) []*data.Field {
	out := make([]*data.Field, 0, len(fields))
	for _, f := range fields {
		out = append(out, toDataField(f))
	}
	return out
}

// toDataField converts a single extracted field into a Grafana data field.
// Null values are represented by nil entries in the backing slice.
func toDataField(f field) *data.Field {
	ftype := nullableType(f.ftype)

	switch ftype {
	case data.FieldTypeNullableTime:
		values := make([]*time.Time, len(f.values))
		for i, v := range f.values {
			if v == nil {
				continue
			}
			ms, ok := v.(float64)
			if !ok {
				continue
			}
			t := time.Unix(0, int64(ms)*int64(time.Millisecond)).UTC()
			values[i] = &t
		}
		return data.NewField(f.name, nil, values)
	case data.FieldTypeNullableFloat64:
		values := make([]*float64, len(f.values))
		for i, v := range f.values {
			if v == nil {
				continue
			}
			if num, ok := v.(float64); ok {
				values[i] = &num
			}
		}
		return data.NewField(f.name, nil, values)
	case data.FieldTypeNullableBool:
		values := make([]*bool, len(f.values))
		for i, v := range f.values {
			if v == nil {
				continue
			}
			if b, ok := v.(bool); ok {
				values[i] = &b
			}
		}
		return data.NewField(f.name, nil, values)
	default:
		values := make([]*string, len(f.values))
		for i, v := range f.values {
			if v == nil {
				continue
			}
			s, ok := v.(string)
			if !ok {
				s = fmt.Sprintf("%v", v)
			}
			values[i] = &s
		}
		return data.NewField(f.name, nil, values)
	}
}

// detectFieldType detects the field type from an array of values. This is a
// port of the frontend's detectFieldType().
func detectFieldType(values []interface{}) data.FieldType {
	// If all values are null, default to strings.
	if allNull(values) {
		return data.FieldTypeString
	}

	// If all values are valid ISO 8601, then assume that it's a time field.
	if allValidISO(values) {
		return data.FieldTypeTime
	}

	if allNumbers(values) {
		return data.FieldTypeFloat64
	}

	if allBooleans(values) {
		return data.FieldTypeBool
	}

	return data.FieldTypeString
}

func allNull(values []interface{}) bool {
	if len(values) == 0 {
		return true
	}
	for _, v := range values {
		if v != nil {
			return false
		}
	}
	return true
}

// allValidISO returns true when every non-null value looks like an ISO 8601
// timestamp. It mirrors the frontend, where only values with a length of at
// least 10 characters are considered.
func allValidISO(values []interface{}) bool {
	if len(values) == 0 {
		return true
	}
	for _, v := range values {
		if v == nil {
			continue
		}
		s, ok := v.(string)
		if !ok {
			return false
		}
		if len(s) < 10 {
			return false
		}
		if !isValidISO(s) {
			return false
		}
	}
	return true
}

func allNumbers(values []interface{}) bool {
	for _, v := range values {
		if _, ok := v.(float64); !ok {
			return false
		}
	}
	return true
}

func allBooleans(values []interface{}) bool {
	for _, v := range values {
		if _, ok := v.(bool); !ok {
			return false
		}
	}
	return true
}

// isoLayouts are the layouts accepted when checking whether a value looks
// like an ISO 8601 timestamp. This intentionally covers the formats that
// dayjs() accepts, which is what the frontend uses.
var isoLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04:05",
	"2006-01-02 15:04:05",
	"2006-01-02",
}

func isValidISO(value string) bool {
	for _, layout := range isoLayouts {
		if _, err := time.Parse(layout, value); err == nil {
			return true
		}
	}
	return false
}

// isNumberType returns true for every field type that represents a number.
func isNumberType(ftype data.FieldType) bool {
	switch ftype {
	case data.FieldTypeFloat32, data.FieldTypeNullableFloat32,
		data.FieldTypeFloat64, data.FieldTypeNullableFloat64,
		data.FieldTypeInt8, data.FieldTypeNullableInt8,
		data.FieldTypeInt16, data.FieldTypeNullableInt16,
		data.FieldTypeInt32, data.FieldTypeNullableInt32,
		data.FieldTypeInt64, data.FieldTypeNullableInt64,
		data.FieldTypeUint8, data.FieldTypeNullableUint8,
		data.FieldTypeUint16, data.FieldTypeNullableUint16,
		data.FieldTypeUint32, data.FieldTypeNullableUint32,
		data.FieldTypeUint64, data.FieldTypeNullableUint64:
		return true
	default:
		return false
	}
}

// parseValues converts values to the given field type. This is a port of the
// frontend's parseValues().
func parseValues(values []interface{}, ftype data.FieldType) ([]interface{}, error) {
	switch {
	case ftype == data.FieldTypeTime || ftype == data.FieldTypeNullableTime:
		return parseTimeValues(values)
	case ftype == data.FieldTypeString || ftype == data.FieldTypeNullableString:
		out := make([]interface{}, 0, len(values))
		for _, v := range values {
			if v == nil {
				out = append(out, nil)
			} else if s, ok := v.(string); ok {
				out = append(out, s)
			} else {
				out = append(out, toJSONString(v))
			}
		}
		return out, nil
	case isNumberType(ftype):
		out := make([]interface{}, 0, len(values))
		for _, v := range values {
			if v == nil {
				out = append(out, nil)
			} else if _, ok := v.(float64); ok || isNumberValue(v) {
				num, err := toFloat64(v)
				if err != nil {
					return nil, fmt.Errorf("'%v' is not a number", v)
				}
				out = append(out, num)
			} else {
				num, err := parseFloat(fmt.Sprintf("%v", v))
				if err != nil {
					return nil, fmt.Errorf("'%v' is not a number", v)
				}
				out = append(out, num)
			}
		}
		return out, nil
	case ftype == data.FieldTypeBool || ftype == data.FieldTypeNullableBool:
		out := make([]interface{}, 0, len(values))
		for _, v := range values {
			if v == nil {
				out = append(out, nil)
				continue
			}
			b, ok := v.(bool)
			if ok {
				out = append(out, b)
				continue
			}
			switch fmt.Sprintf("%v", v) {
			case "0", "false", "FALSE", "False":
				out = append(out, false)
			case "1", "true", "TRUE", "True":
				out = append(out, true)
			default:
				return nil, fmt.Errorf("found non-boolean values in a field of type boolean: %v", v)
			}
		}
		return out, nil
	default:
		return nil, fmt.Errorf("unsupported field type %q", ftype)
	}
}

// parseTimeValues converts values to epoch milliseconds. This is a port of
// the frontend's parseValues() time handling.
func parseTimeValues(values []interface{}) ([]interface{}, error) {
	nonNull := nonNullValues(values)

	// If there are no non-null values, return them as-is. Otherwise a query
	// that returns no observations (e.g. an alert rule evaluated over a time
	// range without data) would fail with "unsupported time property". This
	// mirrors the frontend, where an empty array passes the "all strings"
	// check vacuously and produces an empty field.
	if nonNull == nil {
		return values, nil
	}

	// All (non-null) values are strings.
	if nonNull != nil && allStrings(nonNull) {
		hasInterval := false
		for _, v := range nonNull {
			if strings.Contains(v.(string), "/") {
				hasInterval = true
				break
			}
		}

		if hasInterval {
			// Intervals are not implemented yet; the start of the interval is
			// used. Null values are dropped, mirroring the frontend.
			var out []interface{}
			for _, v := range values {
				if v == nil {
					continue
				}
				ms, err := dayjsValueOf(strings.Split(v.(string), "/")[0])
				if err != nil {
					return nil, err
				}
				out = append(out, float64(ms))
			}
			return out, nil
		}

		var out []interface{}
		for _, v := range values {
			if v == nil {
				out = append(out, nil)
				continue
			}
			ms, err := dayjsValueOf(v.(string))
			if err != nil {
				return nil, err
			}
			out = append(out, float64(ms))
		}
		return out, nil
	}

	// All (non-null) values are numbers. Numbers below one trillion are
	// assumed to be seconds and converted to milliseconds; everything else is
	// assumed to be milliseconds already.
	if nonNull != nil && allNumbers(nonNull) {
		const ms = 1_000_000_000_000
		out := make([]interface{}, 0, len(values))
		for _, v := range values {
			if v == nil {
				out = append(out, nil)
				continue
			}
			num := v.(float64)
			if num < ms {
				out = append(out, num*1000.0)
			} else {
				out = append(out, num)
			}
		}
		return out, nil
	}

	return nil, fmt.Errorf("unsupported time property")
}

// nonNullValues returns the non-null values, or nil if there are none.
func nonNullValues(values []interface{}) []interface{} {
	var out []interface{}
	for _, v := range values {
		if v != nil {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func allStrings(values []interface{}) bool {
	for _, v := range values {
		if _, ok := v.(string); !ok {
			return false
		}
	}
	return true
}

// isNumberValue returns true when the value is a number or a numeric string.
func isNumberValue(v interface{}) bool {
	switch v.(type) {
	case float64, float32, int, int8, int16, int32, int64,
		uint, uint8, uint16, uint32, uint64:
		return true
	default:
		return false
	}
}

// toFloat64 converts numeric values to float64.
func toFloat64(v interface{}) (float64, error) {
	switch n := v.(type) {
	case float64:
		return n, nil
	case float32:
		return float64(n), nil
	case int:
		return float64(n), nil
	case int8:
		return float64(n), nil
	case int16:
		return float64(n), nil
	case int32:
		return float64(n), nil
	case int64:
		return float64(n), nil
	case uint:
		return float64(n), nil
	case uint8:
		return float64(n), nil
	case uint16:
		return float64(n), nil
	case uint32:
		return float64(n), nil
	case uint64:
		return float64(n), nil
	default:
		return 0, fmt.Errorf("%v is not a number", v)
	}
}

// dayjsValueOf converts a value to an epoch timestamp in milliseconds, in the
// same way the frontend's dayjs(...).valueOf() does for strings.
func dayjsValueOf(value string) (int64, error) {
	if num, err := strconv.ParseInt(value, 10, 64); err == nil {
		// Numeric strings are interpreted as epoch milliseconds.
		return num, nil
	}
	for _, layout := range isoLayouts {
		if t, err := time.Parse(layout, value); err == nil {
			return t.UnixMilli(), nil
		}
	}
	return 0, fmt.Errorf("could not parse time value %q", value)
}

// toJSONString converts a value to its JSON string representation, mirroring
// the frontend's JSON.stringify() for objects.
func toJSONString(value interface{}) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(raw)
}

// groupBy splits a frame into one frame per unique value of the given field,
// excluding the group-by field itself.
func groupBy(frame *data.Frame, fieldName, metricField string) data.Frames {
	groupByField, _ := frame.FieldByName(fieldName)
	if groupByField == nil {
		return data.Frames{frame}
	}

	uniqueValues := make([]string, 0)
	seen := map[string]bool{}
	for i := 0; i < groupByField.Len(); i++ {
		value := valueString(groupByField.At(i))
		if !seen[value] {
			seen[value] = true
			uniqueValues = append(uniqueValues, value)
		}
	}

	var frames data.Frames
	for _, groupByValue := range uniqueValues {
		var fields []*data.Field
		for _, src := range frame.Fields {
			if src.Name == groupByField.Name {
				continue
			}
			var out []interface{}
			for i := 0; i < src.Len(); i++ {
				if valueString(groupByField.At(i)) == groupByValue {
					out = append(out, derefValue(src.At(i)))
				}
			}
			grouped := toDataField(field{name: src.Name, ftype: src.Type(), values: out})
			if metricField != "" && src.Name == metricField {
				grouped.Config = &data.FieldConfig{DisplayNameFromDS: groupByValue}
			}
			fields = append(fields, grouped)
		}

		newFrame := data.NewFrame(groupByValue, fields...)
		newFrame.RefID = frame.RefID
		frames = append(frames, newFrame)
	}

	return frames
}

// valueString returns a stable string representation of a field value,
// dereferencing pointers so that identical values compare equal.
func valueString(v interface{}) string {
	v = derefValue(v)
	if v == nil {
		return "<nil>"
	}
	switch t := v.(type) {
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(t), 'f', -1, 32)
	case int64:
		return strconv.FormatInt(t, 10)
	case int:
		return strconv.Itoa(t)
	case bool:
		return strconv.FormatBool(t)
	case time.Time:
		return t.UTC().Format(isoFormat)
	default:
		return fmt.Sprintf("%v", t)
	}
}

// derefValue dereferences a pointer to a basic type; nil pointers and nil
// are both returned as nil. Pointers to pointers are handled recursively.
func derefValue(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr {
		return v
	}
	if rv.IsNil() {
		return nil
	}
	return derefValue(rv.Elem().Interface())
}
