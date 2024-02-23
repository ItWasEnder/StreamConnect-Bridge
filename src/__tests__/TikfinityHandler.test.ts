import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection';
import { TikfinityWebServerHandler } from '../handlers/TikfinityHandler';
import { ProviderManager } from '../providers/ProviderManager';
import { FileManager } from '../utils/FileManager';
import { TestTITSWebSocketHandler } from './TITSHandler.test';
import { Request, Response } from 'express';
import { faker } from '@faker-js/faker';
import { ActionData, ActionMap } from '../providers/backend/ActionProvider';
import { INTERNAL_EVENTS } from '../events/EventsHandler';
import { CALLERS, InternalRequest } from '../providers/backend/InternalRequest';
import { expect, jest, it } from '@jest/globals';
import * as __mock from './data/MockDataGenerator';

jest.mock('../utils/FileManager');
jest.mock('../events/backend/Emmiting');
jest.mock('../connections/backend/WebServerInst');

const config: ConnectionConfig = {
	id: 'tikfinity',
	enabled: true,
	name: 'Tikfinity - Webserver',
	description: 'This will host an api to allow tikfinity app interations',
	type: 'webserver',
	info: {
		host: 'localhost',
		port: 8832,
		apiKey: ''
	} as WebHookInfo
};

const mockRequest = (query = {}, body = {}) => ({
	query,
	body
});

const mockResponse = () => {
	const res: any = {};
	res.json = jest.fn().mockReturnValue(res);
	res.status = jest.fn().mockReturnValue(res);
	res.send = jest.fn().mockReturnValue(res);
	return res;
};

class TestTikfinityWebServerHandler extends TikfinityWebServerHandler {
	routes: Map<string, any> = new Map();

	register(method: string, path: string, handler: (req: Request, res: Response) => void): void {
		this.routes.set(path, handler);
	}

	/** wrapped emit func */
	protected emit(event: string, data: any) {
		this.emitEvent(event, data);
	}

	public emitEvent(event, data) {
		// this does nothing
	}
}

describe('TikfinityHandler', () => {
	let fileManager: FileManager;
	let providerManager: ProviderManager;
	let titsHandler: TestTITSWebSocketHandler;
	let tikfinityHandler: TestTikfinityWebServerHandler;
	let emitSpy;

	beforeAll(() => {
		// Setup managers
		fileManager = new FileManager();
		providerManager = new ProviderManager(fileManager);
		titsHandler = new TestTITSWebSocketHandler(config);
		providerManager.registerProvider(titsHandler.provider);
		tikfinityHandler = new TestTikfinityWebServerHandler(config, providerManager);

		// Setup routes
		tikfinityHandler.setupRoutes();

		// load test actions
		titsHandler.provider.loadActions();

		// Spy on emit
		emitSpy = jest.spyOn(tikfinityHandler, 'emitEvent');
	});

	it('should verify required data from /api/app/info', () => {
		const req = mockRequest();
		const res = mockResponse();

		tikfinityHandler.routes.get('/api/app/info')(req, res);

		const output = res.json.mock.calls[0][0];
		const data = output.data;

		expect(res.status).toHaveBeenCalledWith(200);

		expect(data).toHaveProperty('author');
		expect(data).toHaveProperty('name');
		expect(data).toHaveProperty('version');
	});

	it('should verify recieved categories for /api/features/categories', () => {
		const req = mockRequest();
		const res = mockResponse();

		tikfinityHandler.routes.get('/api/features/categories')(req, res);

		const output = res.json.mock.calls[0][0];
		const data = output.data;
		const storedCategories = titsHandler.provider.getCategories();

		expect(res.status).toHaveBeenCalledWith(200);
		expect(data.length).toBe(storedCategories.length);

		// all categories should be present
		for (let i = 0; i < data.length; i++) {
			expect(storedCategories).toContain(data[i].categoryId);
		}
	});

	it('should verify received actions for /api/features/actions', () => {
		const res = mockResponse();
		const req = mockRequest({
			categoryId: faker.helpers.arrayElement(titsHandler.provider.getCategories())
		});

		tikfinityHandler.routes.get('/api/features/actions')(req, res);

		expect(res.status).toHaveBeenCalledWith(200);

		const output: any = res.json.mock.calls[0][0];
		const actions: { actionId: string; actionName: string }[] = output.data;
		const actionMap: ActionMap<ActionData> = titsHandler.provider.getActionMap(
			(req.query as any).categoryId
		);

		expect(actions.length).toBe(actionMap.size());

		const actionData = actionMap.get(actions[0].actionId);

		expect(actionData).toBeDefined();
	});

	it('verifies that /api/features/actions/exec emits a validated event', () => {
		const selectedCategory = faker.helpers.arrayElement(titsHandler.provider.getCategories());
		const actionMap: ActionMap<ActionData> = titsHandler.provider.getActionMap(selectedCategory);
		const selectedAction: ActionData = faker.helpers.arrayElement(actionMap.getActions());

		const res = mockResponse();
		const req = mockRequest(
			{},
			{
				categoryId: selectedCategory,
				actionId: selectedAction.id,
				context: {
					triggerTypeId: 9,
					userId: '123456789',
					username: 'TestUser',
					coins: 12
				}
			}
		);

		tikfinityHandler.routes.get('/api/features/actions/exec')(req, res);

		expect(res.status).toHaveBeenCalledWith(200);

		const expectedRequest: InternalRequest = __mock.createInternalRequest({
			provider: titsHandler.provider,
			providerKey: {
				categoryId: selectedCategory,
				actions: [selectedAction.id]
			}
		});

		expect(emitSpy).toHaveBeenCalledWith(
			INTERNAL_EVENTS.EXECUTE_ACTION,
			expect.objectContaining({
				data: {
					caller: expect.stringMatching(CALLERS.TIKFINITY),
					bypass_cooldown: expect.any(Boolean),
					providerId: expect.stringMatching(expectedRequest.providerId),
					providerKey: expect.objectContaining({
						categoryId: selectedCategory,
						actions: [selectedAction.id]
					}),
					context: expect.any(Object),
					requestId: expect.any(String)
				}
			})
		);
	});
});
