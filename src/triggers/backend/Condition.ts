import { JSONPath } from 'jsonpath-plus';

export enum OperationType {
	EQUALS = 'equals',
	CONTAINS = 'contains',
	GREATER_THAN = 'greater_than',
	LESS_THAN = 'less_than'
}

export class Condition {
	order: number;
	data_path: string;
	negate: boolean;
	operation: OperationType;
	value: string | number;

	constructor(data: any) {
		this.order = data.order;
		this.data_path = data.data_path;
		this.negate = data.negate;
		this.operation = data.operation;
		this.value = data.value;
	}

	/**
	 * Evaluate a condition against given data
	 * @param data to evaluate against
	 * @returns true if the condition is met
	 */
	evaluate(data: any): boolean {
		const exact_data = JSONPath({
			path: `$.${this.data_path}`,
			json: data
		});

		if (!exact_data || exact_data.length === 0) {
			return false;
		}

		const dataValue = exact_data[0];

		let result = false;

		switch (this.operation) {
			case OperationType.EQUALS:
				result = dataValue === this.value;
				break;
			case OperationType.CONTAINS:
				if (typeof dataValue !== 'string') {
					throw new Error(
						`Cannot use operation 'contains' on data at path ${this.data_path}. Data is not a string.`
					);
				}

				const stringValue = this.value as string;
				result = result = dataValue.includes(stringValue);
				break;
			case OperationType.GREATER_THAN:
				if (typeof dataValue !== 'number') {
					throw new Error(
						`Cannot use operation 'greater_than' on data at path ${this.data_path}. Data is not a number.`
					);
				}

				const numericValue = this.value as number;
				result = dataValue > numericValue;
				break;
			case OperationType.LESS_THAN:
				if (typeof dataValue !== 'number') {
					throw new Error(
						`Cannot use operation 'less_than' on data at path ${this.data_path}. Data is not a number.`
					);
				}

				const numericValueLess = this.value as number;
				result = dataValue < numericValueLess;
				break;
			default:
				throw new Error(`Unknown operation type ${this.operation}`);
		}

		if (this.negate) {
			result = !result;
		}

		return result;
	}
}
