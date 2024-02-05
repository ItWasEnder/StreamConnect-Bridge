import { ConnectionConfig } from './Connection.js';
import * as fs from 'fs';
import * as path from 'path';
import { Server } from './Server.js';

export class ConnectionManager {
	private configs: Map<string, ConnectionConfig>;
	private managedInstances: Map<string, Server>;

	constructor() {
		this.configs = new Map();
		this.managedInstances = new Map();
	}

	loadConfigs(): void {
		const filePath = path.join(process.cwd(), 'storage/connections');

		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		// for each file in the directory
		const files = fs.readdirSync(filePath);

		for (const file of files) {
			try {
				const fileData = fs.readFileSync(path.join(filePath, file), 'utf-8');
				const connection = ConnectionConfig.fromJson(fileData);
				this.addConfig(connection.id, connection);
			} catch (error) {
				console.error(error);
			}
		}
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

	getInstance(key: string): Server|null {
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
