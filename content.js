let port = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

function connectToBackground() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.error('Extension context invalidated');
      return;
    }
    
    port = chrome.runtime.connect({ name: 'content-script' });
    
    port.onMessage.addListener((message) => {
      try {
        handleBackgroundMessage(message);
      } catch (error) {
        console.error('Error handling background message:', error);
      }
    });
    
    port.onDisconnect.addListener(() => {
      port = null;
      
      // Check for specific errors
      if (chrome.runtime.lastError) {
        console.error('Connection error:', chrome.runtime.lastError.message);
      } else {
        console.log('Disconnected from background script');
      }
      
      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
        setTimeout(connectToBackground, delay);
      } else {
        console.error('Max reconnection attempts reached');
      }
    });
    
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    console.log('Successfully connected to background script');
    
  } catch (error) {
    console.error('Failed to connect to background script:', error);
    
    // Retry connection if attempts remaining
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
      setTimeout(connectToBackground, delay);
    }
  }
}

function handleBackgroundMessage(message) {
  const { command, params, id, type } = message;
  
  // Handle new message format for accessibility snapshot
  if (type === 'getAccessibilitySnapshot') {
    getAccessibilitySnapshot(params, id);
    return;
  }
  
  // Handle existing command format
  switch (command) {
  case 'getElementInfo':
    getElementInfo(params, id);
    break;
  case 'highlightElement':
    highlightElement(params, id);
    break;
  case 'simulateEvent':
    simulateEvent(params, id);
    break;
  case 'extractStructuredData':
    extractStructuredData(params, id);
    break;
  case 'observeMutations':
    observeMutations(params, id);
    break;
  case 'injectCSS':
    injectCSS(params, id);
    break;
  case 'removeCSS':
    removeCSS(params, id);
    break;
  }
}

function sendResponse(id, result) {
  if (!port) {
    console.error('Cannot send response: port is disconnected');
    return;
  }
  
  try {
    port.postMessage({
      id,
      type: 'response',
      result
    });
  } catch (error) {
    console.error('Failed to send response:', error);
    // Attempt reconnection
    connectToBackground();
  }
}

function sendError(id, error) {
  if (!port) {
    console.error('Cannot send error: port is disconnected');
    return;
  }
  
  try {
    port.postMessage({
      id,
      type: 'error',
      error: error.toString()
    });
  } catch (error) {
    console.error('Failed to send error:', error);
    // Attempt reconnection
    connectToBackground();
  }
}

function getElementInfo(params, id) {
  try {
    const element = document.querySelector(params.selector);
    if (!element) {
      sendError(id, 'Element not found');
      return;
    }
    
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    
    const info = {
      tagName: element.tagName,
      id: element.id,
      className: element.className,
      textContent: element.textContent,
      innerHTML: element.innerHTML,
      value: element.value,
      href: element.href,
      src: element.src,
      alt: element.alt,
      title: element.title,
      type: element.type,
      name: element.name,
      placeholder: element.placeholder,
      disabled: element.disabled,
      checked: element.checked,
      selected: element.selected,
      rect: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y
      },
      isVisible: rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden',
      styles: params.includeStyles ? {
        display: styles.display,
        visibility: styles.visibility,
        position: styles.position,
        zIndex: styles.zIndex,
        opacity: styles.opacity,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        fontSize: styles.fontSize,
        fontFamily: styles.fontFamily,
        fontWeight: styles.fontWeight,
        textAlign: styles.textAlign,
        lineHeight: styles.lineHeight,
        padding: styles.padding,
        margin: styles.margin,
        border: styles.border
      } : null,
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      dataset: { ...element.dataset }
    };
    
    sendResponse(id, info);
  } catch (error) {
    sendError(id, error.message);
  }
}

function highlightElement(params, id) {
  try {
    const elements = document.querySelectorAll(params.selector);
    const originalStyles = [];
    
    elements.forEach((element) => {
      originalStyles.push({
        element,
        outline: element.style.outline,
        backgroundColor: element.style.backgroundColor
      });
      
      element.style.outline = params.outline || '2px solid red';
      if (params.backgroundColor) {
        element.style.backgroundColor = params.backgroundColor;
      }
    });
    
    if (params.duration) {
      setTimeout(() => {
        originalStyles.forEach(({ element, outline, backgroundColor }) => {
          element.style.outline = outline;
          element.style.backgroundColor = backgroundColor;
        });
      }, params.duration);
    }
    
    sendResponse(id, { count: elements.length });
  } catch (error) {
    sendError(id, error.message);
  }
}

function simulateEvent(params, id) {
  try {
    const element = document.querySelector(params.selector);
    if (!element) {
      sendError(id, 'Element not found');
      return;
    }
    
    const eventType = params.eventType;
    const eventOptions = params.options || {};
    
    let event;
    if (eventType.startsWith('mouse')) {
      event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...eventOptions
      });
    } else if (eventType.startsWith('key')) {
      event = new KeyboardEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...eventOptions
      });
    } else if (eventType === 'focus' || eventType === 'blur') {
      event = new FocusEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window,
        ...eventOptions
      });
    } else {
      event = new Event(eventType, {
        bubbles: true,
        cancelable: true,
        ...eventOptions
      });
    }
    
    element.dispatchEvent(event);
    sendResponse(id, { success: true });
  } catch (error) {
    sendError(id, error.message);
  }
}

function extractStructuredData(params, id) {
  try {
    const data = [];
    const rows = document.querySelectorAll(params.rowSelector);
    
    rows.forEach((row) => {
      const rowData = {};
      
      Object.entries(params.columnSelectors).forEach(([key, selector]) => {
        const element = row.querySelector(selector);
        if (element) {
          rowData[key] = params.extractAttribute 
            ? element.getAttribute(params.extractAttribute)
            : element.textContent.trim();
        }
      });
      
      if (Object.keys(rowData).length > 0) {
        data.push(rowData);
      }
    });
    
    sendResponse(id, { data });
  } catch (error) {
    sendError(id, error.message);
  }
}

let mutationObserver = null;

function observeMutations(params, id) {
  try {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    
    const target = params.selector 
      ? document.querySelector(params.selector)
      : document.body;
      
    if (!target) {
      sendError(id, 'Target element not found');
      return;
    }
    
    const mutations = [];
    
    mutationObserver = new MutationObserver((mutationsList) => {
      mutationsList.forEach((mutation) => {
        mutations.push({
          type: mutation.type,
          target: mutation.target.tagName,
          targetId: mutation.target.id,
          targetClass: mutation.target.className,
          attributeName: mutation.attributeName,
          oldValue: mutation.oldValue,
          addedNodes: Array.from(mutation.addedNodes).map(node => ({
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            textContent: node.textContent
          })),
          removedNodes: Array.from(mutation.removedNodes).map(node => ({
            nodeType: node.nodeType,
            nodeName: node.nodeName,
            textContent: node.textContent
          }))
        });
        
        if (mutations.length >= (params.maxMutations || 100)) {
          mutationObserver.disconnect();
          sendResponse(id, { mutations });
        }
      });
    });
    
    mutationObserver.observe(target, {
      attributes: params.attributes !== false,
      childList: params.childList !== false,
      subtree: params.subtree !== false,
      attributeOldValue: params.attributeOldValue || false,
      characterData: params.characterData || false,
      characterDataOldValue: params.characterDataOldValue || false
    });
    
    if (params.timeout) {
      setTimeout(() => {
        if (mutationObserver) {
          mutationObserver.disconnect();
          sendResponse(id, { mutations });
        }
      }, params.timeout);
    }
    
    sendResponse(id, { observing: true });
  } catch (error) {
    sendError(id, error.message);
  }
}

const injectedStyles = new Map();

function injectCSS(params, id) {
  try {
    const styleId = params.id || `injected-style-${Date.now()}`;
    
    let styleElement = injectedStyles.get(styleId);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
      injectedStyles.set(styleId, styleElement);
    }
    
    styleElement.textContent = params.css;
    sendResponse(id, { styleId });
  } catch (error) {
    sendError(id, error.message);
  }
}

function removeCSS(params, id) {
  try {
    const styleElement = injectedStyles.get(params.styleId);
    if (styleElement) {
      styleElement.remove();
      injectedStyles.delete(params.styleId);
      sendResponse(id, { success: true });
    } else {
      sendError(id, 'Style not found');
    }
  } catch (error) {
    sendError(id, error.message);
  }
}

function getAccessibilitySnapshot(params, id) {
  try {
    const { interestingOnly = true, root = null } = params;
    
    // Helper functions (same as in background.js but running in page context)
    const isVisible = (element) => {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
      
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    
    const getAccessibleName = (element) => {
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
    };
    
    const getRole = (element) => {
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
    };
    
    const getProperties = (element) => {
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
    };
    
    const buildAccessibilityNode = (element, options = {}) => {
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
    };
    
    // Start from root element or document body
    const rootElement = root ? 
      document.querySelector(root) : 
      document.body;
      
    if (!rootElement) {
      throw new Error('Root element not found');
    }
    
    const snapshot = buildAccessibilityNode(rootElement, {
      interestingOnly
    });
    
    // Send response back to background script
    if (port) {
      port.postMessage({
        type: 'accessibilitySnapshot',
        id,
        snapshot
      });
    }
  } catch (error) {
    // Send error back to background script
    if (port) {
      port.postMessage({
        type: 'accessibilitySnapshot',
        id,
        error: error.message
      });
    }
  }
}

// Initialize connection with proper checks
function initializeConnection() {
  // Check if we're in a valid context
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    console.warn('Extension context not available - might be on a restricted page (chrome://, chrome-extension://, etc.)');
    return;
  }
  
  // Additional check for restricted URLs
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'data:', 'file:'];
  const currentProtocol = window.location.protocol;
  if (restrictedProtocols.includes(currentProtocol)) {
    console.warn(`Content script cannot run on ${currentProtocol} pages`);
    return;
  }
  
  // Avoid duplicate connections
  if (port) {
    console.log('Connection already established');
    return;
  }
  
  connectToBackground();
}

// Initialize on different page states
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeConnection);
} else {
  // DOM is already loaded
  initializeConnection();
}

// Also listen for window load as a fallback
window.addEventListener('load', () => {
  if (!port) {
    initializeConnection();
  }
});

// Handle page visibility changes (useful for tabs that were in background)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !port) {
    console.log('Page became visible, attempting to connect');
    initializeConnection();
  }
});

// Helper function for testing Chrome APIs from the console
// Instead of injecting scripts, we'll use a different approach
// Users can dispatch the event directly from the console
console.log('To test Chrome APIs from the console, use:');
console.log('window.dispatchEvent(new CustomEvent("test-chrome-api", { detail: { apiCall: "tabs.query" } }))');

// Listen for the custom event from the page
window.addEventListener('test-chrome-api', (event) => {
  if (!port) {
    console.error('Not connected to background script');
    return;
  }
  
  console.log('Sending test request to background script...');
  
  // Create a unique ID for this request
  const requestId = 'test-' + Date.now();
  
  // Listen for the response
  const responseHandler = (message) => {
    if (message.type === 'testResponse' && message.id === requestId) {
      port.onMessage.removeListener(responseHandler);
      console.log('Test result:', message.result);
      if (message.error) {
        console.error('Test error:', message.error);
      }
    }
  };
  
  port.onMessage.addListener(responseHandler);
  
  // Send the test request
  port.postMessage({
    type: 'test',
    id: requestId,
    apiCall: event.detail.apiCall
  });
  
  // Remove listener after timeout
  setTimeout(() => {
    port.onMessage.removeListener(responseHandler);
  }, 5000);
});