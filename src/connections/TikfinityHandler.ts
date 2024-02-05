import { ConnectionConfig, WebHookInfo } from './backend/Connection.js';
import { WebServerInst } from './backend/WebServerInst.js';
import { EMITTER, INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Action, ActionPayload, ActionsManager } from '../actions/ActionsManager.js';
import * as Text from '../utils/Text.js';

export interface TikfinityExecuteRequest extends ActionPayload {
	categoryId: string;
	actionId: string;
	context: {
		[key: string]: any;
	};
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
			const catMap: { categoryId: string; categoryName: string }[] = [];

			// compile the categories in a format that tikfinity can understand
			this.actionManager.getKeys().forEach((key) => {
				catMap.push({ categoryId: key, categoryName: Text.replaceAndCapitalize(key) });
			});

			res.json({
				data: catMap
			});
		});

		this.register('GET', '/api/features/actions', (req, res) => {
			const categoryId: string = req.query.categoryId as string;
			const actions: Set<Action> = this.actionManager.getActions(categoryId);

			res.json({
				data: Array.from(actions)
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

			const request: TikfinityExecuteRequest = {
				type: 'tikfinity',
				...req.body
			};

			EMITTER.emit(INTERNAL_EVENTS.ACTION, { data: request });

			res.json({
				data: []
			});
		});
	}
}
