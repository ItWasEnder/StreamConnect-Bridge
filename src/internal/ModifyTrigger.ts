import { ne } from '@faker-js/faker';
import { ContextLike } from '../providers/backend/InternalRequest';
import { TriggerManager } from '../triggers/TriggerManager';
import { Trigger } from '../triggers/backend/Trigger';
import { Result } from '../utils/Result';
import { InternalAction } from './backend/InternalAction';

interface TriggerContext {
	triggerId: string;
	action: TriggerActions;
	data?: string;
}

export enum TriggerActions {
	TOGGLE = 'toggle',
	COOLDOWN = 'cooldown',
	REPALCE = 'replace',
}

export class ModifyTrigger extends InternalAction {
	constructor(private triggersManager: TriggerManager) {
		super('ModifyTrigger');
	}

	execute(context: ContextLike): Result<string> {
		const triggerContext = context as TriggerContext;

		switch (triggerContext.action) {
			case TriggerActions.TOGGLE:
				this.toggleTrigger(triggerContext.triggerId);
				break;
			case TriggerActions.COOLDOWN:
				this.changeCooldown(triggerContext.triggerId, parseFloat(triggerContext.data));
				break;
			case TriggerActions.REPALCE:
				this.replaceTrigger(triggerContext.triggerId, Trigger.fromObject(triggerContext.data));
				break;
			default:
				return Result.fail('Invalid action');
		}

		return Result.pass('Success');
	}

	changeCooldown(triggerId: string, newCooldown: number) {
		const trigger: Trigger = this.triggersManager.getTrigger(triggerId);

		// If in seconds, convert to milliseconds
		if (newCooldown < 1000) {
			newCooldown *= 1000;
		}

		const limitedCooldown = Math.max(0, newCooldown);

		if (trigger === undefined) {
			throw new Error('Trigger not found');
		}

		trigger.cooldown = limitedCooldown;
	}

	toggleTrigger(triggerId: string) {
		const trigger: Trigger = this.triggersManager.getTrigger(triggerId);

		if (trigger === undefined) {
			throw new Error('Trigger not found');
		}

		trigger.enabled = !trigger.enabled;
	}

	replaceTrigger(triggerId: string, newTrigger: Trigger) {
		this.triggersManager.removeTrigger(triggerId);
		this.triggersManager.addTrigger(newTrigger);
	}
}
