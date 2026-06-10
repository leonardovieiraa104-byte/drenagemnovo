export default async (request, context) => {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";
  const referrer = request.headers.get("referer") || "";

  // 1. Bypass para ambiente local (por segurança)
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.startsWith("192.168.")) {
    return;
  }

  // 2. Bypass se tiver os parâmetros de preview / teste
  if (url.searchParams.has("preview") || url.searchParams.has("teste") || url.searchParams.has("test")) {
    return;
  }

  // 3. Se for o redirecionamento interno do back redirect (downsell) - de index.html para oferta-especial
  // Se a origem (referer) for o próprio domínio do site, liberamos o acesso.
  if (referrer && referrer.includes(url.hostname)) {
    return;
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

  const hasTrafficParams = url.searchParams.has("fbclid") || 
                           url.searchParams.has("utm_source") || 
                           url.searchParams.has("utm_campaign") || 
                           url.searchParams.has("src") || 
                           url.searchParams.has("gclid");

  const isLegitReferrer = refLower.includes("instagram.com") || 
                          refLower.includes("instagram") || 
                          refLower.includes("linktr.ee") ||
                          refLower.includes("l.facebook.com") ||
                          refLower.includes("facebook.com");

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  const safeRedirectUrl = "https://youtu.be/XEFZ30Cvdnc?si=UGIe4LzNvqLGk-Ds";

  // Se for computador, bot, ou espião da biblioteca de anúncios -> Redireciona imediatamente no nível do servidor (302)
  if (!isMobile || isSuspiciousAgent || (isSpySource && !refLower.includes("l.facebook.com") && !refLower.includes("l.instagram.com"))) {
    return Response.redirect(safeRedirectUrl, 302);
  }

  // Exigir parâmetros de tráfego ou origem de rede social para acessar no celular
  if (!hasTrafficParams && !isLegitReferrer) {
    return Response.redirect(safeRedirectUrl, 302);
  }

  // Caso contrário, continua o carregamento normal da página
  return;
};
