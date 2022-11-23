/**
 * Gets all keys of array with nested json objects
 * @param data
 * @returns
 */
export const getTableHeaders = (data: any[]): string[] => {
  let keys: string[][] = [];
  data.forEach((object: any) => {
    keys = keys.concat(getNestedKeys(object, [], []));
  });

  let headers: string[] = [];
  keys.forEach((object: string[]) => {
    headers.push(object.join('.'));
  });

  return [...new Set(headers)]; //eleminates duplicates
};

/**
 * Gets all keys of nested json object
 * @param data json
 * @param keys keys (empty array: <[]>)
 * @param path path to json object (example: <"">)
 * @returns
 */
const getNestedKeys = (data: any, keys: string[][], path: string[]): string[][] => {
  if (!(data instanceof Array) && typeof data === 'object' && data !== null && data !== undefined) {
    Object.keys(data).forEach((key) => {
      let resultPath = [...path, key];
      const value = data[key];
      if (typeof value === 'object' && !(value instanceof Array)) {
        getNestedKeys(value, keys, resultPath);
      } else {
        //only push if not object
        keys.push(resultPath);
      }
    });
  }
  return keys;
};
