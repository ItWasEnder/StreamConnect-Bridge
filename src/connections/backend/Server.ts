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
	}

	abstract start(): void;
	abstract stop(): void;
	abstract status(): Promise<STATUS>;
}
