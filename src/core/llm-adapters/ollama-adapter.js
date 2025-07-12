// src/core/llm-adapters/ollama-adapter.js

const fetch = require('node-fetch'); // node-fetch'in yüklü olduğundan emin olun (npm install node-fetch@2.7.0)
const config = require('../../config'); // config'i doğru yoldan çağır

async function generateText(prompt) {
    const ollamaUrl = `http://${config.ollamaHost}:${config.ollamaPort}/api/generate`;
    try {
        const response = await fetch(ollamaUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.ollamaModelName,
                prompt: prompt,
                stream: false, // Şimdilik stream kullanmıyoruz
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API'den hata kodu ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.response.trim(); // Ollama'nın yanıt formatı 'response' alanında gelir
    } catch (error) {
        console.error("[OllamaAdapter] ❌ Metin üretimi sırasında hata:", error.message);
        console.error("[OllamaAdapter] ℹ️ Ollama sunucusunun çalıştığından ve 'phi3' modelinin yüklü olduğundan emin olun (`ollama pull phi3`).");
        throw error;
    }
}

module.exports = {
    generateText,
};