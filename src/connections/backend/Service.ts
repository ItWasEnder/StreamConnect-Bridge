import { Emitting } from '../../events/backend/Emmiting';

export enum STATUS {
	ONLINE,
	OFFLINE,
	UNAVAILABLE
}

export abstract class Service extends Emitting {
	abstract get service(): string;

	abstract start(): void;
	abstract stop(): void;
	abstract status(): Promise<STATUS>;
}
