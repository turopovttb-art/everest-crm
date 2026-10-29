/**
 * EVEREST EDUCATION CRM — STARTUP BACKEND SERVER (v4.0)
 * Real-time Firebase Sync + Telegram Bot Auto-Binding + Credentials Delivery
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let PORT = Number(process.env.PORT) || 3000;
const FIREBASE_URL = process.env.FIREBASE_DB_URL || "https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_v3.json";
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8952625874:AAGdtnmNZ_CIB7jvNEAuHggdmAcMsTL5cUc";

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

function requestHttps(urlStr, method = 'GET', bodyData = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(urlStr);
        const payload = bodyData ? JSON.stringify(bodyData) : null;
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (payload) options.headers['Content-Length'] = Buffer.byteLength(payload);

        const req = https.request(options, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(raw)); }
                catch (e) { resolve(raw); }
            });
        });
        req.on('error', err => reject(err));
        if (payload) req.write(payload);
        req.end();
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

    // API: Send Center Credentials via Telegram & Log Email
    if (reqUrl === '/api/send-credentials' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { email, nomi, login, parol, chatId } = JSON.parse(body);
                if (chatId) {
                    await requestHttps(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, 'POST', {
                        chat_id: chatId,
                        text: `🎉 <b>Markazingiz tasdiqlandi!</b>\n\n🏢 <b>Markaz:</b> ${nomi}\n🔐 <b>Login:</b> <code>${login}</code>\n🔑 <b>Parol:</b> <code>${parol}</code>\n📧 <b>Email:</b> ${email}`,
                        parse_mode: 'HTML'
                    });
                }
                console.log(`📧 [CREDENTIALS SENT] Markaz: ${nomi} | Email: ${email} | Login: ${login}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: e.message }));
            }
        });
        return;
    }

    // Serve static files (index.html)
    let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, safePath === '/' || safePath === '\\' ? 'index.html' : safePath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500);
            res.end('Server xatosi');
        } else {
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/html; charset=utf-8' });
            res.end(content);
        }
    });
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        PORT += 1;
        server.listen(PORT);
    }
});

server.listen(PORT, () => {
    console.log(`🚀 Everest Education PRO Server ishga tushdi: http://localhost:${PORT}`);
});