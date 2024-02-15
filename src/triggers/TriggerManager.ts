import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
import { JSONPath } from 'jsonpath-plus';
import { Payload } from '../events/backend/Emitter.js';
import { ActionData, ActionMap, ActionProvider } from './backend/ActionProvider.js';
import { FileManager } from '../utils/FileManager.js';
import { EventMapping, Trigger } from './backend/Trigger.js';
import { TITS_ACTIONS } from '../connections/TITSHandler.js';
import * as fs from 'fs';
import * as path from 'path';
import { Condition } from './backend/Condition.js';

export interface BaseEvent {
	event: string;
	username: string;
	timestamp: number;
}

export class TriggerManager extends Emitting {
	/** internals - used to track data */
	static TRIGGERS_PATH: string = 'storage/triggers.json';
	private eventIndex: Map<string, Trigger[]> = new Map(); // <event, triggers[]>
	private triggers: Map<string, Trigger> = new Map(); // <identifier, trigger>

	/** externals - organized data compiled over multiple services */
	private providerMap: Map<string, ActionProvider<any>> = new Map(); // <service_id, provider>

	constructor(private fileManager: FileManager) {
		super();

		// Create the triggers file if it doesn't exist
		fileManager.createFileIfNotExists(TriggerManager.TRIGGERS_PATH, '[]');

		fileManager.onChange(TriggerManager.TRIGGERS_PATH, (_path) => {
			this.clearAll();
			this.loadTriggers(_path);
		});

		this.loadTriggers(fileManager.getFullPath(TriggerManager.TRIGGERS_PATH));
	}

	/** provider functions */

	/**
	 * Registers a provider with the manager
	 * @param provider the provider to register
	 */
	registerProvider<T extends ActionData>(provider: ActionProvider<T>) {
		if (this.providerMap.has(provider.providerId)) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `TriggerManager >> Provider with id ${provider.providerId} already exists`
				}
			});
			return;
		}

		this.providerMap.set(provider.providerId, provider);
	}

	/**
	 * This method returns an array of all providers
	 * @returns an provider associated with the given id
	 */
	getProvider<T extends ActionData>(providerId: string): ActionProvider<T> | undefined {
		return this.providerMap.get(providerId);
	}

	getProviders<T extends ActionData>(): ActionProvider<T>[] {
		return Array.from(this.providerMap.values());
	}

	lookupProvider<T extends ActionData>(categoryId: string): ActionProvider<T> | undefined {
		let provider: ActionProvider<T> | undefined = undefined;

		for (const _provider of this.providerMap.values()) {
			if (_provider.getActionMap(categoryId)) {
				provider = _provider;
				break;
			}
		}

		return provider;
	}

	/** trigger functions */

	/**
	 * This method saves the triggers to the triggers file
	 */
	save() {
		const triggers = this.getTriggers();
		const data = JSON.stringify(triggers, null, 2);
		this.fileManager.saveFile(TriggerManager.TRIGGERS_PATH, data);
	}

	/**
	 * This method adds a trigger to the triggers list
	 * @param trigger the trigger to add
	 */
	addTrigger(trigger: Trigger): void {
		this.triggers.set(trigger.id, trigger);
	}

	/**
	 * This method removes a trigger from the triggers list
	 * @param id the id of the trigger to remove
	 * @returns true if the trigger was removed, false otherwise
	 */
	removeTrigger(id: string): boolean {
		return this.triggers.delete(id);
	}

	/**
	 * This method returns an array of all triggers
	 * @returns an array of all triggers
	 */
	getTriggers(): Trigger[] {
		return Array.from(this.triggers.values());
	}

	/**
	 * This method clears out the trigger mappings and event index for the manager (this.loadTriggers() after)
	 */
	clearAll(): void {
		this.triggers.clear();

		// Clear the event index
		for (const [event, _] of this.eventIndex) {
			this.eventIndex.set(event, []);
		}
	}

	/**
	 * Load triggers from a file
	 * @param filePath full path to the triggers file
	 */
	private loadTriggers(filePath: string) {
		try {
			const rawData = fs.readFileSync(filePath, 'utf-8');
			const triggers = JSON.parse(rawData);

			for (const _trigger of triggers) {
				const trigger: Trigger = Trigger.fromObject(_trigger);
				this.addTrigger(trigger);

				if (trigger.enabled) {
					// Add the trigger to the event index
					for (const event of trigger.events) {
						this.getEventTriggers(event.event).push(trigger);
					}
				}
			}
		} catch (error) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `TriggerManager >> Error occured trying to load triggers from file @@@ ${error}`
				}
			});
		}
	}

	/**
	 * This will return a mutable array of triggers for the given event
	 * @param eventName the event name to get triggers for
	 * @returns an array of triggers for the given event
	 */
	private getEventTriggers(eventName: string): Trigger[] {
		let triggers: Trigger[] = this.eventIndex.get(eventName);

		// If new event, create a new array for it & setup listener
		if (!triggers) {
			this.on(eventName, (data) => {
				this.handleEvent(eventName, data);
			});
			triggers = this.eventIndex.set(eventName, []).get(eventName)!;
		}

		return triggers;
	}

	private handleEvent(eventName: string, payload: Payload): void {
		const triggers = this.getEventTriggers(eventName);
		const eventData = payload.data;

		for (const trigger of triggers) {
			// Check if the trigger's conditions are met
			const _results = JSONPath({
				path: `$.[?(@.event=="${eventName}")]`,
				json: trigger.events
			});

			// Failed to find matching event in trigger @@@ technically an error but doesn't matter
			if (!_results || _results.length === 0) {
				console.log(`Failed to find matching event in trigger ${trigger.name}`);
				return;
			}

			const triggerEvent: EventMapping = _results[0];
			const conditionsMet = triggerEvent.conditions.every((_con: Condition) =>
				_con.evaluate(eventData)
			);

			// check if the trigger is on cooldown
			if (trigger.cooldown > 0 && Date.now() - trigger.lastExecuted < trigger.cooldown) {
				continue;
			}

			// If the conditions are met, emit the actions
			if (conditionsMet) {
				for (const request of trigger.actions) {
					const _baseEvent: BaseEvent = eventData;
					const nickname = eventData.nickname;

					trigger.lastExecuted = Date.now();

					// Emit the action request
					if (trigger.log) {
						this.emit(INTERNAL_EVENTS.INFO, {
							data: {
								message: `Trigger '${trigger.name}' executed by @${_baseEvent.username}${nickname ? `(${nickname})` : ''} from '${_baseEvent.event}' event`
							}
						});
					}
					this.emit(request.event, { data: request.payload });
				}
			}
		}
	}

	// /**
	//  * Handles the trigger request event
	//  * @param payload the event payload
	//  */
	// private handleTriggerRequest<T extends ActionData>(payload: Payload) {
	// 	const {
	// 		caller,
	// 		providerId,
	// 		categoryId,
	// 		actionId,
	// 		context,
	// 		bypass_cooldown = false
	// 	} = payload.data as ActionRequest;

	// 	if (!providerId || !categoryId || !actionId) {
	// 		this.emit(INTERNAL_EVENTS.ERROR, {
	// 			data: {
	// 				message: 'ActionManager >> Missing providerId or categoryId or actionId from action event'
	// 			}
	// 		});
	// 		return;
	// 	}

	// 	const provider: ActionProvider<T> | undefined = this.providerMap.get(providerId);

	// 	if (!provider) {
	// 		this.emit(INTERNAL_EVENTS.ERROR, {
	// 			data: { message: `ActionManager >> Invalid providerId from action event: ${providerId}` }
	// 		});
	// 		return;
	// 	}

	// 	const actionMap: ActionMap<T> = provider.getActionMap(categoryId)!;
	// 	const actionData: ActionData | undefined = actionMap.get(actionId);

	// 	if (!actionData) {
	// 		this.emit(INTERNAL_EVENTS.ERROR, {
	// 			data: {
	// 				message: `ActionManager >> Invalid actionId from action event: ${categoryId}/${actionId}`
	// 			}
	// 		});
	// 		return;
	// 	}

	// 	// Handle cooldown
	// 	if (!bypass_cooldown && actionData.cooldown > 0) {
	// 		const lastTriggered: number = actionData.lastTriggered ?? 0;
	// 		const now: number = Date.now();
	// 		const elapsed: number = now - lastTriggered;
	// 		const timeLeft: number = actionData.cooldown - elapsed;

	// 		if (elapsed < actionData.cooldown) {
	// 			this.emit(INTERNAL_EVENTS.NOTIF, {
	// 				data: {
	// 					message: `Action '${actionData.name}' cancelled by cooldown (${timeLeft}ms)`
	// 				}
	// 			});
	// 			return;
	// 		}
	// 	}

	// 	// Update last triggered for this action
	// 	actionMap.triggered(actionId);

	// 	switch (caller) {
	// 		case CALLERS.INTENAL:
	// 			this.emit(categoryId, { data: context });
	// 			break;
	// 		case CALLERS.TIKFINITY:
	// 			const coinInfo: string = context?.coins ? `for ${context.coins} coins` : '';

	// 			this.emit(INTERNAL_EVENTS.INFO, {
	// 				data: {
	// 					message: `Action '${actionData.name}' triggered by ${context?.username} ${coinInfo}`
	// 				}
	// 			});

	// 			// Handle different trigger apis
	// 			let payload: any = {};
	// 			if (Object.values(TITS_ACTIONS).includes(categoryId)) {
	// 				if (categoryId == TITS_ACTIONS.ACTIVATE_TRIGGER) {
	// 					payload = {
	// 						triggerId: actionId
	// 					};
	// 				} else if (categoryId == TITS_ACTIONS.THROW_ITEMS) {
	// 					payload = {
	// 						items: [actionId]
	// 					};
	// 				}
	// 			}
	// 			this.emit(categoryId, { data: payload });
	// 			break;
	// 		default:
	// 			this.emit(INTERNAL_EVENTS.ERROR, {
	// 				data: { message: `ActionManager >> Unhandled caller: ${caller}` }
	// 			});
	// 			return;
	// 	}
	// }
}
