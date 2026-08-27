export function isAllowedEmail(email, allowedEmails) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return allowedEmails.some((allowedEmail) => allowedEmail.trim().toLowerCase() === normalizedEmail);
}

export function getAllowedEmails(value) {
  return (value ?? '').split(',').map((email) => email.trim()).filter(Boolean);
}
