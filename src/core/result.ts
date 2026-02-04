import { Result as Byethrow } from "@praha/byethrow";

export type LexicaError =
  | { kind: "invalid-input"; reason: string }
  | { kind: "not-found"; reason: string }
  | { kind: "conflict"; reason: string }
  | { kind: "file-io"; reason: string }
  | { kind: "ai-failed"; reason: string };

export type Result<T> = Byethrow.Result<T, LexicaError>;
export type ResultAsync<T> = Promise<Result<T>>;

export const unwrap = <T>(result: Result<T>): T => {
  if (!Byethrow.isSuccess(result)) {
    throw new Error(`Expected success but got ${result.error.reason}`);
  }
  return result.value;
};

/**
 * Wraps a successful value into a Result.
 */
export const succeed = <T>(value: T): Result<T> => {
  return { type: "Success", value };
};

/**
 * Creates an invalid-input failure Result.
 */
export const failInvalidInput = (reason: string): Result<never> => {
  return { type: "Failure", error: { kind: "invalid-input", reason } };
};

/**
 * Creates a not-found failure Result.
 */
export const failNotFound = (reason: string): Result<never> => {
  return { type: "Failure", error: { kind: "not-found", reason } };
};

/**
 * Creates a conflict failure Result.
 */
export const failConflict = (reason: string): Result<never> => {
  return { type: "Failure", error: { kind: "conflict", reason } };
};

export const failFileIO = (reason: string): Result<never> => ({
  type: "Failure",
  error: { kind: "file-io", reason },
});

/**
 * Checks whether a Result is successful.
 */
export const isSuccess = <T>(result: Result<T>): result is Byethrow.Success<T> => {
  return Byethrow.isSuccess(result);
};

/**
 * Checks whether a Result is a failure.
 */
export const isFailure = <T>(result: Result<T>): result is Byethrow.Failure<LexicaError> => {
  return Byethrow.isFailure(result);
};
