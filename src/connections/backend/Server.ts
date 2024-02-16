import { Emitting } from '../../events/backend/Emmiting.js';

export enum STATUS {
	ONLINE,
	OFFLINE,
	UNAVAILABLE
}

export abstract class Server extends Emitting {
	abstract get service(): string;

	abstract start(): void;
	abstract stop(): void;
	abstract status(): Promise<STATUS>;
}
