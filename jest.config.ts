import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	automock: false,
	verbose: true,
	collectCoverage: false,
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{ts,tsx}', 'src/**/*.{js,jsx}', '!**/node_modules/**', '!**/__test__/data/**'],
	maxConcurrency: 5,
	preset: 'ts-jest',
	testMatch: ['**/?(*.)+(test).ts']
};

export default jestConfig;
