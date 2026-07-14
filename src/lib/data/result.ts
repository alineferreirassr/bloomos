export type DataResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Partial<Record<string, string>> };

export function ok<T>(data: T): DataResult<T> {
  return { success: true, data };
}

export function fail<T>(
  error: string,
  fieldErrors?: Partial<Record<string, string>>,
): DataResult<T> {
  return { success: false, error, fieldErrors };
}
