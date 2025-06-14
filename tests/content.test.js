describe('Content Script', () => {
  let port;
  let mockElement;

  beforeEach(() => {
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
    
    mockElement = {
      tagName: 'DIV',
      id: 'test-id',
      className: 'test-class',
      textContent: 'Test content',
      innerHTML: '<span>Test</span>',
      value: 'test value',
      href: 'https://example.com',
      src: 'image.png',
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

    document.querySelector = jest.fn(() => mockElement);
    document.querySelectorAll = jest.fn(() => [mockElement]);
    document.head = { appendChild: jest.fn() };
    document.body = { textContent: 'Body text' };
    
    window.getComputedStyle = jest.fn(() => ({
      display: 'block',
      visibility: 'visible',
      position: 'relative',
      zIndex: '1',
      opacity: '1'
    }));

    jest.resetModules();
  });

  describe('Connection Management', () => {
    test('should connect to background script on load', () => {
      require('../content.js');
      
      window.dispatchEvent(new Event('load'));
      
      expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: 'content-script' });
    });

    test('should reconnect on disconnect', () => {
      jest.useFakeTimers();
      require('../content.js');
      
      window.dispatchEvent(new Event('load'));
      const disconnectHandler = port.onDisconnect.addListener.mock.calls[0][0];
      
      disconnectHandler();
      
      jest.advanceTimersByTime(1000);
      expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });
  });

  describe('Message Handling', () => {
    let messageHandler;

    beforeEach(() => {
      require('../content.js');
      window.dispatchEvent(new Event('load'));
      messageHandler = port.onMessage.addListener.mock.calls[0][0];
    });

    describe('getElementInfo', () => {
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
            textContent: 'Test content',
            isVisible: true
          })
        });
      });

      test('should include styles when requested', () => {
        messageHandler({
          command: 'getElementInfo',
          params: { selector: '#test-id', includeStyles: true },
          id: '2'
        });

        const call = port.postMessage.mock.calls[0][0];
        expect(call.result.styles).toBeDefined();
        expect(call.result.styles.display).toBe('block');
      });

      test('should handle element not found', () => {
        document.querySelector.mockReturnValue(null);

        messageHandler({
          command: 'getElementInfo',
          params: { selector: '#missing' },
          id: '3'
        });

        expect(port.postMessage).toHaveBeenCalledWith({
          id: '3',
          type: 'error',
          error: 'Element not found'
        });
      });
    });

    describe('highlightElement', () => {
      test('should highlight elements', () => {
        messageHandler({
          command: 'highlightElement',
          params: { selector: '.test-class' },
          id: '4'
        });

        expect(mockElement.style.outline).toBe('2px solid red');
        expect(port.postMessage).toHaveBeenCalledWith({
          id: '4',
          type: 'response',
          result: { count: 1 }
        });
      });

      test('should remove highlight after duration', () => {
        jest.useFakeTimers();
        
        messageHandler({
          command: 'highlightElement',
          params: { selector: '.test-class', duration: 1000 },
          id: '5'
        });

        expect(mockElement.style.outline).toBe('2px solid red');
        
        jest.advanceTimersByTime(1000);
        
        expect(mockElement.style.outline).toBe('');
        jest.useRealTimers();
      });

      test('should apply custom styles', () => {
        messageHandler({
          command: 'highlightElement',
          params: { 
            selector: '.test-class',
            outline: '3px dashed blue',
            backgroundColor: 'yellow'
          },
          id: '6'
        });

        expect(mockElement.style.outline).toBe('3px dashed blue');
        expect(mockElement.style.backgroundColor).toBe('yellow');
      });
    });

    describe('simulateEvent', () => {
      test('should simulate mouse events', () => {
        messageHandler({
          command: 'simulateEvent',
          params: { 
            selector: '#test-id',
            eventType: 'mousedown',
            options: { button: 0 }
          },
          id: '7'
        });

        expect(mockElement.dispatchEvent).toHaveBeenCalled();
        const event = mockElement.dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('mousedown');
        expect(event.bubbles).toBe(true);
      });

      test('should simulate keyboard events', () => {
        messageHandler({
          command: 'simulateEvent',
          params: { 
            selector: '#test-id',
            eventType: 'keydown',
            options: { key: 'Enter' }
          },
          id: '8'
        });

        const event = mockElement.dispatchEvent.mock.calls[0][0];
        expect(event.type).toBe('keydown');
        expect(event.key).toBe('Enter');
      });

      test('should handle element not found', () => {
        document.querySelector.mockReturnValue(null);

        messageHandler({
          command: 'simulateEvent',
          params: { selector: '#missing', eventType: 'click' },
          id: '9'
        });

        expect(port.postMessage).toHaveBeenCalledWith({
          id: '9',
          type: 'error',
          error: 'Element not found'
        });
      });
    });

    describe('extractStructuredData', () => {
      test('should extract data from table rows', () => {
        const row1 = {
          querySelector: jest.fn(selector => {
            if (selector === '.name') return { textContent: 'John' };
            if (selector === '.age') return { textContent: '30' };
            return null;
          })
        };
        const row2 = {
          querySelector: jest.fn(selector => {
            if (selector === '.name') return { textContent: 'Jane' };
            if (selector === '.age') return { textContent: '25' };
            return null;
          })
        };
        
        document.querySelectorAll.mockReturnValue([row1, row2]);

        messageHandler({
          command: 'extractStructuredData',
          params: {
            rowSelector: 'tr',
            columnSelectors: {
              name: '.name',
              age: '.age'
            }
          },
          id: '10'
        });

        expect(port.postMessage).toHaveBeenCalledWith({
          id: '10',
          type: 'response',
          result: {
            data: [
              { name: 'John', age: '30' },
              { name: 'Jane', age: '25' }
            ]
          }
        });
      });

      test('should extract attributes when specified', () => {
        const row = {
          querySelector: jest.fn(() => ({
            getAttribute: jest.fn(() => 'attr-value'),
            textContent: 'text-value'
          }))
        };
        
        document.querySelectorAll.mockReturnValue([row]);

        messageHandler({
          command: 'extractStructuredData',
          params: {
            rowSelector: 'tr',
            columnSelectors: { data: '.cell' },
            extractAttribute: 'data-value'
          },
          id: '11'
        });

        const result = port.postMessage.mock.calls[0][0].result.data[0];
        expect(result.data).toBe('attr-value');
      });
    });

    describe('observeMutations', () => {
      let MutationObserverMock;
      let observerInstance;

      beforeEach(() => {
        observerInstance = {
          observe: jest.fn(),
          disconnect: jest.fn()
        };
        MutationObserverMock = jest.fn(() => observerInstance);
        global.MutationObserver = MutationObserverMock;
      });

      test('should observe mutations on target element', () => {
        messageHandler({
          command: 'observeMutations',
          params: { selector: '#test-id' },
          id: '12'
        });

        expect(MutationObserverMock).toHaveBeenCalled();
        expect(observerInstance.observe).toHaveBeenCalledWith(
          mockElement,
          expect.objectContaining({
            attributes: true,
            childList: true,
            subtree: true
          })
        );
      });

      test('should observe body when no selector provided', () => {
        messageHandler({
          command: 'observeMutations',
          params: {},
          id: '13'
        });

        expect(observerInstance.observe).toHaveBeenCalledWith(
          document.body,
          expect.any(Object)
        );
      });

      test('should disconnect after timeout', () => {
        jest.useFakeTimers();
        
        messageHandler({
          command: 'observeMutations',
          params: { timeout: 1000 },
          id: '14'
        });

        jest.advanceTimersByTime(1000);
        
        expect(observerInstance.disconnect).toHaveBeenCalled();
        jest.useRealTimers();
      });

      test('should disconnect after max mutations', () => {
        messageHandler({
          command: 'observeMutations',
          params: { maxMutations: 2 },
          id: '15'
        });

        const callback = MutationObserverMock.mock.calls[0][0];
        
        callback([
          { type: 'attributes', target: mockElement },
          { type: 'childList', target: mockElement },
          { type: 'attributes', target: mockElement }
        ]);

        expect(observerInstance.disconnect).toHaveBeenCalled();
      });
    });

    describe('CSS Injection', () => {
      test('should inject CSS', () => {
        const styleElement = { textContent: '' };
        document.createElement = jest.fn(() => styleElement);

        messageHandler({
          command: 'injectCSS',
          params: { css: 'body { color: red; }' },
          id: '16'
        });

        expect(styleElement.textContent).toBe('body { color: red; }');
        expect(document.head.appendChild).toHaveBeenCalledWith(styleElement);
        expect(port.postMessage).toHaveBeenCalledWith({
          id: '16',
          type: 'response',
          result: { styleId: expect.stringContaining('injected-style-') }
        });
      });

      test('should update existing CSS with same ID', () => {
        const styleElement = { textContent: 'old css' };
        document.createElement = jest.fn(() => styleElement);

        messageHandler({
          command: 'injectCSS',
          params: { css: 'new css', id: 'custom-id' },
          id: '17'
        });

        messageHandler({
          command: 'injectCSS',
          params: { css: 'updated css', id: 'custom-id' },
          id: '18'
        });

        expect(styleElement.textContent).toBe('updated css');
        expect(document.head.appendChild).toHaveBeenCalledTimes(1);
      });

      test('should remove CSS', () => {
        const styleElement = { remove: jest.fn() };
        document.createElement = jest.fn(() => styleElement);

        messageHandler({
          command: 'injectCSS',
          params: { css: 'test', id: 'test-style' },
          id: '19'
        });

        messageHandler({
          command: 'removeCSS',
          params: { styleId: 'test-style' },
          id: '20'
        });

        expect(styleElement.remove).toHaveBeenCalled();
        expect(port.postMessage).toHaveBeenCalledWith({
          id: '20',
          type: 'response',
          result: { success: true }
        });
      });

      test('should handle removing non-existent style', () => {
        messageHandler({
          command: 'removeCSS',
          params: { styleId: 'non-existent' },
          id: '21'
        });

        expect(port.postMessage).toHaveBeenCalledWith({
          id: '21',
          type: 'error',
          error: 'Style not found'
        });
      });
    });
  });
});