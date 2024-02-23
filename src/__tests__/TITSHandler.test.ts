import { TITSActionData, TITSWebSocketHandler } from '../handlers/TITSHandler';
import { ConnectionConfig, WebSocketInfo } from '../connections/backend/Connection';
import { InternalRequest } from '../providers/backend/InternalRequest';
import { expect, jest, it } from '@jest/globals';
import * as __mock from './data/MockDataGenerator';
import crypto from 'crypto';

jest.mock('../events/backend/Emmiting');
jest.mock('../connections/backend/WebSocketInst');

const config: ConnectionConfig = {
	id: 'tits',
	enabled: true,
	name: 'T.I.T.S - Websocket',
	description: 'This will connect to TITS to control items and triggers',
	type: 'websocket',
	info: {
		url: 'ws://127.0.0.1:42069/websocket'
	} as WebSocketInfo
};

const ACTION_COUNT = 5;

export class TestTITSWebSocketHandler extends TITSWebSocketHandler {
	/** wrapped refresh func */
	async refreshData(): Promise<[string, TITSActionData[]][]> {
		const map: Map<string, TITSActionData[]> = new Map();

		for (let i = 0; i < ACTION_COUNT; i++) {
			const [key, value] = __mock.generateTITSActionDataSet();
			const arr = map.get(key) ?? [];
			arr.push(value);
			map.set(key, arr);
		}

		return Array.from(map);
	}

	/** wrapped send */
	protected send(payload: object, callback: (err?: Error) => void): void {
		this.socketSend(payload, callback);
	}

	socketSend(payload: object, callback: (err?: Error) => void): void {
		// this does nothing
	}
}

describe('TITSHandler', () => {
	let titsHandler: TestTITSWebSocketHandler;
	let sendSpy;

	beforeAll(() => {
		titsHandler = new TestTITSWebSocketHandler(config);
		titsHandler.provider.loadActions();

		sendSpy = jest.spyOn(titsHandler, 'socketSend');
	});

	it(`should have ${ACTION_COUNT} actions in the provider`, () => {
		expect(titsHandler.provider.actionCount()).toBe(ACTION_COUNT);
	});

	it('should execute the request by sending a socket message', () => {
		const request: InternalRequest = __mock.createInternalRequest(titsHandler.provider);
		request.requestId = crypto.randomUUID();

		const result = titsHandler.executeRequest(request);

		if (!result.isSuccess) {
			throw new Error(result.message);
		}

		expect(sendSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				apiName: expect.any(String),
				apiVersion: expect.any(String),
				data: expect.any(Object),
				messageType: expect.any(String),
				requestID: expect.stringMatching(request.requestId)
			}),
			expect.any(Function)
		);
	});

	it('should fail to execute the request due to cooldown', () => {
		const request: InternalRequest = __mock.createInternalRequest(titsHandler.provider);
		request.requestId = crypto.randomUUID();

		const action: TITSActionData = titsHandler.provider
			.getActionMap(request.providerKey.categoryId)
			.get(request.providerKey.actions[0]);

		action.lastTriggered = Date.now();
		action.cooldown = 10000;

		const result = titsHandler.executeRequest(request);

		if (!result.message.includes('cooldown')) {
			throw new Error(result.message);
		}

		expect(result.isSuccess).toBe(false);
	});

	it('should execute the cooldowned request with bypass_cooldown=true', () => {
		const request: InternalRequest = __mock.createInternalRequest(titsHandler.provider);
		request.requestId = crypto.randomUUID();
		request.bypass_cooldown = true;

		const action: TITSActionData = titsHandler.provider
			.getActionMap(request.providerKey.categoryId)
			.get(request.providerKey.actions[0]);

		action.lastTriggered = Date.now();
		action.cooldown = 10000;

		const result = titsHandler.executeRequest(request);

		if (!result.isSuccess) {
			throw new Error(result.message);
		}

		expect(result.isSuccess).toBe(true);
	});
});
