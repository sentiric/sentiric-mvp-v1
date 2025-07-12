// src/scenarios/information_request.js
module.exports = {
  id: 'information_request',
  // Bu anahtar kelimelerle kullanıcı bilgi almak istediğini belli eder.
  trigger_keywords: ['bilgi', 'saat', 'adres', 'nedir', 'politika', 'nasıl', 'telefon', 'site', 'e-posta'],
  
  // Bilgi talebi senaryosunda parametre toplamıyoruz, bu yüzden boş bırakabiliriz
  required_params: [],

  // Bu senaryoda doğrudan bir onay mesajı yerine, LLM'den gelen cevabı kullanacağız.
  // Bu bir placeholder fonksiyondur, Worker'da farklı ele alınacak.
  confirmation_message: () => "Bilgi talebiniz işleniyor.", 
};