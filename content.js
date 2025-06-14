let port = null;

function connectToBackground() {
  port = chrome.runtime.connect({ name: 'content-script' });
  
  port.onMessage.addListener((message) => {
    handleBackgroundMessage(message);
  });
  
  port.onDisconnect.addListener(() => {
    console.log('Disconnected from background script');
    setTimeout(connectToBackground, 1000);
  });
}

function handleBackgroundMessage(message) {
  const { command, params, id } = message;
  
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
  port.postMessage({
    id,
    type: 'response',
    result
  });
}

function sendError(id, error) {
  port.postMessage({
    id,
    type: 'error',
    error: error.toString()
  });
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

window.addEventListener('load', () => {
  connectToBackground();
});

if (document.readyState === 'complete') {
  connectToBackground();
}