import { expect, jest, test } from '@jest/globals';
import { TriggerManager } from '../triggers/TriggerManager';
import { FileManager } from '../utils/FileManager';

// import * as ActionsManager from '../actions/ActionsManager';
// const { getKeys } = jest.requireActual<typeof ActionsManager>('../actions/ActionsManager.ts');

jest.mock('../utils/FileManager')
const _fileManager = <jest.Mocked<FileManager>><unknown>FileManager;

describe('ActionsManager', () => {
	test('getKeys', () => {
		const triggerManager = new TriggerManager(_fileManager);

		// const actionsManager = new ActionsManager();
		// expect(actionsManager.getKeys()).toEqual(['key1', 'key2']);
	});
});
