import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
import { JSONPath } from 'jsonpath-plus';
import { Payload } from '../events/backend/Emitter.js';
import { FileManager } from '../utils/FileManager.js';
import { EventMapping, Trigger } from './backend/Trigger.js';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Condition } from './backend/Condition.js';
import { InternalRequest } from '../providers/backend/InternalRequest.js';

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
			const __results = JSONPath({
				path: `$.[?(@.event=="${eventName}")]`,
				json: trigger.events
			});

			// Failed to find matching event in trigger @@@ technically an error but doesn't matter
			if (!__results || __results.length === 0) {
				console.log(`Failed to find matching event in trigger ${trigger.name}`);
				return;
			}

			const triggerEvent: EventMapping = __results[0];
			const conditionsMet = triggerEvent.conditions.every((_con: Condition) =>
				_con.evaluate(eventData)
			);

			// check if the trigger is on cooldown
			if (trigger.cooldown > 0 && Date.now() - trigger.lastExecuted < trigger.cooldown) {
				continue;
			}

			// If the conditions are met, emit the actions
			if (conditionsMet) {
				for (const __request of trigger.actions) {
					const __baseEvent: BaseEvent = eventData;
					const request: InternalRequest = JSON.parse(JSON.stringify(__request));
					const nickname: string | undefined = eventData?.nickname;

					trigger.lastExecuted = Date.now();

					// Emit the action request
					if (trigger.log) {
						this.emit(INTERNAL_EVENTS.INFO, {
							data: {
								message: `Trigger '${trigger.name}' executed by @${__baseEvent.username}${nickname ? `(${nickname})` : ''} from '${__baseEvent.event}' event`
							}
						});
					}

					// submit event to the backend
					request.requestId = crypto.randomUUID();
					this.injectData(request, eventData);

					this.emit(INTERNAL_EVENTS.EXECUTE_ACTION, { data: request });
				}
			}
		}
	}

	private injectData(request: InternalRequest, data: any) {
		for (const key in request.context) {
			const value = request.context[key];

			if (typeof value === 'string' && value.startsWith('$$')) {
				const path = value.substring(2);
				const result = JSONPath({ path, json: data });

				if (result.length === 1) {
					request.context[key] = result[0];
				}
			}
		}
	}
}
