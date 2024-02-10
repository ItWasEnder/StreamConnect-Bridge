import { Emitter } from './backend/Emitter.js';
import * as Text from '../utils/Text.js';

export const EMITTER = new Emitter();

export const INTERNAL_EVENTS = {
	CONNECTIONS_LOADED: 'connections-loaded',
	SHUTDOWN: 'exit',
	ERROR: 'error',
	WARN: 'warn',
	GOOD: 'good',
	INFO: 'info',
	NOTIF: 'notification',
	ACTION: 'action'
};

EMITTER.on(INTERNAL_EVENTS.ERROR, (error) => {
	const { message } = error.data;
	console.log(`\n${Text.coloredPill(Text.COLORS.RED)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.WARN, (warn) => {
	const { message } = warn.data;
	console.log(`\n${Text.coloredPill(Text.COLORS.YELLOW)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.GOOD, (good) => {
	const { message } = good.data;
	console.log(`\n${Text.coloredPill(Text.COLORS.GREEN)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.INFO, (info) => {
	const { message } = info.data;
	console.log(`\n${Text.coloredPill(Text.COLORS.BLUE)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.NOTIF, (info) => {
	const { message } = info.data;
	console.log(`\n${Text.coloredPill(Text.COLORS.MAGENTA)} ${message}`);
});
