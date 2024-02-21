import { InternalRequest } from '../providers/backend/InternalRequest';
import { TriggerManager } from '../triggers/TriggerManager';
import { FileManager } from '../utils/FileManager';
import { Trigger } from '../triggers/backend/Trigger';
import { INTERNAL_EVENTS } from '../events/EventsHandler';
import { TiktokEvent } from '../handlers/TikTokHandler';
import { expect, jest, test } from '@jest/globals';
import * as __mock from './data/MockDataGenerator';

// import * as ActionsManager from '../actions/ActionsManager';
// const { getKeys } = jest.requireActual<typeof ActionsManager>('../actions/ActionsManager.ts');

jest.mock('../utils/FileManager');
jest.mock('../events/backend/Emmiting');

class TestTriggerManager extends TriggerManager {
	/** wrapped emit func */
	protected emit(event: string, data: any) {
		this.emitEvent(event, data);
	}

	public emitEvent(event, data) {
		super.emit(event, data);
	}
}

describe('TriggerManager', () => {
	let triggerManager: TestTriggerManager;
	let fileManager: FileManager;
	let emitSpy;

	beforeEach(() => {
		fileManager = new FileManager();
		triggerManager = new TestTriggerManager(fileManager);
		emitSpy = jest.spyOn(triggerManager, 'emitEvent');
	});

	test('addTrigger', () => {
		const trigger: Trigger = __mock.createTrigger();

		triggerManager.addTrigger(trigger);

		expect(triggerManager.getTriggers()).toContain(trigger);
	});

	test('removeTrigger', () => {
		const trigger: Trigger = __mock.createTrigger();

		triggerManager.addTrigger(trigger);
		triggerManager.removeTrigger(trigger.id);

		const eventTriggers = triggerManager.getEventTriggers(trigger.events[0].event);

		expect(triggerManager.getTriggers()).not.toContain(trigger);
		expect(eventTriggers).not.toContain(trigger);
	});

	test('injectData', () => {
		const trigger: Trigger = __mock.createTrigger();
		const actionRequest: InternalRequest = trigger.actions[0];
		const triggerReason = trigger.events[0];
		const tiktokEvent: TiktokEvent = __mock.createTiktokEvent({
			event: triggerReason.event,
			data: triggerReason.conditions[0].value.toString()
		});

		actionRequest.context = {
			test: '$$data.test'
		};

		triggerManager.injectData(actionRequest, tiktokEvent);

		expect(actionRequest.context.test).toBe((tiktokEvent.data as any).test!);
	});

	test('handleEvent', () => {
		const trigger: Trigger = __mock.createTrigger();
		const actionRequest: InternalRequest = trigger.actions[0];
		const triggerReason = trigger.events[0];
		const tiktokEvent = __mock.createTiktokEvent({
			event: triggerReason.event,
			data: triggerReason.conditions[0].value.toString()
		});

		triggerManager.addTrigger(trigger);
		triggerManager.handleEvent(triggerReason.event, { data: tiktokEvent });

		expect(emitSpy).toHaveBeenCalledWith(
			INTERNAL_EVENTS.EXECUTE_ACTION,
			expect.objectContaining({
				data: {
					...actionRequest,
					requestId: expect.any(String)
				}
			})
		);
	});
});
