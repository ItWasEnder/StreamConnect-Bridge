import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import * as Text from '../utils/Text.js';
import { InternalRequest, CALLERS, ProviderKey } from '../providers/backend/InternalRequest.js';
import { ProviderManager } from '../providers/ProviderManager.js';

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
		super(config.name, (config.info as WebHookInfo).port);
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

			const reqId = crypto.randomUUID();

			console.log(
				`TikfinityWebServerHandler >> POST /api/features/actions/exec >> Request ID: ${reqId}`
			);

			const pk: ProviderKey = {
				categoryId: body.categoryId,
				actions: [body.actionId]
			};

			const request: InternalRequest = {
				caller: CALLERS.TIKFINITY,
				requestId: reqId,
				providerId: this.providerManager.lookupProvider(body.categoryId)?.providerId || '',
				providerKey: pk,
				bypass_cooldown: body.bypass_cooldown ?? false,
				context: body.context ?? {}
			};

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
