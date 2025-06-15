// Test script for tabs.getAccessibilitySnapshot
// This can be run from the WebSocket client to test the functionality

async function testAccessibilitySnapshot() {
  console.log('Testing tabs.getAccessibilitySnapshot...\n');
  
  // Test 1: Basic snapshot with default parameters
  console.log('Test 1: Basic accessibility snapshot');
  try {
    const response1 = await sendCommand('tabs.getAccessibilitySnapshot', {
      tabId: 1  // Replace with actual tab ID
    });
    console.log('✓ Basic snapshot:', JSON.stringify(response1.snapshot, null, 2));
  } catch (error) {
    console.error('✗ Basic snapshot failed:', error);
  }
  
  // Test 2: Snapshot with interestingOnly = false
  console.log('\nTest 2: Full accessibility tree (interestingOnly = false)');
  try {
    const response2 = await sendCommand('tabs.getAccessibilitySnapshot', {
      tabId: 1,  // Replace with actual tab ID
      interestingOnly: false
    });
    console.log('✓ Full tree snapshot:', JSON.stringify(response2.snapshot, null, 2));
  } catch (error) {
    console.error('✗ Full tree snapshot failed:', error);
  }
  
  // Test 3: Snapshot with specific root selector
  console.log('\nTest 3: Snapshot with root selector');
  try {
    const response3 = await sendCommand('tabs.getAccessibilitySnapshot', {
      tabId: 1,  // Replace with actual tab ID
      root: '#main-content'
    });
    console.log('✓ Root selector snapshot:', JSON.stringify(response3.snapshot, null, 2));
  } catch (error) {
    console.error('✗ Root selector snapshot failed:', error);
  }
  
  // Test 4: Invalid tab ID
  console.log('\nTest 4: Invalid tab ID (error handling)');
  try {
    await sendCommand('tabs.getAccessibilitySnapshot', {
      tabId: 99999
    });
    console.log('✗ Should have failed with invalid tab ID');
  } catch (error) {
    console.log('✓ Correctly handled error:', error);
  }
  
  // Test 5: Non-existent root selector
  console.log('\nTest 5: Non-existent root selector');
  try {
    const response5 = await sendCommand('tabs.getAccessibilitySnapshot', {
      tabId: 1,  // Replace with actual tab ID
      root: '#non-existent-element'
    });
    console.log('Result:', response5.snapshot);
    if (!response5.snapshot) {
      console.log('✓ Correctly returned null for non-existent root');
    }
  } catch (error) {
    console.error('✗ Non-existent root failed:', error);
  }
}

// Helper function to send WebSocket command (placeholder)
async function sendCommand(command, params) {
  // This would be implemented by the WebSocket client
  console.log(`Sending command: ${command}`, params);
  // Return mock response for testing
  return { 
    snapshot: { 
      role: 'document',
      children: []
    } 
  };
}

// Run tests if this script is executed directly
if (typeof module === 'undefined') {
  testAccessibilitySnapshot();
}