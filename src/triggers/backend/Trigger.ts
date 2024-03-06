import { randomUUID } from 'crypto';
import { Condition } from './Condition';
import { InternalRequest } from '../../providers/backend/InternalRequest';

export class EventMapping {
	event: string;
	conditions: Condition[];
}

export class Trigger {
	lastExecuted: number = 0;

	constructor(
		public id: string = randomUUID(),
		public name: string,
		public events: EventMapping[],
		public actions: InternalRequest[],
		public cooldown: number = 0,
		public log: boolean = true,
		public enabled: boolean = true
	) {}

	static fromObject(object: any): Trigger {
		const { id, name, events, actions, cooldown = 0, log = true, enabled = true } = object;
		if (!id || !name || !events || !actions) {
			throw new Error('Invalid trigger object. Missing required properties.');
		}

		const __events: EventMapping[] = events.map((__event: any) => {
			const { event, conditions } = __event;
			if (!event || !conditions) {
				throw new Error('Invalid trigger object. Missing required properties.');
			}

			const mapping: EventMapping = {
				event: event,
				conditions: conditions.map((condition: any) => new Condition(condition)),
			};

			return mapping;
		});

		return new Trigger(id, name, __events, actions, cooldown, log, enabled);
	}
}
