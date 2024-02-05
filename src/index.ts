import inquirer from 'inquirer';
import * as commander from 'commander';
import * as Text from './utils/Text.js';
import { ConnectionManager } from './connections/backend/ConnectionManager.js';
import { Action, ActionsManager } from './actions/ActionsManager.js';
import { EMITTER, INTERNAL_EVENTS } from './events/EventsHandler.js';
import { ConnectionConfig } from './connections/backend/Connection.js';
import { STATUS, Server } from './connections/backend/Server.js';
import { sleep } from './utils/Random.js';
const { program } = commander;
import {
	TITSWebSocketHandler,
	RESPONSE_TYPES,
	TITSMessage,
	TITS_ACTIONS
} from './connections/TITSHandler.js';
import { TikfinityWebServerHandler } from './connections/TikfinityHandler.js';

const cm: ConnectionManager = new ConnectionManager();
const am: ActionsManager = new ActionsManager();
let exit: boolean = false;

// Set up commander
program.version('1.0.0').description('A simple CLI application.');

// Proccess hooks
process.on('unhandledRejection', (reason, promise) => {
	console.log('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
	console.error('There was an uncaught error', err);
	process.exit(1); //mandatory (as per the Node.js docs)
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Run the program
console.clear();

loadConfigs();
setupHandlers();

// Wait for inits
printMainMenu();

runInterface();

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
		case 't':
			const { uuid } = await inquirer.prompt([
				{
					type: 'input',
					name: 'uuid',
					message: 'Enter a UUID:'
				}
			]);

			EMITTER.emit(TITS_ACTIONS.ACTIVATE_TRIGGER, {
				data: { triggerId: uuid }
			});

			break;
		case 's':
			const mStack: string[] = [];
			mStack.push(`\n${Text.coloredPill(Text.COLORS.BLUE)} Current Module Status:`);

			const serverConfigs = cm.getConfigs();

			for (const config of serverConfigs) {
				const server: Server | null = cm.getInstance(config.id);
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

			cm.getConfigs().forEach((config) => {
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
				cm.getInstances().forEach((instance) => {
					instance.start();
				});
			} else {
				console.log(
					`\n${Text.coloredPill(Text.COLORS.BLUE)} Attempting to restart ${service} service...`
				);
				const instance = cm.getInstance(service);
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
	exit = true;

	EMITTER.emit(INTERNAL_EVENTS.SHUTDOWN);

	await sleep(1000);
	console.log(Text.coloredPill(Text.COLORS.RED) + ' Exiting the program. Goodbye!');
}

function printMainMenu() {
	console.log(
		`${Text.coloredPill(Text.COLORS.BLUE)} Welcome to StreamConnect-Bridge! See command below.`
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
		cm.loadConfigs();
		EMITTER.emit(INTERNAL_EVENTS.GOOD, { data: { message: 'Configurations loaded...' } });
	} catch (error) {
		EMITTER.emit(INTERNAL_EVENTS.ERROR, {
			data: { message: 'Error occured trying to load connections...' }
		});
		console.error(error);
	}
}

function setupHandlers() {
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
}

function setupTikfinityService() {
	const config: ConnectionConfig = cm.getConfig('tikfinity');
	if (config) {
		const tikfinityHandler: TikfinityWebServerHandler = new TikfinityWebServerHandler(config);
		cm.addInstance(config.id, tikfinityHandler);

		tikfinityHandler.setActionManager(am);
		tikfinityHandler.start();
	}
}

function setupTitsService() {
	const config: ConnectionConfig = cm.getConfig('tits');
	if (config) {
		const titsHandler: TITSWebSocketHandler = new TITSWebSocketHandler(config);
		cm.addInstance(config.id, titsHandler);

		titsHandler.setCallback(RESPONSE_TYPES.TRIGGER_LIST, (message: TITSMessage) => {
			const data = message.data;
			am.consumeActions(TITS_ACTIONS.ACTIVATE_TRIGGER, () => {
				const actions: Action[] = [];
				// Construct actions
				for (const trigger of data.triggers) {
					const id = trigger['ID'];
					const name = trigger['name'];

					actions.push({
						actionId: id,
						actionName: name
					});
				}

				return actions;
			});
		});

		titsHandler.setCallback(RESPONSE_TYPES.ITEM_LIST, (message: TITSMessage) => {
			const data = message.data;
			am.consumeActions(TITS_ACTIONS.THROW_ITEMS, () => {
				const actions: Action[] = [];
				// Construct actions
				for (const item of data.items) {
					const id = item['ID'];
					const name = item['name'];

					actions.push({
						actionId: id,
						actionName: name
					});
				}

				return actions;
			});
		});

		titsHandler.start();
	}
}
