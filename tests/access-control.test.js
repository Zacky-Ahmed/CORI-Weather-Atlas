import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedEmails, isAllowedEmail } from '../src/utils/access-control.js';

test('allowlist comparison is case-insensitive and trims whitespace', () => {
  const emails = getAllowedEmails(' careers@fidenz.com, owner@example.com ');
  assert.equal(isAllowedEmail('CAREERS@fidenz.com', emails), true);
  assert.equal(isAllowedEmail('unapproved@example.com', emails), false);
});
