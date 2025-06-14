const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8765 });

console.log('WebSocket server running on ws://localhost:8765');

wss.on('connection', (ws) => {
  console.log('Extension connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received:', message);

      if (message.type === 'connected') {
        console.log('Extension version:', message.version);
        
        // Example: List all tabs after connection
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 'demo-1',
            command: 'tabs.list'
          }));
        }, 1000);
      } else if (message.type === 'response') {
        console.log('Command response:', message.result);
        
        // Example: Create a new tab after listing
        if (message.id === 'demo-1' && message.result) {
          ws.send(JSON.stringify({
            id: 'demo-2',
            command: 'tabs.create',
            params: {
              url: 'https://www.example.com',
              active: true
            }
          }));
        }
        
        // Example: Extract text after creating tab
        if (message.id === 'demo-2' && message.result) {
          setTimeout(() => {
            ws.send(JSON.stringify({
              id: 'demo-3',
              command: 'tabs.extractText',
              params: {
                tabId: message.result.id,
                selector: 'h1'
              }
            }));
          }, 2000);
        }
      } else if (message.type === 'error') {
        console.error('Command error:', message.error);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Extension disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Example commands you can send
const exampleCommands = {
  listTabs: {
    id: '1',
    command: 'tabs.list'
  },
  createTab: {
    id: '2',
    command: 'tabs.create',
    params: {
      url: 'https://www.google.com',
      active: true
    }
  },
  navigateTab: {
    id: '3',
    command: 'tabs.navigate',
    params: {
      tabId: 123, // Replace with actual tab ID
      url: 'https://www.github.com'
    }
  },
  clickElement: {
    id: '4',
    command: 'tabs.click',
    params: {
      tabId: 123, // Replace with actual tab ID
      selector: 'button[type="submit"]'
    }
  },
  extractText: {
    id: '5',
    command: 'tabs.extractText',
    params: {
      tabId: 123, // Replace with actual tab ID
      selector: '.main-content'
    }
  },
  captureScreenshot: {
    id: '6',
    command: 'tabs.captureScreenshot',
    params: {
      windowId: 1,
      format: 'png',
      quality: 100
    }
  }
};

console.log('Example commands:', exampleCommands);