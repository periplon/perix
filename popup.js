document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const refreshTabsBtn = document.getElementById('refreshTabsBtn');
  const tabsList = document.getElementById('tabsList');
  
  let isConnected = false;
  
  async function checkConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getConnectionStatus' });
      isConnected = response?.connected || false;
      updateConnectionStatus();
    } catch (error) {
      isConnected = false;
      updateConnectionStatus();
    }
  }
  
  function updateConnectionStatus() {
    if (isConnected) {
      statusIndicator.classList.add('connected');
      statusIndicator.classList.remove('disconnected');
      statusText.textContent = 'Connected';
      reconnectBtn.disabled = true;
    } else {
      statusIndicator.classList.remove('connected');
      statusIndicator.classList.add('disconnected');
      statusText.textContent = 'Disconnected';
      reconnectBtn.disabled = false;
    }
  }
  
  async function loadTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      displayTabs(tabs);
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }
  
  function displayTabs(tabs) {
    tabsList.innerHTML = '';
    
    if (tabs.length === 0) {
      tabsList.innerHTML = '<div style="padding: 12px; text-align: center; color: #666;">No tabs found</div>';
      return;
    }
    
    tabs.forEach(tab => {
      const tabItem = document.createElement('div');
      tabItem.className = 'tab-item';
      
      const title = document.createElement('div');
      title.className = 'tab-title';
      title.textContent = tab.title || 'Untitled';
      
      const url = document.createElement('div');
      url.className = 'tab-url';
      url.textContent = tab.url || '';
      
      tabItem.appendChild(title);
      tabItem.appendChild(url);
      
      tabItem.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      });
      
      tabsList.appendChild(tabItem);
    });
  }
  
  reconnectBtn.addEventListener('click', async () => {
    reconnectBtn.disabled = true;
    statusText.textContent = 'Reconnecting...';
    
    try {
      await chrome.runtime.sendMessage({ type: 'reconnect' });
      setTimeout(checkConnection, 1000);
    } catch (error) {
      console.error('Error reconnecting:', error);
      checkConnection();
    }
  });
  
  refreshTabsBtn.addEventListener('click', loadTabs);
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'connectionStatusChanged') {
      isConnected = message.connected;
      updateConnectionStatus();
    }
  });
  
  checkConnection();
  loadTabs();
  
  setInterval(checkConnection, 5000);
});