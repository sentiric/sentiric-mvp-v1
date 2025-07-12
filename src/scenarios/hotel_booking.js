// src/scenarios/hotel_booking.js

const hotelBookingTool = {
  // Bu, LLM'in kullanacağı fonksiyonun adı
  name: "otel_rezervasyonu_yap", 
  // Bu açıklama, LLM'in bu aracı NE ZAMAN kullanacağını anlamasına yardımcı olur
  description: "Bir müşteri için otel rezervasyonu yapar. Gerekli tüm parametreler (konum, tarih, kişi sayısı) toplandığında bu aracı kullan.",
  // Bu, aracın hangi parametreleri kabul ettiğini ve hangilerinin zorunlu olduğunu belirtir
  parameters: {
    type: "OBJECT",
    properties: {
      location: {
        type: "STRING",
        description: "Rezervasyonun yapılacağı şehir veya bölge, örn: 'Antalya', 'Taksim Meydanı'",
      },
      checkin_date: {
        type: "STRING",
        description: "Otele giriş yapılacak tarih, örn: 'yarın', '25 Ağustos 2025'",
      },
      people_count: {
        type: "NUMBER",
        description: "Konaklayacak toplam kişi sayısı",
      },
      budget: { // Bütçeyi opsiyonel yapalım
        type: "NUMBER",
        description: "Gecelik kişi başı bütçe (isteğe bağlı)",
      },
    },
    // Bu parametreler olmadan fonksiyon çağrılamaz
    required: ["location", "checkin_date", "people_count"],
  },
};

module.exports = {
  id: 'otel_rezervasyonu',
  // Tetikleyici anahtar kelimeler hala faydalı olabilir
  trigger_keywords: ['otel', 'oda', 'rezervasyon', 'konaklama'],
  // En önemli kısım: LLM için araç tanımı
  tool_definition: hotelBookingTool
};