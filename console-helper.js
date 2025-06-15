// Console helper for testing Chrome APIs
// Copy and paste this into the browser console to use testChromeAPI()

window.testChromeAPI = function(apiCall) {
  window.dispatchEvent(new CustomEvent('test-chrome-api', {
    detail: { apiCall: apiCall }
  }));
  console.log('Request sent to extension. Check console for results.');
};

console.log('testChromeAPI function loaded. Usage: testChromeAPI("tabs.query")');