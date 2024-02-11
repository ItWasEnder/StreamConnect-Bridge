import { randomUUID } from 'crypto';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
import { JSONPath } from 'jsonpath-plus';
import * as fs from 'fs';
import * as path from 'path';
import { Payload } from '../events/backend/Emitter.js';

export enum OperationType {
	EQUALS = 'equals',
	CONTAINS = 'contains',
	GREATER_THAN = 'greater_than',
	LESS_THAN = 'less_than'
}

export interface Condition {
	order: number;
	negate: boolean;
	operation: OperationType;
	value: string | number;
}

export interface EventMapping {
	event: string;
	data_path: string;
	conditions: Condition[];
}

export interface EventRequest {
	caller: 'internal';
	event: string;
	payload: Record<string, any>;
}

export class Trigger {
	id: string;
	name: string;
	cooldown: number;
	events: EventMapping[];
	actions: EventRequest[];

	constructor(name: string, events: EventMapping[], actions: EventRequest[]) {
		this.id = randomUUID();
		this.name = name;
		this.events = events;
		this.actions = actions;
	}

	static fromObject(object: any): Trigger {
		const { name, events, actions } = object;
		if (!name || !events || !actions) {
			throw new Error('Invalid trigger object. Missing required properties.');
		}
		return new Trigger(name, events, actions);
	}
}

// TODO parse data_path w/ https://www.npmjs.com/package/jsonpath-plus
export class TriggersManager extends Emitting {
	private eventIndex: Map<string, Trigger[]> = new Map();
	private triggers: Map<string, Trigger> = new Map();

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

	loadTriggers() {
		try {
			const filePath = path.join(process.cwd(), 'storage', 'triggers.json');
			const rawData = fs.readFileSync(filePath, 'utf-8');
			const triggers = JSON.parse(rawData);

			for (const _trigger of triggers) {
				const trigger: Trigger = Trigger.fromObject(_trigger);
				this.addTrigger(trigger);

				// Add the trigger to the event index
				for (const event of trigger.events) {
					console.log(`Adding trigger for event ${event.event}`);

					this.getEventTriggers(event.event).push(trigger);
				}
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
			const conditionsMet = triggerEvent.conditions.every((condition) => {
				return this.evalCondition(triggerEvent.data_path, eventData, condition);
			});

			// If the conditions are met, emit the actions
			if (conditionsMet) {
				for (const request of trigger.actions) {
					// Emit the action request
					this.emit(request.event, { data: request.payload });
				}
			}
		}
	}

	private evalCondition(data_path: string, data: any, condition: Condition): boolean {
		const exact_data = JSONPath({
			path: `$.${data_path}`,
			json: data
		});

		if (!exact_data || exact_data.length === 0) {
			return false;
		}

		const dataValue = exact_data[0];

		let result = false;

		switch (condition.operation) {
			case OperationType.EQUALS:
				result = dataValue === condition.value;
				break;
			case OperationType.CONTAINS:
				if (typeof dataValue !== 'string') {
					throw new Error(
						`Cannot use operation 'contains' on data at path ${data_path}. Data is not a string.`
					);
				}

				const stringValue = condition.value as string;
				result = result = dataValue.includes(stringValue);
				break;
			case OperationType.GREATER_THAN:
				if (typeof dataValue !== 'number') {
					throw new Error(
						`Cannot use operation 'greater_than' on data at path ${data_path}. Data is not a number.`
					);
				}

				const numericValue = condition.value as number;
				result = dataValue > numericValue;
				break;
			case OperationType.LESS_THAN:
				if (typeof dataValue !== 'number') {
					throw new Error(
						`Cannot use operation 'less_than' on data at path ${data_path}. Data is not a number.`
					);
				}

				const numericValueLess = condition.value as number;
				result = dataValue < numericValueLess;
				break;
			default:
				throw new Error(`Unknown operation type ${condition.operation}`);
		}

		if (condition.negate) {
			result = !result;
		}

		return result;
	}
}
