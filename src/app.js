import 'dotenv/config';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import { auth } from 'express-openid-connect';
import { fileURLToPath } from 'node:url';
import { getRankings } from './services/weather.js';
import { cacheStatus } from './services/cache.js';
import { getAllowedEmails, isAllowedEmail, isVerifiedAllowedUser } from './utils/access-control.js';

const app = express();
const port = process.env.PORT || 3000;
const authEnabled = process.env.AUTH_ENABLED === 'true';
const allowedEmails = getAllowedEmails(process.env.ALLOWED_EMAILS);

app.set('view engine', 'ejs');
app.set('views', fileURLToPath(new URL('../views/', import.meta.url)));
app.set('layout', 'layout');
app.use(expressLayouts);
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));

if (authEnabled) {
  const requiredAuthSettings = ['AUTH0_SECRET', 'AUTH0_BASE_URL', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_ISSUER_BASE_URL'];
  const missingSettings = requiredAuthSettings.filter((name) => !process.env[name]);
  if (missingSettings.length || !allowedEmails.length) {
    throw new Error(`Auth0 configuration is incomplete: ${[...missingSettings, !allowedEmails.length && 'ALLOWED_EMAILS'].filter(Boolean).join(', ')}`);
  }
  app.use(auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    authorizationParams: { response_type: 'code', response_mode: 'query' }
  }));
}

function requireUser(req, res, next) {
  if (!authEnabled) return next();
  if (!req.oidc?.isAuthenticated()) return res.oidc.login({ returnTo: '/' });
  if (isVerifiedAllowedUser(req.oidc.user, allowedEmails)) return next();
  if (isAllowedEmail(req.oidc.user?.email, allowedEmails)) {
    return res.status(403).render('error', {
      title: 'Email verification required',
      message: 'Verify your approved email address before accessing this dashboard.',
      user: req.oidc.user
    });
  }
  return res.status(403).render('error', {
    title: 'Access restricted',
    message: 'Your account is authenticated but not approved for this dashboard.',
    user: req.oidc.user
  });
}

app.get('/', requireUser, (req, res) => res.render('dashboard', { title: 'Weather Comfort Atlas', user: req.oidc?.user }));
app.get('/dashboard/rankings', requireUser, async (req, res, next) => {
  try {
    res.app.render('partials/rankings', await getRankings(), (error, html) => {
      if (error) return next(error);
      return res.send(html);
    });
  } catch (error) { next(error); }
});
app.get('/api/cache-status', requireUser, (req, res) => res.json(cacheStatus()));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render('error', { title: 'Unable to load dashboard', message: error.message, user: req.oidc?.user });
});

app.listen(port, () => console.log(`Weather Comfort Atlas running at http://localhost:${port}`));
