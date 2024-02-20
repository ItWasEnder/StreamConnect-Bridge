import { EMITTER } from '../EventsHandler';
import { Payload } from './Emitter';

export abstract class Emitting {
	/**
	 * This is a wrapper for the global proccess emitter
	 * @param event the event to emit
	 * @param data the payload to emit
	 */
	protected emit(event: string, data: Payload): void {
		EMITTER.emit(event, data);
	}

	/**
	 * This is a wrapper for the global proccess emitter
	 * @param event the event to listen for
	 * @param handler the handler to execute
	 */
	protected on(event: string, handler: (data: any) => void) {
		EMITTER.on(event, handler);
	}
}
