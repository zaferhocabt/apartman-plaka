#!/bin/bash
# Telegram'a bildirim gönderir. Kullanım: scripts/notify-telegram.sh "mesaj"
# Gerekli ortam değişkenleri: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
: "${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN tanımlı değil}"
: "${TELEGRAM_CHAT_ID:?TELEGRAM_CHAT_ID tanımlı değil}"
curl -sS -m 20 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="$TELEGRAM_CHAT_ID" --data-urlencode text="$1"
