export enum CALLERS {
	INTENAL = 'internal',
	TIKFINITY = 'tikfinity'
}

export interface ActionRequest {
	caller: CALLERS;
	providerId: string;
	categoryId: string;
	actionId: string;
	bypass_cooldown?: boolean;
	context: Record<string, any>;
}
