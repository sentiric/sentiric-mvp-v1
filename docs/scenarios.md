## Sentiric MVP v1: Gelişmiş Test Senaryoları

### Senaryo 1: Tek Cümlede Tam Rezervasyon (Multi-Parameter Extraction'ın Zirvesi)

Bu senaryo, sistemin birden fazla bilgiyi tek seferde alıp almadığını test edecek. Bu, en akıcı diyalog deneyimi olmalı.

*   **Sistem Başlangıcı:** "Merhaba, ben Sentiric. Size nasıl yardımcı olabilirim?"
*   **Siz Söyleyin:** `"İstanbul'da 15 Temmuz 2025 için 2 kişilik 1000 TL bütçeli otel rezervasyonu yapmak istiyorum."`

*   **Beklenen Davranış:**
    *   Sistem ek bir soru sormadan tüm parametreleri (konum, tarih, kişi sayısı, bütçe) tek seferde algılamalı.
    *   Doğrudan rezervasyonu tamamlayıp size onay mesajını sesli olarak ve ekranda göstermeli.
*   **Loglarda Neye Dikkat Edin:**
    *   `[DialogOrchestrator] Senaryo bulundu: otel_rezervasyonu`
    *   `[AI Handler] LLM Ham Yanıtı (Çoklu Parametre):` altında gelen JSON'da **tüm 4 parametrenin de (location, checkin_date, people_count, budget)** dolu olduğunu ve doğru değerleri içerdiğini görmelisiniz.
    *   `[DialogOrchestrator] Bilgi çıkarıldı:` mesajlarının 4 parametre için de göründüğünü kontrol edin.
    *   `[DB] ✅ Rezervasyon veritabanına kaydedildi:` mesajını görmelisiniz.
    *   Son olarak, sistemin sesli olarak size **detaylı onay mesajını** (örn: "Harika! Tüm bilgileri aldım. İstanbul için 15 Temmuz 2025 tarihinde 2 kişilik otel rezervasyonunuzu 1000 TL bütçe ile oluşturdum. Onay mesajı telefonunuza gönderilecektir.") vermesi gerekiyor.

---

### Senaryo 2: Aşamalı Rezervasyon (Kullanıcı Tarafından Kontrollü Akış)

Bu senaryo, kullanıcı bilgileri parça parça verdiğinde sistemin akışı nasıl yönettiğini test edecek.

*   **Sistem Başlangıcı:** "Merhaba, ben Sentiric. Size nasıl yardımcı olabilirim?"
*   **Siz Söyleyin:** `"Otel rezervasyonu yapmak istiyorum."`
*   **Beklenen Sistem:** Size ilk eksik parametreyi (konum) sormalı: `"Harika, otel rezervasyonu için hangi şehirdesiniz?"`
*   **Siz Söyleyin:** `"Antalya"`
*   **Beklenen Sistem:** İkinci eksik parametreyi (tarih) sormalı: `"Peki, hangi tarihte giriş yapmayı düşünüyorsunuz?"`
*   **Siz Söyleyin:** `"20 Ağustos 2025"`
*   **Beklenen Sistem:** Üçüncü eksik parametreyi (kişi sayısı) sormalı: `"Anladım. Kaç kişi konaklayacaksınız?"`
*   **Siz Söyleyin:** `"4 kişi"`
*   **Beklenen Sistem:** Son eksik parametreyi (bütçe) sormalı: `"Son olarak, gecelik bütçeniz yaklaşık olarak ne kadar?"`
*   **Siz Söyleyin:** `"750 Türk lirası"`
*   **Beklenen Davranış:** Sistem rezervasyonu tamamlayıp size onay mesajını sesli olarak ve ekranda göstermeli.

*   **Loglarda Neye Dikkat Edin:**
    *   Her adımda LLM'den gelen JSON yanıtlarının (`{"value": "Antalya"}` gibi) temiz ve doğru olduğunu kontrol edin.
    *   Her adımda `[DialogOrchestrator] Bilgi çıkarıldı:` mesajlarının doğru parametreyi kaydettiğini görün.
    *   Sonunda rezervasyonun kaydedildiğini ve detaylı onay mesajının geldiğini doğrulayın.

---

### Senaryo 3: Bilgi Talebi (RAG - Özellikle Daha Önce Zorlayan Sorular)

Bu senaryo, RAG (Retrieval-Augmented Generation) özelliğini ve LLM'in bilgi bankası dışındaki yanıtlara karşı nasıl tepki verdiğini test edecek.

*   **Sistem Başlangıcı:** "Merhaba, ben Sentiric. Size nasıl yardımcı olabilirim?"

*   **Test 3.1: Çalışma Saatleri (Başarılı Örnek)**
    *   **Siz Söyleyin:** `"Çalışma saatleriniz nedir?"`
    *   **Beklenen Sistem:** Bilgi bankasındaki çalışma saatleri bilgisini sesli olarak yanıtlamalı.
    *   **Loglarda:** `[AI Handler] RAG Ham Yanıtı:` altında bilgi bankasındaki cevabı görmelisiniz.

*   **Test 3.2: Adres (Daha Önce Sorunluydu, şimdi düzelmiş olmalı!)**
    *   **Siz Söyleyin:** `"Adresiniz neresi?"`
    *   **Beklenen Sistem:** Bilgi bankasındaki adres bilgisini sesli olarak yanıtlamalı.
    *   **Loglarda:** `[AI Handler] RAG Ham Yanıtı:` altında adres bilgisini görmelisiniz.

*   **Test 3.3: Telefon Numarası (Contact Info Testi)**
    *   **Siz Söyleyin:** `"Telefon numaranız nedir?"` veya `"Bana telefon numarası verebilir misiniz?"`
    *   **Beklenen Sistem:** Bilgi bankasındaki telefon numarasını sesli olarak yanıtlamalı (Örn: "Telefon numaramız 0850 XXX XX XX'dir.").
    *   **Loglarda:** `[AI Handler] RAG Ham Yanıtı:` altında telefon bilgisini görmelisiniz.

*   **Test 3.4: Bilgi Bankası Dışı Soru (Sınırları Test Etme)**
    *   **Siz Söyleyin:** `"Dünyanın en yüksek dağı hangisidir?"`
    *   **Beklenen Sistem:** LLM'in bilgi bankasında bu bilgi olmadığı için "Üzgünüm, bu konuda bilgiye sahip değilim." gibi bir yanıt vermeli.
    *   **Loglarda:** `[AI Handler] RAG Ham Yanıtı:` altında bu yanıtı görmelisiniz.

---

### Senaryo 4: Hata Yönetimi ve Anlayamama (Dayanıklılık Testi)

Sistemin yanlış veya anlaşılmaz girişlere nasıl tepki verdiğini test edecek.

*   **Sistem Başlangıcı:** "Merhaba, ben Sentiric. Size nasıl yardımcı olabilirim?"
*   **Siz Söyleyin:** `"Otel rezervasyonu yapmak istiyorum."`
*   **Beklenen Sistem:** İlk eksik parametreyi (konum) sormalı.
*   **Siz Söyleyin:** `"Benim adım kuş"` (konum yerine alakasız bir yanıt)
*   **Beklenen Sistem:** `[DialogOrchestrator - Validation] ⚠️ Konum değeri şüpheli` logunu görmelisiniz. Sistem size "Harika, otel rezervasyonu için hangi şehirdesiniz?" gibi aynı soruyu tekrarlamalı.
*   **Siz Söyleyin:** `"Elma salata"` (yine alakasız bir yanıt)
*   **Beklenen Sistem:** `[DialogOrchestrator - Validation] ⚠️ Konum değeri şüpheli` logunu tekrar görmelisiniz. Bu sefer `[DialogOrchestrator] ⚠️ Hiçbir beklenen parametre çıkarılamadı veya geçersiz. Anlayamama sayısı: 2` loguyla birlikte size `"Üzgünüm, sizi tam olarak anlayamadım. Lütfen bilgiyi daha net bir şekilde tekrar edebilir misiniz?"` gibi bir mesaj vermeli.
*   **Siz Söyleyin:** `"İstanbul"` (doğru yanıt)
*   **Beklenen Sistem:** Diyalog akışına kaldığı yerden (tarih sormayla) devam etmeli.

---
