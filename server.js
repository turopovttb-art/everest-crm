const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { startBot } = require('./bot.js');

let PORT = Number(process.env.PORT) || 3000;
const CLOUD_URL = "https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_saas_prod.json";
const LOCAL_DB_FILE = path.join(__dirname, 'database.json');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function cloudRequest(urlStr, method = 'GET', data = null) {
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

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const reqUrl = req.url.split('?')[0];

    // API: Bazani o'qish
    if (reqUrl === '/api/db' && req.method === 'GET') {
        let db = await cloudRequest(`${CLOUD_URL}?t=${Date.now()}`);
        if (db) {
            try { fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2)); } catch (e) {}
        } else if (fs.existsSync(LOCAL_DB_FILE)) {
            try { db = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8')); } catch (e) {}
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(db || {}));
    }

    // API: Bazani saqlash
    if (reqUrl === '/api/db' && (req.method === 'POST' || req.method === 'PUT')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(parsed, null, 2));
                await cloudRequest(CLOUD_URL, 'PUT', parsed);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ ok: false }));
            }
        });
        return;
    }

    // Statik fayllar (index.html, ota-ona.html va boshqalar)
    let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, (safePath === '/' || safePath === '\\') ? 'index.html' : safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end('Fayl topilmadi');
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
    console.log("======================================================");
    console.log(`🚀 EVEREST OS SERVER ISHGA TUSHDI: http://localhost:${PORT}`);
    console.log("======================================================");
    startBot();
});