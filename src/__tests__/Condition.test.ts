import { Condition, OperationType } from '../triggers/backend/Condition';

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
			value: 'test'
		});

		const result1 = condition.evaluate({ test: 'this test is cool' });
		const result2 = condition.evaluate({ test: 'this foo is cool' });

		expect(result1).toBe(true);
		expect(result2).toBe(false);
	});

	it('should evaluate operation type StartsWith on a string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.STARTS_WITH,
			value: 'xthis'
		});

		const result1 = condition.evaluate({ test: 'this xthis is cool' });
		const result2 = condition.evaluate({ test: 'foo test is cool' });
		const result3 = condition.evaluate({ test: 'xthis test is cool' });

		expect(result1).toBe(false);
		expect(result2).toBe(false);
		expect(result3).toBe(true);
	});

	it('should throw an error when using operation type Contains on a non string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.CONTAINS,
			value: 'test'
		});

		expect(() => condition.evaluate({ test: 123 })).toThrowError();
	});

	it('should throw an error when using operation type StartsWith on a non string', () => {
		const condition = new Condition({
			order: 0,
			data_path: 'test',
			negate: false,
			operation: OperationType.STARTS_WITH,
			value: 'test'
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
