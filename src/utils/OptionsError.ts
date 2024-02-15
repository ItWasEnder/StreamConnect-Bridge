export type OptionsLike = { [key: string]: any };

export class OptionsError extends Error {
	options: OptionsLike;

	constructor(message: string, options?: OptionsLike) {
		super(message);
		this.options = options || {};
	}
}
