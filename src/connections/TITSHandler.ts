import { ConnectionConfig, WebSocketInfo } from './backend/Connection.js';
import { WebSocketInst } from './backend/WebSocketInst.js';
import { EMITTER, INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { RawData } from 'ws';
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
	private config: ConnectionConfig;
	private messageHandlers: Map<string, (data: TITSMessage) => void> = new Map();

	constructor(config: ConnectionConfig) {
		super(config.name, (config.info as WebSocketInfo).url);
		this.config = config;

		// Setup emmiters
		EMITTER.on(TITS_ACTIONS.THROW_ITEMS, (payload) => {
			const { data } = payload;

			if (data?.items) {
				const count: number | undefined = data?.count;
				const delay: number | undefined = data?.delay;

				this.handleThrowRequest(data.items, count, delay);
			} else {
				EMITTER.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `TITSSocketHandler >> Trigger activate request made without 'triggerId' field.`
					}
				});
			}
		});

		EMITTER.on(TITS_ACTIONS.ACTIVATE_TRIGGER, (payload) => {
			const { data } = payload;

			if (data?.triggerId) {
				this.handleTriggerRequest(data.triggerId);
			} else {
				EMITTER.emit(INTERNAL_EVENTS.ERROR, {
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
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `TITSSocketHandler >> An error occured when attempting to call socket api.`
				}
			});
			console.error(message.data);
		});
	}

	onReady(): void {
		// Request data from TITS
		this.refreshData();
	}

	refreshData() {
		this.sendTriggersListRequest();
		this.sendItemsListRequest();
	}

	setCallback(type: string, callback: (message: TITSMessage) => void) {
		if (!Object.values(RESPONSE_TYPES).includes(type)) {
			throw Error(`Type ${type} is not a valid property of MESSAGE_TYPES`);
		}

		this.messageHandlers.set(type, callback);
	}

	sendItemsListRequest() {
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
	}

	sendTriggersListRequest() {
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: crypto.randomUUID(),
				messageType: REQUEST_TYPES.TRIGGER_LIST
			},
			(error) => this.handleError(REQUEST_TYPES.TRIGGER_LIST, error)
		);
	}

	handleThrowRequest(items: string[], count?: number, delay?: number) {
		this.send(
			{
				apiName: 'TITSPublicApi',
				apiVersion: '1.0',
				requestID: crypto.randomUUID(),
				messageType: REQUEST_TYPES.THROW_ITEMS,
				delayTime: delay || 0.08,
				amountOfThrows: count || 1,
				errorOnMissingID: false,
				data: {
					items: items
				}
			},
			(error) => this.handleError(REQUEST_TYPES.THROW_ITEMS, error)
		);
	}

	handleTriggerRequest(triggerId: string) {
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

	handleError(func: string, error: Error) {
		if (!error) {
			return;
		}

		EMITTER.emit(INTERNAL_EVENTS.ERROR, {
			data: { message: `An error occured when attempting to call ${func}` }
		});
		console.error(error);
	}

	onMessage(event: { rawData: RawData; isBinary: boolean }) {
		try {
			const response: TITSMessage = JSON.parse(event.rawData.toString());
			const handler = this.messageHandlers.get(response.messageType);

			if (handler) {
				this.messageHandlers.get(response.messageType)(response);
			} else {
				EMITTER.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `TITSSocketHandler >> No handler found for message type: ${response.messageType}`
					}
				});
			}
		} catch (error) {
			console.error('Error parsing incoming message:', error);
		}
	}
}
