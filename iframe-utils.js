// Utility functions for handling iframes and frame contexts

/**
 * Executes a script in the specified frame context
 * @param {Object} params - Parameters for frame execution
 * @param {number} params.tabId - The tab ID
 * @param {number} [params.frameId] - The frame ID (optional, defaults to main frame)
 * @param {Function|string} params.func - The function to execute
 * @param {Array} [params.args] - Arguments to pass to the function
 * @param {string} [params.world] - Execution world ('ISOLATED' or 'MAIN')
 * @returns {Promise<any>} The result of the script execution
 */
export async function executeInFrame(params) {
  const { tabId, frameId = 0, func, args = [], world = 'ISOLATED' } = params;
  
  const injection = {
    target: { tabId },
    func: typeof func === 'string' ? new Function(func) : func,
    world
  };
  
  // Add frameId if specified (0 is main frame)
  if (frameId !== undefined) {
    injection.target.frameIds = [frameId];
  }
  
  if (args.length > 0) {
    injection.args = args;
  }
  
  const results = await chrome.scripting.executeScript(injection);
  return results[0]?.result;
}

/**
 * Gets all frames in a tab with their hierarchy
 * @param {number} tabId - The tab ID
 * @returns {Promise<Array>} Array of frame information
 */
export async function getAllFrames(tabId) {
  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  return frames.map(frame => ({
    frameId: frame.frameId,
    parentFrameId: frame.parentFrameId,
    url: frame.url,
    frameType: frame.frameType,
    documentId: frame.documentId,
    documentLifecycle: frame.documentLifecycle,
    errorOccurred: frame.errorOccurred
  }));
}

/**
 * Finds frames matching a URL pattern or selector
 * @param {number} tabId - The tab ID
 * @param {Object} criteria - Search criteria
 * @param {string} [criteria.url] - URL pattern to match
 * @param {string} [criteria.name] - Frame name to match
 * @param {string} [criteria.selector] - CSS selector for iframe element
 * @returns {Promise<Array>} Array of matching frame IDs
 */
export async function findFrames(tabId, criteria = {}) {
  const frames = await getAllFrames(tabId);
  let matchingFrames = frames;
  
  if (criteria.url) {
    const urlPattern = new RegExp(criteria.url);
    matchingFrames = matchingFrames.filter(frame => urlPattern.test(frame.url));
  }
  
  if (criteria.name || criteria.selector) {
    // Need to check iframe elements in the parent frame
    const frameElements = await executeInFrame({
      tabId,
      func: (namePattern, selector) => {
        const iframes = document.querySelectorAll('iframe, frame');
        const matches = [];
        
        iframes.forEach((iframe, index) => {
          let match = false;
          
          if (namePattern && iframe.name && iframe.name.includes(namePattern)) {
            match = true;
          }
          
          if (selector) {
            try {
              if (iframe.matches(selector)) {
                match = true;
              }
            } catch (e) {
              // Invalid selector
            }
          }
          
          if (match) {
            matches.push({
              index,
              name: iframe.name,
              id: iframe.id,
              src: iframe.src
            });
          }
        });
        
        return matches;
      },
      args: [criteria.name, criteria.selector]
    });
    
    // Map iframe elements to frame IDs
    // This is approximate - we match by URL when possible
    matchingFrames = matchingFrames.filter(frame => {
      return frameElements.some(elem => 
        elem.src && frame.url && frame.url.includes(elem.src)
      );
    });
  }
  
  return matchingFrames.map(f => f.frameId);
}

/**
 * Converts a selector with frame context to execute in the correct frame
 * Supports syntax like "iframe#myframe >>> .my-element" or "frame[name='content'] >>> button"
 * @param {string} selector - The selector with optional frame context
 * @returns {Object} Object with frameSelector and elementSelector
 */
export function parseFrameSelector(selector) {
  const frameDelimiter = '>>>';
  
  if (!selector.includes(frameDelimiter)) {
    return {
      frameSelector: null,
      elementSelector: selector
    };
  }
  
  const parts = selector.split(frameDelimiter).map(s => s.trim());
  
  if (parts.length === 2) {
    return {
      frameSelector: parts[0],
      elementSelector: parts[1]
    };
  }
  
  // Handle nested frames (iframe >>> iframe >>> element)
  return {
    frameSelectors: parts.slice(0, -1),
    elementSelector: parts[parts.length - 1]
  };
}

/**
 * Executes a command across all frames if needed
 * @param {Object} params - Command parameters
 * @param {number} params.tabId - The tab ID
 * @param {boolean} params.allFrames - Whether to execute in all frames
 * @param {Function} params.func - The function to execute
 * @param {Array} params.args - Arguments for the function
 * @returns {Promise<Array>} Results from all frames
 */
export async function executeInAllFrames(params) {
  const { tabId, func, args = [], world = 'ISOLATED' } = params;
  
  const injection = {
    target: { 
      tabId,
      allFrames: true 
    },
    func,
    world
  };
  
  if (args.length > 0) {
    injection.args = args;
  }
  
  const results = await chrome.scripting.executeScript(injection);
  
  // Filter out null results and add frame information
  return results
    .filter(result => result.result !== null && result.result !== undefined)
    .map(result => ({
      frameId: result.frameId,
      documentId: result.documentId,
      result: result.result
    }));
}

/**
 * Helper to wait for iframe to load
 * @param {number} tabId - The tab ID
 * @param {string} frameSelector - Selector for the iframe element
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} True if iframe loaded
 */
export async function waitForIframe(tabId, frameSelector, timeout = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const iframeExists = await executeInFrame({
      tabId,
      func: (selector) => {
        const iframe = document.querySelector(selector);
        if (!iframe) return false;
        
        try {
          // Check if iframe content is accessible
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          return iframeDoc && iframeDoc.readyState === 'complete';
        } catch (e) {
          // Cross-origin iframe - just check if it exists
          return true;
        }
      },
      args: [frameSelector]
    });
    
    if (iframeExists) return true;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}