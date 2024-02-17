import { INTERNAL_EVENTS } from '../events/EventsHandler.js';
import { Emitting } from '../events/backend/Emmiting.js';
import { FileManager } from '../utils/FileManager.js';
import { ConnectionConfig } from './backend/Connection.js';
import { Service } from './backend/Server.js';
import * as fs from 'fs';
import * as path from 'path';

export class ConnectionManager extends Emitting {
	static MODULES_PATH: string = 'storage/modules.json';
	private configs: Map<string, ConnectionConfig>;
	private managedInstances: Map<string, Service>;

	constructor(private fileManager: FileManager) {
		super();
		this.configs = new Map();
		this.managedInstances = new Map();

		// Setup emitters
		this.on(INTERNAL_EVENTS.SHUTDOWN, () => {
			for (const instance of this.getInstances()) {
				instance.stop();
			}
		});

		// TODO: Create the modules file if it doesn't exist with standard data
		fileManager.createFileIfNotExists(ConnectionManager.MODULES_PATH, '[]');

		fileManager.onChange(ConnectionManager.MODULES_PATH, (_path) => {
			this.loadConfigs(_path);
		});
	}

	load(): void {
		this.loadConfigs(this.fileManager.getFullPath(ConnectionManager.MODULES_PATH));
	}

	loadConfigs(filePath: string): void {
		try {
			const rawData = fs.readFileSync(filePath, 'utf-8');
			const config = JSON.parse(rawData);

			// for each module in the file
			for (const module of config) {
				const newConnection = new ConnectionConfig(
					module.id,
					module.enabled,
					module.name,
					module.description,
					module.type,
					module.connection
				);

				if (this.configs.has(newConnection.id)) {
					const __stored = this.configs.get(newConnection.id);

					__stored.enabled = newConnection.enabled;
					__stored.name = newConnection.name;
					__stored.description = newConnection.description;
					__stored.type = newConnection.type;
					__stored.info = newConnection.info;
				} else {
					this.addConfig(newConnection.id, newConnection);
				}
			}
		} catch (error) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `ConnectionManager >> Error occured trying to load triggers from file @@@ ${error}`
				}
			});
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

	addInstance(key: string, instance: Service): void {
		if (this.managedInstances.has(key)) {
			throw new Error(`Instance with key ${key} already exists.`);
		}

		this.managedInstances.set(key, instance);
	}

	getInstance(key: string): Service | null {
		const instance = this.managedInstances.get(key);
		if (!instance) {
			return null;
		}
		return instance;
	}

	getInstances(): Service[] {
		return Array.from(this.managedInstances.values());
	}
}
