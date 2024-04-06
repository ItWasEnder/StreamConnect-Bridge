import { WebcastPushConnection } from 'tiktok-live-connector';
import { ConnectionConfig, TikTokInfo } from '../connections/backend/Connection';
import { STATUS, Service } from '../connections/backend/Service';
import { INTERNAL_EVENTS } from '../events/EventsHandler';
import { BaseEvent } from '../triggers/TriggerManager';

export const TIKTOK_EVENTS = {
	FOLLOW: 'tiktok-follow',
	GIFT: 'tiktok-gift',
	DONATION: 'tiktok-donation',
	SHARE: 'tiktok-share',
	CHAT: 'tiktok-chat',
	SUBSCRIBE: 'tiktok-subscribe'
};

export enum FOLLOW_STATUS {
	NONE,
	FOLLOWER,
	FRIENDS
}

export interface TiktokEvent extends BaseEvent {
	nickname: string;
	userId: string;
	followRole: FOLLOW_STATUS;
	isSubscriber: boolean;
	isModerator: boolean;
	data?: TiktokGift | TiktokChat | TiktokSubscribe | Record<string, any>;
}

export interface TiktokGift {
	repeatEnd: boolean;
	giftName: string;
	giftId: number;
	count: number;
	diamonds: number;
}

export interface TiktokChat {
	comment: string;
}

export interface TiktokSubscribe {
	subMonth: number;
	oldSubscribeStatus: number;
	subscribingStatus: number;
}

export class TikTokHandler extends Service {
	private connection: WebcastPushConnection;
	private reconnectAttempts: number = 0;
	private maxReconnectAttempts: number = 4;
	private reconnectWaitMs: number = 1000;
	private reconnectEnabled: boolean = true;
	private clientDisconnected: boolean = false;

	constructor(public config: ConnectionConfig) {
		super();
		this.config = config;
		this.connection = null;

		this.connection = new WebcastPushConnection((this.config.info as TikTokInfo).username, {
			fetchRoomInfoOnConnect: true, // only connect to live sessions
			enableWebsocketUpgrade: true, // use websocket, if available
			requestPollingIntervalMs: 1000, // poll every second
			clientParams: {
				app_language: 'en-US',
				device_platform: 'web'
			}
		});

		this.connection.on('chat', (data) => {
			const event: TiktokEvent = this.parseData(TIKTOK_EVENTS.CHAT, data);
			event.data = { comment: data.comment } as TiktokChat;

			this.emit(TIKTOK_EVENTS.CHAT, { data: event });
		});

		this.connection.on('gift', (data) => {
			const event: TiktokEvent = this.parseData(TIKTOK_EVENTS.GIFT, data);
			event.data = {
				repeatEnd: data.repeatEnd,
				giftName: data.giftName,
				giftId: data.giftId,
				count: data.repeatCount,
				diamonds: data.diamondCount
			} as TiktokGift;

			if (data.giftType != 1 || data.repeatEnd) {
				// Streak ended
				this.emit(TIKTOK_EVENTS.GIFT, { data: event });
			} else {
				// Streak in progress
				// console.log(`${data.uniqueId} is sending gift ${data.giftName} x${data.repeatCount}`);
			}
		});

		// Triggered every time a subscriber sends an emote (sticker).
		this.connection.on('emote', (data) => {
			console.log('emote received', data);
		});

		// Triggered every time someone sends a treasure chest.
		this.connection.on('envelope', (data) => {
			console.log('envelope received', data);
		});

		// Triggers when a user creates a subscription.
		this.connection.on('subscribe', (data) => {
			const event: TiktokEvent = this.parseData(TIKTOK_EVENTS.SUBSCRIBE, data);
			event.data = {
				subMonth: data.subMonth,
				oldSubscribeStatus: data.oldSubscribeStatus,
				subscribingStatus: data.subscribingStatus
			} as TiktokSubscribe;

			this.emit(TIKTOK_EVENTS.SUBSCRIBE, { data: event });
		});

		// Triggers when a user follows
		this.connection.on('follow', (data) => {
			const event: TiktokEvent = this.parseData(TIKTOK_EVENTS.FOLLOW, data);

			this.emit(TIKTOK_EVENTS.FOLLOW, { data: event });
		});

		// Triggers when a user shares the stream
		this.connection.on('share', (data) => {
			const event: TiktokEvent = this.parseData(TIKTOK_EVENTS.SHARE, data);

			this.emit(TIKTOK_EVENTS.SHARE, { data: event });
		});

		this.connection.on('streamEnd', (data) => {
			this.reconnectEnabled = false;
		});

		this.connection.on('disconnected', (data) => {
			if (this.clientDisconnected) {
				return;
			}

			this.emit(INTERNAL_EVENTS.WARN, {
				data: { message: `Service ${this.service} disconnected, scheduling reconnect...` }
			});
			this.sceduleReconnect();
		});
	}

	get service(): string {
		return this.config.name;
	}

	async start(): Promise<void> {
		if ((await this.status()) === STATUS.ONLINE) {
			this.emit(INTERNAL_EVENTS.WARN, {
				data: { message: `Service ${this.service} already started...` }
			});
			return;
		}

		this.connect(false);
	}

	connect(isReconnect: boolean) {
		this.connection
			.connect()
			.then((state) => {
				const { upgradedToWebsocket } = state;

				this.reconnectAttempts = 0;
				this.reconnectWaitMs = 1000;

				// Check if connection needs to be dropped
				if (this.clientDisconnected) {
					this.stop();
					return;
				}

				if (!isReconnect) {
					this.emit(INTERNAL_EVENTS.GOOD, {
						data: {
							message: `Service ${this.service} connected to live for '${(this.config.info as TikTokInfo).username}' (webSocket=${upgradedToWebsocket})`
						}
					});
				} else {
					this.emit(INTERNAL_EVENTS.GOOD, {
						data: {
							message: `Service ${this.service} reconnected to live for '${(this.config.info as TikTokInfo).username}'`
						}
					});
				}
			})
			.catch((err) => {
				const msg: string = `${isReconnect ? 'Reconnect' : 'Connection'} failed @@@ ${err.message}`;

				this.emit(INTERNAL_EVENTS.ERROR, {
					data: { message: `Service ${this.service} - ${msg}` }
				});

				if (msg.match(/LIVE has ended/gi)) {
					this.stop();
					return;
				}

				if (this.reconnectEnabled) {
					// Schedule the next reconnect attempt
					this.sceduleReconnect();
				}
			});
	}

	stop(): void {
		this.clientDisconnected = true;
		this.reconnectEnabled = false;

		if ((this.connection.getState() as any).isConnected) {
			this.connection.disconnect();
		}
	}

	async status(): Promise<STATUS> {
		if (!this.config.enabled || this.clientDisconnected) {
			return STATUS.OFFLINE;
		}

		const state = this.connection.getState() as any;
		if (state.isConnected) {
			return STATUS.ONLINE;
		} else {
			return STATUS.UNAVAILABLE;
		}
	}

	sceduleReconnect(): void {
		if (!this.reconnectEnabled) {
			return;
		}

		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: {
					message: `Service ${this.config.name} - Max attempts exceeded. Stopping service...`
				}
			});

			this.stop();

			return;
		}

		setTimeout(() => {
			if (!this.reconnectEnabled || this.reconnectAttempts >= this.maxReconnectAttempts) {
				return;
			}

			++this.reconnectAttempts;
			this.reconnectWaitMs *= 2;

			this.connect(true);
		}, this.reconnectWaitMs);
	}

	private parseData(event: string, data: any): TiktokEvent {
		return {
			event: event,
			nickname: data.nickname,
			username: data.uniqueId,
			userId: data.userId,
			followRole: FOLLOW_STATUS[data.followRole as keyof typeof FOLLOW_STATUS],
			isSubscriber: data.isSubscriber,
			isModerator: data.isModerator,
			timestamp: data.timestamp
		};
	}
}
