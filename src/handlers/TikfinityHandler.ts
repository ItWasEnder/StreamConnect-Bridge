import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection';
import { WebServerInst } from '../connections/backend/WebServerInst';
import { INTERNAL_EVENTS } from '../events/EventsHandler';
import * as Text from '../utils/Text';
import { InternalRequest, CALLERS, ProviderKey } from '../providers/backend/InternalRequest';
import { ProviderManager } from '../providers/ProviderManager';
import crypto from 'crypto';

interface Action {
	actionId: string;
	actionName: string;
}

interface Category {
	categoryId: string;
	categoryName: string;
}

enum TRIGGER_TYPE {
	INVALID,
	SHARE,
	COMMAND,
	GIFT_MIN,
	GIFT_SPECIFIC,
	JOIN,
	LIKES,
	FOLLOW,
	SUBSCRIBE,
	CHAT,
	EMOTE,
	FIRST_USER_ACTIVITY
}

export class TikfinityWebServerHandler extends WebServerInst {
	constructor(
		private config: ConnectionConfig,
		private providerManager: ProviderManager
	) {
		super();
	}

	get service(): string {
		return this.config.name;
	}

	get port(): number {
		return (this.config.info as WebHookInfo).port;
	}

	setupRoutes() {
		this.register('GET', '/api/app/info', (req, res) => {
			res.status(200);
			res.json({
				data: {
					author: 'ItWasEnder',
					name: 'StreamConnect-Bridge',
					version: '1.0.0'
				}
			});
		});

		this.register('GET', '/api/features/categories', (req, res) => {
			const categories: Category[] = this.getCategories();
			res.status(200);
			res.json({
				data: categories
			});
		});

		this.register('GET', '/api/features/actions', (req, res) => {
			const categoryId: string = req.query.categoryId as string;
			try {
				const actions: Action[] = this.getActions(categoryId);
				res.status(200);
				res.json({
					data: actions
				});
			} catch (err) {
				res.status(400);
				res.json({
					message: err.message
				});
			}
		});

		this.register('POST', '/api/features/actions/exec', (req, res) => {
			const body = req.body;

			if (!body?.categoryId || !body?.actionId) {
				res.status(400);
				res.json({
					message: "Invalid request body. Missing 'categoryId' or 'actionId' fields."
				});
				return;
			}

			const __provider = this.providerManager.lookupProvider(body.categoryId);
			const reqId = crypto.randomUUID();
			const pk: ProviderKey = {
				categoryId: body.categoryId,
				actions: [body.actionId]
			};

			if (!__provider) {
				res.status(400);
				res.json({
					message: `No provider found for categoryId: ${body.categoryId}`
				});
				return;
			}

			if (!__provider.has(body.categoryId)) {
				res.status(400);
				res.json({
					message: `No category found for categoryId: ${body.categoryId}`
				});
				return;
			}

			const __actionmap = __provider.getActionMap(pk.categoryId);
			const actionNames: string[] = [];

			for (const action of pk.actions) {
				const __action = __actionmap.get(action);
				if (__action) {
					actionNames.push(__action.name);
				}
			}

			const request: InternalRequest = {
				caller: CALLERS.TIKFINITY,
				requestId: reqId,
				providerId: __provider.providerId || '',
				providerKey: pk,
				bypass_cooldown: body.bypass_cooldown ?? false,
				context: body.context ?? {}
			};

			const coinInfo: string = body.context?.coins ? `with ${body.context.coins} coins` : '';
			const username: string = body.context?.username ?? '<<unknown>>';
			const nickname: string = body.context?.nickname ?? '';
			const triggerType: string = body.context?.triggerType
				? TRIGGER_TYPE[body.context?.triggerType as keyof typeof TRIGGER_TYPE].toString() ??
					'UNKNOWN'
				: 'UNKNOWN';

			// Log the action
			this.emit(INTERNAL_EVENTS.INFO, {
				data: {
					message: `Action '${actionNames.join(', ')}' executed by '${username}(${nickname})' from trigger ${triggerType} ${coinInfo}`
				}
			});

			// submit event to the backend
			this.emit(INTERNAL_EVENTS.EXECUTE_ACTION, { data: request });

			res.status(200);
			res.json({
				data: []
			});
		});
	}

	getCategories(): Category[] {
		const categories: Category[] = [];

		for (const provider of this.providerManager.getProviders()) {
			for (const category of provider.getCategories()) {
				const __cat: Category = {
					categoryId: category,
					categoryName: Text.replaceAndCapitalize(category)
				};
				categories.push(__cat);
			}
		}

		return categories;
	}

	getActions(categoryId: string): Action[] {
		const provider = this.providerManager.lookupProvider(categoryId);
		const actions: Action[] = [];

		if (!provider) {
			throw new Error(
				`TikfinityWebServerHandler >> getActions >> No provider found for categoryId: ${categoryId}`
			);
		}

		if (!provider.has(categoryId)) {
			throw new Error(
				`TikfinityWebServerHandler >> getActions >> No category found for categoryId: ${categoryId}`
			);
		}

		const actionMap = provider.getActionMap(categoryId);

		for (const action of actionMap.getActions()) {
			actions.push({
				actionId: action.id,
				actionName: action.name
			});
		}

		return actions;
	}
}
