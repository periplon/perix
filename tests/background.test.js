const WS = require('jest-websocket-mock').default;

// Mock the background script's global variables
global.wsConnection = null;
global.wsReconnectInterval = null;

describe('Background Script', () => {
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
  });

  describe('WebSocket Connection', () => {
    test('should send connected message on successful connection', async () => {
      // Load background script
      require('../background.js');
      
      // Wait for connection
      await server.connected;
      
      // Verify connected message was sent
      await expect(server).toReceiveMessage(
        JSON.stringify({ type: 'connected', version: '1.0.0' })
      );
    });
  });

  describe('Command Handlers', () => {
    beforeEach(async () => {
      // Load background script and wait for connection
      require('../background.js');
      await server.connected;
    });

    test('should list all tabs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com', title: 'Example', active: true },
        { id: 2, url: 'https://test.com', title: 'Test', active: false }
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);

      // Send command
      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.list',
        params: {}
      }));

      // Verify response
      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.id).toBe('1');
      expect(response.type).toBe('response');
      expect(response.result).toHaveLength(2);
      expect(response.result[0].url).toBe('https://example.com');
    });

    test('should create a new tab', async () => {
      const newTab = { id: 3, url: 'https://new.com', title: 'New Tab' };
      chrome.tabs.create.mockResolvedValue(newTab);

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.create',
        params: { url: 'https://new.com' }
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.result).toEqual({
        id: 3,
        url: 'https://new.com',
        title: 'New Tab'
      });
    });

    test('should handle unknown command', async () => {
      server.send(JSON.stringify({
        id: '3',
        command: 'unknown.command',
        params: {}
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.type).toBe('error');
      expect(response.error).toContain('Unknown command');
    });

    test('should handle missing command', async () => {
      server.send(JSON.stringify({
        id: '4',
        params: {}
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.type).toBe('error');
      expect(response.error).toContain('Command not specified');
    });
  });

  describe('Tab Management', () => {
    beforeEach(async () => {
      require('../background.js');
      await server.connected;
    });

    test('should close a tab', async () => {
      chrome.tabs.remove.mockResolvedValue();

      server.send(JSON.stringify({
        id: '5',
        command: 'tabs.close',
        params: { tabId: 1 }
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.result.success).toBe(true);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
    });

    test('should execute script in tab', async () => {
      chrome.scripting.executeScript.mockResolvedValue([{ result: 'test result' }]);

      server.send(JSON.stringify({
        id: '6',
        command: 'tabs.executeScript',
        params: { tabId: 1, script: 'return document.title;' }
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.result).toBe('test result');
    });

    test('should find elements by selector', async () => {
      const elements = [
        { index: 0, tagName: 'DIV', id: 'test', className: 'example' }
      ];
      chrome.scripting.executeScript.mockResolvedValue([{ result: elements }]);

      server.send(JSON.stringify({
        id: '7',
        command: 'tabs.findElements',
        params: { tabId: 1, selector: '.example' }
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.result.elements).toEqual(elements);
    });
  });

  describe('Cookie Management', () => {
    beforeEach(async () => {
      require('../background.js');
      await server.connected;
    });

    test('should get cookies', async () => {
      const cookies = [{ name: 'test', value: 'cookie' }];
      chrome.cookies.getAll.mockResolvedValue(cookies);

      server.send(JSON.stringify({
        id: '8',
        command: 'tabs.getCookies',
        params: { url: 'https://example.com' }
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.result.cookies).toEqual(cookies);
    });

    test('should set cookie', async () => {
      const cookie = { name: 'test', value: 'cookie' };
      chrome.cookies.set.mockResolvedValue(cookie);

      server.send(JSON.stringify({
        id: '9',
        command: 'tabs.setCookie',
        params: { url: 'https://example.com', name: 'test', value: 'cookie' }
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.result.cookie).toEqual(cookie);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      require('../background.js');
      await server.connected;
    });

    test('should handle command execution errors', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Tab query failed'));

      server.send(JSON.stringify({
        id: '10',
        command: 'tabs.list',
        params: {}
      }));

      const message = await server.nextMessage;
      const response = JSON.parse(message);
      
      expect(response.type).toBe('error');
      expect(response.error).toContain('Tab query failed');
    });
  });
});