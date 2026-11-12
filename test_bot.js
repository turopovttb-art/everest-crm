const https = require('https');
https.get('https://api.telegram.org/bot8952625874:AAGdtnmNZ_CIB7jvNEAuHggdmAcMsTL5cUc/getMe', (r) => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
        const result = JSON.parse(d);
        if (result.ok) {
            console.log('✅ BOT ISHLAYAPTI!');
            console.log('Bot nomi: ' + result.result.first_name);
            console.log('Username: @' + result.result.username);
        } else {
            console.log('❌ Token xato!');
        }
    });
});
