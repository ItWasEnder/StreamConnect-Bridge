import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import * as Text from '../utils/Text.js';
import { ConnectionManager } from './backend/ConnectionManager.js';

export class InternapAPIHandler extends WebServerInst {
	constructor(
		public config: ConnectionConfig,
		public connectionManager: ConnectionManager,
		public triggersManager: TriggerManager
	) {
		super(config.name, (config.info as WebHookInfo).port);
		this.config = config;
	}

	setupRoutes() {
		this.register('GET', '/api', (req, res) => {
			res.json({
				author: 'ItWasEnder',
				name: 'StreamConnect-Bridge',
				version: '1.0.0'
			});
		});
	}
}
