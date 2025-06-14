# Browser Automation Controller

[![Test](https://github.com/periplon/perix/actions/workflows/test.yml/badge.svg)](https://github.com/periplon/perix/actions/workflows/test.yml)
[![Security](https://github.com/periplon/perix/actions/workflows/security.yml/badge.svg)](https://github.com/periplon/perix/actions/workflows/security.yml)

A Chrome extension that enables WebSocket-based browser automation for MCP (Model Context Protocol) server integration. This extension provides comprehensive control over browser tabs, navigation, content extraction, and interaction capabilities.

## Features

### Tab Management
- List all open tabs with detailed information
- Create new tabs with specified URLs
- Close, activate, and reload tabs
- Navigate forward/backward in tab history

### Navigation & Interaction
- Navigate to URLs with automatic load detection
- Click elements using CSS selectors
- Type text into input fields
- Scroll to specific positions
- Simulate keyboard and mouse events

### Content Extraction
- Extract text from pages or specific elements
- Find elements using CSS selectors
- Get element information including position, styles, and attributes
- Extract structured data from tables and lists

### Screen Capture
- Capture screenshots in PNG/JPEG format
- Start video recording of tabs
- Configurable quality and format options

### Storage Management
- Get/set/delete cookies
- Access and modify localStorage
- Clear browsing data

### Advanced Features
- Execute custom JavaScript in page context
- Inject and remove CSS styles
- Observe DOM mutations
- Wait for elements to appear
- Highlight elements for debugging

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory

## WebSocket API

The extension connects to a WebSocket server at `ws://localhost:8765` by default.

### Message Format

Request:
```json
{
  "id": "unique-request-id",
  "command": "command.name",
  "params": {
    // command-specific parameters
  }
}
```

Response:
```json
{
  "id": "unique-request-id",
  "type": "response",
  "result": {
    // command result
  }
}
```

Error:
```json
{
  "id": "unique-request-id",
  "type": "error",
  "error": "Error message"
}
```

### Available Commands

#### Tab Management

**tabs.list** - List all open tabs
```json
{
  "command": "tabs.list"
}
```

**tabs.create** - Create a new tab
```json
{
  "command": "tabs.create",
  "params": {
    "url": "https://example.com",
    "active": true,
    "windowId": 1,
    "index": 0,
    "pinned": false
  }
}
```

**tabs.close** - Close a tab
```json
{
  "command": "tabs.close",
  "params": {
    "tabId": 123
  }
}
```

**tabs.activate** - Make a tab active
```json
{
  "command": "tabs.activate",
  "params": {
    "tabId": 123
  }
}
```

**tabs.reload** - Reload a tab
```json
{
  "command": "tabs.reload",
  "params": {
    "tabId": 123,
    "bypassCache": false
  }
}
```

#### Navigation

**tabs.navigate** - Navigate to a URL
```json
{
  "command": "tabs.navigate",
  "params": {
    "tabId": 123,
    "url": "https://example.com"
  }
}
```

**tabs.goBack** - Go back in history
```json
{
  "command": "tabs.goBack",
  "params": {
    "tabId": 123
  }
}
```

**tabs.goForward** - Go forward in history
```json
{
  "command": "tabs.goForward",
  "params": {
    "tabId": 123
  }
}
```

#### Interaction

**tabs.click** - Click an element
```json
{
  "command": "tabs.click",
  "params": {
    "tabId": 123,
    "selector": "#submit-button",
    "index": 0
  }
}
```

**tabs.type** - Type text into an input
```json
{
  "command": "tabs.type",
  "params": {
    "tabId": 123,
    "selector": "input[name='email']",
    "text": "user@example.com",
    "append": false
  }
}
```

**tabs.scroll** - Scroll to position
```json
{
  "command": "tabs.scroll",
  "params": {
    "tabId": 123,
    "x": 0,
    "y": 500,
    "behavior": "smooth"
  }
}
```

#### Content Extraction

**tabs.extractText** - Extract text content
```json
{
  "command": "tabs.extractText",
  "params": {
    "tabId": 123,
    "selector": ".article-content"
  }
}
```

**tabs.findElements** - Find elements on page
```json
{
  "command": "tabs.findElements",
  "params": {
    "tabId": 123,
    "selector": "a[href^='https']"
  }
}
```

#### Screen Capture

**tabs.captureScreenshot** - Capture visible area
```json
{
  "command": "tabs.captureScreenshot",
  "params": {
    "windowId": 1,
    "format": "png",
    "quality": 100
  }
}
```

**tabs.captureVideo** - Start video recording
```json
{
  "command": "tabs.captureVideo",
  "params": {
    "audio": false,
    "width": 1280,
    "height": 720,
    "frameRate": 30
  }
}
```

#### Script Execution

**tabs.executeScript** - Execute JavaScript
```json
{
  "command": "tabs.executeScript",
  "params": {
    "tabId": 123,
    "script": "return document.title;",
    "world": "ISOLATED"
  }
}
```

#### Storage

**tabs.getCookies** - Get cookies
```json
{
  "command": "tabs.getCookies",
  "params": {
    "url": "https://example.com",
    "name": "session_id"
  }
}
```

**tabs.setCookie** - Set a cookie
```json
{
  "command": "tabs.setCookie",
  "params": {
    "url": "https://example.com",
    "name": "session_id",
    "value": "abc123",
    "secure": true,
    "httpOnly": true
  }
}
```

**tabs.deleteCookie** - Delete a cookie
```json
{
  "command": "tabs.deleteCookie",
  "params": {
    "url": "https://example.com",
    "name": "session_id"
  }
}
```

**tabs.getLocalStorage** - Get localStorage
```json
{
  "command": "tabs.getLocalStorage",
  "params": {
    "tabId": 123,
    "key": "user_preferences"
  }
}
```

**tabs.setLocalStorage** - Set localStorage
```json
{
  "command": "tabs.setLocalStorage",
  "params": {
    "tabId": 123,
    "key": "user_preferences",
    "value": "{\"theme\":\"dark\"}"
  }
}
```

**tabs.clearLocalStorage** - Clear all localStorage
```json
{
  "command": "tabs.clearLocalStorage",
  "params": {
    "tabId": 123
  }
}
```

**tabs.getSessionStorage** - Get sessionStorage
```json
{
  "command": "tabs.getSessionStorage",
  "params": {
    "tabId": 123,
    "key": "temp_data"
  }
}
```

**tabs.setSessionStorage** - Set sessionStorage
```json
{
  "command": "tabs.setSessionStorage",
  "params": {
    "tabId": 123,
    "key": "temp_data",
    "value": "{\"sessionId\":\"abc123\"}"
  }
}
```

**tabs.clearSessionStorage** - Clear all sessionStorage
```json
{
  "command": "tabs.clearSessionStorage",
  "params": {
    "tabId": 123
  }
}
```

#### Utilities

**tabs.waitForElement** - Wait for element to appear
```json
{
  "command": "tabs.waitForElement",
  "params": {
    "tabId": 123,
    "selector": "#dynamic-content",
    "timeout": 10000
  }
}
```

## Example WebSocket Client

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');

ws.on('open', () => {
  console.log('Connected to browser automation extension');
  
  // List all tabs
  ws.send(JSON.stringify({
    id: '1',
    command: 'tabs.list'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
  
  if (message.type === 'connected') {
    console.log('Extension connected, version:', message.version);
  } else if (message.type === 'response') {
    console.log('Command result:', message.result);
  } else if (message.type === 'error') {
    console.error('Command error:', message.error);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('Disconnected from browser automation extension');
});
```

## Security Considerations

- The extension requires broad permissions to function properly
- WebSocket connection is limited to localhost by default
- Consider implementing authentication for production use
- Be cautious when executing arbitrary JavaScript code

## Development

To modify the extension:

1. Edit the source files
2. Reload the extension in Chrome
3. Test changes with your WebSocket client

### Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint
```

### CI/CD

This project uses GitHub Actions for continuous integration:

- **Test Workflow**: Runs on all pushes and pull requests
  - Runs tests on Node.js 16.x, 18.x, and 20.x
  - Runs linter and coverage checks
  - Creates extension package artifacts
  
- **Security Workflow**: Runs security scans
  - npm audit for dependency vulnerabilities
  - CodeQL analysis for code security
  - Dependency review on pull requests
  
- **Release Workflow**: Automated releases on version tags
  - Creates extension packages
  - Publishes GitHub releases

## License

MIT