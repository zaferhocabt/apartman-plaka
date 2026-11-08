# Apartman Plaka Sistemi

Telefon ve bilgisayarda çalışan apartman plaka kayıt, sorgu ve ziyaretçi takip sistemi.
Statik site (GitHub Pages) + Supabase veritabanı. Kurulum yaklaşık 15 dakika.

## Özellikler
- **Herkese açık sorgu** (giriş yok): plaka yazılır, “kayıtlı sakin / geçerli ziyaretçi / süresi dolmuş / pasif / kayıtsız” + daire no gösterilir. Ad ve telefon **sunucudan hiç çıkmaz**. Dakikada 30 sorgu sınırı ve açma/kapama anahtarı vardır.
- **Görevli/kapıcı paneli**: hızlı sorgu, sakin adı, tek dokunuşla arama, **kamerayla plaka okuma**, kayıtsız plakayı ziyaretçi olarak ekleme.
- **Süreli ziyaretçi plakası**: saat aralığı seçilir, süre dolunca otomatik “süresi dolmuş” olur.
- **Yönetici paneli**: daire/sakin/araç ekle-düzenle-sil, kullanıcı rolleri, bina adı, herkese açık sorguyu aç/kapat.
- **Sorgu geçmişi**: kim, ne zaman, hangi plakayı sorguladı; CSV dışa aktarma.
- **İçe/dışa aktarma**: Excel’den CSV ile toplu yükleme, CSV/JSON yedek, yazdırılabilir araç listesi (PDF).
- Mobil öncelikli, açık/koyu tema.

## Roller
| | Herkes | Görevli | Yönetici |
|---|:-:|:-:|:-:|
| Plaka sorgula (yalnızca durum + daire) | ✓ | ✓ | ✓ |
| Sakin adı/telefon görme | | ✓ | ✓ |
| Ziyaretçi ekle | | ✓ | ✓ |
| Kendi sorgu geçmişi | | ✓ | ✓ |
| Tüm geçmiş, daire/araç düzenleme, kullanıcılar, ayarlar | | | ✓ |

Bu kurallar arayüzde değil **veritabanında** (RLS) uygulanır; arayüz değiştirilse bile yetkisiz veri alınamaz.

## Kurulum
### 1) Supabase (veritabanı)
1. https://supabase.com → ücretsiz hesap → **New project** (bölge: Frankfurt/Avrupa yakın olan).
2. **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**.
3. **Authentication → Users → Add user**: kendi e-posta ve şifrenle kullanıcı oluştur (*Auto Confirm* işaretli).
4. **Authentication → Sign In / Providers → Email**: “Allow new users to sign up” **kapalı** olsun (hesapları yalnızca siz açın).
5. SQL Editor’de kendini yönetici yap:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Adınız' where email = 'sizin@eposta.com';
   ```
6. **Project Settings → API**: `Project URL` ve `anon public` anahtarını not al. (`service_role` anahtarını kimseyle paylaşma, siteye koyma.)

### 2) Yerelde deneme
```
npm install
npm run dev        # anahtarlar yoksa DEMO modu: yonetici@demo.local / demo1234
```
Gerçek veritabanıyla denemek için `.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun.

### 3) GitHub Pages’e yayın
1. Depoyu GitHub’a gönderin (public; Pages ücretsiz planda public depo ister. Depoda gerçek veri yok, veriler Supabase’te).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. Repo → **Settings → Secrets and variables → Actions → Variables** sekmesi: `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` ekleyin.
4. `main` dalına her gönderimde site otomatik derlenir ve yayınlanır: `https://KULLANICI.github.io/DEPO/`.

### 4) İlk kullanım
Yönetici olarak giriş → **Yönetim → Şablonu indir** → Excel’de daire/plaka/sakin doldur → **CSV içe aktar**. Kapıcı için Supabase’te hesap açın, **Yönetim → Kullanıcılar**’dan “Görevli” yapın.

## Kamerayla plaka okuma
Tarayıcıda Tesseract OCR ile çalışır; görüntü hiçbir yere gönderilir. HTTPS gerekir (GitHub Pages uygundur). Okuyucu dosyaları ilk kullanımda internetten indirilir. Doğruluk ışığa, açıya ve plaka temizliğine bağlıdır; okunan plaka her zaman görevliye onaylatılır. Plaka okuma kuralları (O/0, I/1 karışıklığı) `src/plate.ts` içinde, testleri `tests/` altındadır.

## Gizlilik (KVKK) notları
- Plaka ve sakin bilgisi kişisel veridir. Sakinlerin bilgilendirilmesi ve yönetim kurulunun onayı önerilir.
- Herkese açık sorgu ad/telefon göstermez ama “bu plaka bu apartmana ait” bilgisini verir; istemiyorsanız Yönetim’den kapatın.
- Sorgu geçmişi yönetici tarafından silinebilir; saklama süresini yönetim olarak belirleyin.
- Herkese açık sorgunun toplam sınırı (30/dk) küçük bir kaba kuvvet taramasını yavaşlatır, tamamen engellemez.

## Geliştirme
`npm test` (plaka/sorgu mantığı), `npm run build`. Mimari: `src/api.ts` arayüzü; `src/demo.ts` (tarayıcı) ve `src/cloud.ts` (Supabase) iki gerçeklemedir.
