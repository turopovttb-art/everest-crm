const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let PORT = Number(process.env.PORT) || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8952625874:AAGdtnmNZ_CIB7jvNEAuHggdmAcMsTL5cUc";
const CLOUD_URL = "https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_v3.json";
const LOCAL_DB_FILE = path.join(__dirname, 'database.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

function httpsReq(urlStr, method = 'GET', data = null) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const body = data ? JSON.stringify(data) : null;
            const req = https.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method,
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                let raw = '';
                res.on('data', chunk => raw += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(raw)); } catch (e) { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            if (body) req.write(body);
            req.end();
        } catch (e) { resolve(null); }
    });
}

function readLocalDB() {
    try {
        if (fs.existsSync(LOCAL_DB_FILE)) {
            return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
        }
    } catch (e) {}
    return null;
}

function writeLocalDB(data) {
    try {
        fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const reqUrl = req.url.split('?')[0];

    // REST API: GET DB
    if (reqUrl === '/api/db' && req.method === 'GET') {
        let db = readLocalDB();
        if (!db) {
            db = await httpsReq(`${CLOUD_URL}?t=${Date.now()}`);
            if (db) writeLocalDB(db);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(db || {}));
    }

    // REST API: SAVE DB
    if (reqUrl === '/api/db' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                writeLocalDB(parsed);
                await httpsReq(CLOUD_URL, 'PUT', parsed);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false }));
            }
        });
        return;
    }

    // STATIC FILES (index.html, style.css, app.js)
    let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, (safePath === '/' || safePath === '\\') ? 'index.html' : safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
        } else {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/html; charset=utf-8' });
            res.end(content);
        }
    });
});

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
        PORT++;
        server.listen(PORT);
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Everest OS Server ishga tushdi: http://localhost:${PORT}`);
});