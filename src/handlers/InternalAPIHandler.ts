import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection';
import { TriggerManager } from '../triggers/TriggerManager';
import { WebServerInst } from '../connections/backend/WebServerInst';
import { ConnectionManager } from '../connections/ConnectionManager';
import { ProviderManager } from '../providers/ProviderManager';
import { TriggersController } from '../controllers/TriggersController';
import { ProviderController } from '../controllers/ProviderController';
import { UserController } from '../controllers/UserController';
import { STATUS } from '../connections/backend/Service';
import { ActionData, ActionProvider } from '../providers/backend/ActionProvider';

export interface InternalActionData extends ActionData {
	lastTriggered?: number;
	callback: any;
}

class InternalActionProvider extends ActionProvider<InternalActionData> {
	override async loadActions(): Promise<[string, InternalActionData[]][]> {
		return [];
	}
}

export class InternalAPIHandler extends WebServerInst {
	public provider: ActionProvider<InternalActionData>;

	constructor(
		public config: ConnectionConfig,
		public connectionManager: ConnectionManager,
		public triggersManager: TriggerManager,
		public providerManager: ProviderManager
	) {
		super();
		this.config = config;
		this.setupRoutes();

		this.provider = new InternalActionProvider(config.id, async () => {
			return [];
		});
	}

	get service(): string {
		return this.config.name;
	}

	get port(): number {
		return (this.config.info as WebHookInfo).port;
	}

	setupRoutes() {
		const triggerManager: TriggersController = new TriggersController(this.triggersManager);
		this.register('GET', '/api/triggers', triggerManager.getTriggers.bind(triggerManager));
		this.register('POST', '/api/triggers', triggerManager.addTrigger.bind(triggerManager));
		this.register('PUT', '/api/triggers', triggerManager.updateTrigger.bind(triggerManager));
		this.register('DELETE', '/api/triggers/:id', triggerManager.deleteTrigger.bind(triggerManager));

		const userController: UserController = new UserController();
		this.register(
			'GET',
			'/api/moderation/users/:platform',
			userController.getUsers.bind(userController)
		);
		this.register(
			'GET',
			'/api/moderation/users/:platform/:username',
			userController.getUser.bind(userController)
		);
		this.register(
			'GET',
			'/api/moderation/users/:platform/:username/:item',
			userController.getCooldown.bind(userController)
		);
		this.register(
			'POST',
			'/api/moderation/cooldown',
			userController.setCooldown.bind(userController)
		);
		this.register('POST', '/api/moderation/block', userController.blockUser.bind(userController));
		this.register(
			'POST',
			'/api/moderation/unblock',
			userController.unblockUser.bind(userController)
		);

		const providerController = new ProviderController(this.providerManager);
		this.register(
			'GET',
			'/api/providers',
			providerController.getProviders.bind(providerController)
		);
		this.register(
			'GET',
			'/api/providers/:id',
			providerController.getProvider.bind(providerController)
		);

		this.register('GET', '/api', async (req, res) => {
			let availCount = 0;

			for (const conn of this.connectionManager.getInstances()) {
				if ((await conn.status()) === STATUS.ONLINE) {
					availCount++;
				}
			}

			const providers = this.providerManager.getProviders();
			const actions = providers.map((p) => p.actionCount()).reduce((a, b) => a + b, 0);

			res.json({
				author: 'ItWasEnder',
				name: 'StreamConnect-Bridge',
				version: '1.0.0',
				enabledServices: this.connectionManager.getInstances().filter((s) => s.config.enabled)
					.length,
				onlineServices: availCount,
				totalTriggers: this.triggersManager.getTriggers().length,
				enabledTriggers: this.triggersManager.getTriggers().filter((t) => t.enabled).length,
				actionProviders: providers.length,
				loadedActions: actions,
			});
		});
	}
}
