import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { WebServerInst } from '../connections/backend/WebServerInst.js';
import { ConnectionManager } from '../connections/ConnectionManager.js';
import { ProviderManager } from '../providers/ProviderManager.js';

export class InternapAPIHandler extends WebServerInst {
	constructor(
		public config: ConnectionConfig,
		public connectionManager: ConnectionManager,
		public triggersManager: TriggerManager,
		public providerManager: ProviderManager
	) {
		super();
		this.config = config;
	}

	get service(): string {
		return this.config.name;
	}

	get port(): number {
		return (this.config.info as WebHookInfo).port;
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
