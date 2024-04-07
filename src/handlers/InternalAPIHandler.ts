import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection';
import { TriggerManager } from '../triggers/TriggerManager';
import { WebServerInst } from '../connections/backend/WebServerInst';
import { ConnectionManager } from '../connections/ConnectionManager';
import { ProviderManager } from '../providers/ProviderManager';
import { TriggersController } from '../controllers/TriggersController';
import { ProviderController } from '../controllers/ProviderController';
import { UserController } from '../controllers/UserController';
import { STATUS } from '../connections/backend/Service';
import { ActionData, ActionMap, ActionProvider } from '../providers/backend/ActionProvider';
import { INTERNAL_EVENTS, EMITTER } from '../events/EventsHandler';
import {
	ContextLike,
	InternalRequest,
	RequestExecutor,
} from '../providers/backend/InternalRequest';
import { Result } from '../utils/Result';
import { InternalAction } from '../internal/backend/InternalAction';
import { ModifyTrigger } from '../internal/ModifyTrigger';
import { ManageUsers } from '../internal/ManagerUsers';

export interface InternalActionData extends ActionData {
	lastTriggered?: number;
	executor: Function;
}

export class InternalActionProvider extends ActionProvider<InternalActionData> {
	override async loadActions() {}

	public register(action: InternalAction): void {
		const map = this.getActionMap(action.providerKey.categoryId);
		for (const __action of action.providerKey.actions) {
			map.put({
				id: __action,
				name: action.name,
				executor: async (context: ContextLike) => {
					return action.execute(context);
				},
			} as InternalActionData);
		}
	}
}

export class InternalAPIHandler extends WebServerInst implements RequestExecutor {
	public provider: InternalActionProvider;

	constructor(
		public config: ConnectionConfig,
		public connectionManager: ConnectionManager,
		public triggersManager: TriggerManager,
		public providerManager: ProviderManager
	) {
		super();
		this.config = config;

		this.provider = new InternalActionProvider(config.id, async () => {
			return [];
		});

		this.providerManager.registerProvider(this.provider);

		this.setup();
	}

	get service(): string {
		return this.config.name;
	}

	get port(): number {
		return (this.config.info as WebHookInfo).port;
	}

	registerActions() {
		this.provider.register(new ModifyTrigger(this.triggersManager));
		this.provider.register(new ManageUsers());
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
			'/api/providers/load',
			providerController.loadAllActions.bind(providerController)
		);
		this.register(
			'GET',
			'/api/providers/:providerId',
			providerController.getCategories.bind(providerController)
		);
		this.register(
			'GET',
			'/api/providers/:providerId/actions/:category',
			providerController.getActions.bind(providerController)
		);
		this.register(
			'GET',
			'/api/providers/:providerId/load',
			providerController.loadActions.bind(providerController)
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

	private setup(): void {
		this.setupRoutes();
		this.registerActions();

		this.on(INTERNAL_EVENTS.EXECUTE_ACTION, async (payload) => {
			const __request: InternalRequest = payload.data;

			if (__request.providerId === this.provider.providerId) {
				const result = await this.executeRequest(__request);

				// only print error execution
				if (!result.isSuccess) {
					EMITTER.emit(result.value, { data: { message: result.message } });
				}
			}
		});
	}

	async executeRequest(request: InternalRequest): Promise<Result<string>> {
		const { caller, requestId, providerKey, context } = request;
		const __info = `(requestId: ${requestId}, caller: ${caller})`;

		if (!providerKey) {
			return Result.fail(`Missing providerKey in request ${__info}`, INTERNAL_EVENTS.ERROR);
		}

		const { categoryId, actions } = providerKey;

		if (!this.provider.has(categoryId)) {
			return Result.fail(
				`Unable to find category based on input of '${JSON.stringify(providerKey)}' ${__info}`,
				INTERNAL_EVENTS.ERROR
			);
		}

		const actionMap: ActionMap<InternalActionData> = this.provider.getActionMap(categoryId);
		const actionDatas: InternalActionData[] = [];

		// Convert keys to actionable data types
		providerKey.actions.forEach((id) => actionDatas.push(actionMap.get(id)));

		try {
			for (const __action of actionDatas) {
				__action.lastTriggered = Date.now();
				const result: Result<string> = await __action.executor(context);

				if (!result.isSuccess) {
					return Result.fail(
						`Action result was unsuccessful (${result.message}) for action '${categoryId}' with actions ${`[${actions.join(', ')}]`} ${__info}`,
						INTERNAL_EVENTS.ERROR
					);
				}
			}

			// TODO: Verbose Log Event (to file or console with debug flag)
			return Result.pass(
				`Action '${categoryId}' executed with actions ${`[${actions.join(', ')}]`} ${__info}`,
				INTERNAL_EVENTS.INFO
			);
		} catch (error) {
			return Result.fail(
				`Error executing action '${categoryId}' with actions ${`[${actions.join(', ')}]`} ${__info}: ${error}`,
				INTERNAL_EVENTS.ERROR
			);
		}
	}
}
