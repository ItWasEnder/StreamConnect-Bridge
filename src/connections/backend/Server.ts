import { Emitting } from '../../events/backend/Emmiting.js';

export enum STATUS {
	ONLINE,
	OFFLINE,
	UNAVAILABLE
}

export abstract class Server extends Emitting {
	public service: string;

	constructor(service: string) {
		super();
		this.service = service;
	}

	abstract start(): void;
	abstract stop(): void;
	abstract status(): Promise<STATUS>;
}
