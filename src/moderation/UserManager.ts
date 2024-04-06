export enum Platform {
	TWITCH = 'twitch',
	YOUTUBE = 'youtube',
	TIKTOK = 'tiktok',
}

export interface UserData {
	username: string;
	blocks: string[];
	cooldowns: Map<string, number>;
}

export class UserManager {
	private platformUsers: Map<Platform, Map<string, UserData>> = new Map();

	constructor() {
		for (const platform of Object.values(Platform)) {
			this.platformUsers.set(platform, new Map());
		}
	}

	public hasPlatform(platform: Platform): boolean {
		return this.platformUsers.has(platform);
	}

	public getUsers(platform: Platform): UserData[] {
		return Array.from(this.platformUsers.get(platform).values());
	}

	public getUser(platform: Platform, username: string): UserData {
		const users = this.platformUsers.get(platform);

		if (!users.has(username)) {
			users.set(username, { username, blocks: [], cooldowns: new Map() });
		}

		return users.get(username);
	}

	public setCooldown(platform: Platform, username: string, item: string, cooldown: number) {
		const user = this.getUser(platform, username);
		user.cooldowns.set(item, Date.now() + cooldown);
	}

	public getCooldown(platform: Platform, username: string, item: string): number {
		const user = this.getUser(platform, username);
		return user.cooldowns.get(item) || 0;
	}

	public isBlocked(platform: Platform, username: string, item: string): boolean {
		const user = this.getUser(platform, username);
		return user.blocks.includes(item);
	}

	public blockUser(platform: Platform, username: string, item: string) {
		const user = this.getUser(platform, username);
		user.blocks.push(item);
	}

	private static instance: UserManager;
	static getInstance(): UserManager {
		if (!this.instance) {
			this.instance = new UserManager();
		}
		return this.instance;
	}
}
