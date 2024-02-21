/**
 * This file is created by EnderGamingFilms.
 * GitHub: https://github.com/EnderGamingFilms
 * Date: 02/20/24
 */

/**
 * Represents the result of an operation.
 * @template T - The type of the value associated with the result.
 * @author (EnderGamingFilms)
 */
export class Result<T> {
	/**
	 * Creates a new Result instance.
	 * @param isSuccess - Indicates whether the operation was successful.
	 * @param message - A message describing the result.
	 * @param value - The value associated with the result.
	 */
	constructor(
		public readonly isSuccess: boolean,
		public readonly message: string,
		public readonly value?: T
	) {}

	/**
	 * Creates a successful Result instance.
	 * @param message - A message describing the result.
	 * @param value - The value associated with the result.
	 * @returns A new Result instance representing a successful result.
	 */
	static pass<T>(message: string, value?: T): Result<T> {
		return new Result(true, message, value || void 0);
	}

	/**
	 * Creates a failed Result instance.
	 * @param message - A message describing the result.
	 * @param value - The value associated with the result.
	 * @returns A new Result instance representing a failed result.
	 */
	static fail<T>(message: string, value?: T): Result<T> {
		return new Result(false, message, value || void 0);
	}

	/**
	 * Wraps a promise and returns a Result object.
	 * @param promise - The promise to be wrapped.
	 * @returns A promise that resolves to a Result object.
	 */
	static async promise<T>(promise: Promise<T>): Promise<Result<T>> {
		try {
			const value = await promise;
			return Result.pass('Operation succeeded', value);
		} catch (error) {
			return Result.fail(error.message);
		}
	}
}
