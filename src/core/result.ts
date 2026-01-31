import { Result as Byethrow } from "@praha/byethrow";

export type CoreError =
  | { kind: "invalid-input"; reason: string }
  | { kind: "not-found"; reason: string };

export type Result<T> = Byethrow.Result<T, CoreError>;

/**
 * Wraps a successful value into a Result.
 */
export const succeed = <T>(value: T): Result<T> => {
  return Byethrow.succeed(value);
};

/**
 * Creates an invalid-input failure Result.
 */
export const failInvalidInput = (reason: string): Result<never> => {
  return Byethrow.fail({ kind: "invalid-input", reason });
};

/**
 * Creates a not-found failure Result.
 */
export const failNotFound = (reason: string): Result<never> => {
  return Byethrow.fail({ kind: "not-found", reason });
};

/**
 * Checks whether a Result is successful.
 */
export const isSuccess = <T>(result: Result<T>): result is Byethrow.Success<T> => {
  return Byethrow.isSuccess(result);
};

/**
 * Checks whether a Result is a failure.
 */
export const isFailure = <T>(result: Result<T>): result is Byethrow.Failure<CoreError> => {
  return Byethrow.isFailure(result);
};
