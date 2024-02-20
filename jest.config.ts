import type { Config } from 'jest';
import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
	automock: false,
	verbose: true,
	collectCoverage: false,
	testEnvironment: 'node',
	collectCoverageFrom: ['src/**/*.{ts,tsx}', 'src/**/*.{js,jsx}', '!**/node_modules/**'],
	maxConcurrency: 5,
	preset: 'ts-jest',
	testPathIgnorePatterns: ['<rootDir>/src/__tests__/data/']
	// transform: {
	// 	'^.+\\.m?[tj]sx?$': [
	// 		'ts-jest',
	// 		{
	// 			useESM: true
	// 		}
	// 	]
	// },
	// moduleNameMapper: {
	// 	'(.+)\\.js': '$1'
	// },
	// extensionsToTreatAsEsm: ['.ts']
};

export default jestConfig;

// export default async (): Promise<Config> => {
// 	return {
// 		automock: true,
// 		verbose: true,
// 		collectCoverage: true,
// 		collectCoverageFrom: ['src/**/*.{ts,tsx}', 'src/**/*.{js,jsx}', '!**/node_modules/**'],
// 		maxConcurrency: 5,
// 		preset: 'ts-jest',
// 		// transform: {
// 		// 	'\\.[jt]sx?$': [
// 		// 		'ts-jest',
// 		// 		{
// 		// 			useESM: true
// 		// 		}
// 		// 	]
// 		// },
// 		// moduleNameMapper: {
// 		// 	'(.+)\\.js': '$1'
// 		// },
// 		// extensionsToTreatAsEsm: ['.ts']
// 	};
// };
