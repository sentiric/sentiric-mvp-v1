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

async function extractMultipleParameters(userText, paramDefinitions) {
    const prompt = `Kullanıcının şu cevabından: "${userText}", aşağıdaki parametreleri çıkar. Yanıtını sadece bir JSON objesi olarak ver. Bu objede, her parametre için bir anahtar ve çıkarılan değer bulunsun. Eğer bir parametre için metinde açıkça bir değer belirtilmemişse, o anahtara null değerini ata. Başka hiçbir metin veya açıklama ekleme.

Parametreler ve beklenen türleri/örnekleri:
${paramDefinitions.map(p => `- '${p.name}': ${p.name === 'people_count' ? 'sayı' : p.name === 'budget' ? 'sayı' : 'metin'}`).join('\n')}

Örnek çıktı formatı:
{
  "location": "Antalya",
  "checkin_date": "15 Temmuz 2025",
  "people_count": 2,
  "budget": null
}`;

    let responseText = '';
    try {
        responseText = await generateText(prompt);
        console.log("[AI Handler] LLM Ham Yanıtı (Çoklu Parametre):", responseText);

        const jsonStringMatch = responseText.match(/\{.*?\}/s);
        if (!jsonStringMatch || !jsonStringMatch[0]) {
            console.warn("[AI Handler] ⚠️ LLM yanıtında geçerli bir JSON objesi bulunamadı (Çoklu Parametre). Ham yanıt:", responseText);
            return {}; 
        }

        let jsonString = jsonStringMatch[0];
        // JSON ayrıştırmadan önce hatalı karakterleri temizlemeye çalış
        // Örneğin: "people_count": , gibi hatalı virgülleri düzelt
        jsonString = jsonString.replace(/,\s*([}\]])/g, '$1'); // sondaki virgülü sil
        jsonString = jsonString.replace(/:\s*,/g, ': null,'); // Eksik değerleri null ile doldur (": ," -> ": null,")
        jsonString = jsonString.replace(/:\s*([}\]])/g, ': null$1'); // Eksik değerleri null ile doldur (": }" -> ": null}")
        
        console.log("[AI Handler] Temizlenmiş JSON Dizisi (Çoklu Parametre):", jsonString); // Yeni log

        const extracted = JSON.parse(jsonString);

        if (typeof extracted === 'object' && extracted !== null && Object.keys(extracted).length > 0) {
            for (const key in extracted) {
                if (typeof extracted[key] === 'string' && extracted[key].toLowerCase().trim() === 'null') {
                    extracted[key] = null;
                }
            }
            return extracted;
        } else {
            console.warn("[AI Handler] ⚠️ LLM yanıtı beklenen çoklu parametre formatında değil veya boş. Ham JSON:", extracted);
            return {};
        }

    } catch (error) {
        console.error("[AI Handler] ❌ Çoklu parametre çıkarımı sırasında hata (JSON parse hatası):", error.message); // Hata mesajı güncellendi
        console.error("[AI Handler] Hata alınan metin (Çoklu Parametre):", responseText);
        return {}; 
    }
}


async function answerQuestionWithContext(userQuestion, knowledgeBase) {
    // RAG prompt'unu daha da iyileştirelim
    const prompt = `Aşağıdaki bilgilerden yola çıkarak, kullanıcının "${userQuestion}" sorusuna en uygun, kısa ve net cevabı ver. Bilgiler sadece referans amaçlıdır, kendi bilgini ekleme. Eğer bilgilerde doğrudan bir cevap yoksa veya soruyla alakasızsa, 'Üzgünüm, bu konuda bilgiye sahip değilim.' şeklinde yanıt ver. Kesinlikle ekstra konuşma veya giriş cümlesi kullanma.

Bilgiler:
${JSON.stringify(knowledgeBase.faqs.map(f => ({ question: f.question, answer: f.answer })))}
${JSON.stringify(knowledgeBase.contact_info ? [{ question: "İletişim bilgileri", answer: `Telefon: ${knowledgeBase.contact_info.phone}, E-posta: ${knowledgeBase.contact_info.email}, Web sitesi: ${knowledgeBase.contact_info.website}` }] : [])}
`;

    try {
        const responseText = await generateText(prompt);
        console.log("[AI Handler] RAG Ham Yanıtı:", responseText);
        return responseText.trim();
    } catch (error) {
        console.error("[AI Handler] ❌ Bilgi bankasından yanıt üretimi sırasında hata:", error.message);
        return "Üzgünüm, şu anda bilgiye erişemiyorum.";
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
    extractMultipleParameters, 
    getImageUrl,
    answerQuestionWithContext 
};