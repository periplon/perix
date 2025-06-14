global.chrome = {
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
    sendMessage: jest.fn(),
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
};

global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN
}));

global.WebSocket.OPEN = 1;
global.WebSocket.CLOSED = 3;

beforeEach(() => {
  jest.clearAllMocks();
});