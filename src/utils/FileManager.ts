import { INTERNAL_EVENTS, EMITTER } from '../events/EventsHandler';
import { Emitting } from '../events/backend/Emmiting';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as _path from 'path';

export class FileManager extends Emitting {
	private watcherMap: Map<string, chokidar.FSWatcher> = new Map();

	constructor(public rootPath: string = '') {
		super();
	}

	/**
	 * Implement a callback function to be called when a file changes
	 * @param filePath that changed
	 * @param callback callback function
	 */
	onChange(relativePath: string, callback: (path: string) => void) {
		const _fullpath = _path.join(this.rootPath, relativePath.replace(/\\/g, '/'));

		this.watcherMap.set(
			_fullpath,
			chokidar.watch(relativePath).on('change', () => {
				try {
					callback(_fullpath);
				} catch (error) {
					EMITTER.emit(INTERNAL_EVENTS.ERROR, {
						data: { message: `FileManager >> Error in file watcher callback: ${error.message}` }
					});
					console.error(error);
				}
			})
		);
	}

	/**
	 * Stop all file watchers
	 */
	close() {
		for (const [_, watcher] of this.watcherMap.entries()) {
			watcher.close();
		}
	}

	/**
	 * This will create a file if it does not exist
	 * @param relativePath path to the file
	 * @param data to write to the file
	 * @param options to use when writing the file
	 * @returns true if the file was created, false if it already exists
	 */
	createFileIfNotExists(
		relativePath: string,
		data: string | NodeJS.ArrayBufferView,
		options?: fs.WriteFileOptions
	): boolean {
		let created = false;

		try {
			const _fullpath = this.getFullPath(relativePath);
			const fullPath = _path.resolve(_fullpath);

			if (!fs.existsSync(fullPath)) {
				fs.writeFileSync(fullPath, data, options);
				created = true;
			}
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: `FileManager >> Error occured trying to create file: ${error.message}` }
			});
			console.error(error);
		}

		return created;
	}

	/**
	 * Constructs a proper patht hat can be used with the file system
	 * @param relativePath some relative path
	 * @returns fixed path with root path if needed
	 */
	getFullPath(relativePath: string): string {
		return _path.join(this.rootPath, relativePath.replace(/\\/g, '/'));
	}

	/**
	 * This method saves a file to the file system
	 * @param relativePath the relative path to save the file to
	 * @param data to save to the file
	 * @param options to use when saving the file
	 */
	saveFile(
		relativePath: string,
		data: string | NodeJS.ArrayBufferView,
		options?: fs.WriteFileOptions
	): void {
		try {
			const fullPath = this.getFullPath(relativePath);
			fs.writeFileSync(fullPath, data, options);
		} catch (error) {
			EMITTER.emit(INTERNAL_EVENTS.ERROR, {
				data: { message: `FileManager >> Error occured trying to save file: ${error.message}` }
			});
			console.error(error);
		}
	}
}
