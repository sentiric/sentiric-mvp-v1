module.exports = {
  id: 'otel_rezervasyonu',
  // Gereken alanlar ve kullanıcıdan nasıl istenecekleri
  required_params: [
    { name: 'location', question: 'Harika, otel rezervasyonu için hangi şehirdesiniz?' },
    { name: 'checkin_date', question: 'Peki, hangi tarihte giriş yapmayı düşünüyorsunuz?' },
    { name: 'people_count', question: 'Anladım. Kaç kişi konaklayacaksınız?' },
    { name: 'budget', question: 'Son olarak, gecelik bütçeniz yaklaşık olarak ne kadar?' }
  ],
  // Bu senaryo için AI'a verilecek genel talimat
  system_instruction: 'Sen, otel rezervasyonu yapan bir müşteri temsilcisisin. Görevin, kullanıcıdan adım adım gerekli bilgileri toplayarak bir rezervasyon oluşturmaktır.'
};