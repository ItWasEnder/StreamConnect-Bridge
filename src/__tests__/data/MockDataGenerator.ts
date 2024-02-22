import { CALLERS, InternalRequest } from '../../providers/backend/InternalRequest';
import { EventMapping, Trigger } from '../../triggers/backend/Trigger';
import { FOLLOW_STATUS, TIKTOK_EVENTS, TiktokEvent } from '../../handlers/TikTokHandler';
import { TITSActionData, TITS_ACTIONS } from '../../handlers/TITSHandler';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';
import { Condition, OperationType } from '../../triggers/backend/Condition';
import { ActionData, ActionProvider } from '../../providers/backend/ActionProvider';

export function createTriggers(amount: number): Trigger[] {
	const triggers = [];

	for (let i = 0; i < amount; i++) {
		triggers.push(createTrigger());
	}

	return triggers;
}

export function createTrigger(options?: {
	events?: EventMapping[];
	actions?: InternalRequest[];
}): Trigger {
	const __events: EventMapping[] = options?.events || [
		{
			event: randomTiktokEventType(),
			conditions: [
				{
					order: 0,
					data_path: 'data.test',
					negate: false,
					operation: 'equals',
					value: `!throw${faker.animal.type()}`
				}
			]
		} as EventMapping
	];

	const __actions: InternalRequest[] = options?.actions || [createInternalRequest()];

	const trigger: Trigger = Trigger.fromObject({
		id: crypto.randomUUID(),
		name: 'Throw Test Command',
		cooldown: 5000,
		log: true,
		enabled: true,
		events: __events,
		actions: __actions
	});

	return trigger;
}

export function createInternalRequest<T extends ActionData>(
	options?: ActionProvider<T> | { provider?: ActionProvider<T> }
): InternalRequest {
	const provider = options instanceof ActionProvider ? options : options?.provider;

	if (provider) {
		const category = faker.helpers.arrayElement(provider.getCategories());
		const map = provider.getActionMap(category);
		const action = faker.helpers.arrayElement(map.getActions());

		return {
			caller: randomEventCaller(),
			providerId: provider.providerId,
			providerKey: {
				categoryId: category,
				actions: [action.id]
			},
			bypass_cooldown: false,
			context: {}
		} as InternalRequest;
	} else {
		return {
			caller: randomEventCaller(),
			providerId: 'tits',
			providerKey: {
				categoryId: randomTITSActionType(),
				actions: [crypto.randomUUID()]
			},
			bypass_cooldown: false,
			context: { count: 1, delay: 0.8 }
		} as InternalRequest;
	}
}

export function createTiktokEvent(options?: {
	event?: string;
	isSub?: boolean;
	isMod?: boolean;
	followRole?: FOLLOW_STATUS;
	data?: string;
}): TiktokEvent {
	const event: TiktokEvent = {
		event: options?.event || randomTiktokEventType(),
		username: faker.internet.userName(),
		nickname: faker.internet.displayName(),
		userId: faker.number.bigInt().toString(),
		followRole: randomTiktokFollowStatus(),
		isSubscriber: faker.datatype.boolean(),
		isModerator: faker.datatype.boolean(),
		timestamp: Date.now(),
		data: {
			test: options.data
		}
	};

	return event;
}

export function randomTITSActionType(): string {
	return faker.helpers.arrayElement(Object.values(TITS_ACTIONS));
}

export function randomTiktokEventType(): string {
	return faker.helpers.arrayElement(Object.values(TIKTOK_EVENTS));
}

export function randomEventCaller(): CALLERS {
	return faker.helpers.arrayElement(Object.values(CALLERS) as CALLERS[]);
}

export function randomTiktokFollowStatus(): FOLLOW_STATUS {
	return faker.helpers.arrayElement(Object.values(FOLLOW_STATUS) as FOLLOW_STATUS[]);
}

export function createCondition(options?: {
	path?: string;
	negate?: boolean;
	value?: string | number;
	operation?: OperationType;
}): Condition {
	return new Condition({
		order: 0,
		data_path: options?.path || 'data.test',
		negate: options?.negate ?? false,
		operation: options?.operation || OperationType.EQUALS,
		value: options?.value || 'test'
	});
}

export function generateTITSActionDataSet(): [string, TITSActionData] {
	const action: TITSActionData = {
		id: crypto.randomUUID(),
		name: faker.word.words(3),
		cooldown: faker.number.int({ min: 1, max: 10 }) * 1000
	};

	return [randomTITSActionType(), action];
}
