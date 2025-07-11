// src/core/tts-handler.js
const http = require('http');
const config = require('../config');

function getXttsAudio(text) {
    return new Promise((resolve, reject) => {
        if (!text || text.trim() === "") {
            return resolve("");
        }
        const params = new URLSearchParams({ text, language: "tr" });
        const url = `http://${config.xttsHost}:${config.xttsPort}/api/tts?${params.toString()}`;

        http.get(url, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`XTTS sunucusundan hata kodu ${res.statusCode}`));
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve(Buffer.concat(chunks).toString('base64'));
            });
        }).on('error', (e) => {
            reject(`XTTS isteği başarısız: ${e.message}.`);
        });
    });
}

module.exports = { getXttsAudio };