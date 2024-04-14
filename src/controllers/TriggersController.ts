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
			this.triggerManager.addTrigger(Trigger.fromObject(triggerBody));
			res.json({ message: 'Trigger added' });
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	}

	async updateTrigger(req: Request, res: Response): Promise<void> {
		try {
			console.log(req.body);
			const updated = Trigger.fromObject(req.body);
			const trigger = this.triggerManager.getTrigger(updated.id);

			if (trigger === undefined) {
				res.status(404).json({ error: 'Trigger not found' });
				return;
			}

			this.triggerManager.unregisterEvents(trigger);

			trigger.name = updated.name;
			trigger.enabled = updated.enabled;
			trigger.log = updated.log;
			trigger.cooldown = updated.cooldown;
			trigger.events = updated.events;
			trigger.actions = updated.actions;

			this.triggerManager.registerEvents(updated);

			res.json({ message: 'Trigger updated', data: trigger });
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
