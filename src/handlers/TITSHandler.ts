import { ConnectionConfig, WebSocketInfo } from '../connections/backend/Connection';
import { WebSocketInst } from '../connections/backend/WebSocketInst';
import { INTERNAL_EVENTS } from '../events/EventsHandler';
import { RawData } from 'ws';
import { ActionData, ActionMap, ActionProvider } from '../providers/backend/ActionProvider';
import { OptionsError } from '../utils/OptionsError';
import { InternalRequest, RequestExecuter } from '../providers/backend/InternalRequest';
import crypto from 'crypto';

export const TITS_ACTIONS = {
	THROW_ITEMS: 'tits-throw-items',
	ACTIVATE_TRIGGER: 'tits-activate-trigger'
};

export interface TITSMessage {
	apiName: string;
	apiVersion: string;
	requestID: string;
	messageType: string;
	data: any;
}

export interface TITSActionData extends ActionData {
	cooldown: number;
	lastTriggered?: number;
}

type PendingRequest = {
	resolve: (value?: unknown) => void;
	reject: (reason?: any) => void;
};

const REQUEST_TYPES = {
	ITEM_LIST: 'TITSItemListRequest',
	ITEM_INFO: 'TITSItemInfoRequest',
	TRIGGER_LIST: 'TITSTriggerListRequest',
	THROW_ITEMS: 'TITSThrowItemsRequest',
	TRIGGER_ACTIVATE: 'TITSTriggerActivateRequest'
};

export const RESPONSE_TYPES = {
	ITEM_LIST: 'TITSItemListResponse',
	ITEM_INFO: 'TITSItemInfoResponse',
	TRIGGER_LIST: 'TITSTriggerListResponse',
	THROW_ITEMS: 'TITSThrowItemsResponse',
	TRIGGER_ACTIVATE: 'TITSTriggerActivateResponse',
	ERROR: 'APIError'
};

// WebSocket handler class
export class TITSWebSocketHandler extends WebSocketInst implements RequestExecuter {
	private messageHandlers: Map<string, (data: TITSMessage) => void> = new Map();
	private pendingRequests: Map<string, PendingRequest> = new Map();
	private refreshInProgress = false;
	private requestTimeoutMs = 5000;

	private config: ConnectionConfig;
	public provider: ActionProvider<TITSActionData>;

	constructor(config: ConnectionConfig) {
		super();
		this.config = config;

		this.provider = new ActionProvider<TITSActionData>(config.id, async () => {
			const promise = this.refreshData();
			const [items, triggers] = await promise;

			return [items, triggers];
		});

		this.on(INTERNAL_EVENTS.EXECUTE_ACTION, (payload) => {
			const __request: InternalRequest = payload.data;

			if (__request.providerId === this.provider.providerId) {
				this.executeRequest(__request);
			}
		});

		// Setup emmiters & listeners
		this.setup();
	}

	/** public methods */

	get service(): string {
		return this.config.name;
	}

	get url(): string {
		return (this.config.info as WebSocketInfo).url;
	}

	async refreshData(): Promise<[string, TITSActionData[]][]> {
		if (this.refreshInProgress) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: `TITSHandler >> Data refresh currently in progress. Please wait.` }
			});
			return Promise.reject(
				new OptionsError(`Data refresh currently in progress. Please wait.`, { print: false })
			);
		}

		this.refreshInProgress = true;

		const timeoutPromise = new Promise<[TITSMessage, TITSMessage]>((_, reject) =>
			setTimeout(() => {
				this.pendingRequests.forEach((request, key) => {
					request.reject(new OptionsError('Request timed out.', { print: false }));
					this.pendingRequests.delete(key);
				});

				reject(new OptionsError('Refresh data timeout', { print: false }));
			}, this.requestTimeoutMs)
		);

		try {
			const itemsPromise = this.sendItemsListRequest();
			const triggersPromise = this.sendTriggersListRequest();

			const result = await Promise.race([
				Promise.all([itemsPromise, triggersPromise]),
				timeoutPromise
			]);

			const [__items, __triggers]: [TITSMessage, TITSMessage] = result;
			const itemsData: TITSActionData[] = this.processMessageResponse('items', __items);
			const triggersData: TITSActionData[] = this.processMessageResponse('triggers', __triggers);

			return [
				[TITS_ACTIONS.THROW_ITEMS, itemsData],
				[TITS_ACTIONS.ACTIVATE_TRIGGER, triggersData]
			];
		} finally {
			this.refreshInProgress = false;
		}
	}

	setCallback(type: string, callback: (message: TITSMessage) => void) {
		if (!Object.values(RESPONSE_TYPES).includes(type)) {
			throw Error(`Type ${type} is not a valid property of MESSAGE_TYPES`);
		}

		this.messageHandlers.set(type, callback);
	}

	sendItemsListRequest(): Promise<TITSMessage> {
		const __requestId = crypto.randomUUID();

		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: __requestId,
				messageType: REQUEST_TYPES.ITEM_LIST,
				sendImage: false
			},
			(error) => this.handleError(REQUEST_TYPES.ITEM_LIST, error)
		);

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(__requestId, { resolve, reject });
		});
	}

	sendTriggersListRequest(): Promise<TITSMessage> {
		const __requestId = crypto.randomUUID();

		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: __requestId,
				messageType: REQUEST_TYPES.TRIGGER_LIST
			},
			(error) => this.handleError(REQUEST_TYPES.TRIGGER_LIST, error)
		);

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(__requestId, { resolve, reject });
		});
	}

	executeRequest(request: InternalRequest) {
		const { caller, requestId, providerKey, bypass_cooldown, context } = request;
		const __info = `(requestId: ${requestId}, caller: ${caller})`;

		if (!providerKey) {
			this.emit(INTERNAL_EVENTS.NOTIF, {
				data: { message: `TITSHandler >> Missing providerKey in request ${__info}` }
			});
			return;
		}

		const { categoryId, actions } = providerKey;

		if (!this.provider.has(categoryId)) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `TITSHandler >> Unable to find category based on input of '${JSON.stringify(providerKey)}' ${__info}`
				}
			});
			return;
		}

		const actionInfo: string = `[${actions.join(', ')}]`;
		// const coinInfo: string = context?.coins ? `for ${context.coins} coins` : '';
		// const username: string = context?.username ?? '<<unknown>>';
		const actionMap: ActionMap<TITSActionData> = this.provider.getActionMap(categoryId);
		const actionDatas: TITSActionData[] = providerKey.actions.map((id) => actionMap.get(id));

		// check if any of the actions are currently on cooldown
		const hasCooldown = actionDatas.some((action) => {
			const last = action.lastTriggered ?? 0;
			const result = Date.now() - last < action.cooldown;
			return result;
		});

		if (!bypass_cooldown && hasCooldown) {
			this.emit(INTERNAL_EVENTS.INFO, {
				data: {
					message: `TITSHandler >> Action not executed, there is a cooldown on one or all of the actions. ${__info}`
				}
			});
			return;
		}

		// TODO: Verbose Log Event (to file or console with debug flag)
		this.emit(INTERNAL_EVENTS.INFO, {
			data: {
				message: `Action '${categoryId}' executed with actions ${actionInfo} ${__info}`
			}
		});

		// Update lastTriggered for all actions
		for (const __action of actionDatas) {
			__action.lastTriggered = Date.now();
		}

		switch (categoryId) {
			case TITS_ACTIONS.ACTIVATE_TRIGGER:
				for (const __action of actions) {
					this.handleTriggerRequest(__action);
				}
				break;
			case TITS_ACTIONS.THROW_ITEMS:
				this.handleThrowRequest(actions, context?.count, context?.delay);
				break;
			default:
				this.emit(INTERNAL_EVENTS.ERROR, {
					data: { message: `TITSHandler >> Unhandled categoryId: ${categoryId}` }
				});
				return;
		}
	}

	/** private methods */

	protected onReady(): void {
		this.provider.loadActions();
	}

	protected onMessage(event: { rawData: RawData; isBinary: boolean }) {
		try {
			const response: TITSMessage = JSON.parse(event.rawData.toString());
			const handler = this.messageHandlers.get(response.messageType);

			// check pending requests - resolve if found - then return
			const pendingRequest = this.pendingRequests.get(response.requestID);
			if (pendingRequest) {
				pendingRequest.resolve(response);
				this.pendingRequests.delete(response.messageType);
				return;
			}

			// Use custom handler if needed
			if (handler) {
				this.messageHandlers.get(response.messageType)(response);
			}
		} catch (error) {
			console.error('Error parsing incoming message:', error);
		}
	}

	private setup(): void {
		this.setCallback(RESPONSE_TYPES.ERROR, (message: TITSMessage) => {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `TITSSocketHandler >> An error occured when attempting to call socket api.`
				}
			});
			console.error(message.data);
		});
	}

	private handleThrowRequest(
		items: string[],
		count: number = 1,
		delay: number = 0.08,
		requestId: string = crypto.randomUUID()
	) {
		const req = {
			apiName: 'TITSPublicApi',
			apiVersion: '1.0',
			requestID: requestId,
			messageType: REQUEST_TYPES.THROW_ITEMS,
			delayTime: delay,
			amountOfThrows: count,
			errorOnMissingID: false,
			data: {
				items: items
			}
		};

		this.send(req, (error) => this.handleError(REQUEST_TYPES.THROW_ITEMS, error));
	}

	private handleTriggerRequest(triggerId: string, requestId: string = crypto.randomUUID()) {
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: requestId,
				messageType: REQUEST_TYPES.TRIGGER_ACTIVATE,
				data: {
					triggerID: triggerId
				}
			},
			(error) => this.handleError(REQUEST_TYPES.TRIGGER_ACTIVATE, error)
		);
	}

	private handleError(func: string, error: Error) {
		if (!error) {
			return;
		}

		this.emit(INTERNAL_EVENTS.ERROR, {
			data: { message: `An error occured when attempting to call ${func}` }
		});
		console.error(error);
	}

	private processMessageResponse(key: string, msg: TITSMessage): TITSActionData[] {
		const _data = msg.data;
		const actions: TITSActionData[] = [];
		for (const _item of _data[key as keyof typeof _data]) {
			const id = _item['ID'];
			const name = _item['name'];

			actions.push({
				id: id,
				name: name,
				cooldown: 0
			});
		}

		return actions;
	}
}