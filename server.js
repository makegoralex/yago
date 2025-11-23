const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const frontendCandidates = [
  process.env.FRONTEND_DIST_PATH,
  path.resolve(__dirname, 'frontend', 'dist'),
  path.resolve(__dirname, 'frontend-dist'),
].filter(Boolean);

const resolveExistingBundle = () => {
  for (const candidate of frontendCandidates) {
    try {
      const stats = fs.statSync(candidate);
      if (!stats.isDirectory()) continue;
      const htmlPath = path.join(candidate, 'index.html');
      if (fs.existsSync(htmlPath)) return candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to inspect frontend bundle path:', candidate, error);
      }
    }
  }
  return undefined;
};

let frontendDistPath = resolveExistingBundle();
let frontendStaticMiddleware = frontendDistPath ? express.static(frontendDistPath) : null;

const refreshFrontendBundle = () => {
  const maybeBundle = resolveExistingBundle();
  if (!maybeBundle) {
    frontendDistPath = undefined;
    frontendStaticMiddleware = null;
    return;
  }
  if (maybeBundle !== frontendDistPath || !frontendStaticMiddleware) {
    frontendDistPath = maybeBundle;
    frontendStaticMiddleware = express.static(frontendDistPath);
  }
};

const serveFrontendStatic = (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/docs') || req.path.startsWith('/healthz')) {
    return next();
  }

  if (!frontendStaticMiddleware) {
    refreshFrontendBundle();
  }

  if (!frontendStaticMiddleware) {
    return next();
  }

  return frontendStaticMiddleware(req, res, (err) => {
    if (err) {
      return next(err);
    }
    return next();
  });
};

const serveSpaFallback = (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/docs') || req.path.startsWith('/healthz')) {
    return next();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  let distPath = frontendDistPath;
  if (!distPath || !fs.existsSync(path.join(distPath, 'index.html'))) {
    refreshFrontendBundle();
    distPath = frontendDistPath;
  }

  if (!distPath) {
    return next();
  }

  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        frontendDistPath = undefined;
        frontendStaticMiddleware = null;
      }
      next(err);
    }
  });
};

if (!frontendDistPath) {
  console.warn(
    'PWA bundle was not found. Build the frontend (npm run build inside frontend/) and copy the dist folder next to the API or provide FRONTEND_DIST_PATH.'
  );
}

app.use(serveFrontendStatic);
app.use(serveSpaFallback);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on port ${port}...`);
});
