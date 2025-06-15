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
  'tabs.getActionables': handleGetActionables
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
          const classes = element.className.split(' ').filter(c => c).join('.');
          selector = `${element.tagName.toLowerCase()}.${classes}`;
          // Make selector more specific if needed
          const matches = document.querySelectorAll(selector);
          if (matches.length > 1) {
            // Add parent context
            let parent = element.parentElement;
            while (parent && matches.length > 1) {
              if (parent.id) {
                selector = `#${parent.id} ${selector}`;
                break;
              } else if (parent.className) {
                const parentClasses = parent.className.split(' ').filter(c => c).join('.');
                selector = `${parent.tagName.toLowerCase()}.${parentClasses} ${selector}`;
                if (document.querySelectorAll(selector).length === 1) break;
              }
              parent = parent.parentElement;
            }
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
      port.onMessage.addListener((message) => {
        console.log(`Message from content script (tab ${tabId}):`, message);
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

// Send message to content script
function sendToContentScript(tabId, message) {
  const port = contentScriptPorts.get(tabId);
  if (port) {
    try {
      port.postMessage(message);
      return true;
    } catch (error) {
      console.error(`Error sending to content script (tab ${tabId}):`, error);
      contentScriptPorts.delete(tabId);
      return false;
    }
  }
  return false;
}

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

connectWebSocket();