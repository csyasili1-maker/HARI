const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
const PORT = 8000;
const DB_FILE = path.join(__dirname, 'database.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload directory exists safely (avoiding read-only filesystem crash on Vercel)
try {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Could not create uploads directory (expected in read-only serverless environment):", err.message);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Database helper functions
function getDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (error) {
    console.error("Error reading database:", error);
    return {};
  }
}

function saveDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

// Set up templating engine
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'public'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'harimarkify-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Serve static assets and uploads
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve style.css from public root
app.get('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/style.css'));
});

// Middleware to inject default configurations into EJS context
app.use((req, res, next) => {
  const db = getDb();
  res.locals.db = db;
  res.locals.seo = db.seo_metadata || {};
  res.locals.settings = db.settings || {};
  res.locals.activePage = req.path;
  res.locals.isAdmin = false;
  next();
});

// SEO sitemap and robots routes
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: http://localhost:${PORT}/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  const db = getDb();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  const urls = ['', '/about-us.html', '/services.html', '/seo-growth.html', '/contact-us.html'];
  urls.forEach(u => {
    xml += `  <url>\n    <loc>http://localhost:${PORT}${u}</loc>\n    <changefreq>monthly</changefreq>\n  </url>\n`;
  });
  xml += `</urlset>`;
  res.send(xml);
});

// --- Public Endpoints & AJAX APIs ---

// Contact Lead Form Submit
app.post('/api/contact', (req, res) => {
  const { name, mobile, business_name, service, budget, message } = req.body;
  if (!name || !mobile) {
    return res.status(400).json({ error: "Name and Mobile number are required" });
  }
  
  const db = getDb();
  if (!db.leads) db.leads = [];
  
  const newLead = {
    id: 'lead-' + Date.now(),
    name: name,
    mobile: mobile,
    business_name: business_name || "",
    service: service || "Not Specified",
    budget: budget || "Not Specified",
    message: message || "",
    status: "New",
    created_at: new Date().toISOString()
  };
  
  db.leads.push(newLead);
  saveDb(db);
  
  res.json({ success: true, message: "Thank you for contacting HariMarkify. Our team will reach out shortly." });
});



// --- Dynamic Page Renderers ---

// Root or index
app.get(['/', '/index.html', '/index-light.html'], (req, res) => {
  const db = getDb();
  const meta = db.seo_metadata.default;
  const isLight = req.path.includes('light');
  res.render(isLight ? 'index-light.html' : 'index.html', {
    pageTitle: meta.title,
    metaDesc: meta.description,
    keywords: meta.keywords,
    homepage: db.homepage,
    services: db.services,
    portfolio: db.portfolio,
    testimonials: db.testimonials,
    blogs: db.blogs ? db.blogs.slice(0, 3) : []
  });
});

app.get(['/about-us.html', '/about-us-light.html'], (req, res) => {
  const db = getDb();
  const meta = db.seo_metadata.about;
  const isLight = req.path.includes('light');
  res.render(isLight ? 'about-us-light.html' : 'about-us.html', {
    pageTitle: meta.title,
    metaDesc: meta.description,
    keywords: db.seo_metadata.default.keywords,
    homepage: db.homepage,
    testimonials: db.testimonials
  });
});

app.get(['/services.html', '/services-light.html'], (req, res) => {
  const db = getDb();
  const meta = db.seo_metadata.services;
  const isLight = req.path.includes('light');
  res.render(isLight ? 'services-light.html' : 'services.html', {
    pageTitle: meta.title,
    metaDesc: meta.description,
    keywords: db.seo_metadata.default.keywords,
    services: db.services
  });
});

app.get(['/services-details.html', '/services-details-light.html'], (req, res) => {
  const db = getDb();
  const isLight = req.path.includes('light');
  const serviceId = req.query.id || (db.services[0] ? db.services[0].id : '');
  const service = db.services.find(s => s.id === serviceId) || db.services[0] || {};
  res.render(isLight ? 'services-details-light.html' : 'services-details.html', {
    pageTitle: `${service.title} - HariMarkify`,
    metaDesc: service.description,
    keywords: db.seo_metadata.default.keywords,
    service: service,
    services: db.services
  });
});

app.get(['/seo-growth.html', '/seo-growth-light.html'], (req, res) => {
  const db = getDb();
  const meta = db.seo_metadata.seo_growth;
  const isLight = req.path.includes('light');
  res.render(isLight ? 'seo-growth-light.html' : 'seo-growth.html', {
    pageTitle: meta.title,
    metaDesc: meta.description,
    keywords: db.seo_metadata.default.keywords,
    pricing: db.pricing
  });
});

app.get(['/contact-us.html', '/contact-us-light.html'], (req, res) => {
  const db = getDb();
  const meta = db.seo_metadata.contact;
  const isLight = req.path.includes('light');
  res.render(isLight ? 'contact-us-light.html' : 'contact-us.html', {
    pageTitle: meta.title,
    metaDesc: meta.description,
    keywords: db.seo_metadata.default.keywords,
    settings: db.settings
  });
});

app.get(['/404.html', '/404'], (req, res) => {
  res.status(404).render('404.html', {
    pageTitle: "404 - Page Not Found",
    metaDesc: "Page not found.",
    keywords: ""
  });
});

// Catch-all route to redirect static links to dynamic rendering
app.use((req, res, next) => {
  const cleanPath = req.path.replace(/^\/public/, '');
  if (cleanPath.endsWith('.html')) {
    return res.redirect(cleanPath);
  }
  next();
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
