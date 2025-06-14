describe('Content Script', () => {
  let port;
  let mockElement;

  beforeEach(() => {
    // Mock port
    port = {
      postMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn()
      },
      onDisconnect: {
        addListener: jest.fn()
      }
    };
    
    chrome.runtime.connect.mockReturnValue(port);
    
    // Mock DOM element
    mockElement = {
      tagName: 'DIV',
      id: 'test-id',
      className: 'test-class',
      textContent: 'Test content',
      innerHTML: '<span>Test</span>',
      value: 'test value',
      style: {},
      getAttribute: jest.fn(attr => mockElement[attr]),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => []),
      dispatchEvent: jest.fn(),
      getBoundingClientRect: jest.fn(() => ({
        top: 10, right: 110, bottom: 60, left: 10,
        width: 100, height: 50, x: 10, y: 10
      })),
      dataset: { testData: 'value' },
      attributes: [
        { name: 'id', value: 'test-id' },
        { name: 'class', value: 'test-class' }
      ]
    };

    // Mock document methods
    document.querySelector = jest.fn(() => mockElement);
    document.querySelectorAll = jest.fn(() => [mockElement]);
    document.head = { appendChild: jest.fn() };
    document.createElement = jest.fn((tag) => ({ 
      textContent: '',
      id: '',
      style: {},
      remove: jest.fn()
    }));
    
    // Mock window methods
    window.getComputedStyle = jest.fn(() => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1'
    }));

    jest.resetModules();
  });

  describe('Connection Management', () => {
    test('should connect to background script', () => {
      require('../content.js');
      
      // Trigger window load event
      window.dispatchEvent(new Event('load'));
      
      expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'content-script' });
    });
  });

  describe('Message Handling', () => {
    let messageHandler;

    beforeEach(() => {
      require('../content.js');
      window.dispatchEvent(new Event('load'));
      messageHandler = port.onMessage.addListener.mock.calls[0][0];
    });

    test('should get element information', () => {
      messageHandler({
        command: 'getElementInfo',
        params: { selector: '#test-id' },
        id: '1'
      });

      expect(port.postMessage).toHaveBeenCalledWith({
        id: '1',
        type: 'response',
        result: expect.objectContaining({
          tagName: 'DIV',
          id: 'test-id',
          className: 'test-class',
          textContent: 'Test content'
        })
      });
    });

    test('should handle element not found', () => {
      document.querySelector.mockReturnValue(null);

      messageHandler({
        command: 'getElementInfo',
        params: { selector: '#missing' },
        id: '2'
      });

      expect(port.postMessage).toHaveBeenCalledWith({
        id: '2',
        type: 'error',
        error: 'Element not found'
      });
    });

    test('should highlight elements', () => {
      messageHandler({
        command: 'highlightElement',
        params: { selector: '.test-class' },
        id: '3'
      });

      expect(mockElement.style.outline).toBe('2px solid red');
      expect(port.postMessage).toHaveBeenCalledWith({
        id: '3',
        type: 'response',
        result: { count: 1 }
      });
    });

    test('should simulate events', () => {
      messageHandler({
        command: 'simulateEvent',
        params: { 
          selector: '#test-id',
          eventType: 'click'
        },
        id: '4'
      });

      expect(mockElement.dispatchEvent).toHaveBeenCalled();
      expect(port.postMessage).toHaveBeenCalledWith({
        id: '4',
        type: 'response',
        result: { success: true }
      });
    });

    test('should extract structured data', () => {
      const row1 = {
        querySelector: jest.fn(selector => {
          if (selector === '.name') return { textContent: 'John' };
          if (selector === '.age') return { textContent: '30' };
          return null;
        })
      };
      
      document.querySelectorAll.mockReturnValue([row1]);

      messageHandler({
        command: 'extractStructuredData',
        params: {
          rowSelector: 'tr',
          columnSelectors: {
            name: '.name',
            age: '.age'
          }
        },
        id: '5'
      });

      expect(port.postMessage).toHaveBeenCalledWith({
        id: '5',
        type: 'response',
        result: {
          data: [{ name: 'John', age: '30' }]
        }
      });
    });

    test('should inject CSS', () => {
      const styleElement = { textContent: '', id: '' };
      document.createElement.mockReturnValue(styleElement);

      messageHandler({
        command: 'injectCSS',
        params: { css: 'body { color: red; }' },
        id: '6'
      });

      expect(document.head.appendChild).toHaveBeenCalledWith(styleElement);
      expect(port.postMessage).toHaveBeenCalledWith({
        id: '6',
        type: 'response',
        result: { styleId: expect.stringContaining('injected-style-') }
      });
    });
  });
});