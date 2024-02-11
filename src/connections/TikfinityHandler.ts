import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { ActionsManager, CALLERS, ActionRequest } from '../actions/ActionsManager.js';
import * as Text from '../utils/Text.js';

interface Action {
	actionId: string;
	actionName: string;
}

interface Category {
	categoryId: string;
	categoryName: string;
}

export class TikfinityWebServerHandler extends WebServerInst {
	private config: ConnectionConfig;
	private actionManager: ActionsManager;

	constructor(config: ConnectionConfig) {
		super(config.name, (config.info as WebHookInfo).port);
		this.config = config;
	}

	setActionManager(am: ActionsManager) {
		this.actionManager = am;
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
			const categories: Category[] = [];

			// compile the categories in a format that tikfinity can understand
			this.actionManager.getCategories().forEach((key) => {
				categories.push({ categoryId: key, categoryName: Text.replaceAndCapitalize(key) });
			});

			res.json({
				data: categories
			});
		});

		this.register('GET', '/api/features/actions', (req, res) => {
			const categoryId: string = req.query.categoryId as string;
			const actions: Action[] = this.actionManager
				.getActionMap(categoryId)
				.getActions()
				.map((action) => action as Action);

			res.json({
				data: actions
			});
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

			this.emit(INTERNAL_EVENTS.ACTION, { data: request });

			res.json({
				data: []
			});
		});
	}
}
