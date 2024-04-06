import { Request, Response } from 'express';
import { TriggerManager } from '../triggers/TriggerManager';
import { randomUUID } from 'crypto';
import { Trigger } from '../triggers/backend/Trigger';

export class TriggersController {
	constructor(private triggerManager: TriggerManager) {
		if (this.triggerManager === undefined) {
			throw new Error('TriggerManager is undefined');
		}
	}

	async getTriggers(req: Request, res: Response): Promise<void> {
		try {
			const triggers = this.triggerManager.getTriggers();
			res.json(triggers);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async addTrigger(req: Request, res: Response): Promise<void> {
		try {
			const triggerBody = req.body;
			triggerBody.id = randomUUID();
			this.triggerManager.addTrigger(Trigger.fromObject(triggerBody));
			res.json({ message: 'Trigger added' });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async updateTrigger(req: Request, res: Response): Promise<void> {
		try {
			console.log(req.body);

			res.json({ message: 'Trigger updated' });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async deleteTrigger(req: Request, res: Response): Promise<void> {
		try {
			const id = req.params.id;

			if (this.triggerManager.getTrigger(id) === undefined) {
				res.status(404).json({ error: 'Trigger not found' });
				return;
			}

			this.triggerManager.removeTrigger(id);
			res.json({ message: 'Trigger deleted' });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}
}
