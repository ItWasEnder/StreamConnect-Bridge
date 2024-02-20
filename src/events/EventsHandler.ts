import { Emitter } from './backend/Emitter';
import * as Text from '../utils/Text';

export const EMITTER = new Emitter();

let NEW_LINE = '\n';

export function disableNewLine() {
	NEW_LINE = '';
}

export const INTERNAL_EVENTS = {
	CONNECTIONS_LOADED: 'connections-loaded',
	SHUTDOWN: 'exit',
	ERROR: 'error',
	WARN: 'warn',
	GOOD: 'good',
	INFO: 'info',
	NOTIF: 'notification',
	EXECUTE_ACTION: 'execute-action'
};

EMITTER.on(INTERNAL_EVENTS.ERROR, (error) => {
	const { message } = error.data;
	console.log(`${NEW_LINE}${Text.coloredPill(Text.COLORS.RED)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.WARN, (warn) => {
	const { message } = warn.data;
	console.log(`${NEW_LINE}${Text.coloredPill(Text.COLORS.YELLOW)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.GOOD, (good) => {
	const { message } = good.data;
	console.log(`${NEW_LINE}${Text.coloredPill(Text.COLORS.GREEN)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.INFO, (info) => {
	const { message } = info.data;
	console.log(`${NEW_LINE}${Text.coloredPill(Text.COLORS.BLUE)} ${message}`);
});

EMITTER.on(INTERNAL_EVENTS.NOTIF, (info) => {
	const { message } = info.data;
	console.log(`${NEW_LINE}${Text.coloredPill(Text.COLORS.MAGENTA)} ${message}`);
});
