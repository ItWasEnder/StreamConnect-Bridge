import { ConnectionConfig, WebSocketInfo } from './backend/Connection.js';
import { WebSocketInst } from './backend/WebSocketInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { RawData } from 'ws';
import crypto from 'crypto';
import { ActionData, ActionProvider } from '../triggers/backend/ActionProvider.js';
import { OptionsError } from '../utils/OptionsError.js';

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
export class TITSWebSocketHandler extends WebSocketInst {
	private messageHandlers: Map<string, (data: TITSMessage) => void> = new Map();
	private pendingRequests: Map<string, PendingRequest> = new Map();
	private refreshInProgress = false;
	private requestTimeoutMs = 5000;

	private config: ConnectionConfig;
	public provider: ActionProvider<ActionData>;

	constructor(config: ConnectionConfig) {
		super(config.name, (config.info as WebSocketInfo).url);
		this.config = config;

		this.provider = new ActionProvider(config.id, async () => {
			const promise = this.refreshData();
			const [items, triggers] = await promise;

			return [items, triggers];
		});

		// Setup emmiters & listeners
		this.setup();
	}
	/** public methods */

	async refreshData(): Promise<[string, ActionData[]][]> {
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

			// Assuming these responses are directly usable - ensure this logic matches your application's needs
			const itemsData: ActionData[] = this.processMessageResponse('items', __items);
			const triggersData: ActionData[] = this.processMessageResponse('triggers', __triggers);

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
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: crypto.randomUUID(),
				messageType: REQUEST_TYPES.ITEM_LIST,
				sendImage: false
			},
			(error) => this.handleError(REQUEST_TYPES.ITEM_LIST, error)
		);

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(RESPONSE_TYPES.ITEM_LIST, { resolve, reject });
		});
	}

	sendTriggersListRequest(): Promise<TITSMessage> {
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: crypto.randomUUID(),
				messageType: REQUEST_TYPES.TRIGGER_LIST
			},
			(error) => this.handleError(REQUEST_TYPES.TRIGGER_LIST, error)
		);

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(RESPONSE_TYPES.TRIGGER_LIST, { resolve, reject });
		});
	}

	/** private methods */

	protected onReady(): void {
		this.provider.loadActions();
	}

	protected onMessage(event: { rawData: RawData; isBinary: boolean }) {
		try {
			const response: TITSMessage = JSON.parse(event.rawData.toString());
			const handler = this.messageHandlers.get(response.messageType);

			// check pending requests - resolve if found - then continue
			const pendingRequest = this.pendingRequests.get(response.messageType);
			if (pendingRequest) {
				pendingRequest.resolve(response);
				this.pendingRequests.delete(response.messageType);
			}

			if (handler) {
				this.messageHandlers.get(response.messageType)(response);
			} else {
				this.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `TITSSocketHandler >> No handler found for message type: ${response.messageType}`
					}
				});
			}
		} catch (error) {
			console.error('Error parsing incoming message:', error);
		}
	}

	private handleThrowRequest(items: string[], count: number = 1, delay: number = 0.08) {
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: crypto.randomUUID(),
				messageType: REQUEST_TYPES.THROW_ITEMS,
				delayTime: delay,
				amountOfThrows: count,
				errorOnMissingID: false,
				data: {
					items: items
				}
			},
			(error) => this.handleError(REQUEST_TYPES.THROW_ITEMS, error)
		);
	}

	private handleTriggerRequest(triggerId: string) {
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: crypto.randomUUID(),
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

	private processMessageResponse(key: string, msg: TITSMessage): ActionData[] {
		const _data = msg.data;
		const actions: ActionData[] = [];
		for (const _item of _data[key as keyof typeof _data]) {
			const id = _item['ID'];
			const name = _item['name'];

			actions.push({
				id: id,
				name: name
			});
		}

		return actions;
	}

	private setup(): void {
		// Setup event listeners
		this.on(TITS_ACTIONS.THROW_ITEMS, (payload) => {
			const { data } = payload;

			if (data?.items) {
				const count: number | undefined = data?.count;
				const delay: number | undefined = data?.delay;

				this.handleThrowRequest(data.items, count, delay);
			} else {
				this.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `TITSSocketHandler >> Trigger activate request made without 'triggerId' field.`
					}
				});
			}
		});

		this.on(TITS_ACTIONS.ACTIVATE_TRIGGER, (payload) => {
			const { data } = payload;

			if (data?.triggerId) {
				this.handleTriggerRequest(data.triggerId);
			} else {
				this.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `TITSSocketHandler >> Trigger activate request made without 'triggerId' field.`
					}
				});
			}
		});

		// Set callbacks for handlers
		const _empty = () => {};
		Object.values(RESPONSE_TYPES).map((type) => this.setCallback(type, _empty));

		this.setCallback(RESPONSE_TYPES.ERROR, (message: TITSMessage) => {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `TITSSocketHandler >> An error occured when attempting to call socket api.`
				}
			});
			console.error(message.data);
		});
	}
}
