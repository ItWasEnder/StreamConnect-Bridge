import type { Config } from 'jest';

export default async (): Promise<Config> => {
	return {
		automock: true,
		verbose: true,
		collectCoverage: true,
		collectCoverageFrom: ['src/**/*.{ts,tsx}', 'src/**/*.{js,jsx}', '!**/node_modules/**'],
		maxConcurrency: 5,
		preset: 'ts-jest',
		transform: {
			'\\.[jt]sx?$': [
				'ts-jest',
				{
					useESM: true
				}
			]
		},
		moduleNameMapper: {
			'(.+)\\.js': '$1'
		},
		extensionsToTreatAsEsm: ['.ts']
	};
};
