# 🤖 Everest CRM — Telegram Bot Qo'llanma

## 1-QADAM: Node.js O'rnatish

Agar hali o'rnatilmagan bo'lsa:
👉 https://nodejs.org → "LTS" versiyasini yuklab o'rnating

O'rnatilganini tekshirish:
```
node --version
```
(Masalan: `v20.11.0` chiqishi kerak)

---

## 2-QADAM: Botni Ishga Tushirish

### Usul 1: Ikkita alohida terminal oynasida

**Terminal 1 — Server (CRM sayt):**
```bash
cd C:\Users\TTB\Desktop\CRM
node server.js
```

**Terminal 2 — Telegram Bot:**
```bash
cd C:\Users\TTB\Desktop\CRM
node bot.js
```

### Usul 2: Yagona `start.bat` fayli (avtomatik)
`start.bat` faylini ikki marta bosing — hammasi bir vaqtda ishga tushadi.

---

## 3-QADAM: Botni Tekshirish

1. Telegramda **@everest_crmbot** ni oching
2. `/start` yuboring
3. Login va parolingizni kiriting (markaz tomonidan berilgan)
4. Menyudan kerakli bo'limni tanlang

---

## BOT IMKONIYATLARI

| Funksiya | Kim uchun |
|----------|-----------|
| 📊 Bugungi davomatim | O'quvchi |
| 📅 Ertangi darslar | O'quvchi |
| 📈 Mening natijalarim | O'quvchi |
| 📋 Davomat tarixi | O'quvchi |
| 👨‍👩‍👧 Ota-ona rejimi | Ota-ona |
| 🔔 Avtomatik xabar | Davomat belgilanganida |

---

## OTA-ONA REJIMI

Ota-ona botga kirib:
1. "👨‍👩‍👧 Ota-ona rejimi" tugmasini bosadi
2. Farzandining **login va parolini** kiritadi
3. Farzandining davomati, dars jadvali va natijalarini ko'radi

**MUHIM:** Ota-ona va farzand bitta botda, alohida hisobga kirishi shart emas.

---

## DAVOMAT XABARLARI

CRM saytidan davomat belgilanganida o'quvchi Telegramga **avtomatik xabar** oladi:

```
✅ DAVOMAT YANGILANDI

👤 O'quvchi: Alisher Valiyev
📚 Fan: IELTS Intensive
📌 Holat: KELDI (+5 Coin)
📝 Izoh: Vaqtida keldi (+5 Coin)
🏫 Markaz: Everest IT & IELTS Academy
🕐 Vaqt: 2026-11-11 10:30

🪙 Joriy ball: 95 Coin
```

---

## MUAMMOLAR VA YECHIMLAR

**Muammo:** "Login yoki parol xato!"
**Yechim:** Markazdan berilgan login va parolni to'g'ri kiritganingizni tekshiring.

**Muammo:** Bot javob bermayapti
**Yechim:** `node bot.js` ishga tushirilganini tekshiring.

**Muamlo:** "409 Conflict" xatosi
**Yechim:** Bot webhook bilan ziddiyat — bot o'zi avtomatik hal qiladi.

---

## .ENV FAYLI (Maxfiy ma'lumotlar)

`.env` faylida o'zgartiring:
```
PORT=3000
BOT_PORT=3001
FIREBASE_DB_URL=https://everestcrm-5b705-default-rtdb.firebaseio.com/everest_saas_prod.json
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE
SUPER_ADMIN_LOGIN=nvmtrpv
```

---

## ARXITEKTURA

```
CRM Sayt (server.js :3000)
    ↕ Firebase DB
Telegram Bot (bot.js :3001)
    ↕ Telegram API
Foydalanuvchi (Telegram)
```

Davomat belgilanganida:
```
CRM Sayt → POST /api/attendance → DB saqlanadi → Telegram xabar yuboriladi
```
