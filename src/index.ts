import inquirer from 'inquirer';
import * as Text from './utils/Text';
import { ConnectionManager } from './connections/ConnectionManager';
import { EMITTER, INTERNAL_EVENTS, disableNewLine } from './events/EventsHandler';
import { ConnectionConfig } from './connections/backend/Connection';
import { STATUS, Service } from './connections/backend/Server';
import { sleep } from './utils/Random';
import chalk from 'chalk';
import { TriggerManager } from './triggers/TriggerManager';
import { FileManager } from './utils/FileManager';
import {
	FOLLOW_STATUS,
	TIKTOK_EVENTS,
	TikTokHandler,
	TiktokChat,
	TiktokEvent
} from './handlers/TikTokHandler';
import { ProviderManager } from './providers/ProviderManager';
import { TikfinityWebServerHandler } from './handlers/TikfinityHandler';
import { TITSWebSocketHandler } from './handlers/TITSHandler';
import { POGHandler } from './handlers/POGHandler';

// Load userData folder for file storage
const args = process.argv.slice(2); // Slice the first two elements
let rootDir: string = '';
let backend: boolean = false; // if cli should be enabled

for (let i = 0; i < args.length; i++) {
	if (args[i] === '--data') {
		rootDir = args[i + 1];
	} else if (args[i] === '--backend') {
		backend = true;
	}
}

const CMD_HIST: Map<string, string> = new Map();
const FILE_MANAGER: FileManager = new FileManager(rootDir);
const CONNECTION_MANAGER: ConnectionManager = new ConnectionManager(FILE_MANAGER);
const PROVIDER_MANAGER: ProviderManager = new ProviderManager(FILE_MANAGER);
const TRIGGER_MANAGER: TriggerManager = new TriggerManager(FILE_MANAGER);

let exit: boolean = false;
let shutdownAttempts: number = 0;

// Proccess hooks
process.on('unhandledRejection', (reason, promise) => {
	console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
	console.error('There was an uncaught error', err);
	process.exit(1); //mandatory (as per the Node.js docs)
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', () => {
	++shutdownAttempts;

	if (shutdownAttempts >= 2) {
		console.log(chalk['red'].underline('Proccess failed to shutdown peacefully.'));
		process.exit(0);
	} else {
		shutdown();
	}
});

// Run the program
// console.clear();
loadConfigs();

// Setup handlers
setupHandlers();

// Wait for inits
printMainMenu();
setupFileWatcher();

// CLI
if (!backend) {
	runInterface();
} else {
	disableNewLine();
}

// Function to run the program
function runInterface() {
	// Use inquirer for interactive inputs
	const questions = [
		{
			type: 'input',
			name: 'action',
			message: 'Command:'
		}
	];

	inquirer.prompt(questions).then((answers: any) => {
		handleCommand(answers.action.toLowerCase());
	});
}

async function handleCommand(action: string) {
	switch (action.toLowerCase()) {
		case 'h':
			printMainMenu();
			break;
		case 'q':
			await shutdown();
			break;
		case 'c':
			console.clear();
			break;
		case 'tc':
			const { chat } = await inquirer.prompt([
				{
					type: 'input',
					name: 'chat',
					message: 'Enter a chat-message:'
				}
			]);

			let _chat: string = chat as string;

			if (_chat === '`') {
				_chat = CMD_HIST.get('tc') || 'undefined';
			} else {
				CMD_HIST.set('tc', _chat);
			}

			console.log(`${Text.coloredPill(Text.COLORS.MAGENTA)} Sending TikTok chat message event...`);
			const event: TiktokEvent = {
				event: TIKTOK_EVENTS.CHAT,
				nickname: 'Test',
				username: 'test',
				userId: 'test123',
				followRole: FOLLOW_STATUS.FOLLOWER,
				isSubscriber: false,
				isModerator: false,
				timestamp: Date.now(),
				data: {
					comment: _chat
				} as TiktokChat
			};

			EMITTER.emit(TIKTOK_EVENTS.CHAT, {
				data: event
			});

			break;
		case 's':
			const mStack: string[] = [];
			mStack.push(`\n${Text.coloredPill(Text.COLORS.BLUE)} Current Module Status:`);

			const serverConfigs = CONNECTION_MANAGER.getConfigs();

			for (const config of serverConfigs) {
				const server: Service | null = CONNECTION_MANAGER.getInstance(config.id);
				let statusBubble: string;

				if (!server) {
					statusBubble = Text.coloredPill(Text.COLORS.RED);
				} else {
					const status: STATUS = await server.status();

					switch (status) {
						case STATUS.ONLINE:
							statusBubble = Text.coloredPill(Text.COLORS.GREEN);
							break;
						case STATUS.UNAVAILABLE:
							statusBubble = Text.coloredPill(Text.COLORS.YELLOW);
							break;
						case STATUS.OFFLINE:
							statusBubble = Text.coloredPill(Text.COLORS.RED);
							break;
					}
				}

				mStack.push(`  ${statusBubble} ${config.name}`);
			}

			console.log(mStack.join('\n') + '\n');
			break;
		case 'r':
			const choices: any[] = [{ name: 'Restart all services', value: 'all' }];

			CONNECTION_MANAGER.getConfigs().forEach((config) => {
				choices.push({ name: config.name, value: config.id });
			});

			const { service } = await inquirer.prompt([
				{
					type: 'list',
					name: 'service',
					message: 'Select a service to restart:',
					choices: choices
				}
			]);

			if (service === 'all') {
				console.log(`\n${Text.coloredPill(Text.COLORS.BLUE)} Restarting all services...`);
				CONNECTION_MANAGER.getInstances().forEach((instance) => {
					instance.start();
				});
			} else {
				console.log(
					`\n${Text.coloredPill(Text.COLORS.BLUE)} Attempting to restart ${service} service...`
				);
				const instance = CONNECTION_MANAGER.getInstance(service);
				if (instance) {
					instance.start();
				} else {
					console.log(
						`\n${Text.coloredPill(Text.COLORS.RED)} Service ${service} is not available...`
					);
				}
			}

			break;
		default:
			break;
	}

	if (!exit) {
		await sleep(500);
		runInterface();
	}
}

async function shutdown() {
	++shutdownAttempts;
	exit = true;

	EMITTER.emit(INTERNAL_EVENTS.SHUTDOWN);
	console.log(Text.coloredPill(Text.COLORS.RED) + ' Exiting the program. Goodbye!');

	await sleep(3000);
	process.exit(0);
}

function printMainMenu() {
	console.log(
		`${Text.coloredPill(Text.COLORS.BLUE)} Welcome to StreamConnect-Bridge! See commands below. (${process.pid})`
	);
	console.log(`-  Q exit the program.`);
	console.log(`-  H see a list of commands.`);
	console.log(`-  C clear the console.`);
	console.log(`-  S list current module status.`);
	console.log(`-  R attempt to reconnect modules.\n`);
}

function loadConfigs() {
	try {
		// Load connection configs
		CONNECTION_MANAGER.load();
		TRIGGER_MANAGER.load();
		EMITTER.emit(INTERNAL_EVENTS.GOOD, { data: { message: 'Configurations loaded...' } });
	} catch (error) {
		EMITTER.emit(INTERNAL_EVENTS.ERROR, {
			data: { message: 'Error occured trying to load connections...' }
		});
		console.error(error);
	}
}

function setupHandlers() {
	if (CONNECTION_MANAGER.getConfigs().length === 0) {
		EMITTER.emit(INTERNAL_EVENTS.WARN, {
			data: { message: 'No configurations found. Please create "storage/modules.json"' }
		});
	} else {
		try {
			setupTitsService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup TITS service...' }
			});
			console.error(error);
		}

		try {
			setupTikfinityService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup tikfinity service...' }
			});
			console.error(error);
		}

		try {
			setupTiktokService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup tiktok service...' }
			});
			console.error(error);
		}

		try {
			setupPOGService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup VTS-POG service...' }
			});
			console.error(error);
		}
	}
}

function setupTikfinityService() {
	const config: ConnectionConfig = CONNECTION_MANAGER.getConfig('tikfinity');
	if (config?.enabled) {
		const tikfinityHandler: TikfinityWebServerHandler = new TikfinityWebServerHandler(
			config,
			PROVIDER_MANAGER
		);

		CONNECTION_MANAGER.addInstance(config.id, tikfinityHandler);

		tikfinityHandler.start();
	}
}

function setupTiktokService() {
	const config: ConnectionConfig = CONNECTION_MANAGER.getConfig('tiktok');

	if (config?.enabled) {
		const tiktokHandler: TikTokHandler = new TikTokHandler(config);
		CONNECTION_MANAGER.addInstance(config.id, tiktokHandler);
		tiktokHandler.start();
	}
}

function setupPOGService() {
	const config: ConnectionConfig = CONNECTION_MANAGER.getConfig('vts-pog');
	if (config?.enabled) {
		const pogHandler: POGHandler = new POGHandler(config);
		CONNECTION_MANAGER.addInstance(config.id, pogHandler);
	}
}

function setupTitsService() {
	const config: ConnectionConfig = CONNECTION_MANAGER.getConfig('tits');
	if (config?.enabled) {
		const titsHandler: TITSWebSocketHandler = new TITSWebSocketHandler(config);

		// Register this service
		CONNECTION_MANAGER.addInstance(config.id, titsHandler);
		PROVIDER_MANAGER.registerProvider(titsHandler.provider);

		titsHandler.start();
	}
}

function setupFileWatcher() {
	FILE_MANAGER.onChange('storage/modules.json', (_p) => {
		// TODO: Handle reloading modules
	});

	FILE_MANAGER.onChange('storage/modules.json', (_p) => {
		// TODO: Handle reloading modules
	});
}
