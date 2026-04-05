const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();

const COMPRESSIBLE_TYPES = /text\/html|application\/javascript|text\/css|application\/json/i;
app.use((req, res, next) => {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  const isIos15Safari = ua.includes('safari') && !ua.includes('chrome') && /os 15[._]/.test(ua);
  if (isIos15Safari) {
    const sanitized = String(req.headers['accept-encoding'] || '')
      .split(',')
      .map((part) => part.trim())
      .filter((token) => token && !token.startsWith('br'))
      .join(', ');
    req.headers['accept-encoding'] = sanitized || 'gzip';
  }

  next();
});

app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      const contentType = String(res.getHeader('Content-Type') || '');
      if (contentType && !COMPRESSIBLE_TYPES.test(contentType)) {
        return false;
      }

      return compression.filter(req, res);
    },
    brotli: { enabled: true },
  })
);

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
const extractReleaseId = (distPath) => {
  if (!distPath) return undefined;

  const htmlPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(htmlPath)) return undefined;

  try {
    const indexHtml = fs.readFileSync(htmlPath, 'utf8');
    const match = indexHtml.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/);
    return match?.[1];
  } catch (error) {
    console.warn('Failed to read frontend index.html for release hash:', error);
    return undefined;
  }
};

let frontendReleaseId = extractReleaseId(frontendDistPath);
const cacheAwareStatic = (distPath) =>
  express.static(distPath, {
    setHeaders: (res, filePath) => {
      const normalizedPath = filePath.replace(/\\/g, '/');

      if (normalizedPath.endsWith('/index.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return;
      }

      if (normalizedPath.endsWith('/manifest.json') || normalizedPath.endsWith('/service-worker.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return;
      }

      if (normalizedPath.includes('/assets/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });

let frontendStaticMiddleware = frontendDistPath ? cacheAwareStatic(frontendDistPath) : null;

const refreshFrontendBundle = () => {
  const maybeBundle = resolveExistingBundle();
  if (!maybeBundle) {
    frontendDistPath = undefined;
    frontendStaticMiddleware = null;
    frontendReleaseId = undefined;
    return;
  }
  if (maybeBundle !== frontendDistPath || !frontendStaticMiddleware || !frontendReleaseId) {
    frontendDistPath = maybeBundle;
    frontendStaticMiddleware = cacheAwareStatic(frontendDistPath);
    frontendReleaseId = extractReleaseId(frontendDistPath);
  }
};

const addReleaseHeader = (req, res, next) => {
  if (req.path === '/') {
    if (!frontendReleaseId) {
      refreshFrontendBundle();
    }
    if (frontendReleaseId) {
      res.setHeader('X-Release-Id', frontendReleaseId);
      res.setHeader('X-Build-Hash', frontendReleaseId);
    }
  }
  next();
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

  if (req.path.startsWith('/assets') || path.extname(req.path)) {
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

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
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

app.use(addReleaseHeader);
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
