describe('Popup Script', () => {
  let mockDocument;

  beforeEach(() => {
    mockDocument = {
      getElementById: jest.fn((id) => {
        const elements = {
          'statusIndicator': {
            classList: {
              add: jest.fn(),
              remove: jest.fn()
            }
          },
          'statusText': {
            textContent: ''
          },
          'reconnectBtn': {
            disabled: false,
            addEventListener: jest.fn()
          },
          'refreshTabsBtn': {
            addEventListener: jest.fn()
          },
          'tabsList': {
            innerHTML: '',
            appendChild: jest.fn()
          }
        };
        return elements[id];
      }),
      createElement: jest.fn((tag) => ({
        className: '',
        textContent: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn()
      })),
      addEventListener: jest.fn()
    };

    global.document = mockDocument;
    
    chrome.runtime.sendMessage.mockResolvedValue({ connected: true });
    chrome.tabs.query.mockResolvedValue([]);
    
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should set up event listeners on DOMContentLoaded', () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      domContentLoadedHandler();
      
      const reconnectBtn = mockDocument.getElementById('reconnectBtn');
      const refreshTabsBtn = mockDocument.getElementById('refreshTabsBtn');
      
      expect(reconnectBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(refreshTabsBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should check connection status on load', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getConnectionStatus' });
    });

    test('should load tabs on initialization', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });

    test('should set up periodic connection check', () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      domContentLoadedHandler();
      
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe('Connection Status', () => {
    test('should display connected status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ connected: true });
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const statusIndicator = mockDocument.getElementById('statusIndicator');
      const statusText = mockDocument.getElementById('statusText');
      const reconnectBtn = mockDocument.getElementById('reconnectBtn');
      
      expect(statusIndicator.classList.add).toHaveBeenCalledWith('connected');
      expect(statusIndicator.classList.remove).toHaveBeenCalledWith('disconnected');
      expect(statusText.textContent).toBe('Connected');
      expect(reconnectBtn.disabled).toBe(true);
    });

    test('should display disconnected status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ connected: false });
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const statusIndicator = mockDocument.getElementById('statusIndicator');
      const statusText = mockDocument.getElementById('statusText');
      const reconnectBtn = mockDocument.getElementById('reconnectBtn');
      
      expect(statusIndicator.classList.remove).toHaveBeenCalledWith('connected');
      expect(statusIndicator.classList.add).toHaveBeenCalledWith('disconnected');
      expect(statusText.textContent).toBe('Disconnected');
      expect(reconnectBtn.disabled).toBe(false);
    });

    test('should handle connection check errors', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Runtime error'));
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const statusText = mockDocument.getElementById('statusText');
      expect(statusText.textContent).toBe('Disconnected');
    });
  });

  describe('Tab Display', () => {
    test('should display tabs list', async () => {
      const mockTabs = [
        { id: 1, title: 'Tab 1', url: 'https://example.com', windowId: 1 },
        { id: 2, title: 'Tab 2', url: 'https://test.com', windowId: 1 }
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);
      
      const tabItems = [];
      mockDocument.getElementById('tabsList').appendChild = jest.fn((item) => {
        tabItems.push(item);
      });
      
      require('../popup.js');
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(tabItems).toHaveLength(2);
      expect(tabItems[0].textContent).toContain('Tab 1');
      expect(tabItems[1].textContent).toContain('Tab 2');
    });

    test('should display empty state when no tabs', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const tabsList = mockDocument.getElementById('tabsList');
      expect(tabsList.innerHTML).toContain('No tabs found');
    });

    test('should handle tab click to activate', async () => {
      const mockTab = { id: 1, title: 'Test Tab', url: 'https://test.com', windowId: 1 };
      chrome.tabs.query.mockResolvedValue([mockTab]);
      
      let clickHandler;
      const mockTabItem = {
        className: '',
        textContent: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'click') clickHandler = handler;
        })
      };
      mockDocument.createElement.mockReturnValue(mockTabItem);
      
      require('../popup.js');
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      clickHandler();
      
      expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
      expect(chrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    });

    test('should handle tabs with missing title or URL', async () => {
      const mockTabs = [
        { id: 1, title: '', url: '', windowId: 1 },
        { id: 2, title: null, url: null, windowId: 1 }
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);
      
      const tabItems = [];
      mockDocument.getElementById('tabsList').appendChild = jest.fn((item) => {
        tabItems.push(item);
      });
      
      require('../popup.js');
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(tabItems[0].textContent).toContain('Untitled');
      expect(tabItems[1].textContent).toContain('Untitled');
    });
  });

  describe('User Actions', () => {
    test('should handle reconnect button click', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ connected: false });
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const reconnectBtn = mockDocument.getElementById('reconnectBtn');
      const clickHandler = reconnectBtn.addEventListener.mock.calls[0][1];
      
      chrome.runtime.sendMessage.mockClear();
      await clickHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reconnect' });
      expect(reconnectBtn.disabled).toBe(true);
    });

    test('should handle refresh tabs button click', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const refreshBtn = mockDocument.getElementById('refreshTabsBtn');
      const clickHandler = refreshBtn.addEventListener.mock.calls[0][1];
      
      chrome.tabs.query.mockClear();
      chrome.tabs.query.mockResolvedValue([]);
      
      await clickHandler();
      
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });

    test('should handle reconnect errors gracefully', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ connected: false });
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const reconnectBtn = mockDocument.getElementById('reconnectBtn');
      const clickHandler = reconnectBtn.addEventListener.mock.calls[0][1];
      
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Reconnect failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await clickHandler();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error reconnecting:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Runtime Messages', () => {
    test('should update status on connection change message', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      messageListener({ type: 'connectionStatusChanged', connected: true });
      
      const statusText = mockDocument.getElementById('statusText');
      expect(statusText.textContent).toBe('Connected');
      
      messageListener({ type: 'connectionStatusChanged', connected: false });
      expect(statusText.textContent).toBe('Disconnected');
    });
  });

  describe('Periodic Updates', () => {
    test('should check connection status periodically', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      chrome.runtime.sendMessage.mockClear();
      
      jest.advanceTimersByTime(5000);
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getConnectionStatus' });
    });
  });
});