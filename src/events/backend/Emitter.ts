export interface Payload {
	data: any;
}

export type EventHandler = (payload: Payload) => void;

export class Emitter {
	private events: Record<string, EventHandler[]> = {};

	on(event: string, handler: EventHandler): void {
		if (!this.events[event]) {
			this.events[event] = [];
		}

		this.events[event].push(handler);
	}

	off(event: string, handler: EventHandler): void {
		const eventHandlers = this.events[event];

		if (eventHandlers) {
			const index = eventHandlers.indexOf(handler);

			if (index !== -1) {
				eventHandlers.splice(index, 1);
			}
		}
	}

	emit(event: string, payload?: Payload): void {
		const eventHandlers = this.events[event];

		if (eventHandlers) {
			for (const handler of eventHandlers) {
				handler(payload);
			}
		}
	}
}
