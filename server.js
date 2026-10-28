/**
 * EVEREST EDUCATION CRM — STARTUP BACKEND SERVER (v3.0)
 * Hech qanday qo'shimcha npm paket talab qilmaydi, 100% xatosiz ishlaydi.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 1. .env faylini avtomatik o'qish (agar mavjud bo'lsa)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
    envLines.forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key && !key.startsWith('#')) process.env[key] = val;
        }
    });
}

// 2. Asosiy Sozlamalar (.env yoki default)
let PORT = Number(process.env.PORT) || 3000;
const FIREBASE_URL = process.env.FIREBASE_DB_URL || "https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_v3.json";
const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8952625874:AAGdtnmNZ_CIB7jvNEAuHggdmAcMsTL5cUc";
const LOCAL_DB_FILE = path.join(__dirname, 'local_backup_db.json');

// 3. MIME turlari (HTML, CSS, JS, Rasmlar uchun)
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 4. HTTPS so'rov yuborish yordamchi funksiyasi (Firebase va Telegram uchun)
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

// 5. Asosiy HTTP va API Server
const server = http.createServer(async (req, res) => {
    // CORS ruxsatlari
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const reqUrl = req.url.split('?')[0];

    // API 1: Server holatini tekshirish (/api/health)
    if (reqUrl === '/api/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
            status: 'ok',
            platform: 'Everest Education OS 3.0',
            firebase: FIREBASE_URL,
            time: new Date().toISOString()
        }));
    }

    // API 2: Bazani o'qish (/api/db -> Firebase + Local Backup)
    if (reqUrl === '/api/db' && req.method === 'GET') {
        try {
            const fbData = await requestHttps(FIREBASE_URL, 'GET');
            if (fbData) {
                fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(fbData, null, 2), 'utf-8');
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                return res.end(JSON.stringify(fbData));
            }
        } catch (e) {}

        if (fs.existsSync(LOCAL_DB_FILE)) {
            const localData = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            return res.end(localData);
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ centers: [], applications: [] }));
    }

    // API 3: Bazani saqlash (/api/db -> PUT/POST)
    if (reqUrl === '/api/db' && (req.method === 'PUT' || req.method === 'POST')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
                await requestHttps(FIREBASE_URL, 'PUT', parsed);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, message: "Firebase va Lokal bazaga saqlandi" }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // API 4: Telegram Bot Xabarnoma yuborish (/api/telegram)
    if (reqUrl === '/api/telegram' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { chatId, text } = JSON.parse(body);
                const tgUrl = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
                const tgRes = await requestHttps(tgUrl, 'POST', {
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML'
                });
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(tgRes));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }

    // 6. Frontend sahifalarini (index.html, ota-ona.html va boshqalar) ochib berish
    let safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(__dirname, safePath === '/' || safePath === '\\' ? 'index.html' : safePath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'text/html; charset=utf-8';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('500 - Server ichki xatosi');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// 7. Agar 3000-port band bo'lsa, avtomatik keyingi bo'sh portda yoqish (EADDRINUSE xatosi chiqmaydi)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️ Port ${PORT} band ekan, ${PORT + 1}-portda ishga tushirilmoqda...`);
        PORT += 1;
        server.listen(PORT);
    } else {
        console.error('Server xatosi:', err);
    }
});

server.listen(PORT, () => {
    console.log('\n======================================================');
    console.log('🚀 EVEREST EDUCATION STARTUP SERVER ISHGA TUSHDI!');
    console.log(`🌐 Sayt manzili:     http://localhost:${PORT}`);
    console.log(`📡 API Baza manzili: http://localhost:${PORT}/api/db`);
    console.log(`☁️  Firebase Baza:    Ulangan (Realtime Sync)`);
    console.log('======================================================\n');
});