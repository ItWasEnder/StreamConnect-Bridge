import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { STATUS, Service } from './Service';
import { INTERNAL_EVENTS } from '../../events/EventsHandler';
import bodyParser from 'body-parser';
import http from 'http';

export abstract class WebServerInst extends Service {
	private app: Express;
	private server: http.Server;

	constructor() {
		super();
		this.app = express();
		this.app.use(bodyParser.json());
		this.app.use(cors());

		this.register('GET', '/health', (req, res) => {
			res.send('OK');
		});
	}

	abstract setupRoutes(): void;

	abstract get port(): number;

	async status(): Promise<STATUS> {
		const url = `http://localhost:${this.port}/health`;

		try {
			const response = await fetch(url);

			if (response.status === 200) {
				return STATUS.ONLINE;
			} else if (response.status === 500) {
				return STATUS.UNAVAILABLE;
			} else {
				return STATUS.OFFLINE;
			}
		} catch (error) {
			return STATUS.OFFLINE;
		}
	}

	register(method: string, path: string, handler: (req: Request, res: Response) => void) {
		switch (method) {
			case 'GET':
				this.app.get(path, handler);
				break;
			case 'POST':
				this.app.post(path, handler);
				break;
			case 'PUT':
				this.app.put(path, handler);
				break;
			case 'DELETE':
				this.app.delete(path, handler);
				break;
			case 'PATCH':
				this.app.patch(path, handler);
				break;
			default:
				console.error(`Unsupported method: ${method}`);
		}
	}

	async start() {
		if ((await this.status()) === STATUS.ONLINE) {
			this.emit(INTERNAL_EVENTS.WARN, {
				data: { message: `Service ${this.service} already started...` }
			});
			return;
		}

		this.server = this.app.listen(this.port, () => {
			this.emit(INTERNAL_EVENTS.GOOD, {
				data: { message: `Service ${this.service} is hosted on http://localhost:${this.port}` }
			});
		});
	}

	stop() {
		if (this.server) {
			this.server.close();
		}
	}
}
