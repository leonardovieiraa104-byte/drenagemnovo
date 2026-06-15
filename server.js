const express = require('express');
const path = require('path');
const app = express();

// Enable trust proxy for behind reverse proxy (Easypanel)
app.enable('trust proxy');

const PORT = process.env.PORT || 3000;

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url} - req.path: ${req.path}`);
  next();
});

// Setup query parser (Express uses 'extended' query parser by default, which is fine, but we configure it explicitly)
app.set('query parser', 'simple');

// Cloaker Rules Middleware
function cloakerMiddleware(req, res, next) {
  const userAgent = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || req.headers['referrer'] || '';

  // 1. Bypass para ambiente local (por segurança)
  const hostname = req.hostname || '';
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.")) {
    return next();
  }

  // 2. Bypass se tiver os parâmetros de preview / teste ou o cookie de preview bypass
  const cookies = req.headers.cookie || '';
  const hasPreviewBypass = req.query.preview !== undefined || 
                           req.query.teste !== undefined || 
                           req.query.test !== undefined ||
                           cookies.includes('previewfast300=true');
  if (hasPreviewBypass) {
    return next();
  }

  // 3. Cloaker Rules
  const suspiciousUserAgents = [
    "bot", "crawler", "spider", "headless", "selenium", "puppeteer", 
    "lighthouse", "gtmetrix", "pingdom", "facebookexternalhit", 
    "facebot", "adsbot", "googlebot", "bingbot", "baiduspider", 
    "yandexbot", "ahrefsbot", "semrushbot", "dotbot", "rogerbot",
    "httrack", "wget", "offline", "go-http-client", "curl", "python"
  ];
  
  const uaLower = userAgent.toLowerCase();
  const isSuspiciousAgent = suspiciousUserAgents.some(agent => uaLower.includes(agent));

  const refLower = referrer.toLowerCase();
  const isSpySource = refLower.includes("facebook.com/ads/library") || 
                      refLower.includes("ads/library") ||
                      refLower.includes("adspy") || 
                      refLower.includes("dropispy") || 
                      refLower.includes("spy");

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  const safeRedirectUrl = "https://youtu.be/XEFZ30Cvdnc?si=UGIe4LzNvqLGk-Ds";

  // Se for computador, bot, ou espião da biblioteca de anúncios -> Redireciona imediatamente (302)
  if (!isMobile || isSuspiciousAgent || isSpySource) {
    return res.redirect(302, safeRedirectUrl);
  }

  // Celulares legítimos são liberados direto
  next();
}

// Route to set cookie bypass for preview
app.get('/previewfast300', (req, res) => {
  res.setHeader('Set-Cookie', 'previewfast300=true; Path=/; Max-Age=86400'); // 24 horas
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Redirects (_redirects)
app.get('/login', (req, res) => {
  res.redirect(301, '/area-de-membros/');
});

// Serve public folders
app.use('/area-de-membros', express.static(path.join(__dirname, 'area-de-membros')));
app.use('/oferta-especial', cloakerMiddleware, express.static(path.join(__dirname, 'oferta-especial')));

// Serve root files with cloaker
app.get(['/', '/index.html'], cloakerMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve styles.css directly from root
app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

// Fallback 404 for any other undefined routes
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
