const WS = require('jest-websocket-mock').default;

describe('tabs.sendKey', () => {
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

  test('should send key to focused element', async () => {
    require('../background.js');
    await server.connected;

    // Mock Chrome API
    chrome.scripting.executeScript.mockResolvedValueOnce([{ 
      result: { success: true }
    }]);

    server.send(JSON.stringify({
      id: '1',
      command: 'tabs.sendKey',
      params: { tabId: 1, key: 'a' }
    }));

    const message = await server.nextMessage;
    const response = JSON.parse(message);
    
    expect(response.result.success).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      func: expect.any(Function),
      args: [undefined, 'a', undefined]
    });
  });

  test('should send key to specific element', async () => {
    require('../background.js');
    await server.connected;

    chrome.scripting.executeScript.mockResolvedValueOnce([{ 
      result: { success: true }
    }]);

    server.send(JSON.stringify({
      id: '2',
      command: 'tabs.sendKey',
      params: { 
        tabId: 1, 
        selector: '#username',
        key: 'Enter' 
      }
    }));

    const message = await server.nextMessage;
    const response = JSON.parse(message);
    
    expect(response.result.success).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      func: expect.any(Function),
      args: ['#username', 'Enter', undefined]
    });
  });

  test('should send key with modifiers', async () => {
    require('../background.js');
    await server.connected;

    chrome.scripting.executeScript.mockResolvedValueOnce([{ 
      result: { success: true }
    }]);

    server.send(JSON.stringify({
      id: '3',
      command: 'tabs.sendKey',
      params: { 
        tabId: 1, 
        key: 'a',
        modifiers: ['ctrl', 'shift']
      }
    }));

    const message = await server.nextMessage;
    const response = JSON.parse(message);
    
    expect(response.result.success).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      func: expect.any(Function),
      args: [undefined, 'a', ['ctrl', 'shift']]
    });
  });

  test('should handle element not found', async () => {
    require('../background.js');
    await server.connected;

    chrome.scripting.executeScript.mockResolvedValueOnce([{ 
      result: { success: false, error: 'No element found' }
    }]);

    server.send(JSON.stringify({
      id: '4',
      command: 'tabs.sendKey',
      params: { 
        tabId: 1,
        selector: '#nonexistent',
        key: 'x'
      }
    }));

    const message = await server.nextMessage;
    const response = JSON.parse(message);
    
    expect(response.result.success).toBe(false);
    expect(response.result.error).toBe('No element found');
  });

  test('should handle script execution failure', async () => {
    require('../background.js');
    await server.connected;

    chrome.scripting.executeScript.mockResolvedValueOnce([null]);

    server.send(JSON.stringify({
      id: '5',
      command: 'tabs.sendKey',
      params: { 
        tabId: 1,
        key: 'a'
      }
    }));

    const message = await server.nextMessage;
    const response = JSON.parse(message);
    
    expect(response.result.success).toBe(false);
    expect(response.result.error).toBe('Script execution failed');
  });
});