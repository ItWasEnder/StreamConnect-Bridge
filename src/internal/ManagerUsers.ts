import { Platform, UserManager } from '../moderation/UserManager';
import { ContextLike } from '../providers/backend/InternalRequest';
import { Result } from '../utils/Result';
import { InternalAction } from './backend/InternalAction';

interface UserContext {
	username: string;
	platform: Platform;
	action: UserActions;
	itemId: string;
	cooldown?: string;
}

export enum UserActions {
	SET_COOLDOWN = 'set_cooldown',
	UNSET_COOLDOWN = 'unset_cooldown',
	ADD_BLOCK = 'add_block',
	REMOVE_BLOCK = 'remove_block',
}

export class ManageUsers extends InternalAction {
	constructor() {
		super('ManageUsers');
	}

	execute(context: ContextLike): Result<string> {
		const triggerContext = context as UserContext;

		switch (triggerContext.action) {
			case UserActions.SET_COOLDOWN:
				this.setCooldown(triggerContext, parseInt(triggerContext.cooldown));
				break;
			case UserActions.UNSET_COOLDOWN:
				this.clearCooldown(triggerContext);
				break;
			case UserActions.ADD_BLOCK:
				this.addBlock(triggerContext);
				break;
			case UserActions.REMOVE_BLOCK:
				this.removeBlock(triggerContext);
				break;
			default:
				return Result.fail('Invalid action');
		}

		return Result.pass('Success');
	}

	setCooldown(context: UserContext, newCooldown: number) {
		const manager = UserManager.getInstance();
		manager.setCooldown(context.platform, context.username, context.itemId, newCooldown * 1000);
	}

	clearCooldown(context: UserContext) {
		const manager = UserManager.getInstance();
		const user = manager.getUser(context.platform, context.username);

		user.cooldowns.delete(context.itemId);
	}

	addBlock(context: UserContext) {
		const manager = UserManager.getInstance();
		manager.blockUser(context.platform, context.username, context.itemId);
	}

	removeBlock(context: UserContext) {
		const manager = UserManager.getInstance();
		const user = manager.getUser(context.platform, context.username);

		user.blocks = user.blocks.filter((block) => block !== context.itemId);
	}
}
