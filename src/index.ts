import inquirer from 'inquirer';
import * as Text from './utils/Text';
import { ConnectionManager } from './connections/ConnectionManager';
import { EMITTER, INTERNAL_EVENTS, disableNewLine } from './events/EventsHandler';
import { ConnectionConfig } from './connections/backend/Connection';
import { STATUS, Service } from './connections/backend/Service';
import { sleep } from './utils/Random';
import chalk from 'chalk';
import { TriggerManager } from './triggers/TriggerManager';
import { FileManager } from './utils/FileManager';
import {
	FOLLOW_STATUS,
	TIKTOK_EVENTS,
	TikTokHandler,
	TiktokChat,
	TiktokEvent,
} from './handlers/TikTokHandler';
import { ProviderManager } from './providers/ProviderManager';
import { TikfinityWebServerHandler } from './handlers/TikfinityHandler';
import { TITSWebSocketHandler } from './handlers/TITSHandler';
import { POGHandler } from './handlers/POGHandler';
import { Result } from './utils/Result';
import { InternalAPIHandler as InternalAPIHandler } from './handlers/InternalAPIHandler';
import { Platform } from './moderation/UserManager';

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

	if (shutdownAttempts > 1) {
		console.log(chalk[Text.COLORS.RED].underline('Proccess failed to shutdown peacefully.'));
		process.exit(0);
	} else {
		shutdown();
	}
});

// Run the program
loadConfigs();

const INTERNAL_API: InternalAPIHandler = new InternalAPIHandler(
	CONNECTION_MANAGER.getConfig('internal-api'),
	CONNECTION_MANAGER,
	TRIGGER_MANAGER,
	PROVIDER_MANAGER
);

// Setup handlers
setupHandlers();

// Wait for inits
printMainMenu();

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
			message: 'Command:',
		},
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
			shutdown();
			break;
		case 'c':
			console.clear();
			break;
		case 'mt':
			await modifyTriggerFlow();
			break;
		case 'tc':
			const { chat } = await inquirer.prompt([
				{
					type: 'input',
					name: 'chat',
					message: 'Enter a chat-message:',
				},
			]);

			let _chat: string = chat as string;

			if (_chat === '`') {
				_chat = CMD_HIST.get('tc') || 'undefined';
			} else {
				CMD_HIST.set('tc', _chat);
			}

			console.log(`${Text.coloredPill(Text.COLORS.MAGENTA)} Sending TikTok chat message event...`);
			const event: TiktokEvent = {
				platform: Platform.TIKTOK,
				event: TIKTOK_EVENTS.CHAT,
				nickname: 'Test',
				username: 'test',
				userId: 'test123',
				followRole: FOLLOW_STATUS.FOLLOWER,
				isSubscriber: true,
				isModerator: true,
				timestamp: Date.now(),
				data: {
					comment: _chat,
				} as TiktokChat,
			};

			EMITTER.emit(TIKTOK_EVENTS.CHAT, {
				data: event,
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
			var choices: any[] = [{ name: 'Restart all services', value: 'all' }];

			CONNECTION_MANAGER.getConfigs().forEach((config) => {
				choices.push({ name: config.name, value: config.id });
			});

			var { service } = await inquirer.prompt([
				{
					type: 'list',
					name: 'service',
					message: 'Select a service to restart:',
					choices: choices,
				},
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

function printMainMenu() {
	console.log(
		`${Text.coloredPill(Text.COLORS.BLUE)} Welcome to StreamConnect-Bridge v1.1.0! See commands below. (${process.pid})`
	);
	console.log(`-  Q exit the program.`);
	console.log(`-  H see a list of commands.`);
	console.log(`-  C clear the console.`);
	console.log(`-  S list current module status.`);
	console.log(`-  R attempt to reconnect modules.\n`);
}

function loadConfigs() {
	printResult(CONNECTION_MANAGER.load());
	printResult(TRIGGER_MANAGER.load());
}

function setupHandlers() {
	INTERNAL_API.start();

	if (CONNECTION_MANAGER.getConfigs().length === 0) {
		EMITTER.emit(INTERNAL_EVENTS.WARN, {
			data: { message: 'No configurations found. Please create "storage/modules.json"' },
		});
	} else {
		try {
			setupTitsService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup TITS service...' },
			});
			console.error(error);
		}

		try {
			setupTikfinityService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup tikfinity service...' },
			});
			console.error(error);
		}

		try {
			setupTiktokService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup tiktok service...' },
			});
			console.error(error);
		}

		try {
			setupPOGService();
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: 'Error occured trying to setup VTS-POG service...' },
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
		const result = PROVIDER_MANAGER.registerProvider(titsHandler.provider);

		if (!result.isSuccess) {
			printResult(result);
		}

		titsHandler.start();
	}
}

function printResult<T>(result: Result<T>) {
	if (result.isSuccess) {
		EMITTER.emit(INTERNAL_EVENTS.GOOD, {
			data: { message: result.message },
		});
	} else {
		EMITTER.emit(INTERNAL_EVENTS.ERROR, {
			data: { message: result.message },
		});
	}
}

function shutdown() {
	++shutdownAttempts;
	exit = true;

	TRIGGER_MANAGER.save();

	CONNECTION_MANAGER.close();
	FILE_MANAGER.close();
	INTERNAL_API.stop();

	console.log(Text.coloredPill(Text.COLORS.RED) + ' Exiting the program. Goodbye!');
	// process.exit(0);
}
async function modifyTriggerFlow() {
	let loop = true;

	const editOptions: any[] = [
		{ name: 'Enable', value: 'enable' },
		{ name: 'Disable', value: 'disable' },
		{ name: 'Remove', value: 'remove' },
		{ name: 'Cooldown', value: 'cooldown' },
		{ name: 'Back', value: 'back' },
	];

	do {
		let choices: any[] = [{ name: '[[ Exit ]]', value: 'exit' }];

		TRIGGER_MANAGER.getTriggers().forEach((trigger) => {
			choices.push({
				name: `${trigger.name} <${trigger.enabled ? chalk.green('Enabled') : chalk.red('Disabled')}>`,
				value: trigger.id,
			});
		});

		const { trigger } = await inquirer.prompt([
			{
				type: 'list',
				name: 'trigger',
				message: 'Select a trigger to modify:',
				choices: choices,
			},
		]);

		if (trigger === 'exit') {
			loop = false;
			break;
		}

		let { action } = await inquirer.prompt([
			{
				type: 'list',
				name: 'action',
				message: 'Select an action:',
				choices: editOptions,
			},
		]);

		console.log('Selected:', action);

		if (action === 'back') {
			return;
		} else {
			const _trigger = TRIGGER_MANAGER.getTrigger(trigger);
			if (_trigger) {
				switch (action) {
					case 'enable':
						_trigger.enabled = true;
						console.log(chalk.green('>> Enabled trigger:'), _trigger.name);
						break;
					case 'disable':
						_trigger.enabled = false;
						console.log(chalk.red('>> Disabled trigger:'), _trigger.name);
						break;
					case 'remove':
						TRIGGER_MANAGER.removeTrigger(_trigger.id);
						break;
					case 'cooldown':
						console.log('>> Current cooldown:', _trigger.cooldown / 1000, 'seconds');
						let { cooldown } = await inquirer.prompt([
							{
								type: 'input',
								name: 'cooldown',
								message: 'Enter a new cooldown time (in ms):',
							},
						]);

						_trigger.cooldown = parseInt(cooldown);

						console.log('>> Updated cooldown:', _trigger.cooldown / 1000, 'seconds');
						break;
					default:
						console.log('>> Invalid action:', action);
				}
			} else {
				console.log('>> Trigger not found:', trigger);
			}
		}
	} while (loop);
}
