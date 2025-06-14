describe('Popup Script', () => {
  let mockDocument;
  let elements;

  beforeEach(() => {
    // Create mock elements
    elements = {
      statusIndicator: {
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        }
      },
      statusText: {
        textContent: ''
      },
      reconnectBtn: {
        disabled: false,
        addEventListener: jest.fn()
      },
      refreshTabsBtn: {
        addEventListener: jest.fn()
      },
      tabsList: {
        innerHTML: '',
        appendChild: jest.fn()
      }
    };

    // Mock document
    mockDocument = {
      getElementById: jest.fn((id) => {
        const elementMap = {
          'statusIndicator': elements.statusIndicator,
          'statusText': elements.statusText,
          'reconnectBtn': elements.reconnectBtn,
          'refreshTabsBtn': elements.refreshTabsBtn,
          'tabsList': elements.tabsList
        };
        return elementMap[id];
      }),
      createElement: jest.fn(() => ({
        className: '',
        textContent: '',
        appendChild: jest.fn(),
        addEventListener: jest.fn()
      })),
      addEventListener: jest.fn()
    };

    global.document = mockDocument;
    
    // Mock Chrome APIs
    chrome.runtime.sendMessage.mockResolvedValue({ connected: true });
    chrome.tabs.query.mockResolvedValue([]);
    chrome.runtime.onMessage.addListener.mockClear();
  });

  describe('Initialization', () => {
    test('should set up event listeners', () => {
      require('../popup.js');
      
      // Simulate DOMContentLoaded
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      domContentLoadedHandler();
      
      expect(elements.reconnectBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(elements.refreshTabsBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should check connection status', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'getConnectionStatus' });
    });
  });

  describe('Connection Status', () => {
    test('should display connected status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ connected: true });
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(elements.statusIndicator.classList.add).toHaveBeenCalledWith('connected');
      expect(elements.statusText.textContent).toBe('Connected');
      expect(elements.reconnectBtn.disabled).toBe(true);
    });

    test('should display disconnected status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ connected: false });
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(elements.statusIndicator.classList.add).toHaveBeenCalledWith('disconnected');
      expect(elements.statusText.textContent).toBe('Disconnected');
      expect(elements.reconnectBtn.disabled).toBe(false);
    });
  });

  describe('Tab Display', () => {
    test('should display tabs', async () => {
      const mockTabs = [
        { id: 1, title: 'Tab 1', url: 'https://example.com', windowId: 1 }
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);
      
      require('../popup.js');
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(elements.tabsList.appendChild).toHaveBeenCalled();
    });

    test('should display empty state', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      expect(elements.tabsList.innerHTML).toContain('No tabs found');
    });
  });

  describe('User Actions', () => {
    test('should handle reconnect', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const reconnectHandler = elements.reconnectBtn.addEventListener.mock.calls[0][1];
      await reconnectHandler();
      
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reconnect' });
    });

    test('should handle refresh tabs', async () => {
      require('../popup.js');
      
      const domContentLoadedHandler = mockDocument.addEventListener.mock.calls[0][1];
      await domContentLoadedHandler();
      
      const refreshHandler = elements.refreshTabsBtn.addEventListener.mock.calls[0][1];
      chrome.tabs.query.mockClear();
      
      await refreshHandler();
      
      expect(chrome.tabs.query).toHaveBeenCalledWith({});
    });
  });
});