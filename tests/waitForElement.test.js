const WS = require('jest-websocket-mock').default;

// Mock the background script's global variables
global.wsConnection = null;
global.wsReconnectInterval = null;

describe('waitForElement', () => {
  let server;
  let originalWebSocket;

  beforeEach(async () => {
    // Save original WebSocket
    originalWebSocket = global.WebSocket;
    
    // Create mock server
    server = new WS('ws://localhost:8765');
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset global variables
    global.wsConnection = null;
    global.wsReconnectInterval = null;
    
    // Load background script
    require('../background.js');
    
    // Wait for connection
    await server.connected;
  });

  afterEach(() => {
    // Clean up WebSocket server
    WS.clean();
    
    // Clear any intervals
    if (global.wsReconnectInterval) {
      clearInterval(global.wsReconnectInterval);
      global.wsReconnectInterval = null;
    }
    
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
    
    // Clear module cache
    jest.resetModules();
  });

  test('should return found: true when element exists', async () => {
    // Mock successful element finding
    chrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

    const command = {
      id: '123',
      command: 'tabs.waitForElement',
      params: {
        tabId: 456,
        selector: '#test-element',
        timeout: 1000
      }
    };

    // Send command from server
    server.send(JSON.stringify(command));
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Get messages sent by the client
    const messages = server.messages.filter(msg => {
      const parsed = JSON.parse(msg);
      return parsed.id === '123';
    });
    
    expect(messages.length).toBeGreaterThan(0);
    const response = JSON.parse(messages[messages.length - 1]);
    
    expect(response).toMatchObject({
      id: '123',
      result: {
        found: true,
        elapsed: expect.any(Number)
      }
    });
    
    expect(response.result.elapsed).toBeLessThan(1000);
  });

  test('should return found: false when element does not exist within timeout', async () => {
    // Mock element not found
    chrome.scripting.executeScript.mockResolvedValue([{ result: false }]);

    const command = {
      id: '124',
      command: 'tabs.waitForElement',
      params: {
        tabId: 456,
        selector: '#non-existent',
        timeout: 500
      }
    };

    // Send command from server
    server.send(JSON.stringify(command));
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 700));
    
    // Get messages sent by the client
    const messages = server.messages.filter(msg => {
      const parsed = JSON.parse(msg);
      return parsed.id === '124';
    });
    
    expect(messages.length).toBeGreaterThan(0);
    const response = JSON.parse(messages[messages.length - 1]);
    
    expect(response).toMatchObject({
      id: '124',
      result: {
        found: false,
        elapsed: expect.any(Number)
      }
    });
    
    expect(response.result.elapsed).toBeGreaterThanOrEqual(500);
  });

  test('should handle script execution errors gracefully', async () => {
    // Mock script execution error
    chrome.scripting.executeScript.mockRejectedValue(new Error('Tab not found'));

    const command = {
      id: '125',
      command: 'tabs.waitForElement',
      params: {
        tabId: 999,
        selector: '#test',
        timeout: 300
      }
    };

    // Send command from server
    server.send(JSON.stringify(command));
    
    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get messages sent by the client
    const messages = server.messages.filter(msg => {
      const parsed = JSON.parse(msg);
      return parsed.id === '125';
    });
    
    expect(messages.length).toBeGreaterThan(0);
    const response = JSON.parse(messages[messages.length - 1]);
    
    expect(response).toMatchObject({
      id: '125',
      result: {
        found: false,
        elapsed: expect.any(Number)
      }
    });
    
    expect(response.result.elapsed).toBeGreaterThanOrEqual(300);
  });

  test('should not return true for undefined or null results', async () => {
    // Mock various falsy results
    chrome.scripting.executeScript
      .mockResolvedValueOnce([{ result: undefined }])
      .mockResolvedValueOnce([{ result: null }])
      .mockResolvedValueOnce([{ result: false }])
      .mockResolvedValueOnce([{ result: true }]);

    const command = {
      id: '126',
      command: 'tabs.waitForElement',
      params: {
        tabId: 456,
        selector: '#test',
        timeout: 1000
      }
    };

    // Send command from server
    server.send(JSON.stringify(command));
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get messages sent by the client
    const messages = server.messages.filter(msg => {
      const parsed = JSON.parse(msg);
      return parsed.id === '126';
    });
    
    expect(messages.length).toBeGreaterThan(0);
    const response = JSON.parse(messages[messages.length - 1]);
    
    expect(response).toMatchObject({
      id: '126',
      result: {
        found: true,
        elapsed: expect.any(Number)
      }
    });
    
    // Should have called executeScript 4 times (3 falsy + 1 true)
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(4);
  });

  test('should throw error when tabId is missing', async () => {
    const command = {
      id: '127',
      command: 'tabs.waitForElement',
      params: {
        selector: '#test'
      }
    };

    // Send command from server
    server.send(JSON.stringify(command));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get messages sent by the client
    const messages = server.messages.filter(msg => {
      const parsed = JSON.parse(msg);
      return parsed.id === '127';
    });
    
    expect(messages.length).toBeGreaterThan(0);
    const response = JSON.parse(messages[messages.length - 1]);
    
    expect(response).toMatchObject({
      id: '127',
      error: 'tabId is required'
    });
  });

  test('should throw error when selector is missing', async () => {
    const command = {
      id: '128',
      command: 'tabs.waitForElement',
      params: {
        tabId: 456
      }
    };

    // Send command from server
    server.send(JSON.stringify(command));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get messages sent by the client
    const messages = server.messages.filter(msg => {
      const parsed = JSON.parse(msg);
      return parsed.id === '128';
    });
    
    expect(messages.length).toBeGreaterThan(0);
    const response = JSON.parse(messages[messages.length - 1]);
    
    expect(response).toMatchObject({
      id: '128',
      error: 'selector is required'
    });
  });
});