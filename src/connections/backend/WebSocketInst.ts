import WebSocket, { RawData } from 'ws';
import { INTERNAL_EVENTS } from '../../events/EventsHandler.js';
import { STATUS, Server } from './Server.js';
import { sleep } from '../../utils/Random.js';

export abstract class WebSocketInst extends Server {
	private socket: WebSocket;
	private url: any;
	private attempts: number;
	private connected: boolean;

	constructor(service: string, url: string) {
		super(service);
		this.connected = false;
		this.url = url;
		this.service = service;
		this.attempts = 0;
	}

	abstract onReady(): void;

	send(payload: object, callback: (err?: Error) => void) {
		const data: string = JSON.stringify(payload);
		this.socket.send(data, callback);
	}

	addListener(event: string, handler: (data: any) => void) {
		this.socket.on(event, handler);
	}

	removeListener(event: string, handler: (data: any) => void) {
		this.socket.off(event, handler);
	}

	async status(): Promise<STATUS> {
		if (this.socket && this.socket.isPaused) {
			return STATUS.UNAVAILABLE;
		} else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			return STATUS.ONLINE;
		} else {
			return STATUS.OFFLINE;
		}
	}

	abstract onMessage(event: { rawData: RawData; isBinary: boolean }): void;

	async start() {
		if ((await this.status()) === STATUS.ONLINE) {
			this.emit(INTERNAL_EVENTS.WARN, {
				data: { message: `Service ${this.service} already started...` }
			});
			return;
		}

		this.socket = new WebSocket(this.url);

		this.socket.on('open', () => {
			this.emit(INTERNAL_EVENTS.GOOD, {
				data: { message: `Service ${this.service} is connected to ${this.url}` }
			});

			this.onReady();
			this.connected = true;

			this.socket.on('message', (rawData, isBinary) => {
				this.onMessage({ rawData, isBinary });
			});
		});

		this.socket.on('close', () => {
			if (!this.connected) {
				return;
			}

			this.emit(INTERNAL_EVENTS.WARN, {
				data: { message: `Service ${this.service} has disconnected from ${this.url}` }
			});

			this.socket = null;
			this.connected = false;
		});

		this.socket.onerror = async (error) => {
			if (error.message.match(/ECONNREFUSED/) && this.attempts < 3) {
				await sleep(1000);
				this.attempts++;

				this.start();
				return;
			}

			this.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: `Service ${this.service} encountered an error: ${error.message}` }
			});
		};
	}

	stop() {
		if (this.socket) {
			this.socket.close();
		}
	}
}
