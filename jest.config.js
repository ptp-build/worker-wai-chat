module.exports = {
  setupFilesAfterEnv: ['./tests/setup.js'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/'
  ],
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	},
	watchman: false,
	"roots": ["src"],
	globals:{

	}
};
