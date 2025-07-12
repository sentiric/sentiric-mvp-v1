// src/scenarios/hotel_booking.js

module.exports = {
  // Senaryoyu tanımak için kullanılan ID
  id: 'otel_rezervasyonu',
  
  // Senaryoyu tetiklemek için anahtar kelimeler
  trigger_keywords: ['otel', 'oda', 'rezervasyon', 'konaklama', 'yer ayırt'],
  
  // Prompt'a eklenecek olan, LLM'e aracı nasıl kullanacağını anlatan metin.
  tool_description: `
- Function: otel_rezervasyonu_yap(location: string, checkin_date: string, people_count: number, budget?: number)
- Description: Müşteri için bir otel rezervasyonu oluşturur. 'location', 'checkin_date' ve 'people_count' parametreleri zorunludur. 'budget' isteğe bağlıdır.
  `,

  // LLM'in uyması gereken katı JSON çıktı formatı.
  output_format: {
    "thought": "Buraya kullanıcının isteğini nasıl anladığını ve bir sonraki adımının ne olacağını adım adım yaz. Örneğin: 'Kullanıcı otel rezervasyonu yapmak istiyor. Şu bilgiler mevcut: [mevcut bilgiler]. Şu bilgiler eksik: [eksik bilgiler]. Bu yüzden eksik olan ilk bilgiyi soracağım.'",
    "action": {
      "tool_name": "kullanılacak_fonksiyonun_adı_veya_null",
      "parameters": {
        "location": "çıkarılan_konum_veya_null",
        "checkin_date": "çıkarılan_tarih_veya_null",
        "people_count": "çıkarılan_kişi_sayısı_veya_null",
        "budget": "çıkarılan_bütçe_veya_null"
      }
    },
    "speak": "Eğer ek bilgiye ihtiyaç varsa, kullanıcıya sorulacak bir sonraki kısa ve net soru. Eğer tüm bilgiler tamamsa bu alan null olmalı."
  }
};