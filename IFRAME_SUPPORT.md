# Iframe Support Documentation

This document describes the enhanced iframe support added to the Browser Automation Extension.

## Overview

The extension now provides comprehensive support for interacting with elements inside iframes and complex webpage structures. This includes:

1. **Frame-aware selectors** - Target elements within specific iframes
2. **Frame discovery** - Find and enumerate all frames in a page
3. **Cross-frame operations** - Execute commands across all frames
4. **Frame-specific execution** - Target specific frames by ID

## Frame Selector Syntax

Use the `>>>` delimiter to specify frame context in selectors:

```javascript
// Target an element within a specific iframe
"iframe#content >>> button.submit"

// Target an element within nested iframes
"iframe#outer >>> iframe.inner >>> div.content"

// Use any valid CSS selector for frames
"iframe[name='widget'] >>> input[type='email']"
"iframe.payment-frame >>> button"
```

## Enhanced Commands

### All DOM Commands

All DOM manipulation commands now support iframe operations:

- `tabs.click`
- `tabs.type`
- `tabs.sendKey`
- `tabs.findElements`
- `tabs.extractText`
- `tabs.scroll`
- `tabs.waitForElement`
- `tabs.getActionables`

#### Using Frame Selectors

```javascript
// Click a button inside an iframe
{
  command: "tabs.click",
  params: {
    tabId: 123,
    selector: "iframe#loginFrame >>> button.submit"
  }
}

// Type in an input field within an iframe
{
  command: "tabs.type",
  params: {
    tabId: 123,
    selector: "iframe.form-container >>> input[name='email']",
    text: "user@example.com"
  }
}
```

#### Using Frame ID

```javascript
// Click using a specific frame ID
{
  command: "tabs.click",
  params: {
    tabId: 123,
    selector: "button.submit",
    frameId: 2
  }
}
```

#### Searching All Frames

```javascript
// Find all buttons across all frames
{
  command: "tabs.findElements",
  params: {
    tabId: 123,
    selector: "button",
    allFrames: true
  }
}

// Extract text from all frames
{
  command: "tabs.extractText",
  params: {
    tabId: 123,
    selector: "p",
    allFrames: true
  }
}
```

### New Frame-Specific Commands

#### tabs.getFrames

Get information about all frames in a tab:

```javascript
{
  command: "tabs.getFrames",
  params: {
    tabId: 123
  }
}

// Response:
{
  frames: [
    {
      frameId: 0,
      parentFrameId: -1,
      url: "https://example.com",
      frameType: "outermost_frame"
    },
    {
      frameId: 1,
      parentFrameId: 0,
      url: "https://example.com/widget",
      frameType: "sub_frame"
    }
  ]
}
```

#### tabs.waitForIframe

Wait for an iframe to load before proceeding:

```javascript
{
  command: "tabs.waitForIframe",
  params: {
    tabId: 123,
    selector: "iframe#dynamicContent",
    timeout: 5000  // optional, defaults to 5000ms
  }
}

// Response:
{
  loaded: true,
  elapsed: "iframe loaded"
}
```

### Enhanced Script Execution

The `tabs.executeScript` command now supports frame execution:

```javascript
// Execute in a specific frame
{
  command: "tabs.executeScript",
  params: {
    tabId: 123,
    script: "return document.title;",
    frameId: 1
  }
}

// Execute in all frames
{
  command: "tabs.executeScript",
  params: {
    tabId: 123,
    script: "return location.href;",
    allFrames: true
  }
}
```

### Storage Commands with Frame Support

LocalStorage and SessionStorage commands can target specific frames:

```javascript
// Get localStorage from a specific frame
{
  command: "tabs.getLocalStorage",
  params: {
    tabId: 123,
    key: "userData",
    frameId: 1
  }
}

// Set localStorage in a specific frame
{
  command: "tabs.setLocalStorage",
  params: {
    tabId: 123,
    key: "preference",
    value: "dark-mode",
    frameId: 1
  }
}
```

## Complex Webpage Support

### Shadow DOM Compatibility

While Shadow DOM is not directly supported through selectors, you can use `tabs.executeScript` to interact with shadow roots:

```javascript
{
  command: "tabs.executeScript",
  params: {
    tabId: 123,
    script: `
      const host = document.querySelector('#shadow-host');
      const shadowRoot = host.shadowRoot;
      const button = shadowRoot.querySelector('button');
      button.click();
      return true;
    `
  }
}
```

### Dynamic Content

Use `tabs.waitForElement` with frame selectors for dynamic content:

```javascript
// Wait for dynamic content in an iframe
{
  command: "tabs.waitForElement",
  params: {
    tabId: 123,
    selector: "iframe#chat >>> div.message-list",
    timeout: 10000
  }
}
```

### Cross-Origin Iframes

Note: Due to browser security restrictions, cross-origin iframes have limitations:
- Cannot access content directly
- Can still interact through simulated events
- Frame enumeration works regardless of origin

## Best Practices

1. **Use frame selectors** when you know the iframe structure
2. **Use frame IDs** when working with dynamic frames
3. **Use `allFrames`** when searching across entire page
4. **Wait for iframes** to load before interacting with their content
5. **Handle errors** gracefully as frames may be removed/added dynamically

## Example: Complete Iframe Interaction

```javascript
// 1. Wait for iframe to load
await sendCommand({
  command: "tabs.waitForIframe",
  params: {
    tabId: currentTab.id,
    selector: "iframe#paymentFrame"
  }
});

// 2. Fill form fields in iframe
await sendCommand({
  command: "tabs.type",
  params: {
    tabId: currentTab.id,
    selector: "iframe#paymentFrame >>> input[name='cardNumber']",
    text: "4111111111111111"
  }
});

// 3. Click submit button in iframe
await sendCommand({
  command: "tabs.click",
  params: {
    tabId: currentTab.id,
    selector: "iframe#paymentFrame >>> button[type='submit']"
  }
});

// 4. Wait for success message
await sendCommand({
  command: "tabs.waitForElement",
  params: {
    tabId: currentTab.id,
    selector: "iframe#paymentFrame >>> .success-message",
    timeout: 10000
  }
});
```

## Limitations

1. **Cross-origin restrictions**: Cannot read content from cross-origin iframes
2. **Dynamic frames**: Frame IDs may change when frames are recreated
3. **Nested frame limits**: Very deep nesting (>5 levels) may have performance impact
4. **Shadow DOM**: Requires custom scripts for interaction

## Migration Guide

Existing commands continue to work as before. To use iframe features:

1. Add frame context to selectors using `>>>`
2. Add `frameId` parameter for specific frame targeting
3. Add `allFrames: true` for cross-frame operations
4. Use new commands for frame discovery and waiting