/**
 * Auth0 Post-Login Action: deny everyone except explicitly approved users.
 *
 * Configure ALLOWED_EMAILS as an Action secret, for example:
 * careers@fidenz.com,your-personal-email@example.com
 */
exports.onExecutePostLogin = async (event, api) => {
  const allowlist = (event.secrets.ALLOWED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = event.user.email?.trim().toLowerCase();

  if (!email || !allowlist.includes(email)) {
    api.access.deny('access_denied', 'This dashboard is restricted to approved users.');
  }
};
