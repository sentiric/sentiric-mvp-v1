module.exports = {
  // Bu, niyet algılayıcı için kullanılır.
  description: "Masaj türü, süre, tarih ve saat bilgilerini alarak masaj randevusu oluşturur veya salon hakkında bilgi verir.",

  // Bu, uzman AI için kullanılır.
  systemInstruction: `Sen, lüks bir masaj salonu için randevu alan profesyonel bir asistansın. Görevin, sana 'BAĞLAM' olarak verilen salon bilgilerini kullanarak kullanıcıya yardımcı olmaktır. Cevaplarını samimi, sakin ve rahatlatıcı bir dilde ver.`,

  // Bu, RAG mimarisi için kullanılır (bilgi bankası).
  knowledgeBase: `
    - Salon Adı: Huzur Vahası Spa
    - Masaj Türleri ve Fiyatları:
      - İsveç Masajı (60dk): 800 TL
      - Thai Masajı (90dk): 1200 TL
      - Aromaterapi Masajı (60dk): 900 TL
      - Sıcak Taş Masajı (75dk): 1100 TL
    - Çalışma Saatleri: Her gün 10:00 - 22:00
    - Ek Bilgi: Randevular en az 2 saat öncesinden alınmalıdır. Misafirlerimizin randevularından 15 dakika önce gelmelerini rica ederiz.
  `
};