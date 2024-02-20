import { expect, jest, test } from '@jest/globals';
import { ActionsManager } from '../actions/ActionsManager';

// import * as ActionsManager from '../actions/ActionsManager';
// const { getKeys } = jest.requireActual<typeof ActionsManager>('../actions/ActionsManager.ts');

describe('ActionsManager', () => {
	test('getKeys', () => {
		const actionsManager = new ActionsManager();

		// const actionsManager = new ActionsManager();
		// expect(actionsManager.getKeys()).toEqual(['key1', 'key2']);
	});
});
