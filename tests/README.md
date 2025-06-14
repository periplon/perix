# Browser Automation Extension Tests

This directory contains the test suite for the Browser Automation Chrome Extension.

## Test Structure

- `setup.js` - Global test setup and Chrome API mocks
- `simple.test.js` - Basic functionality tests that verify mocking setup
- `background.test.js` - Tests for WebSocket connection and command handlers
- `content.test.js` - Tests for DOM manipulation and content script functionality
- `popup.test.js` - Tests for popup UI interactions
- `integration.test.js` - End-to-end workflow tests

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

The project aims for 80% code coverage across:
- Branches
- Functions
- Lines
- Statements

## Writing Tests

When adding new functionality, please ensure:
1. Unit tests cover individual functions
2. Integration tests verify workflows
3. Mocks are properly set up and cleaned up
4. Tests are isolated and don't affect each other

## Known Issues

Some tests in the full test suite may fail due to complex mocking requirements. The `simple.test.js` file provides a baseline of passing tests to ensure the test infrastructure is working correctly.