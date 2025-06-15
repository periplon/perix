let wsConnection = null;
let wsReconnectInterval = null;
const WS_URL = 'ws://localhost:8765';
const RECONNECT_DELAY = 5000;

const commandHandlers = {
  'tabs.list': handleListTabs,
  'tabs.create': handleCreateTab,
  'tabs.close': handleCloseTab,
  'tabs.activate': handleActivateTab,
  'tabs.reload': handleReloadTab,
  'tabs.navigate': handleNavigate,
  'tabs.goBack': handleGoBack,
  'tabs.goForward': handleGoForward,
  'tabs.executeScript': handleExecuteScript,
  'tabs.captureScreenshot': handleCaptureScreenshot,
  'tabs.captureVideo': handleCaptureVideo,
  'tabs.extractText': handleExtractText,
  'tabs.findElements': handleFindElements,
  'tabs.click': handleClick,
  'tabs.type': handleType,
  'tabs.scroll': handleScroll,
  'tabs.waitForElement': handleWaitForElement,
  'tabs.getCookies': handleGetCookies,
  'tabs.setCookie': handleSetCookie,
  'tabs.deleteCookie': handleDeleteCookie,
  'tabs.getLocalStorage': handleGetLocalStorage,
  'tabs.setLocalStorage': handleSetLocalStorage,
  'tabs.clearLocalStorage': handleClearLocalStorage,
  'tabs.getSessionStorage': handleGetSessionStorage,
  'tabs.setSessionStorage': handleSetSessionStorage,
  'tabs.clearSessionStorage': handleClearSessionStorage,
  'tabs.getActionables': handleGetActionables,
  'tabs.getAccessibilitySnapshot': handleAccessibilitySnapshot
};

function connectWebSocket() {
  if (wsConnection?.readyState === WebSocket.OPEN) {
    return;
  }

  wsConnection = new WebSocket(WS_URL);

  wsConnection.onopen = () => {
    console.log('WebSocket connected');
    sendMessage({ type: 'connected', version: '1.0.0' });
    
    if (wsReconnectInterval) {
      clearInterval(wsReconnectInterval);
      wsReconnectInterval = null;
    }
    
    notifyConnectionStatus();
  };

  wsConnection.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      await handleMessage(message);
    } catch (error) {
      console.error('Error handling message:', error);
      sendError(null, error.message);
    }
  };

  wsConnection.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  wsConnection.onclose = () => {
    console.log('WebSocket disconnected');
    scheduleReconnect();
    notifyConnectionStatus();
  };
}

function scheduleReconnect() {
  if (!wsReconnectInterval) {
    wsReconnectInterval = setInterval(() => {
      console.log('Attempting to reconnect...');
      connectWebSocket();
    }, RECONNECT_DELAY);
  }
}

function sendMessage(message) {
  if (wsConnection?.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(message));
  }
}

function sendResponse(id, result) {
  sendMessage({
    id,
    type: 'response',
    result
  });
}

function sendError(id, error) {
  sendMessage({
    id,
    type: 'error',
    error: error.toString()
  });
}

async function handleMessage(message) {
  // Handle special message types
  if (message.type === 'ack') {
    console.log('Received acknowledgment from server');
    return;
  }
  
  if (message.type === 'pong') {
    console.log('Received pong from server');
    return;
  }
  
  // Handle command messages
  const { id, command, params } = message;
  
  if (!command) {
    sendError(id, 'Command not specified');
    return;
  }

  const handler = commandHandlers[command];
  if (!handler) {
    sendError(id, `Unknown command: ${command}`);
    return;
  }

  try {
    const result = await handler(params);
    sendResponse(id, result);
  } catch (error) {
    sendError(id, error.message);
  }
}

async function handleListTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    active: tab.active,
    windowId: tab.windowId,
    index: tab.index,
    pinned: tab.pinned,
    audible: tab.audible,
    mutedInfo: tab.mutedInfo,
    status: tab.status
  }));
}

async function handleCreateTab(params) {
  const tab = await chrome.tabs.create({
    url: params.url,
    active: params.active !== false,
    windowId: params.windowId,
    index: params.index,
    pinned: params.pinned
  });
  return { id: tab.id, url: tab.url, title: tab.title };
}

async function handleCloseTab(params) {
  await chrome.tabs.remove(params.tabId);
  return { success: true };
}

async function handleActivateTab(params) {
  await chrome.tabs.update(params.tabId, { active: true });
  return { success: true };
}

async function handleReloadTab(params) {
  await chrome.tabs.reload(params.tabId, { bypassCache: params.bypassCache });
  return { success: true };
}

async function handleNavigate(params) {
  await chrome.tabs.update(params.tabId, { url: params.url });
  await waitForTabLoad(params.tabId);
  return { success: true };
}

async function handleGoBack(params) {
  await chrome.tabs.goBack(params.tabId);
  return { success: true };
}

async function handleGoForward(params) {
  await chrome.tabs.goForward(params.tabId);
  return { success: true };
}

async function handleExecuteScript(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: new Function(params.script),
    world: params.world || 'ISOLATED'
  });
  return results[0]?.result;
}

async function handleCaptureScreenshot(params) {
  const dataUrl = await chrome.tabs.captureVisibleTab(params.windowId, {
    format: params.format || 'png',
    quality: params.quality || 100
  });
  return { dataUrl };
}

async function handleCaptureVideo(params) {
  const streamId = await new Promise((resolve) => {
    chrome.tabCapture.capture({
      audio: params.audio || false,
      video: true,
      videoConstraints: {
        mandatory: {
          minWidth: params.width || 1280,
          minHeight: params.height || 720,
          maxFrameRate: params.frameRate || 30
        }
      }
    }, (stream) => {
      resolve(stream.id);
    });
  });
  
  return { streamId, message: 'Video capture started. Use stream APIs to record.' };
}

async function handleExtractText(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (selector) => {
      if (selector) {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => el.textContent);
      }
      return document.body.textContent;
    },
    args: [params.selector]
  });
  return { text: results[0]?.result };
}

async function handleFindElements(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (selector) => {
      const elements = document.querySelectorAll(selector);
      return Array.from(elements).map((el, index) => ({
        index,
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        text: el.textContent?.substring(0, 100),
        attributes: Array.from(el.attributes).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {}),
        rect: el.getBoundingClientRect()
      }));
    },
    args: [params.selector]
  });
  return { elements: results[0]?.result || [] };
}

async function handleClick(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (selector, index) => {
      const elements = document.querySelectorAll(selector);
      const element = elements[index || 0];
      if (element) {
        element.click();
        return true;
      }
      return false;
    },
    args: [params.selector, params.index || 0]
  });
  return { success: results[0]?.result || false };
}

async function handleType(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (selector, text, append) => {
      const element = document.querySelector(selector);
      if (element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
        if (!append) {
          element.value = text;
        } else {
          element.value += text;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    },
    args: [params.selector, params.text, params.append || false]
  });
  return { success: results[0]?.result || false };
}

async function handleScroll(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (x, y, behavior) => {
      window.scrollTo({
        left: x || 0,
        top: y || 0,
        behavior: behavior || 'smooth'
      });
      return { x: window.scrollX, y: window.scrollY };
    },
    args: [params.x, params.y, params.behavior]
  });
  return results[0]?.result;
}

async function handleWaitForElement(params) {
  // Validate required parameters
  if (!params.tabId) {
    throw new Error('tabId is required');
  }
  if (!params.selector) {
    throw new Error('selector is required');
  }
  
  const timeout = params.timeout || 10000;
  const checkInterval = 100;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: params.tabId },
        func: (selector) => {
          return document.querySelector(selector) !== null;
        },
        args: [params.selector]
      });
      
      // Check if script execution was successful and returned a valid result
      // Only return true if we explicitly got a true result
      if (results && results.length > 0 && results[0].result === true) {
        return { found: true, elapsed: Date.now() - startTime };
      }
      // If result is explicitly false or any other value, continue waiting
    } catch (error) {
      // Script execution failed (tab closed, navigating, permissions, etc.)
      console.warn(`Error checking element presence: ${error.message}`);
      // Continue checking instead of failing immediately
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  return { found: false, elapsed: timeout };
}

async function handleGetCookies(params) {
  const cookies = await chrome.cookies.getAll({
    url: params.url,
    domain: params.domain,
    name: params.name
  });
  return { cookies };
}

async function handleSetCookie(params) {
  const cookie = await chrome.cookies.set({
    url: params.url,
    name: params.name,
    value: params.value,
    domain: params.domain,
    path: params.path || '/',
    secure: params.secure,
    httpOnly: params.httpOnly,
    expirationDate: params.expirationDate
  });
  return { cookie };
}

async function handleDeleteCookie(params) {
  await chrome.cookies.remove({
    url: params.url,
    name: params.name
  });
  return { success: true };
}

async function handleGetLocalStorage(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (key) => {
      if (key) {
        return { [key]: localStorage.getItem(key) };
      }
      return { ...localStorage };
    },
    args: [params.key]
  });
  return { storage: results[0]?.result };
}

async function handleSetLocalStorage(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (key, value) => {
      localStorage.setItem(key, value);
      return true;
    },
    args: [params.key, params.value]
  });
  return { success: results[0]?.result || false };
}

async function handleClearLocalStorage(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: () => {
      localStorage.clear();
      return true;
    }
  });
  return { success: results[0]?.result || false };
}

async function handleGetSessionStorage(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (key) => {
      if (key) {
        return { [key]: sessionStorage.getItem(key) };
      }
      return { ...sessionStorage };
    },
    args: [params.key]
  });
  return { storage: results[0]?.result };
}

async function handleSetSessionStorage(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: (key, value) => {
      sessionStorage.setItem(key, value);
      return true;
    },
    args: [params.key, params.value]
  });
  return { success: results[0]?.result || false };
}

async function handleClearSessionStorage(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: () => {
      sessionStorage.clear();
      return true;
    }
  });
  return { success: results[0]?.result || false };
}

async function handleGetActionables(params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: params.tabId },
    func: () => {
      const actionables = [];
      let labelNumber = 0;

      // Define interactive element selectors
      const interactiveSelectors = [
        'a[href]',
        'button',
        'input:not([type="hidden"])',
        'select',
        'textarea',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="switch"]',
        '[role="tab"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[onclick]',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ];

      // Query all interactive elements
      const elements = document.querySelectorAll(interactiveSelectors.join(','));
      
      // Process each element
      elements.forEach(element => {
        // Check if element is visible
        const rect = element.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 &&
                         rect.top < window.innerHeight && rect.bottom > 0 &&
                         rect.left < window.innerWidth && rect.right > 0;
        
        if (!isVisible) return;
        
        // Check if element is interactive (not disabled)
        if (element.disabled || element.getAttribute('aria-disabled') === 'true') return;
        
        // Determine element type
        let type = element.tagName.toLowerCase();
        if (type === 'input') {
          type = `input[type="${element.type || 'text'}"]`;
        } else if (element.getAttribute('role')) {
          type = `${type}[role="${element.getAttribute('role')}"]`;
        }
        
        // Generate description
        let description = '';
        if (element.textContent && element.textContent.trim()) {
          description = element.textContent.trim().substring(0, 100);
        } else if (element.getAttribute('aria-label')) {
          description = element.getAttribute('aria-label');
        } else if (element.getAttribute('placeholder')) {
          description = element.getAttribute('placeholder');
        } else if (element.getAttribute('title')) {
          description = element.getAttribute('title');
        } else if (element.value) {
          description = `Value: ${element.value}`;
        } else if (type === 'a' && element.href) {
          description = `Link to: ${element.href}`;
        }
        
        // Generate a unique selector
        let selector = '';
        if (element.id) {
          selector = `#${element.id}`;
        } else if (element.className) {
          // Escape CSS special characters in class names
          const escapeClassName = (className) => {
            return className.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
          };
          
          const classes = element.className.split(' ')
            .filter(c => c)
            .map(escapeClassName)
            .join('.');
          selector = `${element.tagName.toLowerCase()}.${classes}`;
          
          // Make selector more specific if needed
          try {
            const matches = document.querySelectorAll(selector);
            if (matches.length > 1) {
              // Add parent context
              let parent = element.parentElement;
              while (parent && matches.length > 1) {
                if (parent.id) {
                  selector = `#${parent.id} ${selector}`;
                  break;
                } else if (parent.className) {
                  const parentClasses = parent.className.split(' ')
                    .filter(c => c)
                    .map(escapeClassName)
                    .join('.');
                  selector = `${parent.tagName.toLowerCase()}.${parentClasses} ${selector}`;
                  try {
                    if (document.querySelectorAll(selector).length === 1) break;
                  } catch (e) {
                    // If selector is still invalid, continue to next parent
                  }
                }
                parent = parent.parentElement;
              }
            }
          } catch (e) {
            // If selector is invalid, fallback to a simpler approach
            // Use data attribute or index-based selector
            const parent = element.parentElement;
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element) + 1;
            selector = `${parent.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
          }
        } else {
          // Fallback to nth-child selector
          const parent = element.parentElement;
          const siblings = Array.from(parent.children);
          const index = siblings.indexOf(element) + 1;
          selector = `${parent.tagName.toLowerCase()} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
        }
        
        actionables.push({
          labelNumber: labelNumber++,
          description: description || `${type} element`,
          type: type,
          selector: selector
        });
      });
      
      return actionables;
    }
  });
  
  return { actionables: results[0]?.result || [] };
}

async function handleAccessibilitySnapshot(params) {
  const { tabId, interestingOnly = true, root = null } = params;
  
  // Check if we have a content script connection for this tab
  const port = contentScriptPorts.get(tabId);
  if (!port) {
    // If no persistent connection, try to execute directly
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (options) => {
        // This function runs in the page context
        // We need to check if the page has accessibility API
        if (!window.getComputedStyle) {
          throw new Error('Page context not fully loaded');
        }
        
        // Since we're in a Chrome extension content script context,
        // we don't have direct access to Puppeteer's page.accessibility.snapshot
        // Instead, we'll implement our own accessibility tree traversal
        
        function isVisible(element) {
          if (!element) return false;
          
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          if (style.opacity === '0') return false;
          
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }
        
        function getAccessibleName(element) {
          // Check aria-label first
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel.trim();
          
          // Check aria-labelledby
          const labelledBy = element.getAttribute('aria-labelledby');
          if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) return labelElement.textContent.trim();
          }
          
          // Check for label element (for form controls)
          if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent.trim();
          }
          
          // Check alt text for images
          if (element.tagName === 'IMG' && element.alt) {
            return element.alt.trim();
          }
          
          // Check placeholder
          if (element.placeholder) return element.placeholder.trim();
          
          // Check title
          if (element.title) return element.title.trim();
          
          // Use text content as fallback
          return element.textContent?.trim() || '';
        }
        
        function getRole(element) {
          // Check explicit role
          const explicitRole = element.getAttribute('role');
          if (explicitRole) return explicitRole;
          
          // Map HTML elements to implicit roles
          const tagName = element.tagName.toLowerCase();
          const type = element.type?.toLowerCase();
          
          const implicitRoles = {
            'a': element.href ? 'link' : null,
            'article': 'article',
            'aside': 'complementary',
            'button': 'button',
            'datalist': 'listbox',
            'dd': 'definition',
            'details': 'group',
            'dialog': 'dialog',
            'dt': 'term',
            'fieldset': 'group',
            'figure': 'figure',
            'footer': 'contentinfo',
            'form': 'form',
            'h1': 'heading',
            'h2': 'heading',
            'h3': 'heading',
            'h4': 'heading',
            'h5': 'heading',
            'h6': 'heading',
            'header': 'banner',
            'hr': 'separator',
            'img': element.alt !== '' ? 'img' : 'presentation',
            'input': {
              'button': 'button',
              'checkbox': 'checkbox',
              'email': 'textbox',
              'image': 'button',
              'number': 'spinbutton',
              'password': 'textbox',
              'radio': 'radio',
              'range': 'slider',
              'reset': 'button',
              'search': 'searchbox',
              'submit': 'button',
              'tel': 'textbox',
              'text': 'textbox',
              'url': 'textbox'
            }[type] || 'textbox',
            'li': 'listitem',
            'main': 'main',
            'menu': 'list',
            'nav': 'navigation',
            'ol': 'list',
            'option': 'option',
            'output': 'status',
            'progress': 'progressbar',
            'section': 'region',
            'select': 'combobox',
            'summary': 'button',
            'table': 'table',
            'tbody': 'rowgroup',
            'td': 'cell',
            'textarea': 'textbox',
            'tfoot': 'rowgroup',
            'th': 'columnheader',
            'thead': 'rowgroup',
            'tr': 'row',
            'ul': 'list'
          };
          
          return implicitRoles[tagName] || null;
        }
        
        function getProperties(element) {
          const properties = {};
          
          // Get various ARIA properties
          const ariaProps = [
            'aria-checked',
            'aria-current',
            'aria-disabled',
            'aria-expanded',
            'aria-haspopup',
            'aria-hidden',
            'aria-invalid',
            'aria-pressed',
            'aria-readonly',
            'aria-required',
            'aria-selected'
          ];
          
          ariaProps.forEach(prop => {
            const value = element.getAttribute(prop);
            if (value !== null) {
              const propName = prop.replace('aria-', '');
              // Convert string boolean values to actual booleans
              if (value === 'true') properties[propName] = true;
              else if (value === 'false') properties[propName] = false;
              else properties[propName] = value;
            }
          });
          
          // Add properties based on element state
          if (element.disabled) properties.disabled = true;
          if (element.readOnly) properties.readonly = true;
          if (element.required) properties.required = true;
          
          // For form elements, add value info
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
            if (element.type === 'checkbox' || element.type === 'radio') {
              properties.checked = element.checked;
            }
            if (element.value && element.type !== 'password') {
              properties.value = element.value;
            }
          }
          
          // Add level for headings
          const headingMatch = element.tagName.match(/^H(\d)$/);
          if (headingMatch) {
            properties.level = parseInt(headingMatch[1]);
          }
          
          return properties;
        }
        
        function buildAccessibilityNode(element, options = {}) {
          if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
          
          const role = getRole(element);
          const name = getAccessibleName(element);
          const properties = getProperties(element);
          
          // Skip hidden elements
          if (properties.hidden === true || element.getAttribute('aria-hidden') === 'true') {
            return null;
          }
          
          // Skip non-visible elements if required
          if (options.interestingOnly && !isVisible(element)) {
            return null;
          }
          
          const node = { role };
          
          // Add name if present
          if (name) node.name = name;
          
          // Add properties if any
          if (Object.keys(properties).length > 0) {
            Object.assign(node, properties);
          }
          
          // Process children
          const children = [];
          for (const child of element.children) {
            const childNode = buildAccessibilityNode(child, options);
            if (childNode) {
              children.push(childNode);
            }
          }
          
          // Also check for text nodes
          for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent.trim();
              if (text && !name) {
                // If the element has no name but has direct text content,
                // add it as the name (unless it has children with roles)
                if (children.length === 0 || !children.some(c => c.role)) {
                  node.name = text;
                }
              }
            }
          }
          
          // Add children if any
          if (children.length > 0) {
            node.children = children;
          }
          
          // Filter out uninteresting nodes if requested
          if (options.interestingOnly) {
            // Keep nodes that have a role, name, or properties
            const hasInterestingContent = role || name || Object.keys(properties).length > 0;
            // Also keep nodes with interesting children
            const hasInterestingChildren = children.length > 0;
            
            if (!hasInterestingContent && !hasInterestingChildren) {
              // If this node has children but is not interesting itself,
              // promote its children
              return children.length === 1 ? children[0] : (children.length > 0 ? { children } : null);
            }
          }
          
          return node;
        }
        
        // Start from root element or document body
        const rootElement = options.root ? 
          document.querySelector(options.root) : 
          document.body;
          
        if (!rootElement) {
          throw new Error('Root element not found');
        }
        
        const snapshot = buildAccessibilityNode(rootElement, {
          interestingOnly: options.interestingOnly
        });
        
        return snapshot;
      },
      args: [{ interestingOnly, root }]
    });
    
    return { snapshot: results[0]?.result || null };
  }
  
  // Send message to content script for more advanced handling
  return new Promise((resolve, reject) => {
    const messageId = Date.now();
    const timeout = setTimeout(() => {
      port.onMessage.removeListener(listener);
      reject(new Error('Timeout waiting for accessibility snapshot'));
    }, 30000);
    
    const listener = (response) => {
      if (response.type === 'accessibilitySnapshot' && response.id === messageId) {
        clearTimeout(timeout);
        port.onMessage.removeListener(listener);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve({ snapshot: response.snapshot });
        }
      }
    };
    
    port.onMessage.addListener(listener);
    port.postMessage({
      type: 'getAccessibilitySnapshot',
      id: messageId,
      params: { interestingOnly, root }
    });
  });
}

async function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Handle persistent connections from content scripts
const contentScriptPorts = new Map();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'content-script') {
    const tabId = port.sender?.tab?.id;
    if (tabId) {
      contentScriptPorts.set(tabId, port);
      console.log(`Content script connected from tab ${tabId}`);
      
      // Handle messages from content script
      port.onMessage.addListener(async (message) => {
        console.log(`Message from content script (tab ${tabId}):`, message);
        
        // Handle test Chrome API requests
        if (message.type === 'testChromeAPI') {
          try {
            // Execute the API call
            const result = await chrome.tabs.query({active: true, currentWindow: true});
            port.postMessage({
              type: 'testResponse',
              id: message.id,
              result: result
            });
          } catch (error) {
            port.postMessage({
              type: 'testResponse',
              id: message.id,
              error: error.message
            });
          }
          return;
        }
        
        // Forward responses back through WebSocket if needed
        if (message.type === 'response' || message.type === 'error') {
          sendMessage(message);
        }
      });
      
      // Clean up when content script disconnects
      port.onDisconnect.addListener(() => {
        contentScriptPorts.delete(tabId);
        console.log(`Content script disconnected from tab ${tabId}`);
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          console.error('Content script disconnect error:', chrome.runtime.lastError);
        }
      });
    }
  }
});


// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getConnectionStatus') {
    sendResponse({ connected: wsConnection?.readyState === WebSocket.OPEN });
    return true;
  }
  
  if (request.type === 'reconnect') {
    if (wsConnection?.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
    sendResponse({ success: true });
    return true;
  }
});

// Notify popup when connection status changes
function notifyConnectionStatus() {
  try {
    chrome.runtime.sendMessage({
      type: 'connectionStatusChanged',
      connected: wsConnection?.readyState === WebSocket.OPEN
    });
  } catch (error) {
    // Popup might not be open, ignore error
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Browser Automation Extension installed');
  connectWebSocket();
});

chrome.runtime.onStartup.addListener(() => {
  connectWebSocket();
});

// Initialize WebSocket connection when script loads
// In test environment, this will use the mocked WebSocket
connectWebSocket();