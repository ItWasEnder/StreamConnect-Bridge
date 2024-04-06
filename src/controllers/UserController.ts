import { Request, Response } from 'express';
import { UserManager, Platform } from '../moderation/UserManager';

interface CooldownRequest {
	platform: Platform;
	username: string;
	item: string;
	cooldown: number;
}

export class UserController {
	async getUsers(req: Request, res: Response): Promise<void> {
		const platform = req.params.platform as Platform;
		const moderationManager = UserManager.getInstance();

		if (!moderationManager.hasPlatform(platform)) {
			res.status(404).json({ error: 'Platform not found' });
			return;
		}

		const users = moderationManager.getUsers(platform);
		res.json(users);
	}

	async getUser(req: Request, res: Response): Promise<void> {
		const platform = req.params.platform as Platform;
		const username = req.params.username;

		const moderationManager = UserManager.getInstance();

		if (!moderationManager.hasPlatform(platform)) {
			res.status(404).json({ error: 'Platform not found' });
			return;
		}

		const user = moderationManager.getUser(platform, username);
		res.json(user);
	}

	async setCooldown(req: Request, res: Response): Promise<void> {
		const body = req.body as CooldownRequest;
		const moderationManager = UserManager.getInstance();

		if (!moderationManager.hasPlatform(body.platform)) {
			res.status(404).json({ error: 'Platform not found' });
			return;
		}

		moderationManager.setCooldown(body.platform, body.username, body.item, body.cooldown);
		res.json({ message: 'Cooldown set' });
	}

	async getCooldown(req: Request, res: Response): Promise<void> {
		// api/user/:platform/:username/:item
		const platform = req.params.platform as Platform;
		const username = req.params.username;
		const item = req.params.item;

		const moderationManager = UserManager.getInstance();

		if (!moderationManager.hasPlatform(platform)) {
			res.status(404).json({ error: 'Platform not found' });
			return;
		}

		const cooldown = moderationManager.getCooldown(platform, username, item);
		const isBlocked = moderationManager.isBlocked(platform, username, item);
		res.json({ cooldown, isBlocked });
	}

	async blockUser(req: Request, res: Response): Promise<void> {
		const body = req.body as CooldownRequest;
		const moderationManager = UserManager.getInstance();

		if (!moderationManager.hasPlatform(body.platform)) {
			res.status(404).json({ error: 'Platform not found' });
			return;
		}

		moderationManager.blockUser(body.platform, body.username, body.item);
		res.json({ message: 'User blocked', user: body.username, item: body.item });
	}

	async unblockUser(req: Request, res: Response): Promise<void> {
		const body = req.body as CooldownRequest;
		const moderationManager = UserManager.getInstance();

		if (!moderationManager.hasPlatform(body.platform)) {
			res.status(404).json({ error: 'Platform not found' });
			return;
		}

		const user = moderationManager.getUser(body.platform, body.username);
		user.blocks = user.blocks.filter((block) => block !== body.item);
		res.json({ message: 'User unblocked', user, item: body.item });
	}
}
