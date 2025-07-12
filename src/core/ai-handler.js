// src/core/ai-handler.js (LLM Orkestratörü ve Ortak AI Fonksiyonları)

const fetch = require('node-fetch');
const config = require('../config');

let llmAdapter;
if (config.useLocalLLM) {
    llmAdapter = require('./llm-adapters/ollama-adapter');
    console.log("[AI Handler] LLM olarak Yerel Ollama Adaptörü kullanılıyor.");
} else {
    llmAdapter = require('./llm-adapters/gemini-adapter');
    console.log("[AI Handler] LLM olarak Google Gemini Adaptörü kullanılıyor.");
}

async function generateText(prompt) {
    return llmAdapter.generateText(prompt);
}

async function extractParameters(text, paramName, question) {
    let specificPrompt = '';

    // LLM'e sadece metinde geçen değeri çıkarmasını, yoksa null dönmesini açıkça belirtiyoruz.
    const baseInstruction = "Sadece ve sadece JSON formatında yanıt ver. Bu objenin içinde tek bir anahtar 'value' olsun. Başka hiçbir metin, açıklama veya formatlama olmamalı. Eğer ilgili bilgi metinde açıkça belirtilmemişse, 'value' anahtarına null değerini ata.";

    if (paramName === 'people_count') {
        specificPrompt = `Kullanıcının şu cevabından: "${text}", kaç kişi olduğunu bir sayı olarak çıkar. ${baseInstruction} Örnek: {"value": "2"} veya {"value": null}`;
    } else if (paramName === 'budget') {
        specificPrompt = `Kullanıcının şu cevabından: "${text}", bütçesini (sadece sayısal değeri) çıkar. ${baseInstruction} Örnek: {"value": "1000"} veya {"value": null}`;
    } else if (paramName === 'location') { // Konum için özel talimat
        specificPrompt = `Kullanıcının şu cevabından: "${text}", otel rezervasyonu için hangi şehirde olduğunu çıkar. Yanıtını sadece bir JSON objesi olarak ver ve bu objenin içinde tek bir anahtar 'value' olsun. Başka hiçbir metin, açıklama veya formatlama olmamalı. Eğer şehir metinde açıkça belirtilmemişse, 'value' anahtarına null değerini ata. Örnek: {"value": "Antalya"} veya {"value": null}`;
    } else {
        // Genel parametreler için
        specificPrompt = `Kullanıcının şu cevabından: "${text}", sorulan şu soruya karşılık gelen değeri çıkar: "${question}". ${baseInstruction} Örnek: {"value": "15 Temmuz"} veya {"value": null}`;
    }
    
    let responseText = '';
    try {
        responseText = await generateText(specificPrompt); // LLM'in ham yanıtı
        console.log("[AI Handler] LLM Ham Yanıtı:", responseText); // Hata ayıklama için
        
        const jsonStringMatch = responseText.match(/\{.*?\}/s); 
        
        if (!jsonStringMatch || !jsonStringMatch[0]) {
            console.warn("[AI Handler] ⚠️ LLM yanıtında geçerli bir JSON objesi bulunamadı. Ham yanıt:", responseText);
            return null; 
        }

        const jsonString = jsonStringMatch[0];
        console.log("[AI Handler] Çıkarılan JSON Dizisi:", jsonString); // Hata ayıklama için

        const extracted = JSON.parse(jsonString);
        
        if (extracted && extracted.value !== undefined) {
            // Eğer LLM 'null' döndürdüyse, bunu null olarak kabul et.
            if (extracted.value === null || String(extracted.value).trim().toLowerCase() === 'null') {
                return null;
            }
            return extracted.value;
        } else if (extracted && Object.keys(extracted).length === 1) {
            const firstKey = Object.keys(extracted)[0];
            const valueFromFirstKey = extracted[firstKey];
            if (valueFromFirstKey === null || String(valueFromFirstKey).trim().toLowerCase() === 'null') {
                return null;
            }
            console.warn(`[AI Handler] ⚠️ LLM 'value' anahtarı yerine '${firstKey}' anahtarını döndürdü. Değeri bu anahtardan alınıyor.`);
            return valueFromFirstKey;
        } else {
            console.warn("[AI Handler] ⚠️ LLM yanıtı beklenen 'value' anahtarını içermiyor veya beklenmedik formatta. Ham JSON:", extracted);
            return null;
        }

    } catch (error) {
        console.error("[AI Handler] ❌ Bilgi çıkarımı sırasında hata (JSON ayrıştırma veya LLM yanıtı formatı):", error.message);
        console.error("[AI Handler] Hata alınan metin:", responseText); // Hata anında ham yanıtı tekrar göster
        return null;
    }
}

async function getImageUrl(query) {
    if (!config.pexelsApiKey) {
        console.warn("[AI Handler] Pexels API Anahtarı tanımlı değil. Rastgele Unsplash görseli kullanılacak.");
        return `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    }
    try {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
            headers: { 'Authorization': config.pexelsApiKey }
        });
        if (!response.ok) throw new Error(`Pexels API'den hata: ${response.statusText}`);
        const data = await response.json();
        return data.photos?.[0]?.src.medium || `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    } catch (error) {
        console.error("[AI Handler] Pexels API hatası:", error.message);
        return `https://source.unsplash.com/random/400x200/?${encodeURIComponent(query)}`;
    }
}

module.exports = { 
    generateText, 
    extractParameters, 
    getImageUrl 
};