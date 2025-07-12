// src/scenarios/hotel_booking.js
module.exports = {
  id: 'otel_rezervasyonu',
  trigger_keywords: ['otel', 'oda', 'rezervasyon', 'konaklama'],

  required_params: [
    {
      name: 'location',
      question: 'Otel bakmaya başlayalım! Hangi şehirde konaklamayı düşünüyorsunuz?',
    },
    {
      name: 'checkin_date',
      question: 'Harika, peki giriş yapmayı planladığınız tarih nedir?',
    },
    {
      name: 'people_count',
      question: 'Kaç kişi olacaksınız? Bu bilgi uygun oda bulmam için önemli.',
    },
    {
      name: 'budget',
      question: 'Son olarak, gecelik kişi başı yaklaşık bütçenizi öğrenebilir miyim?',
    },
  ],

  confirmation_message: (params) => {
    const location = params.location || 'belirtilmeyen bir şehir';
    const date = params.checkin_date || 'belirtilmeyen bir tarih';
    const people = params.people_count || 'belirtilmeyen kişi sayısı';
    const budget = params.budget ? `Kişi başı yaklaşık ${params.budget} TL bütçeyle` : '';

    return `Süper! ${location} için ${date} tarihinde ${people} kişilik bir otel arıyorum. ${budget} en uygun seçenekleri hazırlıyorum. Rezervasyon detaylarını size kısa süre içinde ileteceğim.`;
  },
};
