import { TITS_ACTIONS } from '../connections/TITSHandler.js';
import { TikfinityExecuteRequest } from '../connections/TikfinityHandler.js';
import { EMITTER, INTERNAL_EVENTS } from '../events/EventsHandler.js';

export interface Action {
	actionId: string;
	actionName: string;
}

export interface ActionPayload {
	type: string;
}

export class ActionsManager {
	private actionsMap: Map<string, Map<string, string>> = new Map();

	constructor() {
		EMITTER.on(INTERNAL_EVENTS.ACTION, (payload) => {
			const { data } = payload;

			if (data.type === 'tikfinity') {
				const { categoryId, actionId, context } = data as TikfinityExecuteRequest;

				if (!this.actionsMap.has(categoryId)) {
					EMITTER.emit(INTERNAL_EVENTS.ERROR, {
						data: { message: `ActionManager >> Invalid map key from action event: ${categoryId}` }
					});
					return;
				}

				const coinInfo: string = context?.coins ? `for ${context.coins} coins` : ''; 

				EMITTER.emit(INTERNAL_EVENTS.INFO, {
					data: {
						message: `Action '${this.getActionName(categoryId, actionId)}' triggered by ${context?.username} ${coinInfo}`
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
				EMITTER.emit(categoryId, { data: payload });
			}
		});
	}

	getActions(categoryId: string): Set<Action> | undefined {
		let actionSet = new Set<Action>();
		const actionMap = this.actionsMap.get(categoryId);

		if (actionMap) {
			for (const key of actionMap.keys()) {
				actionSet.add({
					actionId: key,
					actionName: actionMap.get(key)
				});
			}
		}

		return actionSet;
	}

	getKeys(): string[] {
		return Array.from(this.actionsMap.keys());
	}

	consumeActions(categoryId: string, supplier: () => Action[]) {
		let actionMap: Map<string, string> | undefined = this.actionsMap.get(categoryId);
		let actions: Action[] = supplier();

		if (!actionMap) {
			actionMap = new Map<string, string>();
			this.actionsMap.set(categoryId, actionMap);
		}

		for (const action of actions) {
			actionMap.set(action.actionId, action.actionName);
		}
	}

	removeByCategory(categoryId: string) {
		this.actionsMap.delete(categoryId);
	}

	clearAll() {
		this.actionsMap.clear();
	}

	getActionName(categoryId: string, actionId: string) {
		const actionMap = this.actionsMap.get(categoryId);

		if (!actionMap) {
			return actionId;
		}

		return actionMap.get(actionId) || actionId;
	}
}
