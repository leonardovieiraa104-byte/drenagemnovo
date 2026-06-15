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

// Redirects (_redirects)
app.get('/login', (req, res) => {
  res.redirect(301, '/area-de-membros/');
});

// Serve public folders
app.use('/area-de-membros', express.static(path.join(__dirname, 'area-de-membros')));
app.use(['/bônus', '/b%C3%B4nus'], express.static(path.join(__dirname, 'bônus')));
app.use('/oferta-especial', express.static(path.join(__dirname, 'oferta-especial')));
app.use('/orderbump', express.static(path.join(__dirname, 'orderbump')));
app.use([
  '/Principal Entregável',
  '/Principal%20Entregável',
  '/Principal%20Entreg%C3%A1vel',
  '/Principal Entreg%C3%A1vel'
], express.static(path.join(__dirname, 'Principal Entregável')));

// Serve root files
app.get(['/', '/index.html'], (req, res) => {
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
