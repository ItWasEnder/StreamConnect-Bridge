import { InternalRequest } from '../providers/backend/InternalRequest';
import { TITSActionData, TITSWebSocketHandler } from '../handlers/TITSHandler';
import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection';
import { expect, jest, it } from '@jest/globals';
import * as __mock from './data/MockDataGenerator';
import { TikfinityWebServerHandler } from '../handlers/TikfinityHandler';
import { ProviderManager } from '../providers/ProviderManager';
import { FileManager } from '../utils/FileManager';
import { TestTITSWebSocketHandler } from './TITSHandler.test';

// import * as ActionsManager from '../actions/ActionsManager';
// const { getKeys } = jest.requireActual<typeof ActionsManager>('../actions/ActionsManager.ts');

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

class TestTikfinityWebServerHandler extends TikfinityWebServerHandler {
	/** wrapped emit func */
	protected emit(event: string, data: any) {
		this.emitEvent(event, data);
	}

	public emitEvent(event, data) {
		super.emit(event, data);
	}
}

describe('TikfinityHandler', () => {
	let fileManager: FileManager;
	let providerManager: ProviderManager;
	let titsHandler: TestTITSWebSocketHandler;
	let tikfinityHandler: TestTikfinityWebServerHandler;
	let sendSpy;

	beforeAll(() => {
		// Setup managers
		fileManager = new FileManager();
		providerManager = new ProviderManager(fileManager);
		titsHandler = new TestTITSWebSocketHandler(config);
		providerManager.registerProvider(titsHandler.provider);
		tikfinityHandler = new TestTikfinityWebServerHandler(config, providerManager);

		// load test actions
		titsHandler.provider.loadActions();

		// Spy on emit
		sendSpy = jest.spyOn(tikfinityHandler, 'emitEvent');
	});

	xit('test', () => {});
});
