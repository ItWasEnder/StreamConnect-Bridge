export enum CALLERS {
	INTENAL = 'internal',
	TIKFINITY = 'tikfinity'
}

export type ProviderKey = {
	categoryId?: string;
	actions: string[];
}

export interface InternalRequest {
	caller: CALLERS; // who is calling the action
	requestId: string; // request identifier for logging
	providerId: string; // identifier for the event handler
	providerKey: ProviderKey; // used when you need to pass in specific action details
	bypass_cooldown?: boolean;
	context: Record<string, any>; // contains the data for the action
}

export abstract class RequestExecuter {
	executeRequest(request: InternalRequest): void {
		throw new Error('Method not implemented.');
	}
}
