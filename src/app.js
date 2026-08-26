import 'dotenv/config';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import { auth } from 'express-openid-connect';
import { fileURLToPath } from 'node:url';
import { getRankings } from './services/weather.js';
import { cacheStatus } from './services/cache.js';

const app = express();
const port = process.env.PORT || 3000;
const authEnabled = process.env.AUTH_ENABLED === 'true';

app.set('view engine', 'ejs');
app.set('views', fileURLToPath(new URL('../views/', import.meta.url)));
app.set('layout', 'layout');
app.use(expressLayouts);
app.use(express.static(fileURLToPath(new URL('../public/', import.meta.url))));

if (authEnabled) {
  app.use(auth({ authRequired: false, auth0Logout: true, secret: process.env.AUTH0_SECRET, baseURL: process.env.AUTH0_BASE_URL, clientID: process.env.AUTH0_CLIENT_ID, issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL }));
}

function requireUser(req, res, next) {
  if (!authEnabled || req.oidc?.isAuthenticated()) return next();
  return res.oidc.login({ returnTo: '/' });
}

app.get('/', requireUser, (req, res) => res.render('dashboard', { title: 'Weather Comfort Atlas', user: req.oidc?.user }));
app.get('/dashboard/rankings', requireUser, async (req, res, next) => {
  try {
    res.app.render('partials/rankings', { rankings: await getRankings() }, (error, html) => {
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
