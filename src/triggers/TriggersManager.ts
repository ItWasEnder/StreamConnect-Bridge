import { randomUUID } from 'crypto';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
import { JSONPath } from 'jsonpath-plus';
import { Payload } from '../events/backend/Emitter.js';
import * as fs from 'fs';
import * as path from 'path';

export enum OperationType {
	EQUALS = 'equals',
	CONTAINS = 'contains',
	GREATER_THAN = 'greater_than',
	LESS_THAN = 'less_than'
}

export interface Condition {
	order: number;
	data_path: string;
	negate: boolean;
	operation: OperationType;
	value: string | number;
}

export interface EventMapping {
	event: string;
	conditions: Condition[];
}

export interface EventRequest {
	caller: 'internal';
	event: string;
	payload: Record<string, any>;
}

export interface BaseEvent {
	event: string;
	username: string;
	timestamp: number;
}

export class Trigger {
	lastExecuted: number = 0;
	id: string;

	constructor(
		public name: string,
		public events: EventMapping[],
		public actions: EventRequest[],
		public cooldown: number = 0,
		public log: boolean = true,
		public enabled: boolean = true
	) {
		this.id = randomUUID();
	}

	static fromObject(object: any): Trigger {
		const { name, events, actions, cooldown = 0, log = true, enabled = true } = object;
		if (!name || !events || !actions) {
			throw new Error('Invalid trigger object. Missing required properties.');
		}
		return new Trigger(name, events, actions, cooldown, log, enabled);
	}
}

// TODO parse data_path w/ https://www.npmjs.com/package/jsonpath-plus
export class TriggersManager extends Emitting {
	private eventIndex: Map<string, Trigger[]> = new Map();
	private triggers: Map<string, Trigger> = new Map();
	private fileWatcherTimeout: NodeJS.Timeout | null = null;

	constructor() {
		super();
		const filePath = path.join(process.cwd(), 'storage', 'triggers.json');

		this.loadTriggers(filePath);
		this.watchTriggersFile(filePath);
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

	watchTriggersFile(filePath: string) {
		fs.watch(filePath, (eventType, filename) => {
			if (eventType === 'change') {
				// Clear the existing timeout
				if (this.fileWatcherTimeout) {
					clearTimeout(this.fileWatcherTimeout);
				}

				// Set a new timeout
				this.fileWatcherTimeout = setTimeout(() => {
					this.emit(INTERNAL_EVENTS.NOTIF, {
						data: {
							message: `File change detected! Reloading triggers from file >> '${filename}'`
						}
					});

					this.clearAll();
					this.loadTriggers(filePath);
				}, 100); // 100ms delay
			}
		});
	}

	loadTriggers(filePath: string) {
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
			const conditionsMet = triggerEvent.conditions.every((c) => {
				return this.evalCondition(eventData, c);
			});

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

	private evalCondition(data: any, con: Condition): boolean {
		const exact_data = JSONPath({
			path: `$.${con.data_path}`,
			json: data
		});

		if (!exact_data || exact_data.length === 0) {
			return false;
		}

		const dataValue = exact_data[0];

		let result = false;

		switch (con.operation) {
			case OperationType.EQUALS:
				result = dataValue === con.value;
				break;
			case OperationType.CONTAINS:
				if (typeof dataValue !== 'string') {
					throw new Error(
						`Cannot use operation 'contains' on data at path ${con.data_path}. Data is not a string.`
					);
				}

				const stringValue = con.value as string;
				result = result = dataValue.includes(stringValue);
				break;
			case OperationType.GREATER_THAN:
				if (typeof dataValue !== 'number') {
					throw new Error(
						`Cannot use operation 'greater_than' on data at path ${con.data_path}. Data is not a number.`
					);
				}

				const numericValue = con.value as number;
				result = dataValue > numericValue;
				break;
			case OperationType.LESS_THAN:
				if (typeof dataValue !== 'number') {
					throw new Error(
						`Cannot use operation 'less_than' on data at path ${con.data_path}. Data is not a number.`
					);
				}

				const numericValueLess = con.value as number;
				result = dataValue < numericValueLess;
				break;
			default:
				throw new Error(`Unknown operation type ${con.operation}`);
		}

		if (con.negate) {
			result = !result;
		}

		return result;
	}
}
