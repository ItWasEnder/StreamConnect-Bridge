import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	automock: false,
	verbose: true,
	collectCoverage: false,
	testEnvironment: 'node',
	collectCoverageFrom: [
		'src/**/*.{ts,tsx}',
		'src/**/*.{js,jsx}',
		'!**/node_modules/**',
		'!**/__test__/data/**'
	],
	maxConcurrency: 5,
	maxWorkers: '50%',
	preset: 'ts-jest',
	testMatch: ['**/?(*.)+(test).ts'],
	transformIgnorePatterns: ['node_modules/(?!(ora|chalk|cli-cursor))'],
	transform: {
		'^.+\\.(ts|tsx)$': 'ts-jest',
		'^.+\\.(js|jsx)$': 'babel-jest'
	}
};

export default jestConfig;
