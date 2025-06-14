import WS from 'jest-websocket-mock';

describe('Background Script', () => {
  let server;
  let backgroundScript;

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

  describe('WebSocket Connection', () => {
    test('should connect to WebSocket server on startup', async () => {
      require('../background.js');
      await server.connected;
      expect(server).toHaveReceivedMessages([
        JSON.stringify({ type: 'connected', version: '1.0.0' })
      ]);
    });

    test('should handle connection errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      require('../background.js');
      
      server.error();
      
      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('should attempt reconnection when disconnected', async () => {
      jest.useFakeTimers();
      require('../background.js');
      await server.connected;
      
      server.close();
      
      jest.advanceTimersByTime(5000);
      expect(WebSocket).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });

  describe('Command Handlers', () => {
    beforeEach(async () => {
      require('../background.js');
      await server.connected;
    });

    describe('tabs.list', () => {
      test('should list all tabs', async () => {
        const mockTabs = [
          { id: 1, url: 'https://example.com', title: 'Example', active: true },
          { id: 2, url: 'https://test.com', title: 'Test', active: false }
        ];
        chrome.tabs.query.mockResolvedValue(mockTabs);

        server.send(JSON.stringify({
          id: '1',
          command: 'tabs.list',
          params: {}
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"type":"response"')
        );
        
        const response = JSON.parse(await server.nextMessage);
        expect(response.id).toBe('1');
        expect(response.result).toHaveLength(2);
        expect(response.result[0].url).toBe('https://example.com');
      });
    });

    describe('tabs.create', () => {
      test('should create a new tab', async () => {
        const newTab = { id: 3, url: 'https://new.com', title: 'New Tab' };
        chrome.tabs.create.mockResolvedValue(newTab);

        server.send(JSON.stringify({
          id: '2',
          command: 'tabs.create',
          params: { url: 'https://new.com' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"type":"response"')
        );

        const response = JSON.parse(await server.nextMessage);
        expect(response.result).toEqual({
          id: 3,
          url: 'https://new.com',
          title: 'New Tab'
        });
        expect(chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://new.com',
          active: true,
          windowId: undefined,
          index: undefined,
          pinned: undefined
        });
      });
    });

    describe('tabs.close', () => {
      test('should close a tab', async () => {
        chrome.tabs.remove.mockResolvedValue();

        server.send(JSON.stringify({
          id: '3',
          command: 'tabs.close',
          params: { tabId: 1 }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );

        expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
      });
    });

    describe('tabs.navigate', () => {
      test('should navigate to a URL', async () => {
        chrome.tabs.update.mockResolvedValue({});
        let updateListener;
        chrome.tabs.onUpdated.addListener.mockImplementation(listener => {
          updateListener = listener;
        });

        server.send(JSON.stringify({
          id: '4',
          command: 'tabs.navigate',
          params: { tabId: 1, url: 'https://navigate.com' }
        }));

        setTimeout(() => {
          updateListener(1, { status: 'complete' });
        }, 100);

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );

        expect(chrome.tabs.update).toHaveBeenCalledWith(1, { url: 'https://navigate.com' });
      });
    });

    describe('tabs.executeScript', () => {
      test('should execute script in tab', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: 'test result' }]);

        server.send(JSON.stringify({
          id: '5',
          command: 'tabs.executeScript',
          params: { tabId: 1, script: 'return document.title;' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"result":"test result"')
        );

        expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
          target: { tabId: 1 },
          func: expect.any(Function),
          world: 'ISOLATED'
        });
      });
    });

    describe('tabs.captureScreenshot', () => {
      test('should capture screenshot', async () => {
        const dataUrl = 'data:image/png;base64,screenshot';
        chrome.tabs.captureVisibleTab.mockResolvedValue(dataUrl);

        server.send(JSON.stringify({
          id: '6',
          command: 'tabs.captureScreenshot',
          params: { windowId: 1 }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"dataUrl":"data:image/png;base64,screenshot"')
        );

        expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
          format: 'png',
          quality: 100
        });
      });
    });

    describe('tabs.findElements', () => {
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

        await expect(server).toReceiveMessage(
          expect.stringContaining('"elements"')
        );

        const response = JSON.parse(await server.nextMessage);
        expect(response.result.elements).toEqual(elements);
      });
    });

    describe('tabs.click', () => {
      test('should click element', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

        server.send(JSON.stringify({
          id: '8',
          command: 'tabs.click',
          params: { tabId: 1, selector: '#button' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );
      });
    });

    describe('tabs.type', () => {
      test('should type text into element', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

        server.send(JSON.stringify({
          id: '9',
          command: 'tabs.type',
          params: { tabId: 1, selector: '#input', text: 'Hello' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );
      });
    });

    describe('tabs.scroll', () => {
      test('should scroll to position', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: { x: 0, y: 100 } }]);

        server.send(JSON.stringify({
          id: '10',
          command: 'tabs.scroll',
          params: { tabId: 1, y: 100 }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"x":0')
        );
      });
    });

    describe('tabs.waitForElement', () => {
      test('should wait for element to appear', async () => {
        chrome.scripting.executeScript
          .mockResolvedValueOnce([{ result: false }])
          .mockResolvedValueOnce([{ result: false }])
          .mockResolvedValueOnce([{ result: true }]);

        server.send(JSON.stringify({
          id: '11',
          command: 'tabs.waitForElement',
          params: { tabId: 1, selector: '#delayed' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"found":true')
        );
      });

      test('should timeout if element not found', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: false }]);

        server.send(JSON.stringify({
          id: '12',
          command: 'tabs.waitForElement',
          params: { tabId: 1, selector: '#missing', timeout: 500 }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"found":false')
        );
      });
    });

    describe('Cookie Management', () => {
      test('should get cookies', async () => {
        const cookies = [{ name: 'test', value: 'cookie' }];
        chrome.cookies.getAll.mockResolvedValue(cookies);

        server.send(JSON.stringify({
          id: '13',
          command: 'tabs.getCookies',
          params: { url: 'https://example.com' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"cookies"')
        );
      });

      test('should set cookie', async () => {
        const cookie = { name: 'test', value: 'cookie' };
        chrome.cookies.set.mockResolvedValue(cookie);

        server.send(JSON.stringify({
          id: '14',
          command: 'tabs.setCookie',
          params: { url: 'https://example.com', name: 'test', value: 'cookie' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"cookie"')
        );
      });

      test('should delete cookie', async () => {
        chrome.cookies.remove.mockResolvedValue();

        server.send(JSON.stringify({
          id: '15',
          command: 'tabs.deleteCookie',
          params: { url: 'https://example.com', name: 'test' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );
      });
    });

    describe('LocalStorage Management', () => {
      test('should get localStorage', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ 
          result: { key: 'value' } 
        }]);

        server.send(JSON.stringify({
          id: '16',
          command: 'tabs.getLocalStorage',
          params: { tabId: 1 }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"storage"')
        );
      });

      test('should set localStorage', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

        server.send(JSON.stringify({
          id: '17',
          command: 'tabs.setLocalStorage',
          params: { tabId: 1, key: 'test', value: 'value' }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );
      });

      test('should clear localStorage', async () => {
        chrome.scripting.executeScript.mockResolvedValue([{ result: true }]);

        server.send(JSON.stringify({
          id: '18',
          command: 'tabs.clearLocalStorage',
          params: { tabId: 1 }
        }));

        await expect(server).toReceiveMessage(
          expect.stringContaining('"success":true')
        );
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      require('../background.js');
      await server.connected;
    });

    test('should handle missing command', async () => {
      server.send(JSON.stringify({
        id: '19',
        params: {}
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Command not specified"')
      );
    });

    test('should handle unknown command', async () => {
      server.send(JSON.stringify({
        id: '20',
        command: 'unknown.command',
        params: {}
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Unknown command: unknown.command"')
      );
    });

    test('should handle command execution errors', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Tab query failed'));

      server.send(JSON.stringify({
        id: '21',
        command: 'tabs.list',
        params: {}
      }));

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error":"Tab query failed"')
      );
    });

    test('should handle malformed messages', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      server.send('invalid json');

      await expect(server).toReceiveMessage(
        expect.stringContaining('"error"')
      );
      
      expect(consoleSpy).toHaveBeenCalledWith('Error handling message:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});