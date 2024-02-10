import { TriggerRequest } from '../actions/ActionsManager.js';

export enum OperationType {
	EQUALS = 'equals',
	CONTAINS = 'contains',
	GREATER_THAN = 'greater_than',
	LESS_THAN = 'less_than'
}

export interface Condition {
	order: number;
	negate: boolean;
	operation: OperationType;
	value: string;
}

export interface EventMapping {
	event: string;
	data_path: string;
	conditions: Condition[];
}

export interface Trigger {
	id: string;
	name: string;
	events: EventMapping[];
	actions: TriggerRequest[];
}
