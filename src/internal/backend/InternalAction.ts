import { ContextLike, ProviderKey } from '../../providers/backend/InternalRequest';
import { Result } from '../../utils/Result';

export abstract class InternalAction {
	constructor(public readonly name: string) {}

	abstract execute(context: ContextLike): Result<string>;

	public get providerKey(): ProviderKey {
		return {
			actions: [this.name],
			categoryId: 'internal-commands',
		};
	}
}
