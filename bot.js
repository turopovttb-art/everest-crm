const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8952625874:AAGdtnmNZ_CIB7jvNEAuHggdmAcMsTL5cUc";
const DB_URL = "https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_saas_prod.json";
const WEB_APP_URL = "https://turopovttb-art.github.io/";

let lastUpdateId = 0;
let isPolling = false;

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

function findStudentByChatOrLogin(db, chatId, loginText = '') {
    const cleanLogin = String(loginText || '').trim().toLowerCase();
    const centers = toArray(db.centers);

    for (const c of centers) {
        const students = toArray(c.oquvchilar);
        for (const s of students) {
            if (cleanLogin && String(s.login || '').trim().toLowerCase() === cleanLogin) {
                return { center: c, student: s };
            }
            if (!cleanLogin && String(s.chatId || '') === String(chatId)) {
                return { center: c, student: s };
            }
        }
    }
    return null;
}

function getMainKeyboard() {
    return {
        keyboard: [
            [{ text: "📊 Davomatim" }, { text: "🪙 Everest Coin & Ball" }],
            [{ text: "📅 Dars jadvali" }, { text: "🏢 Markaz ma'lumoti" }],
            [{ text: "🔄 Boshqa login kiritish" }]
        ],
        resize_keyboard: true
    };
}

async function handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text = String(msg.text || '').trim();
    const username = (msg.from?.username || '').toLowerCase();

    if (!text) return;

    const db = await getDB();
    db.settings = db.settings || {};
    db.settings.lastActiveTgId = chatId;

    // 1. /start komandasi
    if (text.toLowerCase().startsWith('/start')) {
        const parts = text.split(' ');
        const startLogin = parts[1] ? parts[1].trim().toLowerCase() : '';

        if (startLogin) {
            const match = findStudentByChatOrLogin(db, chatId, startLogin);
            if (match) {
                match.student.chatId = chatId;
                if (username) match.student.tg = '@' + username;
                await saveDB(db);

                await tgCall('sendMessage', {
                    chat_id: chatId,
                    parse_mode: 'HTML',
                    text: `<b>✅ EVEREST SMART DAVOMAT ULANDI!</b>\n\n👤 <b>O'quvchi:</b> ${match.student.ism}\n🏢 <b>Markaz:</b> ${match.center.nomi}\n📚 <b>Guruh:</b> ${match.student.fan}\n📈 <b>Davomat ko'rsatkichi:</b> ${calcAttendancePercent(match.student)}%\n🪙 <b>Ball:</b> ${match.student.ball || 0} Coin\n\n<i>Endi har bir dars davomati shu yerga avtomatik yuboriladi!</i>`,
                    reply_markup: getMainKeyboard()
                });
                return;
            }
        }

        const existing = findStudentByChatOrLogin(db, chatId);
        if (existing) {
            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>🎓 Xush kelibsiz, ${existing.student.ism}!</b>\n🏢 <b>Markaz:</b> ${existing.center.nomi}\n\nQuyidagi menyudan kerakli bo'limni tanlang:`,
                reply_markup: getMainKeyboard()
            });
        } else {
            await tgCall('sendMessage', {
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `<b>👋 Assalomu alaykum! Everest OS Smart Davomat botiga xush kelibsiz!</b>\n\nFarzandingiz yoki o'zingizning davomat ma'lumotlaringizni Telegramga ulash uchun <b>Loginingizni</b> yozib yuboring:`
            });
        }
        await saveDB(db);
        return;
    }

    // 2. Boshqa login kiritish
    if (text === "🔄 Boshqa login kiritish") {
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `🔐 Yangi o'quvchi <b>Loginini</b> yozib yuboring:`
        });
        return;
    }

    // 3. Menyudagi tugmalar
    const linked = findStudentByChatOrLogin(db, chatId);

    if (text === "📊 Davomatim" && linked) {
        const s = linked.student;
        const pct = calcAttendancePercent(s);
        const hist = toArray(s.tarix).slice(0, 5);
        const histText = hist.length === 0
            ? "Hozircha tarix yo'q"
            : hist.map(h => `• <b>${h.sana}</b> (${h.vaqt || ''}) — ${h.holat.toUpperCase()} <i>(${h.izoh || '-'})</i>`).join('\n');

        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `<b>📊 SHAXSIY DAVOMAT KUNDALIGI</b>\n\n👤 <b>O'quvchi:</b> ${s.ism}\n📚 <b>Fan:</b> ${s.fan}\n📈 <b>Umumiy davomat:</b> ${pct}%\n📌 <b>Bugungi holat:</b> ${String(s.davomat || 'keldi').toUpperCase()} (${s.izoh || '-'})\n\n<b>Oxirgi darslar:</b>\n${histText}`,
            reply_markup: getMainKeyboard()
        });
        return;
    }

    if (text === "🪙 Everest Coin & Ball" && linked) {
        const s = linked.student;
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `<b>🪙 EVEREST COIN VA NATIJADORLIK</b>\n\n👤 <b>O'quvchi:</b> ${s.ism}\n🏆 <b>To'plangan ball:</b> ${s.ball || 0} Coin\n🎯 <b>Sertifikat holati:</b> ${(Number(s.ball) || 0) >= 80 ? '✅ Tayyor (80+ ball)' : `⏳ Yana ${80 - (Number(s.ball) || 0)} Coin kerak`}`,
            reply_markup: getMainKeyboard()
        });
        return;
    }

    if (text === "📅 Dars jadvali" && linked) {
        const jadval = toArray(linked.center.jadval);
        const jText = jadval.length === 0
            ? "Dars jadvali hali kiritilmagan."
            : jadval.map(j => `🔹 <b>${j.fan}</b> (${j.ustoz})\n   🕒 ${j.kunlar} | ${j.vaqt}`).join('\n\n');

        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `<b>📅 MARKAZ DARS JADVALI (${linked.center.nomi})</b>\n\n${jText}`,
            reply_markup: getMainKeyboard()
        });
        return;
    }

    if (text === "🏢 Markaz ma'lumoti" && linked) {
        const c = linked.center;
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `<b>🏢 ${c.nomi}</b>\n\n📍 <b>Manzil:</b> ${c.manzil}\n📞 <b>Telefon:</b> ${c.tel}\n💳 <b>To'lov kartasi:</b> <code>${c.karta || 'Kiritilmagan'}</code> (${c.kartaEgasi || '-'})\n🌐 <b>Web Platforma:</b> ${WEB_APP_URL}`,
            reply_markup: getMainKeyboard()
        });
        return;
    }

    // 4. Agar foydalanuvchi login yozib yuborgan bo'lsa
    const byLogin = findStudentByChatOrLogin(db, chatId, text);
    if (byLogin) {
        byLogin.student.chatId = chatId;
        if (username) byLogin.student.tg = '@' + username;
        await saveDB(db);

        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `<b>✅ HISOB MUVAFFAQIYATLI ULANDI!</b>\n\n👤 <b>O'quvchi:</b> ${byLogin.student.ism}\n🏢 <b>Markaz:</b> ${byLogin.center.nomi}\n📚 <b>Guruh:</b> ${byLogin.student.fan}\n📈 <b>Davomat:</b> ${calcAttendancePercent(byLogin.student)}%\n🪙 <b>Ball:</b> ${byLogin.student.ball || 0} Coin\n\n<i>Endi ustoz yoki admin davomat belgilashi bilan shu yerga xabar keladi!</i>`,
            reply_markup: getMainKeyboard()
        });
    } else {
        await tgCall('sendMessage', {
            chat_id: chatId,
            parse_mode: 'HTML',
            text: `⚠️ <b>"${text}"</b> logini bo'yicha o'quvchi topilmadi.\n\nIltimos, markaz admini bergan aniq loginni yozing yoki <a href="${WEB_APP_URL}">Everest Web Platformasi</a> orqali ro'yxatdan o'ting.`
        });
    }
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
    console.log("🤖 Everest Telegram Bot (@everest_crmbot) 24/7 rejimida ishga tushdi!");
    pollUpdates();
}

if (require.main === module) {
    startBot();
}

module.exports = { startBot };