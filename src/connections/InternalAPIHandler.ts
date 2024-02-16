import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import * as Text from '../utils/Text.js';
import { ConnectionManager } from './backend/ConnectionManager.js';
import { InternalRequest, CALLERS } from '../providers/backend/InternalRequest.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import { ActionData, ActionMap } from '../providers/backend/ActionProvider.js';

export class InternapAPIHandler extends WebServerInst {
	constructor(
		public config: ConnectionConfig,
		public connectionManager: ConnectionManager,
		public triggersManager: TriggerManager,
		public providerManager: ProviderManager
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
