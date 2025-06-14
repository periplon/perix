import WS from 'jest-websocket-mock';

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

  describe('End-to-End Scenarios', () => {
    test('should handle complete tab navigation flow', async () => {
      require('../background.js');
      await server.connected;

      const mockTab = { id: 1, url: 'https://example.com', title: 'Example' };
      chrome.tabs.create.mockResolvedValue(mockTab);
      chrome.tabs.update.mockResolvedValue({});
      chrome.scripting.executeScript.mockResolvedValue([{ result: 'Page loaded' }]);
      
      let updateListener;
      chrome.tabs.onUpdated.addListener.mockImplementation(listener => {
        updateListener = listener;
      });

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.create',
        params: { url: 'https://example.com' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"result":{"id":1')
      );

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.navigate',
        params: { tabId: 1, url: 'https://example.com/page2' }
      }));

      setTimeout(() => {
        updateListener(1, { status: 'complete' });
      }, 100);

      await expect(server).toReceiveMessage(
        expect.stringContaining('"success":true')
      );

      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.executeScript',
        params: { tabId: 1, script: 'return document.readyState;' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"result":"Page loaded"')
      );
    });

    test('should handle form interaction flow', async () => {
      require('../background.js');
      await server.connected;

      chrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: [{ index: 0, tagName: 'INPUT' }] }])
        .mockResolvedValueOnce([{ result: true }])
        .mockResolvedValueOnce([{ result: true }])
        .mockResolvedValueOnce([{ result: true }]);

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.findElements',
        params: { tabId: 1, selector: 'input[type="text"]' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"elements":[{"index":0')
      );

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.type',
        params: { tabId: 1, selector: 'input[type="text"]', text: 'Test input' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"success":true')
      );

      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.click',
        params: { tabId: 1, selector: 'button[type="submit"]' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"success":true')
      );

      server.send(JSON.stringify({
        id: '4',
        command: 'tabs.waitForElement',
        params: { tabId: 1, selector: '.success-message', timeout: 5000 }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"found":true')
      );
    });

    test('should handle data extraction flow', async () => {
      require('../background.js');
      await server.connected;

      const extractedText = 'Product: Test Item\nPrice: $99.99';
      const structuredData = [
        { name: 'Item 1', price: '$10' },
        { name: 'Item 2', price: '$20' }
      ];

      chrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: extractedText }])
        .mockResolvedValueOnce([{ result: structuredData }]);

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.extractText',
        params: { tabId: 1, selector: '.product-details' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining(extractedText)
      );

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.executeScript',
        params: {
          tabId: 1,
          script: `
            const rows = document.querySelectorAll('.product-row');
            return Array.from(rows).map(row => ({
              name: row.querySelector('.name').textContent,
              price: row.querySelector('.price').textContent
            }));
          `
        }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"name":"Item 1"')
      );
    });

    test('should handle cookie and storage management', async () => {
      require('../background.js');
      await server.connected;

      const cookies = [
        { name: 'session', value: 'abc123', domain: '.example.com' }
      ];
      chrome.cookies.getAll.mockResolvedValue(cookies);
      chrome.cookies.set.mockResolvedValue(cookies[0]);
      chrome.cookies.remove.mockResolvedValue();
      chrome.scripting.executeScript
        .mockResolvedValueOnce([{ result: { key1: 'value1' } }])
        .mockResolvedValueOnce([{ result: true }])
        .mockResolvedValueOnce([{ result: true }]);

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.getCookies',
        params: { url: 'https://example.com' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"cookies":[{"name":"session"')
      );

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.setCookie',
        params: {
          url: 'https://example.com',
          name: 'newCookie',
          value: 'newValue'
        }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"cookie":')
      );

      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.getLocalStorage',
        params: { tabId: 1 }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"storage":{"key1":"value1"}')
      );

      server.send(JSON.stringify({
        id: '4',
        command: 'tabs.setLocalStorage',
        params: { tabId: 1, key: 'key2', value: 'value2' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"success":true')
      );

      server.send(JSON.stringify({
        id: '5',
        command: 'tabs.clearLocalStorage',
        params: { tabId: 1 }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"success":true')
      );
    });

    test('should handle screenshot and video capture', async () => {
      require('../background.js');
      await server.connected;

      const screenshotData = 'data:image/png;base64,iVBORw0KGgo...';
      chrome.tabs.captureVisibleTab.mockResolvedValue(screenshotData);
      
      let captureCallback;
      chrome.tabCapture.capture.mockImplementation((options, callback) => {
        captureCallback = callback;
        setTimeout(() => callback({ id: 'stream123' }), 0);
      });

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.captureScreenshot',
        params: { windowId: 1, format: 'png', quality: 90 }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"dataUrl":"data:image/png;base64,iVBORw0KGgo')
      );

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.captureVideo',
        params: {
          audio: false,
          video: true,
          width: 1920,
          height: 1080,
          frameRate: 30
        }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"streamId":"stream123"')
      );
    });
  });

  describe('Error Recovery', () => {
    test('should handle multiple errors gracefully', async () => {
      require('../background.js');
      await server.connected;

      chrome.tabs.query.mockRejectedValue(new Error('Permission denied'));
      chrome.tabs.create.mockRejectedValue(new Error('Quota exceeded'));

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.list'
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Permission denied"')
      );

      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.create',
        params: { url: 'https://example.com' }
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Quota exceeded"')
      );

      chrome.tabs.query.mockResolvedValue([]);
      
      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.list'
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"result":[]')
      );
    });

    test('should maintain connection after command errors', async () => {
      require('../background.js');
      await server.connected;

      server.send('invalid json');
      server.send(JSON.stringify({ id: '2' }));
      server.send(JSON.stringify({ id: '3', command: 'invalid.command' }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error"')
      );
      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Command not specified"')
      );
      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Unknown command: invalid.command"')
      );

      chrome.tabs.query.mockResolvedValue([]);
      server.send(JSON.stringify({
        id: '4',
        command: 'tabs.list'
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"result":[]')
      );
    });
  });

  describe('Performance', () => {
    test('should handle rapid command sequences', async () => {
      require('../background.js');
      await server.connected;

      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({ id: 1 });
      chrome.tabs.update.mockResolvedValue({});
      chrome.tabs.remove.mockResolvedValue();

      const commands = [];
      for (let i = 0; i < 10; i++) {
        commands.push({
          id: String(i),
          command: i % 2 === 0 ? 'tabs.list' : 'tabs.create',
          params: i % 2 === 0 ? {} : { url: `https://example${i}.com` }
        });
      }

      commands.forEach(cmd => {
        server.send(JSON.stringify(cmd));
      });

      for (let i = 0; i < 10; i++) {
        await expect(server).toReceiveMessage(
          expect.stringContaining(`"id":"${i}"`)
        );
      }
    });

    test('should handle concurrent operations', async () => {
      require('../background.js');
      await server.connected;

      const results = {
        tabs: [{ id: 1 }, { id: 2 }],
        cookies: [{ name: 'test' }],
        screenshot: 'data:image/png;base64,test'
      };

      chrome.tabs.query.mockResolvedValue(results.tabs);
      chrome.cookies.getAll.mockResolvedValue(results.cookies);
      chrome.tabs.captureVisibleTab.mockResolvedValue(results.screenshot);

      server.send(JSON.stringify({
        id: '1',
        command: 'tabs.list'
      }));
      server.send(JSON.stringify({
        id: '2',
        command: 'tabs.getCookies',
        params: { url: 'https://example.com' }
      }));
      server.send(JSON.stringify({
        id: '3',
        command: 'tabs.captureScreenshot',
        params: { windowId: 1 }
      }));

      const messages = [];
      for (let i = 0; i < 3; i++) {
        messages.push(JSON.parse(await server.nextMessage));
      }

      expect(messages.some(m => m.id === '1' && m.result.length === 2)).toBe(true);
      expect(messages.some(m => m.id === '2' && m.result.cookies.length === 1)).toBe(true);
      expect(messages.some(m => m.id === '3' && m.result.dataUrl)).toBe(true);
    });
  });
});