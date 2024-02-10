import { TITS_ACTIONS } from '../connections/TITSHandler.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
import { Payload } from '../events/backend/Emitter.js';
import * as fs from 'fs';
import * as path from 'path';

export enum CALLERS {
	INTENAL,
	TIKFINITY
}

export interface ActionData {
	actionId: string;
	actionName: string;
	lastTriggered?: number;
	cooldown?: number;
}

export interface TriggerRequest {
	caller: CALLERS;
	categoryId: string;
	actionId: string;
	bypass_cooldown?: boolean;
	context: Record<string, any>;
}

export class ActionMap {
	private actionMap: Map<string, ActionData> = new Map();

	/**
	 * @param actionId identifier
	 * @returns true if action is stored
	 */
	has(actionId: string): boolean {
		return this.actionMap.has(actionId);
	}

	/**
	 * Get an ActionData from an action identifier
	 * @param actionId identifier
	 * @returns the associated ActionData or undefined if no value is set
	 */
	get(actionId: string): ActionData | undefined {
		return this.actionMap.get(actionId);
	}

	/**
	 * Adds the action to the action map
	 * @param action the action
	 */
	put(action: ActionData) {
		this.actionMap.set(action.actionId, action);
	}

	/**
	 * @returns an array of ActionData objects
	 */
	getActions(): ActionData[] {
		return Array.from(this.actionMap.values()) ?? [];
	}

	/**
	 * Will update the lastTriggered field for a specific action
	 * @param actionId the action to update
	 */
	triggered(actionId: string) {
		if (this.actionMap.has(actionId)) {
			this.actionMap.get(actionId).lastTriggered = Date.now();
		}
	}
}

export class ActionsManager extends Emitting {
	private categoryMap: Map<string, ActionMap>; // map<categoryId, map<actionId, info>>
	private reverseMap: Map<string, string>; // map<actionId, categoryId>

	constructor() {
		super();
		// init maps
		this.categoryMap = new Map();
		this.reverseMap = new Map();

		// setup event listeners
		this.on(INTERNAL_EVENTS.ACTION, this.handleTriggerRequest.bind(this));
	}

	/**
	 * This function will generate a new ActionMap if the category does not exist
	 * @param categoryId the category identifier
	 * @returns an ActionMap for the given category
	 */
	getActionMap(categoryId: string): ActionMap {
		let actionMap: ActionMap | undefined = this.categoryMap.get(categoryId);

		if (actionMap === undefined) {
			actionMap = new ActionMap();
			this.categoryMap.set(categoryId, actionMap);
		}

		return actionMap;
	}

	/**
	 * Uses a reverse map to lookup the category of the specified action
	 * @param actionId identifier
	 * @returns a category identifier or undefined if the actionId is not found
	 */
	lookupCategory(actionId: string): string | undefined {
		return this.reverseMap.get(actionId);
	}

	getCategories(): string[] {
		return Array.from(this.categoryMap.keys());
	}

	consumeActions(categoryId: string, supplier: () => ActionData[]) {
		const actionMap: ActionMap = this.getActionMap(categoryId);
		const actions: ActionData[] = supplier();

		for (const action of actions) {
			actionMap.put(action);

			if (this.reverseMap.has(action.actionId)) {
				this.emit(INTERNAL_EVENTS.WARN, {
					data: {
						message: `ActionManager >> ActionId '${action.actionId}/${action.actionName}' already exists in another category`
					}
				});
			} else {
				this.reverseMap.set(action.actionId, categoryId);
			}
		}

		this.loadCooldowns();
	}

	removeByCategory(categoryId: string) {
		this.categoryMap.delete(categoryId);
	}

	clearAll() {
		this.categoryMap.clear();
	}

	loadCooldowns() {
		try {
			const filePath = path.join(process.cwd(), 'storage', 'cooldowns.json');
			const rawData = fs.readFileSync(filePath, 'utf-8');
			const cooldowns = JSON.parse(rawData);

			// for each actiondata in the file
			for (const actionData of cooldowns?.actions) {
				const categoryId = actionData?.categoryId;
				const actionId = actionData?.actionId;
				const cooldown = actionData?.cooldown;

				const actionMap: ActionMap = this.categoryMap.get(categoryId);

				if (!actionMap) {
					return;
				}

				const action: ActionData | undefined = actionMap.get(actionId);

				if (!action) {
					return;
				}

				action.cooldown = cooldown;
			}
		} catch (error) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `ActionManager >> Error occured trying to load cooldowns from file @@@ ${error}`
				}
			});
		}
	}

	/**
	 * Handles the trigger request event
	 * @param payload the event payload
	 */
	private handleTriggerRequest(payload: Payload) {
		const {
			caller,
			categoryId,
			actionId,
			context,
			bypass_cooldown = false
		} = payload.data as TriggerRequest;

		if (!categoryId || !actionId) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'ActionManager >> Missing categoryId or actionId from action event' }
			});
			return;
		}

		const actionMap: ActionMap = this.getActionMap(categoryId)!;
		const actionData: ActionData | undefined = actionMap.get(actionId);

		if (!actionData) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `ActionManager >> Invalid actionId from action event: ${categoryId}/${actionId}`
				}
			});
			return;
		}

		// Handle cooldown
		if (!bypass_cooldown && actionData.cooldown > 0) {
			const lastTriggered: number = actionData.lastTriggered ?? 0;
			const now: number = Date.now();
			const elapsed: number = now - lastTriggered;
			const timeLeft: number = actionData.cooldown - elapsed;

			if (elapsed < actionData.cooldown) {
				this.emit(INTERNAL_EVENTS.NOTIF, {
					data: {
						message: `Action '${actionData.actionName}' cancelled by cooldown (${timeLeft}ms)`
					}
				});
				return;
			}
		}

		// Update last triggered for this action
		actionData.lastTriggered = Date.now();

		switch (caller) {
			case CALLERS.TIKFINITY:
				const coinInfo: string = context?.coins ? `for ${context.coins} coins` : '';

				this.emit(INTERNAL_EVENTS.INFO, {
					data: {
						message: `Action '${actionData.actionName}' triggered by ${context?.username} ${coinInfo}`
					}
				});

				// Handle different trigger apis
				let payload: any = {};
				if (Object.values(TITS_ACTIONS).includes(categoryId)) {
					if (categoryId == TITS_ACTIONS.ACTIVATE_TRIGGER) {
						payload = {
							triggerId: actionId
						};
					} else if (categoryId == TITS_ACTIONS.THROW_ITEMS) {
						payload = {
							items: [actionId]
						};
					}
				}
				this.emit(categoryId, { data: payload });
				break;
			default:
				this.emit(INTERNAL_EVENTS.ERROR, {
					data: { message: `ActionManager >> Unhandled caller: ${caller}` }
				});
				return;
		}
	}
}
