import test from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedEmails, isAllowedEmail, isVerifiedAllowedUser } from '../src/utils/access-control.js';

test('allowlist comparison is case-insensitive and trims whitespace', () => {
  const emails = getAllowedEmails(' careers@fidenz.com, owner@example.com ');
  assert.equal(isAllowedEmail('CAREERS@fidenz.com', emails), true);
  assert.equal(isAllowedEmail('unapproved@example.com', emails), false);
});

test('dashboard access requires both allowlisting and a verified email', () => {
  const emails = getAllowedEmails('careers@fidenz.com');
  assert.equal(isVerifiedAllowedUser({ email: 'careers@fidenz.com', email_verified: true }, emails), true);
  assert.equal(isVerifiedAllowedUser({ email: 'careers@fidenz.com', email_verified: false }, emails), false);
  assert.equal(isVerifiedAllowedUser({ email: 'unapproved@example.com', email_verified: true }, emails), false);
});
