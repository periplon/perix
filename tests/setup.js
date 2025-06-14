Object.defineProperty(window, 'chrome', {
  value: {
    runtime: {
      onInstalled: {
        addListener: jest.fn()
      },
      onStartup: {
        addListener: jest.fn()
      },
      onMessage: {
        addListener: jest.fn()
      },
      sendMessage: jest.fn(() => Promise.resolve()),
      connect: jest.fn(() => ({
        onMessage: {
          addListener: jest.fn()
        },
        onDisconnect: {
          addListener: jest.fn()
        },
        postMessage: jest.fn()
      }))
    },
    tabs: {
      query: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      reload: jest.fn(),
      goBack: jest.fn(),
      goForward: jest.fn(),
      captureVisibleTab: jest.fn(),
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    },
    scripting: {
      executeScript: jest.fn()
    },
    tabCapture: {
      capture: jest.fn()
    },
    cookies: {
      getAll: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    windows: {
      update: jest.fn()
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn()
      }
    }
  },
  writable: true
});

global.chrome = window.chrome;

global.WebSocket = jest.fn(() => {
  const ws = {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    readyState: 1
  };
  return ws;
});

global.WebSocket.OPEN = 1;
global.WebSocket.CLOSED = 3;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});