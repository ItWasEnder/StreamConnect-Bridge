import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	splitting: false,
	sourcemap: true,
	clean: true,
	noExternal: [
		'body-parser',
		'chalk',
		'commander',
		'cors',
		'express',
		'inquirer',
		'jsonpath-plus',
		'tiktok-live-connector',
		'ws'
	]
});
