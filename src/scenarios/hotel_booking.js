// src/scenarios/hotel_booking.js
module.exports = {
  id: 'otel_rezervasyonu',
  trigger_keywords: ['otel', 'oda', 'rezervasyon', 'konaklama'],
  
  required_params: [
    { name: 'location', question: 'Harika, otel rezervasyonu için hangi şehirdesiniz?' },
    { name: 'checkin_date', question: 'Peki, hangi tarihte giriş yapmayı düşünüyorsunuz?' },
    { name: 'people_count', question: 'Anladım. Kaç kişi konaklayacaksınız?' },
    { name: 'budget', question: 'Son olarak, gecelik bütçeniz yaklaşık olarak ne kadar?' }
  ],

  confirmation_message: "Harika! Tüm bilgileri aldım. Rezervasyonunuzu oluşturdum.",
};