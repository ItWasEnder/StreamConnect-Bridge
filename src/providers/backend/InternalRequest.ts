import { Result } from "../../utils/Result";

export enum CALLERS {
	INTENAL = 'internal',
	TIKFINITY = 'tikfinity',
}

export type ProviderKey = {
	categoryId?: string;
	actions: string[];
};

export type ContextLike = Record<string, any>;

export interface InternalRequest {
	caller: CALLERS; // who is calling the action
	requestId?: string; // request identifier for logging
	providerId: string; // identifier for the event handler
	providerKey?: ProviderKey; // used when you need to pass in specific action details
	bypass_cooldown?: boolean;
	context: ContextLike; // contains the data for the action
}

export abstract class RequestExecutor {
	async executeRequest(request: InternalRequest): Promise<Result<string>> {
		throw new Error('Method not implemented.');
	}
}
