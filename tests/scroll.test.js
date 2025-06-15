// Test for scroll functionality

// Import the handleScroll function
async function handleScroll(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (x, y, selector, behavior) => {
      try {
        // If selector is provided, scroll to that element
        if (selector) {
          const element = document.querySelector(selector);
          if (!element) {
            throw new Error(`Element not found: ${selector}`);
          }
          element.scrollIntoView({
            behavior: behavior || 'smooth',
            block: 'center',
            inline: 'center'
          });
        } else {
          // Otherwise use x,y coordinates
          window.scrollTo({
            left: x !== undefined ? x : window.scrollX,
            top: y !== undefined ? y : window.scrollY,
            behavior: behavior || 'smooth'
          });
        }
        
        // Return the new scroll position
        return { 
          x: window.scrollX || window.pageXOffset || 0, 
          y: window.scrollY || window.pageYOffset || 0 
        };
      } catch (error) {
        throw new Error(`Scroll failed: ${error.message}`);
      }
    },
    args: [params.x, params.y, params.selector, params.behavior]
  });
  
  if (results[0]?.error) {
    throw new Error(results[0].error);
  }
  
  return results[0]?.result;
}

describe('handleScroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should scroll to x,y coordinates', async () => {
    const mockResult = { x: 100, y: 500 };
    chrome.scripting.executeScript.mockResolvedValue([{ result: mockResult }]);

    const params = {
      tabId: 123,
      x: 100,
      y: 500,
      behavior: 'smooth'
    };

    const result = await handleScroll(params);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 123 },
      func: expect.any(Function),
      args: [100, 500, undefined, 'smooth']
    });

    expect(result).toEqual(mockResult);
  });

  test('should scroll to element by selector', async () => {
    const mockResult = { x: 0, y: 300 };
    chrome.scripting.executeScript.mockResolvedValue([{ result: mockResult }]);

    const params = {
      tabId: 123,
      selector: '#target-element',
      behavior: 'smooth'
    };

    const result = await handleScroll(params);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 123 },
      func: expect.any(Function),
      args: [undefined, undefined, '#target-element', 'smooth']
    });

    expect(result).toEqual(mockResult);
  });

  test('should handle scroll without coordinates (maintain position)', async () => {
    const mockResult = { x: 50, y: 100 };
    chrome.scripting.executeScript.mockResolvedValue([{ result: mockResult }]);

    const params = {
      tabId: 123,
      behavior: 'instant'
    };

    const result = await handleScroll(params);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 123 },
      func: expect.any(Function),
      args: [undefined, undefined, undefined, 'instant']
    });

    expect(result).toEqual(mockResult);
  });

  test('should throw error when element not found', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{ 
      error: new Error('Element not found: #non-existent') 
    }]);

    const params = {
      tabId: 123,
      selector: '#non-existent'
    };

    await expect(handleScroll(params)).rejects.toThrow('Element not found: #non-existent');
  });

  test('should default to smooth behavior', async () => {
    const mockResult = { x: 0, y: 0 };
    chrome.scripting.executeScript.mockResolvedValue([{ result: mockResult }]);

    const params = {
      tabId: 123,
      x: 0,
      y: 0
    };

    await handleScroll(params);

    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 123 },
      func: expect.any(Function),
      args: [0, 0, undefined, undefined]
    });
  });
});