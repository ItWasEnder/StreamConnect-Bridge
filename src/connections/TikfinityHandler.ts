import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import * as Text from '../utils/Text.js';
import { TriggerManager } from '../triggers/TriggerManager.js';
import { ActionRequest, CALLERS } from '../triggers/backend/ActionRequest.js';

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
		private triggerManager: TriggerManager
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

			const request: ActionRequest = req.body as ActionRequest;
			request.caller = CALLERS.TIKFINITY;

			this.emit(INTERNAL_EVENTS.EXECUTE_ACTION, { data: request });

			res.json({
				data: []
			});
		});
	}

	private getCategories(): Category[] {
		const categories: Category[] = [];

		for (const provider of this.triggerManager.getProviders()) {
			for (const category of provider.getCategories()) {
				categories.push({
					categoryId: category,
					categoryName: Text.replaceAndCapitalize(category)
				} as Category);
			}
		}

		return categories;
	}

	private getActions(categoryId: string): Action[] {
		const provider = this.triggerManager.lookupProvider(categoryId);
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
