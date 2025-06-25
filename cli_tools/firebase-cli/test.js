#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const chalk = require('chalk');

const CLI_PATH = path.join(__dirname, 'firebase-cli');
let testsPassed = 0;
let testsFailed = 0;

function runCommand(command) {
  try {
    const output = execSync(`${CLI_PATH} ${command}`, { encoding: 'utf8' });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.stderr || error.message };
  }
}

function test(description, fn) {
  process.stdout.write(`Testing: ${description}... `);
  try {
    fn();
    console.log(chalk.green('✓ PASS'));
    testsPassed++;
  } catch (error) {
    console.log(chalk.red('✗ FAIL'));
    console.error(chalk.red(`  Error: ${error.message}`));
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test collection for our tests
const TEST_COLLECTION = 'firebase-cli-test';
let testDocId = null;

console.log(chalk.cyan('\n=== Firebase CLI E2E Tests ===\n'));

// Test 1: Help command
test('Help command shows usage', () => {
  const result = runCommand('--help');
  assert(result.success, 'Help command should succeed');
  assert(result.output.includes('Firebase CLI tool'), 'Should show description');
  assert(result.output.includes('firestore'), 'Should show firestore command');
  assert(result.output.includes('auth'), 'Should show auth command');
  assert(result.output.includes('storage'), 'Should show storage command');
});

// Test 2: Firestore add document
test('Firestore add document', () => {
  const testData = {
    name: 'Test User',
    email: 'test@example.com',
    active: true
  };
  
  const result = runCommand(`firestore add ${TEST_COLLECTION} --data '${JSON.stringify(testData)}' --json`);
  assert(result.success, 'Add command should succeed');
  
  const response = JSON.parse(result.output);
  assert(response.id, 'Should return document ID');
  assert(response.collection === TEST_COLLECTION, 'Should return correct collection');
  
  testDocId = response.id; // Save for later tests
});

// Test 3: Firestore list documents
test('Firestore list documents', () => {
  const result = runCommand(`firestore list ${TEST_COLLECTION} --json`);
  assert(result.success, 'List command should succeed');
  
  const response = JSON.parse(result.output);
  assert(Array.isArray(response.documents), 'Should return documents array');
  assert(response.count > 0, 'Should have at least one document');
  
  const testDoc = response.documents.find(doc => doc.id === testDocId);
  assert(testDoc, 'Should find our test document');
  assert(testDoc.name === 'Test User', 'Document should have correct data');
});

// Test 4: Firestore get document
test('Firestore get document', () => {
  const result = runCommand(`firestore get ${TEST_COLLECTION} ${testDocId} --json`);
  assert(result.success, 'Get command should succeed');
  
  const doc = JSON.parse(result.output);
  assert(doc.id === testDocId, 'Should return correct document ID');
  assert(doc.name === 'Test User', 'Should have correct name');
  assert(doc.email === 'test@example.com', 'Should have correct email');
});

// Test 5: Firestore update document
test('Firestore update document', () => {
  const updateData = {
    name: 'Updated User',
    active: false
  };
  
  const result = runCommand(`firestore update ${TEST_COLLECTION} ${testDocId} --data '${JSON.stringify(updateData)}' --json`);
  assert(result.success, 'Update command should succeed');
  
  const response = JSON.parse(result.output);
  assert(response.success === true, 'Should indicate success');
  
  // Verify update
  const getResult = runCommand(`firestore get ${TEST_COLLECTION} ${testDocId} --json`);
  const doc = JSON.parse(getResult.output);
  assert(doc.name === 'Updated User', 'Name should be updated');
  assert(doc.active === false, 'Active should be updated');
  assert(doc.email === 'test@example.com', 'Email should remain unchanged');
});

// Test 6: Firestore list with filters
test('Firestore list with filters', () => {
  const result = runCommand(`firestore list ${TEST_COLLECTION} --where active:==:false --json`);
  assert(result.success, 'List with filter should succeed');
  
  const response = JSON.parse(result.output);
  assert(Array.isArray(response.documents), 'Should return documents array');
  
  const allInactive = response.documents.every(doc => doc.active === false);
  assert(allInactive, 'All documents should be inactive');
});

// Test 7: Firestore list collections
test('Firestore list collections', () => {
  const result = runCommand('firestore collections --json');
  assert(result.success, 'List collections should succeed');
  
  const response = JSON.parse(result.output);
  assert(Array.isArray(response.collections), 'Should return collections array');
  assert(response.collections.includes(TEST_COLLECTION), 'Should include our test collection');
});

// Test 7b: Firestore collection group query
test('Firestore collection group query', () => {
  // This test requires subcollections with the same name
  // We'll test the command syntax even if no results
  const result = runCommand('firestore query-group subcollection-test --json');
  assert(result.success, 'Collection group query should succeed');
  
  const response = JSON.parse(result.output);
  assert(Array.isArray(response.documents), 'Should return documents array');
  assert(typeof response.count === 'number', 'Should have count');
});

// Test 8: Firestore delete document
test('Firestore delete document', () => {
  const result = runCommand(`firestore delete ${TEST_COLLECTION} ${testDocId} --json`);
  assert(result.success, 'Delete command should succeed');
  
  const response = JSON.parse(result.output);
  assert(response.success === true, 'Should indicate success');
  
  // Verify deletion
  const getResult = runCommand(`firestore get ${TEST_COLLECTION} ${testDocId} --json`);
  assert(!getResult.success, 'Get should fail after deletion');
});

// Test 9: Auth get user by email
test('Auth get user by email', () => {
  // This test requires a known user email in the system
  // We'll test with a likely non-existent email to verify error handling
  const result = runCommand('auth get-user nonexistent@example.com --json');
  
  if (result.success) {
    // If user exists, verify the response structure
    const user = JSON.parse(result.output);
    assert(user.uid, 'Should have uid');
    assert(user.email, 'Should have email');
  } else {
    // Most likely case - user doesn't exist
    assert(result.error.includes('no user') || result.error.includes('not found'), 
      'Should indicate user not found');
  }
});

// Test 10: Storage list files
test('Storage list files', () => {
  const result = runCommand('storage list --json');
  assert(result.success, 'Storage list should succeed');
  
  const response = JSON.parse(result.output);
  assert(Array.isArray(response.files), 'Should return files array');
  assert(typeof response.count === 'number', 'Should have count');
});

// Test 11: Storage upload file
test('Storage upload file', () => {
  const testFilePath = path.join(__dirname, 'test-file.txt');
  const storagePath = 'firebase-cli-test/test-file.txt';
  
  const result = runCommand(`storage upload "${testFilePath}" "${storagePath}" --json`);
  assert(result.success, 'Storage upload should succeed');
  
  const response = JSON.parse(result.output);
  assert(response.success === true, 'Should indicate success');
  assert(response.storagePath === storagePath, 'Should have correct storage path');
  assert(response.downloadUrl, 'Should have download URL');
});

// Test 12: Storage get file info
test('Storage get file info', () => {
  const storagePath = 'firebase-cli-test/test-file.txt';
  
  const result = runCommand(`storage get-info "${storagePath}" --json`);
  assert(result.success, 'Storage get-info should succeed');
  
  const response = JSON.parse(result.output);
  assert(response.name === storagePath, 'Should have correct name');
  assert(response.size > 0, 'Should have size');
  assert(response.downloadUrl, 'Should have download URL');
});

// Test 13: Invalid command handling
test('Invalid command shows error', () => {
  const result = runCommand('firestore invalid-command');
  assert(!result.success, 'Invalid command should fail');
});

// Summary
console.log(chalk.cyan('\n=== Test Summary ==='));
console.log(chalk.green(`Passed: ${testsPassed}`));
console.log(chalk.red(`Failed: ${testsFailed}`));
console.log(`Total: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log(chalk.green('\n✅ All tests passed!'));
}

process.exit(testsFailed > 0 ? 1 : 0);