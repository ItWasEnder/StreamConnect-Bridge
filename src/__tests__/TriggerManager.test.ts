import { Condition, OperationType } from '../triggers/backend/Condition';
import { InternalRequest } from '../providers/backend/InternalRequest';
import { TriggerManager } from '../triggers/TriggerManager';
import { FileManager } from '../utils/FileManager';
import { Trigger } from '../triggers/backend/Trigger';
import { INTERNAL_EVENTS } from '../events/EventsHandler';
import { TiktokEvent } from '../handlers/TikTokHandler';
import { expect, jest, it } from '@jest/globals';
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

describe('Condition', () => {
	// test all condition operations
	it('should evaluate operation type Equals on a string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.EQUALS,
			value: 'test'
		});

		const result1 = condition.evaluate({ test: 'test' });
		const result2 = condition.evaluate({ test: 'foo' });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should evaluate operation type Contains on a string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.CONTAINS,
			value: 'this test is cool'
		});

		const result1 = condition.evaluate({ test: 'test' });
		const result2 = condition.evaluate({ test: 'foo' });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should evaluate operation type StartsWith on a string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.STARTS_WITH,
			value: 'this test is cool'
		});

		const result1 = condition.evaluate({ test: 'this' });
		const result2 = condition.evaluate({ test: 'foo' });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should throw an error when using operation type Contains on a non string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.CONTAINS,
			value: 'this test is cool'
		});

		expect(() => condition.evaluate({ test: 123 })).toThrowError();
	});

	it('should throw an error when using operation type StartsWith on a non string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.STARTS_WITH,
			value: 'this test is cool'
		});

		expect(() => condition.evaluate({ test: 123 })).toThrowError();
	});

	it('should evaluate operation type GreaterThan on a number', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.GREATER_THAN,
			value: 5
		});

		const result1 = condition.evaluate({ test: 6 });
		const result2 = condition.evaluate({ test: 4 });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should evaluate operation type LessThan on a number', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.LESS_THAN,
			value: 5
		});

		const result1 = condition.evaluate({ test: 4 });
		const result2 = condition.evaluate({ test: 6 });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should evaluate operation type Equals on a number', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.EQUALS,
			value: 5
		});

		const result1 = condition.evaluate({ test: 5 });
		const result2 = condition.evaluate({ test: 6 });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should throw an error when using operation type GreaterThan on a non number', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.GREATER_THAN,
			value: 5
		});

		expect(() => condition.evaluate({ test: 'test' })).toThrowError();
	});

	it('should throw an error when using operation type LessThan on a non number', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.LESS_THAN,
			value: 5
		});

		expect(() => condition.evaluate({ test: 'test' })).toThrowError();
	});
});

describe('Trigger', () => {
	it('should create a trigger', () => {
		const trigger = __mock.createTrigger();

		expect(trigger).toBeDefined();
		expect(trigger.events[0].conditions[0].evaluate).toBeDefined();
	});

	it('should evaluate a condition', () => {
		const condition = __mock.createCondition({ path: 'test' });
		const data = {
			test: 'test'
		};

		const result = condition.evaluate(data);
		expect(result).toBe(true);
	});
});

describe('TriggerManager', () => {
	let triggerManager: TestTriggerManager;
	let fileManager: FileManager;
	let emitSpy;

	beforeEach(() => {
		fileManager = new FileManager();
		triggerManager = new TestTriggerManager(fileManager);
		emitSpy = jest.spyOn(triggerManager, 'emitEvent');
	});

	it('adds a trigger to the manager', () => {
		const trigger: Trigger = __mock.createTrigger();

		triggerManager.addTrigger(trigger);

		expect(triggerManager.getTriggers()).toContain(trigger);
	});

	it('removes a trigger from the manager', () => {
		const trigger: Trigger = __mock.createTrigger();

		triggerManager.addTrigger(trigger);
		triggerManager.removeTrigger(trigger.id);

		const eventTriggers = triggerManager.getEventTriggers(trigger.events[0].event);

		expect(triggerManager.getTriggers()).not.toContain(trigger);
		expect(eventTriggers).not.toContain(trigger);
	});

	it('should inject data from the event to path data.test', () => {
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

	it('should execute the triggers actions by meeting conditions', () => {
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
