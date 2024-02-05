import { EMITTER, INTERNAL_EVENTS } from '../../events/EventsHandler.js';

export enum STATUS {
	ONLINE,
	OFFLINE,
	UNAVAILABLE
}

export abstract class Server {
	public service: string;

	constructor(service: string) {
		this.service = service;
		
		// Setup emitters
		EMITTER.on(INTERNAL_EVENTS.SHUTDOWN, () => {
			this.stop();
		});
	}

	abstract start(): void;
	abstract stop(): void;
	abstract status(): Promise<STATUS>;
}
