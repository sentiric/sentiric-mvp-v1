module.exports = {
  // Bu, niyet algılayıcı için kullanılır.
  description: "Otel odası arama, müsaitlik kontrolü ve rezervasyon yapma işlemlerini yönetir veya otel hakkında genel bilgi verir.",
  
  // Bu, uzman AI için kullanılır.
  systemInstruction: `Sen, bir otel asistanısın. Görevin, sana 'BAĞLAM' olarak verilen otel bilgilerini kullanarak kullanıcıya yardımcı olmaktır. Bilmediğin konularda varsayım yapma. Cevaplarını kısa ve net tut. Kullanıcıya her zaman profesyonel bir dille hitap et.`,
  
  // Bu, RAG mimarisi için kullanılır (bilgi bankası).
  knowledgeBase: `
    - Otel Adı: Sahil Sarayı Otel
    - Konum: Antalya, Konyaaltı
    - Oda Tipleri: Standart Oda (2 kişi), Aile Odası (4 kişi), Kral Dairesi (Jakuzili)
    - Gecelik Fiyatlar: Standart 1500 TL, Aile 2500 TL, Kral Dairesi 5000 TL
    - Hizmetler: Ücretsiz kahvaltı, Ücretli Spa (Masaj 500 TL), Ücretsiz Havuz ve Plaj
    - İptal Politikası: Girişten 48 saat öncesine kadar ücretsizdir.
    - Check-in saati: 14:00 sonrası. Check-out saati: 12:00 öncesi.
  `
};