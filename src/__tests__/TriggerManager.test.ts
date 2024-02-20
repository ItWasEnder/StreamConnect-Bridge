import { expect, jest, test } from '@jest/globals';
import { TriggerManager } from '../triggers/TriggerManager';
import { FileManager } from '../utils/FileManager';
import { Trigger } from '../triggers/backend/Trigger';
import * as __mock from './data/MockDataGenerator';

// import * as ActionsManager from '../actions/ActionsManager';
// const { getKeys } = jest.requireActual<typeof ActionsManager>('../actions/ActionsManager.ts');

jest.mock('../utils/FileManager');
// const _fileManager = <jest.Mocked<FileManager>>(<unknown>FileManager);

describe('TriggerManager', () => {
	let triggerManager: TriggerManager;
	let fileManager: FileManager;

	beforeEach(() => {
		fileManager = new FileManager();
		triggerManager = new TriggerManager(fileManager);
	});

	test('addTrigger', () => {
		const trigger = __mock.createTrigger();

		triggerManager.addTrigger(trigger);

		expect(triggerManager.getTriggers()).toContain(trigger);
	});

	test('removeTrigger', () => {
		const trigger = __mock.createTrigger();

		triggerManager.addTrigger(trigger);
		triggerManager.removeTrigger(trigger.id);

		console.log(JSON.stringify(trigger, null, 2));

		expect(triggerManager.getTriggers()).not.toContain(trigger);
	});
});
