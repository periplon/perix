module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/simple.test.js', '<rootDir>/tests/waitForElement.test.js', '<rootDir>/tests/getActionables.test.js', '<rootDir>/tests/accessibilitySnapshot.test.js', '<rootDir>/tests/scroll.test.js', '<rootDir>/tests/sendKey.test.js', '<rootDir>/tests/iframe-utils.test.js'],
  collectCoverageFrom: [
    '*.js',
    '!example-websocket-server.js',
    '!tests/**',
    '!jest.config.js'
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0
    }
  },
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};