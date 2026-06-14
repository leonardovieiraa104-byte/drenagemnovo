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

// URL decoding middleware to handle non-ASCII path characters (e.g. bônus, Principal Entregável)
app.use((req, res, next) => {
  try {
    req.url = decodeURIComponent(req.url);
  } catch (e) {
    // ignore decoding errors
  }
  next();
});

// Setup query parser (Express uses 'extended' query parser by default, which is fine, but we configure it explicitly)
app.set('query parser', 'simple');

// Cloaker Rules Middleware
function cloakerMiddleware(req, res, next) {
  const hostname = req.hostname;
  const userAgent = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || req.headers['referrer'] || '';

  // 1. Bypass para ambiente local (por segurança)
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.")) {
    return next();
  }

  // 2. Bypass se tiver os parâmetros de preview / teste
  if (req.query.preview !== undefined || req.query.teste !== undefined || req.query.test !== undefined) {
    return next();
  }

  // 3. Se for o redirecionamento interno do back redirect (downsell) - de index.html para oferta-especial
  // Se a origem (referer) for o próprio domínio do site, liberamos o acesso.
  if (referrer && referrer.includes(hostname)) {
    return next();
  }

  // 4. Cloaker Rules
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

  const hasTrafficParams = req.query.fbclid !== undefined || 
                           req.query.utm_source !== undefined || 
                           req.query.utm_campaign !== undefined || 
                           req.query.src !== undefined || 
                           req.query.gclid !== undefined;

  const isLegitReferrer = refLower.includes("instagram.com") || 
                          refLower.includes("instagram") || 
                          refLower.includes("linktr.ee") ||
                          refLower.includes("l.facebook.com") ||
                          refLower.includes("facebook.com");

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  const safeRedirectUrl = "https://youtu.be/XEFZ30Cvdnc?si=UGIe4LzNvqLGk-Ds";

  // Se for computador, bot, ou espião da biblioteca de anúncios -> Redireciona imediatamente no nível do servidor (302)
  if (!isMobile || isSuspiciousAgent || (isSpySource && !refLower.includes("l.facebook.com") && !refLower.includes("l.instagram.com"))) {
    return res.redirect(302, safeRedirectUrl);
  }

  // Detectar se o acesso está ocorrendo dentro do próprio App do Facebook ou Instagram (In-App Browser)
  const isFacebookOrInstagramApp = uaLower.includes("fban") || 
                                   uaLower.includes("fbav") || 
                                   uaLower.includes("fb_iab") || 
                                   uaLower.includes("fb4a") || 
                                   uaLower.includes("instagram");

  // Exigir parâmetros de tráfego, origem de rede social, ou estar dentro do app do FB/IG para acessar no celular
  if (!hasTrafficParams && !isLegitReferrer && !isFacebookOrInstagramApp) {
    return res.redirect(302, safeRedirectUrl);
  }

  // Caso contrário, continua o carregamento normal da página
  next();
}

// Redirects (_redirects)
app.get('/login', (req, res) => {
  res.redirect(301, '/area-de-membros/');
});

// Cloaker applied to root and index.html
app.get(['/', '/index.html'], cloakerMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Cloaker applied to /oferta-especial and /oferta-especial/index.html
app.get(['/oferta-especial', '/oferta-especial/', '/oferta-especial/index.html'], cloakerMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'oferta-especial', 'index.html'));
});

// Serve styles.css directly from root
app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'styles.css'));
});

// Serve public folders
app.use('/area-de-membros', express.static(path.join(__dirname, 'area-de-membros')));
app.use('/bônus', express.static(path.join(__dirname, 'bônus')));
app.use('/orderbump', express.static(path.join(__dirname, 'orderbump')));
app.use('/Principal Entregável', express.static(path.join(__dirname, 'Principal Entregável')));

// Fallback 404 for any other undefined routes
app.use((req, res) => {
  res.status(404).send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
