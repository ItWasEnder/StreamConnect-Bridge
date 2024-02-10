import { randomUUID } from 'crypto';
import { TriggerRequest } from '../actions/ActionsManager.js';
import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
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
	negate: boolean;
	operation: OperationType;
	value: string;
}

export interface EventMapping {
	event: string;
	data_path: string;
	conditions: Condition[];
}

export class Trigger {
	id: string;
	name: string;
	events: EventMapping[];
	actions: TriggerRequest[];

	constructor(name: string, events: EventMapping[], actions: TriggerRequest[]) {
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
	 * @param trigger the trigger to remove
	 * @returns true if the trigger was removed, false otherwise
	 */
	removeTrigger(trigger: Trigger): boolean {
		return this.triggers.delete(trigger.id);
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
			}
		} catch (error) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `ActionManager >> Error occured trying to load cooldowns from file @@@ ${error}`
				}
			});
		}
	}
}
