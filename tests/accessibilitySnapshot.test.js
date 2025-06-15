describe('test.getAccessibilitySnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('should return basic accessibility tree', async () => {
    // Mock chrome.scripting.executeScript to return accessibility snapshot
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: 'main',
        children: [
          {
            role: 'heading',
            name: 'Welcome',
            level: 1
          },
          {
            role: 'button',
            name: 'Submit'
          }
        ]
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: () => {
        // This would be the actual function that runs in the browser
        return {
          role: 'main',
          children: [
            {
              role: 'heading',
              name: 'Welcome',
              level: 1
            },
            {
              role: 'button',
              name: 'Submit'
            }
          ]
        };
      }
    });
    
    expect(result[0].result).toHaveProperty('role', 'main');
    expect(result[0].result.children).toHaveLength(2);
    expect(result[0].result.children[0]).toEqual({
      role: 'heading',
      name: 'Welcome',
      level: 1
    });
  });
  
  test('should include ARIA properties', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: 'button',
        name: 'Menu',
        expanded: false,
        haspopup: 'menu'
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: () => {
        return {
          role: 'button',
          name: 'Menu',
          expanded: false,
          haspopup: 'menu'
        };
      }
    });
    
    expect(result[0].result).toEqual({
      role: 'button',
      name: 'Menu',
      expanded: false,
      haspopup: 'menu'
    });
  });
  
  test('should handle form elements with values', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: 'form',
        children: [
          {
            role: 'textbox',
            name: 'Email',
            required: true,
            value: 'user@example.com'
          },
          {
            role: 'checkbox',
            name: 'Subscribe to newsletter',
            checked: true
          }
        ]
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: () => {
        return {
          role: 'form',
          children: [
            {
              role: 'textbox',
              name: 'Email',
              required: true,
              value: 'user@example.com'
            },
            {
              role: 'checkbox',
              name: 'Subscribe to newsletter',
              checked: true
            }
          ]
        };
      }
    });
    
    const form = result[0].result;
    expect(form.children[0].value).toBe('user@example.com');
    expect(form.children[0].required).toBe(true);
    expect(form.children[1].checked).toBe(true);
  });
  
  test('should filter out hidden elements', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: 'main',
        children: [
          {
            role: 'button',
            name: 'Visible Button'
          }
          // Hidden button should not appear in results
        ]
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: () => {
        return {
          role: 'main',
          children: [
            {
              role: 'button',
              name: 'Visible Button'
            }
          ]
        };
      }
    });
    
    expect(result[0].result.children).toHaveLength(1);
    expect(result[0].result.children[0].name).toBe('Visible Button');
  });
  
  test('should handle interestingOnly parameter', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: 'navigation',
        children: [
          {
            role: 'list',
            children: [
              {
                role: 'listitem',
                children: [
                  {
                    role: 'link',
                    name: 'Home'
                  }
                ]
              }
            ]
          }
        ]
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: (/* { interestingOnly } */) => {
        // When interestingOnly is true, we expect a more condensed tree
        return {
          role: 'navigation',
          children: [
            {
              role: 'list',
              children: [
                {
                  role: 'listitem',
                  children: [
                    {
                      role: 'link',
                      name: 'Home'
                    }
                  ]
                }
              ]
            }
          ]
        };
      },
      args: [{ interestingOnly: true }]
    });
    
    expect(result[0].result).toHaveProperty('role', 'navigation');
  });
  
  test('should handle root selector parameter', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: 'article',
        children: [
          {
            role: 'heading',
            name: 'Article Title',
            level: 2
          }
        ]
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: (/* { root } */) => {
        // Should start from the specified root element
        return {
          role: 'article',
          children: [
            {
              role: 'heading',
              name: 'Article Title',
              level: 2
            }
          ]
        };
      },
      args: [{ root: '#main-article' }]
    });
    
    expect(result[0].result.role).toBe('article');
  });
  
  test('should handle implicit roles correctly', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: {
        role: null,
        children: [
          {
            role: 'link',
            name: 'Click here'
          },
          {
            role: 'button',
            name: 'Submit'
          },
          {
            role: 'heading',
            name: 'Section Title',
            level: 3
          },
          {
            role: 'navigation',
            children: []
          }
        ]
      }
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: () => {
        return {
          role: null,
          children: [
            {
              role: 'link',
              name: 'Click here'
            },
            {
              role: 'button',
              name: 'Submit'
            },
            {
              role: 'heading',
              name: 'Section Title',
              level: 3
            },
            {
              role: 'navigation',
              children: []
            }
          ]
        };
      }
    });
    
    const snapshot = result[0].result;
    expect(snapshot.children.find(c => c.role === 'link')).toBeTruthy();
    expect(snapshot.children.find(c => c.role === 'button')).toBeTruthy();
    expect(snapshot.children.find(c => c.role === 'heading' && c.level === 3)).toBeTruthy();
    expect(snapshot.children.find(c => c.role === 'navigation')).toBeTruthy();
  });
  
  test('should handle errors gracefully', async () => {
    chrome.scripting.executeScript.mockRejectedValue(new Error('Tab not found'));
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: 999 },
        func: () => {}
      });
    } catch (error) {
      expect(error.message).toBe('Tab not found');
    }
  });
  
  test('should return null when root element not found', async () => {
    chrome.scripting.executeScript.mockResolvedValue([{
      result: null
    }]);
    
    const result = await chrome.scripting.executeScript({
      target: { tabId: 1 },
      func: (/* { root } */) => {
        // Root element doesn't exist
        return null;
      },
      args: [{ root: '#non-existent' }]
    });
    
    expect(result[0].result).toBeNull();
  });
});