import { randomUUID } from 'crypto';
import { Condition } from './Condition.js';

export interface EventRequest {
	caller: 'internal';
	event: string;
	payload: Record<string, any>;
}

export class EventMapping {
	event: string;
	conditions: Condition[];
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

		const _events: EventMapping[] = events.map((event: any) => {
			const { event: _event, conditions } = event;
			if (!_event || !conditions) {
				throw new Error('Invalid trigger object. Missing required properties.');
			}

			return {
				event: _event,
				conditions: conditions.map((condition: any) => new Condition(condition))
			};
		});

		return new Trigger(name, _events, actions, cooldown, log, enabled);
	}
}
