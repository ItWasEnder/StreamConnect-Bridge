import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import * as Text from '../utils/Text.js';
import { InternalRequest, CALLERS, ProviderKey } from '../providers/backend/InternalRequest.js';
import { ProviderManager } from '../providers/ProviderManager.js';
import crypto from 'crypto';

interface Action {
	actionId: string;
	actionName: string;
}

interface Category {
	categoryId: string;
	categoryName: string;
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
			res.json({
				data: categories
			});
		});

		this.register('GET', '/api/features/actions', (req, res) => {
			const categoryId: string = req.query.categoryId as string;
			try {
				const actions: Action[] = this.getActions(categoryId);
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

			// Log the action
			this.emit(INTERNAL_EVENTS.INFO, {
				data: {
					message: `Action '${actionNames.join(', ')}' executed by '${username}' ${coinInfo}`
				}
			});

			// submit event to the backend
			this.emit(INTERNAL_EVENTS.EXECUTE_ACTION, { data: request });

			res.json({
				data: []
			});
		});
	}

	private getCategories(): Category[] {
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

	private getActions(categoryId: string): Action[] {
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
