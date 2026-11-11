# Bildirim

Kullanıcı bir işi bitirdiğimde Telegram'dan haber verilmesini istiyor.
Her görev bittiğinde (başarılı ya da başarısız) kısa bir özetle şunu çalıştır:

    scripts/notify-telegram.sh "Görev bitti: <kısa özet>"

Script `TELEGRAM_BOT_TOKEN` ve `TELEGRAM_CHAT_ID` ortam değişkenlerini kullanır.
Token'ı asla repoya, commit'e veya çıktıya yazma. Değişkenler tanımlı değilse
kullanıcıya bildir. Ortamın ağ izin listesinde `api.telegram.org` olmalı.
