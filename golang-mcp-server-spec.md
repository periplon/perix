# Browser Automation Extension - Golang MCP Server Implementation Specification

This document provides a comprehensive specification for implementing a Golang MCP (Model Context Protocol) server that interfaces with the Browser Automation Extension.

## Overview

The Browser Automation Extension is a Chrome extension that exposes browser automation capabilities through a WebSocket interface. It allows external applications to control browser tabs, interact with web pages, extract data, and manage browser storage.

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Golang MCP     │ ◄──────────────────► │ Chrome Extension │
│    Server       │   ws://localhost:8765│                  │
└─────────────────┘                     └──────────────────┘
        │                                         │
        │                                         │
        ▼                                         ▼
┌─────────────────┐                     ┌──────────────────┐
│   MCP Client    │                     │   Browser Tabs   │
│  (LLM/Tools)    │                     │   & Web Pages    │
└─────────────────┘                     └──────────────────┘
```

## WebSocket Protocol

### Connection Details
- **URL**: `ws://localhost:8765`
- **Protocol**: Standard WebSocket
- **Reconnection**: Automatic reconnection every 5 seconds on disconnect
- **Initial Handshake**: Extension sends `{"type": "connected", "version": "1.0.0"}` upon connection

### Message Format

#### Request Structure
```json
{
  "id": "unique-request-id",
  "command": "command.name",
  "params": {
    // Command-specific parameters
  }
}
```

#### Response Structure
```json
{
  "id": "unique-request-id",
  "type": "response",
  "result": {
    // Command-specific result
  }
}
```

#### Error Structure
```json
{
  "id": "unique-request-id",
  "type": "error",
  "error": "Error message"
}
```

## Data Models

### Tab Object
```go
type Tab struct {
    ID        int                    `json:"id"`
    URL       string                 `json:"url"`
    Title     string                 `json:"title"`
    Active    bool                   `json:"active"`
    WindowID  int                    `json:"windowId"`
    Index     int                    `json:"index"`
    Pinned    bool                   `json:"pinned"`
    Audible   bool                   `json:"audible"`
    MutedInfo map[string]interface{} `json:"mutedInfo"`
    Status    string                 `json:"status"`
}
```

### Element Object
```go
type Element struct {
    Index      int               `json:"index"`
    TagName    string            `json:"tagName"`
    ID         string            `json:"id"`
    ClassName  string            `json:"className"`
    Text       string            `json:"text"`       // First 100 chars
    Attributes map[string]string `json:"attributes"`
    Rect       DOMRect           `json:"rect"`
}

type DOMRect struct {
    X      float64 `json:"x"`
    Y      float64 `json:"y"`
    Width  float64 `json:"width"`
    Height float64 `json:"height"`
    Top    float64 `json:"top"`
    Right  float64 `json:"right"`
    Bottom float64 `json:"bottom"`
    Left   float64 `json:"left"`
}
```

### Cookie Object
```go
type Cookie struct {
    Name           string  `json:"name"`
    Value          string  `json:"value"`
    Domain         string  `json:"domain"`
    Path           string  `json:"path"`
    Secure         bool    `json:"secure"`
    HTTPOnly       bool    `json:"httpOnly"`
    SameSite       string  `json:"sameSite"`
    ExpirationDate float64 `json:"expirationDate,omitempty"`
    HostOnly       bool    `json:"hostOnly"`
    Session        bool    `json:"session"`
}
```

## Command Reference

### Tab Management

#### tabs.list
Lists all open browser tabs.

**Parameters**: None

**Returns**:
```go
type TabsListResult struct {
    Tabs []Tab `json:"tabs"`
}
```

#### tabs.create
Creates a new browser tab.

**Parameters**:
```go
type CreateTabParams struct {
    URL      string `json:"url"`
    Active   *bool  `json:"active,omitempty"`   // Default: true
    WindowID *int   `json:"windowId,omitempty"`
    Index    *int   `json:"index,omitempty"`
    Pinned   *bool  `json:"pinned,omitempty"`
}
```

**Returns**:
```go
type CreateTabResult struct {
    ID    int    `json:"id"`
    URL   string `json:"url"`
    Title string `json:"title"`
}
```

#### tabs.close
Closes a specific tab.

**Parameters**:
```go
type CloseTabParams struct {
    TabID int `json:"tabId"`
}
```

**Returns**: `{"success": true}`

#### tabs.activate
Activates (focuses) a specific tab.

**Parameters**:
```go
type ActivateTabParams struct {
    TabID int `json:"tabId"`
}
```

**Returns**: `{"success": true}`

#### tabs.reload
Reloads a specific tab.

**Parameters**:
```go
type ReloadTabParams struct {
    TabID       int  `json:"tabId"`
    BypassCache bool `json:"bypassCache,omitempty"`
}
```

**Returns**: `{"success": true}`

### Navigation

#### tabs.navigate
Navigates a tab to a new URL and waits for loading to complete.

**Parameters**:
```go
type NavigateParams struct {
    TabID int    `json:"tabId"`
    URL   string `json:"url"`
}
```

**Returns**: `{"success": true}`

#### tabs.goBack
Navigates back in the tab's history.

**Parameters**:
```go
type GoBackParams struct {
    TabID int `json:"tabId"`
}
```

**Returns**: `{"success": true}`

#### tabs.goForward
Navigates forward in the tab's history.

**Parameters**:
```go
type GoForwardParams struct {
    TabID int `json:"tabId"`
}
```

**Returns**: `{"success": true}`

### Content Interaction

#### tabs.click
Clicks on an element matching the selector.

**Parameters**:
```go
type ClickParams struct {
    TabID    int    `json:"tabId"`
    Selector string `json:"selector"`
    Index    int    `json:"index,omitempty"` // Default: 0
}
```

**Returns**: `{"success": boolean}`

#### tabs.type
Types text into an input or textarea element.

**Parameters**:
```go
type TypeParams struct {
    TabID    int    `json:"tabId"`
    Selector string `json:"selector"`
    Text     string `json:"text"`
    Append   bool   `json:"append,omitempty"` // Default: false
}
```

**Returns**: `{"success": boolean}`

#### tabs.scroll
Scrolls the page to specific coordinates.

**Parameters**:
```go
type ScrollParams struct {
    TabID    int    `json:"tabId"`
    X        int    `json:"x,omitempty"`        // Default: 0
    Y        int    `json:"y,omitempty"`        // Default: 0
    Behavior string `json:"behavior,omitempty"` // Default: "smooth"
}
```

**Returns**:
```go
type ScrollResult struct {
    X int `json:"x"` // Final scroll X position
    Y int `json:"y"` // Final scroll Y position
}
```

#### tabs.waitForElement
Waits for an element to appear on the page.

**Parameters**:
```go
type WaitForElementParams struct {
    TabID    int    `json:"tabId"`
    Selector string `json:"selector"`
    Timeout  int    `json:"timeout,omitempty"` // Default: 10000 (ms)
}
```

**Returns**:
```go
type WaitResult struct {
    Found   bool `json:"found"`
    Elapsed int  `json:"elapsed"` // Time taken in ms
}
```

### Content Extraction

#### tabs.extractText
Extracts text content from the page or specific elements.

**Parameters**:
```go
type ExtractTextParams struct {
    TabID    int    `json:"tabId"`
    Selector string `json:"selector,omitempty"` // If empty, extracts all body text
}
```

**Returns**:
```go
type TextResult struct {
    Text interface{} `json:"text"` // String or []string if multiple elements
}
```

#### tabs.findElements
Finds all elements matching a selector and returns their information.

**Parameters**:
```go
type FindElementsParams struct {
    TabID    int    `json:"tabId"`
    Selector string `json:"selector"`
}
```

**Returns**:
```go
type FindElementsResult struct {
    Elements []Element `json:"elements"`
}
```

#### tabs.executeScript
Executes JavaScript code in the context of a tab.

**Parameters**:
```go
type ExecuteScriptParams struct {
    TabID  int    `json:"tabId"`
    Script string `json:"script"`
    World  string `json:"world,omitempty"` // Default: "ISOLATED"
}
```

**Returns**: The result of the script execution (any type)

### Capture

#### tabs.captureScreenshot
Captures a screenshot of the current window.

**Parameters**:
```go
type CaptureScreenshotParams struct {
    WindowID int    `json:"windowId"`
    Format   string `json:"format,omitempty"`  // Default: "png"
    Quality  int    `json:"quality,omitempty"` // Default: 100
}
```

**Returns**:
```go
type ScreenshotResult struct {
    DataURL string `json:"dataUrl"` // Base64 encoded image
}
```

#### tabs.captureVideo
Starts video capture (screen recording).

**Parameters**:
```go
type CaptureVideoParams struct {
    Audio     bool `json:"audio,omitempty"`     // Default: false
    Width     int  `json:"width,omitempty"`     // Default: 1280
    Height    int  `json:"height,omitempty"`    // Default: 720
    FrameRate int  `json:"frameRate,omitempty"` // Default: 30
}
```

**Returns**:
```go
type VideoResult struct {
    StreamID string `json:"streamId"`
    Message  string `json:"message"`
}
```

### Storage Management

#### tabs.getCookies
Retrieves cookies based on specified criteria.

**Parameters**:
```go
type GetCookiesParams struct {
    URL    string `json:"url,omitempty"`
    Domain string `json:"domain,omitempty"`
    Name   string `json:"name,omitempty"`
}
```

**Returns**:
```go
type CookiesResult struct {
    Cookies []Cookie `json:"cookies"`
}
```

#### tabs.setCookie
Sets a cookie.

**Parameters**:
```go
type SetCookieParams struct {
    URL            string  `json:"url"`
    Name           string  `json:"name"`
    Value          string  `json:"value"`
    Domain         string  `json:"domain,omitempty"`
    Path           string  `json:"path,omitempty"`      // Default: "/"
    Secure         bool    `json:"secure,omitempty"`
    HTTPOnly       bool    `json:"httpOnly,omitempty"`
    ExpirationDate float64 `json:"expirationDate,omitempty"`
}
```

**Returns**:
```go
type SetCookieResult struct {
    Cookie Cookie `json:"cookie"`
}
```

#### tabs.deleteCookie
Deletes a cookie.

**Parameters**:
```go
type DeleteCookieParams struct {
    URL  string `json:"url"`
    Name string `json:"name"`
}
```

**Returns**: `{"success": true}`

#### tabs.getLocalStorage
Retrieves localStorage data from a tab.

**Parameters**:
```go
type GetLocalStorageParams struct {
    TabID int    `json:"tabId"`
    Key   string `json:"key,omitempty"` // If empty, returns all
}
```

**Returns**:
```go
type LocalStorageResult struct {
    Storage map[string]string `json:"storage"`
}
```

#### tabs.setLocalStorage
Sets a localStorage item in a tab.

**Parameters**:
```go
type SetLocalStorageParams struct {
    TabID int    `json:"tabId"`
    Key   string `json:"key"`
    Value string `json:"value"`
}
```

**Returns**: `{"success": boolean}`

#### tabs.clearLocalStorage
Clears all localStorage data in a tab.

**Parameters**:
```go
type ClearLocalStorageParams struct {
    TabID int `json:"tabId"`
}
```

**Returns**: `{"success": boolean}`

## Error Handling

The server should handle the following error cases:

1. **Missing Command**: Return error "Command not specified"
2. **Unknown Command**: Return error "Unknown command: {command}"
3. **Invalid Parameters**: Forward errors from the extension
4. **WebSocket Errors**: Log and handle reconnection gracefully
5. **Timeout Errors**: Implement appropriate timeouts for long-running operations

## Implementation Guidelines

### 1. WebSocket Server Setup
```go
package main

import (
    "github.com/gorilla/websocket"
    "net/http"
)

var upgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool {
        // Allow connections from localhost only
        return r.Host == "localhost:8765"
    },
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
    conn, err := upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("WebSocket upgrade failed: %v", err)
        return
    }
    defer conn.Close()
    
    // Handle messages
    handleConnection(conn)
}
```

### 2. Message Handler Structure
```go
type MessageHandler interface {
    HandleMessage(conn *websocket.Conn, msg Message) error
}

type CommandRegistry struct {
    handlers map[string]CommandHandler
}

func (r *CommandRegistry) Register(name string, handler CommandHandler) {
    r.handlers[name] = handler
}

func (r *CommandRegistry) Execute(command string, params json.RawMessage) (interface{}, error) {
    handler, exists := r.handlers[command]
    if !exists {
        return nil, fmt.Errorf("Unknown command: %s", command)
    }
    return handler.Execute(params)
}
```

### 3. MCP Integration
```go
// MCP Tool Implementation
type BrowserAutomationTool struct {
    wsClient *WebSocketClient
}

func (t *BrowserAutomationTool) GetTools() []mcp.Tool {
    return []mcp.Tool{
        {
            Name:        "browser_navigate",
            Description: "Navigate to a URL in the browser",
            Parameters:  navigateSchema,
        },
        {
            Name:        "browser_click",
            Description: "Click on an element in the browser",
            Parameters:  clickSchema,
        },
        // ... more tools
    }
}

func (t *BrowserAutomationTool) ExecuteTool(name string, params map[string]interface{}) (interface{}, error) {
    switch name {
    case "browser_navigate":
        return t.navigate(params)
    case "browser_click":
        return t.click(params)
    // ... more cases
    }
    return nil, fmt.Errorf("Unknown tool: %s", name)
}
```

### 4. Connection Management
```go
type ConnectionManager struct {
    conn      *websocket.Conn
    mu        sync.Mutex
    requests  map[string]chan Response
    connected bool
}

func (cm *ConnectionManager) SendRequest(command string, params interface{}) (interface{}, error) {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    if !cm.connected {
        return nil, errors.New("Not connected to browser extension")
    }
    
    // Generate unique ID
    id := generateUniqueID()
    
    // Create response channel
    respChan := make(chan Response, 1)
    cm.requests[id] = respChan
    
    // Send request
    req := Request{
        ID:      id,
        Command: command,
        Params:  params,
    }
    
    err := cm.conn.WriteJSON(req)
    if err != nil {
        delete(cm.requests, id)
        return nil, err
    }
    
    // Wait for response with timeout
    select {
    case resp := <-respChan:
        if resp.Type == "error" {
            return nil, errors.New(resp.Error)
        }
        return resp.Result, nil
    case <-time.After(30 * time.Second):
        delete(cm.requests, id)
        return nil, errors.New("Request timeout")
    }
}
```

### 5. Error Handling and Logging
```go
func (cm *ConnectionManager) handleMessage(msg []byte) error {
    var baseMsg BaseMessage
    if err := json.Unmarshal(msg, &baseMsg); err != nil {
        log.Printf("Failed to parse message: %v", err)
        return err
    }
    
    switch baseMsg.Type {
    case "connected":
        log.Printf("Connected to browser extension version: %s", baseMsg.Version)
        cm.connected = true
    case "response":
        var resp Response
        if err := json.Unmarshal(msg, &resp); err != nil {
            return err
        }
        cm.handleResponse(resp)
    case "error":
        var errResp ErrorResponse
        if err := json.Unmarshal(msg, &errResp); err != nil {
            return err
        }
        cm.handleError(errResp)
    }
    
    return nil
}
```

## Testing

### Unit Tests
- Test each command handler independently
- Mock WebSocket connections
- Verify request/response serialization

### Integration Tests
- Test actual WebSocket communication
- Verify command execution flow
- Test error scenarios and timeouts

### Example Test
```go
func TestNavigateCommand(t *testing.T) {
    // Setup mock WebSocket server
    server := httptest.NewServer(http.HandlerFunc(mockWebSocketHandler))
    defer server.Close()
    
    // Create client
    client := NewBrowserClient(server.URL)
    err := client.Connect()
    assert.NoError(t, err)
    
    // Test navigate command
    result, err := client.Navigate(1234, "https://example.com")
    assert.NoError(t, err)
    assert.True(t, result.Success)
}
```

## Security Considerations

1. **Localhost Only**: Ensure WebSocket server only accepts connections from localhost
2. **Input Validation**: Validate all command parameters before forwarding
3. **Script Execution**: Be cautious with `executeScript` command - consider sandboxing
4. **Cookie Access**: Implement proper access controls for cookie operations
5. **Rate Limiting**: Consider implementing rate limiting for resource-intensive operations

## Performance Optimization

1. **Connection Pooling**: Reuse WebSocket connections
2. **Request Batching**: Support batching multiple commands
3. **Async Operations**: Implement async command execution for long-running operations
4. **Caching**: Cache tab information to reduce round trips
5. **Compression**: Enable WebSocket compression for large data transfers

## Deployment

1. **Configuration**: Use environment variables for WebSocket URL and port
2. **Logging**: Implement structured logging with levels
3. **Monitoring**: Add metrics for command execution times and error rates
4. **Health Checks**: Implement health check endpoints
5. **Graceful Shutdown**: Handle SIGTERM/SIGINT properly

## Example Usage

```go
// Initialize browser automation client
client := NewBrowserAutomationClient("ws://localhost:8765")
err := client.Connect()
if err != nil {
    log.Fatal("Failed to connect:", err)
}

// Create a new tab
tab, err := client.CreateTab("https://example.com", true)
if err != nil {
    log.Fatal("Failed to create tab:", err)
}

// Wait for an element
found, err := client.WaitForElement(tab.ID, "#search-input", 5000)
if err != nil || !found {
    log.Fatal("Element not found")
}

// Type in the search box
success, err := client.Type(tab.ID, "#search-input", "golang mcp server")
if err != nil || !success {
    log.Fatal("Failed to type")
}

// Click search button
success, err = client.Click(tab.ID, "#search-button", 0)
if err != nil || !success {
    log.Fatal("Failed to click")
}

// Extract results
results, err := client.ExtractText(tab.ID, ".search-result")
if err != nil {
    log.Fatal("Failed to extract results:", err)
}

fmt.Println("Search results:", results)
```

## Conclusion

This specification provides a complete guide for implementing a Golang MCP server that interfaces with the Browser Automation Extension. The server acts as a bridge between MCP clients (like LLMs) and the browser, enabling automated web interactions through a standardized protocol.

The implementation should focus on reliability, performance, and security while maintaining compatibility with the existing extension protocol. Regular testing and monitoring will ensure the system remains stable and performant in production environments.