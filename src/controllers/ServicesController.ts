import { Request, Response } from 'express';
import { TriggerManager } from '../triggers/TriggerManager';
import { randomUUID } from 'crypto';
import { Trigger } from '../triggers/backend/Trigger';
import { ConnectionManager } from '../connections/ConnectionManager';

export class ServicesController {
	constructor(private manager: ConnectionManager) {
		if (this.manager === undefined) {
			throw new Error('TriggerManager is undefined');
		}
	}

	async getServices(req: Request, res: Response): Promise<void> {
		try {
			const services = this.manager.getInstances();
			res.json(services);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async disableService(req: Request, res: Response): Promise<void> {
		try {
			const id = req.params.id;
			const service = this.manager.getInstance(id);

			if (service === undefined) {
				res.status(404).json({ error: 'Service not found' });
				return;
			}

			service.stop();
			service.config.enabled = false;

			res.json({ message: `Service disabled`, service: service.service });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async enableService(req: Request, res: Response): Promise<void> {
		try {
			const id = req.params.id;
			const service = this.manager.getInstance(id);

			if (service === undefined) {
				res.status(404).json({ error: 'Service not found' });
				return;
			}

			service.start();
			service.config.enabled = true;

			res.json({ message: `Service enabled`, service: service.service });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}
}
