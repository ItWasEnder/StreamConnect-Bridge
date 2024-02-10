import { EMITTER } from '../EventsHandler.js';
import { Payload } from './Emitter.js';

export abstract class Emitting {
	/**
	 * This is a wrapper for the global proccess emitter
	 * @param event the event to emit
	 * @param data the payload to emit
	 */
	emit(event: string, data: Payload): void {
		EMITTER.emit(event, data);
	}

	/**
	 * This is a wrapper for the global proccess emitter
	 * @param event the event to listen for
	 * @param handler the handler to execute
	 */
	on(event: string, handler: (data: any) => void) {
		EMITTER.on(event, handler);
	}
}
