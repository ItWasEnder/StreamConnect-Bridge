import { EMITTER, INTERNAL_EVENTS } from '../events/EventsHandler';
import { InternalRequest, RequestExecutor } from '../providers/backend/InternalRequest';
import { ConnectionConfig, WebHookInfo } from '../connections/backend/Connection';
import { STATUS, Service } from '../connections/backend/Service';
import http from 'http';
import { Result } from '../utils/Result';

export class POGHandler extends Service implements RequestExecutor {
	private host: string;
	private port: number;

	constructor(public config: ConnectionConfig) {
		super();
		this.config = config;

		const { host, port } = config.info as WebHookInfo;
		this.host = host;
		this.port = port;

		this.on(INTERNAL_EVENTS.EXECUTE_ACTION, async (payload) => {
			const __request: InternalRequest = payload.data;
			const __info = `(requestId: ${__request.requestId}, caller: ${__request.caller})`;

			if (__request.providerId !== this.config.id) {
				return;
			}

			if ((await this.status()) !== STATUS.ONLINE) {
				EMITTER.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `POGHandler >> Action cancelled, connection is not currently available ${__info}`,
					},
				});
				return;
			}

			this.executeRequest(__request);
		});
	}

	executeRequest(request: InternalRequest): Promise<Result<string>> {
		const { context } = request;
		const __info = `(requestId: ${request.requestId}, caller: ${request.caller})`;

		const { username, voice = 'brian', service = 'monster', limit = '350', message = '' } = context;
		const __message: string = message.replace(/^!\w+\s/, '');

		this.sendTTSRequest(__message, username, voice, service, limit)
			.then((_) => {
				EMITTER.emit(INTERNAL_EVENTS.INFO, {
					data: { message: `Action 'TTS' executed by '${username}' with message '${__message}'` },
				});
			})
			.catch((error) => {
				EMITTER.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `POGHandler >> Error occurred trying to execute TTS action by '${username}' ${__info}`,
					},
				});
				console.error(error);
			});

		return Promise.resolve(
			Result.pass(`Action 'TTS' executed by '${username}' with message '${__message}'`)
		);
	}

	get service(): string {
		return this.config.name;
	}

	async sendTTSRequest(
		message: string,
		username: string,
		voice: string = 'brian',
		service: string = 'monster',
		limit: number = 350
	): Promise<any> {
		const url = `http://${this.host}:${this.port}/pog?text=${message}&user=${username}&tts=${service}&limit=${limit}&tts=${voice}`;

		try {
			const data = await this.sendHttpRequest(url);
			return data;
		} catch (error) {
			throw error;
		}
	}

	start(): void {}
	stop(): void {}

	async status(): Promise<STATUS> {
		if (!this.config.enabled) {
			console.log('POGHandler: status: OFFLINE');
			return STATUS.OFFLINE;
		}

		const url = `http://localhost:3800/status`;

		try {
			const data = await this.sendHttpRequest(url);
			return data === '1' ? STATUS.ONLINE : STATUS.UNAVAILABLE;
		} catch (error) {
			return STATUS.OFFLINE;
		}
	}

	private sendHttpRequest(url: string): Promise<string> {
		return new Promise((resolve, reject) => {
			http
				.get(url, (res) => {
					let data = '';

					res.on('data', (chunk) => {
						data += chunk;
					});

					res.on('end', () => {
						resolve(data);
					});
				})
				.on('error', (error) => {
					reject(error);
				});
		});
	}
}
