const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8952625874:AAGdtnmNZ_CIB7jvNEAuHggdmAcMsTL5cUc";
const DB_URL = "https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_saas_prod.json";
const WEB_APP_URL = "https://turopovttb-art.github.io/";

let lastUpdateId = 0;
let isPolling = false;
// Har bir foydalanuvchining joriy kirish bosqichini saqlash: { [chatId]: { step: 'await_bot_id', login: '...' } }
const authSessions = {};

function apiRequest(urlStr, method = 'GET', payload = null) {
    return new Promise((resolve) => {
        try {
            const u = new URL(urlStr);
            const body = payload ? JSON.stringify(payload) : null;
            const req = https.request({
                hostname: u.hostname,
                path: u.pathname + u.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {})
                }
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
        } catch (e) {
            resolve(null);
        }
    });
}

async function tgCall(method, data) {
    return await apiRequest(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, 'POST', data);
}

async function getDB() {
    const data = await apiRequest(`${DB_URL}?t=${Date.now()}`);
    if (data && typeof data === 'object') return data;
    return { centers: [], applications: [], settings: {} };
}

async function saveDB(db) {
    return await apiRequest(DB_URL, 'PUT', db);
}

function toArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'object') return Object.values(val).filter(Boolean);
    return [];
}

function calcAttendancePercent(student) {
    const hist = toArray(student.tarix);
    if (hist.length === 0) return student.davomat === 'kelmadi' ? 0 : 100;
    const ok = hist.filter(h => ['keldi', 'kechikdi', 'sababli'].includes(h.holat)).length;
    return Math.round((ok / hist.length) * 100);
}

function findStudent(db, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return null;
    for (const c of toArray(db.centers)) {
        for (const s of toArray(c.oquvchilar)) {
            if (String(s.botId || '').trim().toLowerCase() === q) return { center: c, student: s };
            if (String(s.login || '').trim().toLowerCase() === q) return { center: c, student: s };
        }
    }
    return null;
}

function findStudentByChat(db, chatId) {
    for (const c of toArray(db.centers)) {
        for (const s of toArray(c.oquvchilar)) {
            if (String(s.chatId || '') === String(chatId)) return { center: c, student: s };
        }
    }
    return null;
}

function getMainKeyboard() {
    return {
        keyboard: [
            [{ text: "📊 Davomatim" }, { text: "🪙 Everest Coin & Ball" }],
            [{ text: "📅 Dars jadvali" }, { text: "🏢 Markaz ma'lumoti" }],
            [{ text: "🔄 Boshqa hisob ulash" }]
        ],
        resize_keyboard: true
    };
}

async function completeStudentLogin(db, chatId, username, match) {
    delete authSessions[chatId];
    match.student.chatId = chatId;
    if (username) match.student.tg = '@' + username;
    await saveDB(db);

    await tgCall('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `<b>✅ HISOB MUVAFFAQIYATLI ULANDI!</b>\n\n👤 <b>O'quvchi:</b> ${match.student.ism}\n🏢 <b>Markaz:</b> ${match.center.nomi}\n📚 <b>Guruh:</b> ${match.student.fan}\n🆔 <b>Bot ID:</b> <code>${match.student.botId}</code>\n📈 <b>Umumiy davomat:</b> ${calcAttendancePercent(match.student)}%\n🪙 <b>Balans:</b> ${match.student.ball || 0} Coin\n\n<i>Endi ustoz yoki admin davomatni (Keldi / Kechikdi / Kelmadi) belgilashi bilan shu yerga avtomatik hisobot keladi!</i>`,
        reply_markup: getMainKeyboard()
    });
}

async function handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text = String(msg.text || '').trim();
    const username = (msg.from?.username || '').toLowerCase();

    if (!text) return;

    const db = await getDB();
    db.settings = db.settings || {};
    db.settings.lastActiveTgId = chatId;

    // 1. /start komandasi (Saytdan 1-bosishda Deep-Link orqali kelganda)
    if (text.toLowerCase().startsWith('/start')) {
        const parts = text.split(' ');
        const startParam = parts[1] ? parts[1].trim() : '';

        if (startParam) {
            const match = findStudent(db, startParam);
            if (match) {
                await completeStudentLogin(db, chatId, username, match);
                return;
            }
        }

        const existing = findStudentByChat(db, chatId);
        if (existing) {
            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>🎓 Xush kelibsiz, ${existing.student.ism}!</b>\n🏢 <b>Markaz:</b> ${existing.center.nomi}\n🆔 <b>Bot ID:</b> <code>${existing.student.botId}</code>\n\nQuyidagi menyudan foydalaning:`,
                reply_markup: getMainKeyboard()
            });
            await saveDB(db);
            return;
        }

        authSessions[chatId] = { step: 'await_login' };
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `<b>👋 Assalomu alaykum! Everest OS Smart Davomat botiga xush kelibsiz.</b>\n\nHisobingizni ulash uchun markaz tomonidan berilgan <b>Login</b> yoki <b>5 xonali Bot ID</b> raqamingizni kiriting:`
        });
        await saveDB(db);
        return;
    }

    // 2. Boshqa hisob ulash tugmasi
    if (text === "🔄 Boshqa hisob ulash") {
        authSessions[chatId] = { step: 'await_login' };
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `🔐 Yangi o'quvchi <b>Loginini</b> yoki <b>5 xonali Bot ID</b> raqamini kiriting:`
        });
        return;
    }

    // 3. Menyudagi tugmalar (ulangan foydalanuvchi uchun)
    const linked = findStudentByChat(db, chatId);
    if (linked && !authSessions[chatId]) {
        if (text === "📊 Davomatim") {
            const s = linked.student;
            const pct = calcAttendancePercent(s);
            const hist = toArray(s.tarix).slice(0, 5);
            const histText = hist.length === 0
                ? "Hozircha tarix yo'q"
                : hist.map(h => `• <b>${h.sana}</b> (${h.vaqt || ''}) — <b>${h.holat.toUpperCase()}</b> <i>(${h.izoh || '-'})</i>`).join('\n');

            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>📊 SHAXSIY DAVOMAT KUNDALIGI</b>\n\n👤 <b>O'quvchi:</b> ${s.ism} (ID: <code>${s.botId}</code>)\n📚 <b>Fan:</b> ${s.fan}\n📈 <b>Umumiy davomat:</b> ${pct}%\n📌 <b>Bugungi holat:</b> ${String(s.davomat || 'keldi').toUpperCase()} (${s.izoh || '-'})\n\n<b>Oxirgi darslar:</b>\n${histText}`,
                reply_markup: getMainKeyboard()
            });
            return;
        }

        if (text === "🪙 Everest Coin & Ball") {
            const s = linked.student;
            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>🪙 EVEREST COIN VA NATIJADORLIK</b>\n\n👤 <b>O'quvchi:</b> ${s.ism}\n🏆 <b>To'plangan ball:</b> ${s.ball || 0} Coin\n🎯 <b>Sertifikat holati:</b> ${(Number(s.ball) || 0) >= 80 ? '✅ Tayyor (80+ ball)' : `⏳ Yana ${80 - (Number(s.ball) || 0)} Coin kerak`}`,
                reply_markup: getMainKeyboard()
            });
            return;
        }

        if (text === "📅 Dars jadvali") {
            const jadval = toArray(linked.center.jadval);
            const jText = jadval.length === 0
                ? "Dars jadvali hali kiritilmagan."
                : jadval.map(j => `🔹 <b>${j.fan}</b> (${j.ustoz})\n   🕒 ${j.kunlar} | ${j.vaqt}`).join('\n\n');

            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>📅 DARS JADVALI (${linked.center.nomi})</b>\n\n${jText}`,
                reply_markup: getMainKeyboard()
            });
            return;
        }

        if (text === "🏢 Markaz ma'lumoti") {
            const c = linked.center;
            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>🏢 ${c.nomi}</b>\n\n📍 <b>Manzil:</b> ${c.manzil}\n📞 <b>Telefon:</b> ${c.tel}\n💳 <b>To'lov kartasi:</b> <code>${c.karta || 'Kiritilmagan'}</code> (${c.kartaEgasi || '-'})\n🌐 <b>Web Platforma:</b> ${WEB_APP_URL}`,
                reply_markup: getMainKeyboard()
            });
            return;
        }
    }

    // 4. Bosqichma-bosqich Login + 5 xonali Bot ID orqali kirish
    const session = authSessions[chatId];

    // Agar foydalanuvchi 2-bosqichda (Bot ID kiritish bosqichida) bo'lsa
    if (session && session.step === 'await_bot_id') {
        const match = findStudent(db, session.login);
        if (match && String(match.student.botId).trim() === text.trim()) {
            await completeStudentLogin(db, chatId, username, match);
            return;
        } else {
            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `❌ <b>Bot ID noto'g'ri kiritildi!</b>\n\nIltimos, <b>${session.login}</b> hisobi uchun markaz bergan 5 xonali <b>Bot ID</b> raqamini qayta kiriting (yoki yangi login yozing):`
            });
            delete authSessions[chatId];
            return;
        }
    }

    // Agar foydalanuvchi "login 48291" ko'rinishida ikkalasini birdan yozsa yoki to'g'ridan-to'g'ri 5 xonali Bot ID yozsa
    const parts = text.split(/\s+/);
    if (parts.length === 2) {
        const match = findStudent(db, parts[0]);
        if (match && String(match.student.botId).trim() === parts[1].trim()) {
            await completeStudentLogin(db, chatId, username, match);
            return;
        }
    }

    // To'g'ridan-to'g'ri 5 xonali Bot ID yozilgan bo'lsa
    if (/^\d{5}$/.test(text.trim())) {
        const matchById = findStudent(db, text.trim());
        if (matchById) {
            await completeStudentLogin(db, chatId, username, matchById);
            return;
        }
    }

    // Agar foydalanuvchi Login yozgan bo'lsa — uni topib 5 xonali Bot ID so'raymiz!
    const matchByLogin = findStudent(db, text.trim());
    if (matchByLogin) {
        authSessions[chatId] = { step: 'await_bot_id', login: matchByLogin.student.login };
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `✅ O'quvchi topildi: <b>${matchByLogin.student.ism}</b> (${matchByLogin.center.nomi})\n\n🔐 Hisobni tasdiqlash uchun <b>5 xonali Maxsus Bot ID</b> raqamingizni kiriting:`
        });
        return;
    }

    // Topilmasa
    await tgCall('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `⚠️ <b>"${text}"</b> bo'yicha o'quvchi topilmadi.\n\nMarkaz admini bergan <b>Login</b> yoki <b>5 xonali Bot ID</b> raqamini kiriting.`
    });
}

async function pollUpdates() {
    if (isPolling) return;
    isPolling = true;
    try {
        const res = await apiRequest(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`);
        if (res && !res.ok && res.error_code === 409) {
            await apiRequest(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
        } else if (res && res.ok && Array.isArray(res.result)) {
            for (const item of res.result) {
                lastUpdateId = item.update_id;
                const msg = item.message || item.edited_message;
                if (msg) await handleMessage(msg);
            }
        }
    } catch (e) {} finally {
        isPolling = false;
        setTimeout(pollUpdates, 1500);
    }
}

async function startBot() {
    await apiRequest(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    console.log("🤖 Everest Telegram Bot (Bot ID + Login Auth) ishga tushdi!");
    pollUpdates();
}

if (require.main === module) {
    startBot();
}

module.exports = { startBot };