import { INTERNAL_EVENTS } from '../../events/EventsHandler';
import { Emitting } from '../../events/backend/Emmiting';
import { OptionsError } from '../../utils/OptionsError';

export interface ActionData {
	id: string;
	name: string;
}

export class ActionMap<T extends ActionData> {
	private actionMap: Map<string, T> = new Map(); // map<identifier, data>

	/**
	 * @param identifier identifier
	 * @returns true if action is stored
	 */
	has(identifier: string): boolean {
		return this.actionMap.has(identifier);
	}

	/**
	 * Get an ActionData from an action identifier
	 * @param identifier identifier
	 * @returns the associated ActionData or undefined if no value is set
	 */
	get(identifier: string): T | undefined {
		return this.actionMap.get(identifier);
	}

	/**
	 * Adds the action to the action map
	 * @param action the action
	 */
	put(action: T) {
		// Update the action if it already exists
		if (this.actionMap.has(action.id)) {
			const __action = this.actionMap.get(action.id);

			const __updated = {
				...__action,
				...action
			};

			this.actionMap.set(action.id, __updated);
		} else {
			this.actionMap.set(action.id, action);
		}
	}

	/**
	 * Removes an action from the action map
	 * @param identifier the action to remove
	 * @returns true if the action was removed
	 */
	remove(identifier: string): boolean {
		return this.actionMap.delete(identifier);
	}

	/**
	 * Clear all data from the map
	 */
	clear() {
		this.actionMap.clear();
	}

	/**
	 * This method returns the number of actions in the map
	 * @returns the number of actions in the map
	 */
	size() {
		return this.actionMap.size;
	}

	/**
	 * @returns an array of ActionData objects
	 */
	getActions(): T[] {
		return Array.from(this.actionMap.values()) ?? [];
	}
}

export class ActionProvider<T extends ActionData> extends Emitting {
	private categoryMap: Map<string, ActionMap<T>> = new Map(); // map<categoryId, map<actionId, info>>
	private reverseMap: Map<string, string> = new Map(); // map<identifier, categoryId>

	constructor(
		public providerId: string,
		private _loadActions: () => Promise<[string, T[]][]>
	) {
		super();
	}

	/**
	 * This method returns the number of actions in the provider
	 * @returns the number of actions in the provider
	 */
	actionCount() {
		let count = 0;

		for (const [_, actionMap] of this.categoryMap) {
			count += actionMap.size();
		}

		return count;
	}

	/**
	 * This function will generate a new ActionMap if the category does not exist
	 * @param actionId the category identifier
	 * @returns an ActionMap for the given category
	 */
	getActionMap(actionId: string): ActionMap<T> {
		let actionMap: ActionMap<T> | undefined = this.categoryMap.get(actionId);

		if (actionMap === undefined) {
			actionMap = new ActionMap();
			this.categoryMap.set(actionId, actionMap);
		}

		return actionMap;
	}

	/**
	 * Uses a reverse map to lookup the category of the specified action
	 * @param actionId identifier
	 * @returns a category identifier or undefined if the actionId is not found
	 */
	lookupCategory(actionId: string): string | undefined {
		return this.reverseMap.get(actionId);
	}

	/**
	 * Get the available keys that are mapped to ActionMap objects
	 * @returns an array of category identifiers
	 */
	getCategories(): string[] {
		return Array.from(this.categoryMap.keys());
	}

	/**
	 * Get the available keys that are mapped to ActionMap objects
	 * @param categoryId id for the category
	 */
	removeByCategory(categoryId: string) {
		this.categoryMap.delete(categoryId);
	}

	/**
	 * Clear all data from the maps
	 */
	clearAll() {
		this.categoryMap.clear();
		this.reverseMap.clear();
	}

	/**
	 * Checks if the category exists
	 * @param categoryId the category identifier
	 * @returns true if the category exists, false otherwise
	 */
	has(categoryId: string): boolean {
		return this.categoryMap.has(categoryId);
	}

	/**
	 * Load actions from the provider func
	 */
	loadActions() {
		if (!this._loadActions) {
			this.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: `ActionProvider@${this.providerId} >> Error: _loadActions is not defined` }
			});
			return;
		}

		// clear the maps
		this.clearAll();

		// load new data
		this._loadActions()
			.then((actions) => {
				let count = 0;

				for (const [categoryId, actionData] of actions) {
					const actionMap = this.getActionMap(categoryId);

					for (const __action of actionData) {
						const action = __action as T;
						actionMap.put(action);
						this.reverseMap.set(action.id, categoryId);
					}

					count += actionMap.size();
				}

				this.emit(INTERNAL_EVENTS.INFO, {
					data: {
						message: `ActionProvider@${this.providerId} >> Loaded ${this.categoryMap.size} categories with ${count} actions...`
					}
				});
			})
			.catch((error) => {
				this.emit(INTERNAL_EVENTS.ERROR, {
					data: {
						message: `ActionProvider@${this.providerId} >> Error occured trying to load actions: ${error.message}`
					}
				});

				let print = true;

				if (error instanceof OptionsError) {
					print = (error as OptionsError).options?.print ?? true;
				}

				if (print) {
					console.error(error);
				}
			});
	}
}
