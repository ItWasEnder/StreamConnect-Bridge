import { INTERNAL_EVENTS } from '../../events/EventsHandler.js';
import { Emitting } from '../../events/backend/Emmiting.js';
import { ConnectionConfig } from './Connection.js';
import { Server } from './Server.js';
import * as fs from 'fs';
import * as path from 'path';

export class ConnectionManager extends Emitting {
	private configs: Map<string, ConnectionConfig>;
	private managedInstances: Map<string, Server>;

	constructor() {
		super();
		this.configs = new Map();
		this.managedInstances = new Map();

		// Setup emitters
		this.on(INTERNAL_EVENTS.SHUTDOWN, () => {
			for (const instance of this.getInstances()) {
				instance.stop();
			}
		});
	}

	loadConfigs(): void {
		// try {
		const filePath = path.join(process.cwd(), 'storage', 'modules.json');
		const rawData = fs.readFileSync(filePath, 'utf-8');
		const config = JSON.parse(rawData);

		// for each module in the file
		for (const module of config) {
			const connection = new ConnectionConfig(
				module.id,
				module.enabled,
				module.name,
				module.description,
				module.type,
				module.connection
			);
			this.addConfig(connection.id, connection);
		}
		// } catch (error) {
		// 	throw error;
		// }
	}

	addConfig(key: string, config: ConnectionConfig): void {
		if (this.configs.has(key)) {
			throw new Error(`Connection with key ${key} already exists.`);
		}
		this.configs.set(key, config);
	}

	getConfig(key: string): ConnectionConfig {
		const connection = this.configs.get(key);
		if (!connection) {
			throw new Error(`No connection with key ${key} found.`);
		}
		return connection;
	}

	removeConfig(key: string): void {
		if (!this.configs.has(key)) {
			throw new Error(`No connection with key ${key} found.`);
		}
		this.configs.delete(key);
	}

	getConfigs(): ConnectionConfig[] {
		return Array.from(this.configs.values());
	}

	addInstance(key: string, instance: Server): void {
		if (this.managedInstances.has(key)) {
			throw new Error(`Instance with key ${key} already exists.`);
		}

		this.managedInstances.set(key, instance);
	}

	getInstance(key: string): Server | null {
		const instance = this.managedInstances.get(key);
		if (!instance) {
			return null;
		}
		return instance;
	}

	getInstances(): Server[] {
		return Array.from(this.managedInstances.values());
	}
}
