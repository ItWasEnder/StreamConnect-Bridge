import { INTERNAL_EVENTS } from '../events/EventsHandler';
import { Emitting } from '../events/backend/Emmiting';
import { FileManager } from '../utils/FileManager';
import { Result } from '../utils/Result';
import { ConnectionConfig } from './backend/Connection';
import { Service } from './backend/Service';
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

		// TODO: Create the modules file if it doesn't exist with standard data
		fileManager.createFileIfNotExists(ConnectionManager.MODULES_PATH, '[]');

		fileManager.onChange(ConnectionManager.MODULES_PATH, (_path) => {
			this.loadConfigs(_path);
		});
	}

	load(): Result<void> {
		return this.loadConfigs(this.fileManager.getFullPath(ConnectionManager.MODULES_PATH));
	}

	loadConfigs(filePath: string): Result<void> {
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
					module.info
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

			return Result.pass(`ConnectionManager >> Loaded ${config.length} module infos from file.`);
		} catch (error) {
			return Result.fail(
				`ConnectionManager >> Error occured trying to load triggers from file @@@ ${error}`
			);
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

	close(): void {
		for (const instance of this.getInstances()) {
			instance.stop();
		}
	}
}
