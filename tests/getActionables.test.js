describe('tabs.getActionables', () => {
  let mockTab;
  
  beforeEach(() => {
    mockTab = { id: 1, url: 'https://example.com' };
    
    // Mock DOM elements
    global.document = {
      querySelectorAll: jest.fn(),
      querySelector: jest.fn()
    };
    
    global.window = {
      innerHeight: 800,
      innerWidth: 1200
    };
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  test('should identify button elements', async () => {
    // Mock button element
    const mockButton = {
      tagName: 'BUTTON',
      textContent: 'Click me',
      getBoundingClientRect: () => ({ width: 100, height: 40, top: 100, bottom: 140, left: 10, right: 110 }),
      disabled: false,
      getAttribute: jest.fn(() => null),
      id: 'submit-btn',
      className: '',
      parentElement: { tagName: 'DIV', children: [] }
    };
    
    document.querySelectorAll.mockReturnValue([mockButton]);
    
    // Mock chrome.scripting.executeScript
    chrome.scripting.executeScript.mockResolvedValue([{
      result: [{
        labelNumber: 0,
        description: 'Click me',
        type: 'button',
        selector: '#submit-btn'
      }]
    }]);
    
    // Load background script (or import the handler)
    const { handleGetActionables } = require('../background.js');
    
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables).toHaveLength(1);
    expect(result.actionables[0]).toEqual({
      labelNumber: 0,
      description: 'Click me',
      type: 'button',
      selector: '#submit-btn'
    });
  });
  
  test('should identify input elements with proper type', async () => {
    // Mock input element
    const mockInput = {
      tagName: 'INPUT',
      type: 'email',
      placeholder: 'Enter your email',
      value: '',
      getBoundingClientRect: () => ({ width: 200, height: 40, top: 200, bottom: 240, left: 10, right: 210 }),
      disabled: false,
      getAttribute: jest.fn((attr) => attr === 'placeholder' ? 'Enter your email' : null),
      id: '',
      className: 'form-input',
      parentElement: { tagName: 'FORM', children: [] }
    };
    
    document.querySelectorAll.mockReturnValue([mockInput]);
    
    chrome.scripting.executeScript.mockResolvedValue([{
      result: [{
        labelNumber: 0,
        description: 'Enter your email',
        type: 'input[type="email"]',
        selector: 'input.form-input'
      }]
    }]);
    
    const { handleGetActionables } = require('../background.js');
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables).toHaveLength(1);
    expect(result.actionables[0].type).toBe('input[type="email"]');
    expect(result.actionables[0].description).toBe('Enter your email');
  });
  
  test('should identify links with href', async () => {
    // Mock link element
    const mockLink = {
      tagName: 'A',
      href: 'https://example.com/about',
      textContent: 'About Us',
      getBoundingClientRect: () => ({ width: 80, height: 20, top: 50, bottom: 70, left: 100, right: 180 }),
      disabled: false,
      getAttribute: jest.fn((attr) => attr === 'href' ? 'https://example.com/about' : null),
      id: '',
      className: 'nav-link',
      parentElement: { tagName: 'NAV', children: [] }
    };
    
    document.querySelectorAll.mockReturnValue([mockLink]);
    
    chrome.scripting.executeScript.mockResolvedValue([{
      result: [{
        labelNumber: 0,
        description: 'About Us',
        type: 'a',
        selector: 'a.nav-link'
      }]
    }]);
    
    const { handleGetActionables } = require('../background.js');
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables).toHaveLength(1);
    expect(result.actionables[0].type).toBe('a');
    expect(result.actionables[0].description).toBe('About Us');
  });
  
  test('should skip hidden elements', async () => {
    // Mock hidden element
    const mockHidden = {
      tagName: 'BUTTON',
      textContent: 'Hidden',
      getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, bottom: 0, left: 0, right: 0 }),
      disabled: false,
      getAttribute: jest.fn(() => null),
      id: 'hidden-btn',
      className: '',
      parentElement: { tagName: 'DIV', children: [] }
    };
    
    // Mock visible element
    const mockVisible = {
      tagName: 'BUTTON',
      textContent: 'Visible',
      getBoundingClientRect: () => ({ width: 100, height: 40, top: 100, bottom: 140, left: 10, right: 110 }),
      disabled: false,
      getAttribute: jest.fn(() => null),
      id: 'visible-btn',
      className: '',
      parentElement: { tagName: 'DIV', children: [] }
    };
    
    document.querySelectorAll.mockReturnValue([mockHidden, mockVisible]);
    
    chrome.scripting.executeScript.mockResolvedValue([{
      result: [{
        labelNumber: 0,
        description: 'Visible',
        type: 'button',
        selector: '#visible-btn'
      }]
    }]);
    
    const { handleGetActionables } = require('../background.js');
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables).toHaveLength(1);
    expect(result.actionables[0].description).toBe('Visible');
  });
  
  test('should skip disabled elements', async () => {
    // Mock disabled element
    const mockDisabled = {
      tagName: 'BUTTON',
      textContent: 'Disabled',
      getBoundingClientRect: () => ({ width: 100, height: 40, top: 100, bottom: 140, left: 10, right: 110 }),
      disabled: true,
      getAttribute: jest.fn(() => null),
      id: 'disabled-btn',
      className: '',
      parentElement: { tagName: 'DIV', children: [] }
    };
    
    document.querySelectorAll.mockReturnValue([mockDisabled]);
    
    chrome.scripting.executeScript.mockResolvedValue([{
      result: []
    }]);
    
    const { handleGetActionables } = require('../background.js');
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables).toHaveLength(0);
  });
  
  test('should handle elements with ARIA roles', async () => {
    // Mock element with role
    const mockRoleButton = {
      tagName: 'DIV',
      textContent: 'Custom Button',
      getBoundingClientRect: () => ({ width: 100, height: 40, top: 100, bottom: 140, left: 10, right: 110 }),
      disabled: false,
      getAttribute: jest.fn((attr) => attr === 'role' ? 'button' : null),
      id: '',
      className: 'custom-btn',
      parentElement: { tagName: 'DIV', children: [] }
    };
    
    document.querySelectorAll.mockReturnValue([mockRoleButton]);
    
    chrome.scripting.executeScript.mockResolvedValue([{
      result: [{
        labelNumber: 0,
        description: 'Custom Button',
        type: 'div[role="button"]',
        selector: 'div.custom-btn'
      }]
    }]);
    
    const { handleGetActionables } = require('../background.js');
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables).toHaveLength(1);
    expect(result.actionables[0].type).toBe('div[role="button"]');
  });
  
  test('should generate proper selectors', async () => {
    // Mock element without ID or class
    const mockNoIdClass = {
      tagName: 'BUTTON',
      textContent: 'No ID/Class',
      getBoundingClientRect: () => ({ width: 100, height: 40, top: 100, bottom: 140, left: 10, right: 110 }),
      disabled: false,
      getAttribute: jest.fn(() => null),
      id: '',
      className: '',
      parentElement: { 
        tagName: 'DIV',
        children: [mockNoIdClass, {}, {}] // 3 children
      }
    };
    
    // Fix circular reference
    mockNoIdClass.parentElement.children[0] = mockNoIdClass;
    
    document.querySelectorAll.mockReturnValue([mockNoIdClass]);
    
    chrome.scripting.executeScript.mockResolvedValue([{
      result: [{
        labelNumber: 0,
        description: 'No ID/Class',
        type: 'button',
        selector: 'div > button:nth-child(1)'
      }]
    }]);
    
    const { handleGetActionables } = require('../background.js');
    const result = await handleGetActionables({ tabId: 1 });
    
    expect(result.actionables[0].selector).toBe('div > button:nth-child(1)');
  });
});