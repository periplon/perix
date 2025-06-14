const WS = require('jest-websocket-mock').default;

describe('Integration Tests', () => {
  let server;

  beforeEach(async () => {
    server = new WS('ws://localhost:8765');
    jest.resetModules();
    global.wsConnection = null;
    global.wsReconnectInterval = null;
  });

  afterEach(() => {
    WS.clean();
    if (global.wsReconnectInterval) {
      clearInterval(global.wsReconnectInterval);
    }
  });

  describe('End-to-End Workflows', () => {
    test('should handle complete tab navigation flow', async () => {
      // Setup
      require('../background.js');
      await server.connected;

      // Mock Chrome APIs
      const mockTab = { id: 1, url: 'https://example.com', title: 'Example' };
      chrome.tabs.create.mockResolvedValue(mockTab);
      chrome.tabs.update.mockResolvedValue({});
      chrome.scripting.executeScript.mockResolvedValue([{ result: 'complete' }]);

      // Create tab
      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.create',
        params: { url: 'https://example.com' }
      }));

      let message = await server.nextMessage;
      let response = JSON.parse(message);
      expect(response.result.id).toBe(1);

      // Navigate to new URL
      let updateListener;
      chrome.tabs.onUpdated.addListener.mockImplementation(listener => {
        updateListener = listener;
      });

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.navigate',
        params: { tabId: 1, url: 'https://example.com/page2' }
      }));

      // Simulate tab update completion
      setTimeout(() => {
        if (updateListener) updateListener(1, { status: 'complete' });
      }, 100);

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.result.success).toBe(true);

      // Execute script
      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.executeScript',
        params: { tabId: 1, script: 'return document.readyState;' }
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.result).toBe('complete');
    });

    test('should handle form interaction', async () => {
      require('../background.js');
      await server.connected;

      // Find input field
      chrome.scripting.executeScript.mockResolvedValueOnce([{ 
        result: [{ index: 0, tagName: 'INPUT', id: 'username' }] 
      }]);

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.findElements',
        params: { tabId: 1, selector: 'input[type="text"]' }
      }));

      let message = await server.nextMessage;
      let response = JSON.parse(message);
      expect(response.result.elements).toHaveLength(1);

      // Type into field
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: true }]);

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.type',
        params: { tabId: 1, selector: '#username', text: 'testuser' }
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.result.success).toBe(true);

      // Click submit button
      chrome.scripting.executeScript.mockResolvedValueOnce([{ result: true }]);

      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.click',
        params: { tabId: 1, selector: 'button[type="submit"]' }
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.result.success).toBe(true);
    });

    test('should handle cookie operations', async () => {
      require('../background.js');
      await server.connected;

      // Get cookies
      const cookies = [
        { name: 'session', value: 'abc123', domain: '.example.com' }
      ];
      chrome.cookies.getAll.mockResolvedValue(cookies);

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.getCookies',
        params: { url: 'https://example.com' }
      }));

      let message = await server.nextMessage;
      let response = JSON.parse(message);
      expect(response.result.cookies).toEqual(cookies);

      // Set new cookie
      const newCookie = { name: 'newCookie', value: 'newValue' };
      chrome.cookies.set.mockResolvedValue(newCookie);

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.setCookie',
        params: {
          url: 'https://example.com',
          name: 'newCookie',
          value: 'newValue'
        }
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.result.cookie).toEqual(newCookie);

      // Delete cookie
      chrome.cookies.remove.mockResolvedValue();

      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.deleteCookie',
        params: { url: 'https://example.com', name: 'session' }
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.result.success).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should handle multiple errors gracefully', async () => {
      require('../background.js');
      await server.connected;

      // First error
      chrome.tabs.query.mockRejectedValue(new Error('Permission denied'));

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.list'
      }));

      let message = await server.nextMessage;
      let response = JSON.parse(message);
      expect(response.type).toBe('error');
      expect(response.error).toContain('Permission denied');

      // Second error
      chrome.tabs.create.mockRejectedValue(new Error('Quota exceeded'));

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.create',
        params: { url: 'https://example.com' }
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.type).toBe('error');
      expect(response.error).toContain('Quota exceeded');

      // Recovery - successful command
      chrome.tabs.query.mockResolvedValue([]);

      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.list'
      }));

      message = await server.nextMessage;
      response = JSON.parse(message);
      expect(response.type).toBe('response');
      expect(response.result).toEqual([]);
    });
  });
});