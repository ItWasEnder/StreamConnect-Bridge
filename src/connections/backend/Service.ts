import { Emitting } from '../../events/backend/Emmiting';
import { ConnectionConfig } from './Connection';

export enum STATUS {
	ONLINE,
	OFFLINE,
	UNAVAILABLE
}

export abstract class Service extends Emitting {
	abstract get service(): string;
	abstract get config(): ConnectionConfig;

	abstract start(): void;
	abstract stop(): void;
	abstract status(): Promise<STATUS>;
}
