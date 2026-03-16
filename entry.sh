#!/bin/sh

PROXY_URL=""
if [ ! -z "$SHM_URL" ]; then
    PROXY_URL="$SHM_URL"
elif [ ! -z "$SHM_HOST" ]; then
    PROXY_URL="$SHM_HOST"
fi

if [ ! -z "$PROXY_URL" ]; then
    sed -i "s|#SHM_URL|$PROXY_URL|" /etc/nginx/conf.d/default.conf
fi

if [ ! -z "$SHM_BASE_PATH" ] && [ "$SHM_BASE_PATH" != "/" ]; then
    sed -i "s|#BASE_LOCATION|location $SHM_BASE_PATH/ {\n        alias /app/;\n        try_files \$uri \$uri/ /index.html;\n    }|" /etc/nginx/conf.d/default.conf
    sed -i "s|href=\"/\"|href=\"${SHM_BASE_PATH}/\"|" /app/index.html
    sed -i "s|#proxy_cookie_path;|proxy_cookie_path / $SHM_BASE_PATH;|" /etc/nginx/conf.d/default.conf
fi

cat > "/app/config.js" << EOF
window.__APP_CONFIG__ = {
  APP_NAME: "${APP_NAME:-SHM Client}",
  TELEGRAM_BOT_NAME: "${TELEGRAM_BOT_NAME:-}",
  TELEGRAM_BOT_AUTH_ENABLE: "${TELEGRAM_BOT_AUTH_ENABLE:-false}",
  TELEGRAM_WEBAPP_AUTH_ENABLE: "${TELEGRAM_WEBAPP_AUTH_ENABLE:-false}",
  TELEGRAM_WEBAPP_AUTO_AUTH_ENABLE: "${TELEGRAM_WEBAPP_AUTO_AUTH_ENABLE:-false}",
  TELEGRAM_WEBAPP_PROFILE: "${TELEGRAM_WEBAPP_PROFILE:-}",
  SUPPORT_LINK: "${SUPPORT_LINK:-}",
  SHM_BASE_PATH: "${SHM_BASE_PATH:-/}",
  OTP_ENABLE: "${OTP_ENABLE:-true}",
  PASSKEY_ENABLE: "${PASSKEY_ENABLE:-true}",
  PASSKEY_AUTH_DISABLED: "${PASSKEY_AUTH_DISABLED:-false}",
  BITRIX_WIDGET_SCRIPT_URL: "${BITRIX_WIDGET_SCRIPT_URL:-}",
  PROXY_CATEGORY: "${PROXY_CATEGORY:-}",
  PROXY_CATEGORY_TITLE: "${PROXY_CATEGORY_TITLE:-}",
  PROXY_STORAGE_PREFIX: "${PROXY_STORAGE_PREFIX:-}",
  VPN_CATEGORY: "${VPN_CATEGORY:-}",
  VPN_CATEGORY_TITLE: "${VPN_CATEGORY_TITLE:-}",
  VPN_STORAGE_PREFIX: "${VPN_STORAGE_PREFIX:-}",
  VISIBLE_CATEGORIES: "${VISIBLE_CATEGORIES:-}",
  EMAIL_REQUIRED: "${EMAIL_REQUIRED:-false}",
  EMAIL_VERIFY_REQUIRED: "${EMAIL_VERIFY_REQUIRED:-false}",
  ALLOW_SERVICE_BLOCKED: "${ALLOW_SERVICE_BLOCKED:-true}",
  ALLOW_SERVICE_DELETE: "${ALLOW_SERVICE_DELETE:-true}",
  ALLOW_SERVICE_CHANGE: "${ALLOW_SERVICE_CHANGE:-true}",
  ALLOW_SERVICE_CHANGE_FORCE: "${ALLOW_SERVICE_CHANGE_FORCE:-false}",
  ALLOW_TELEGRAM_PIN: "${ALLOW_TELEGRAM_PIN:-true}"
};
EOF

nginx -g "daemon off;"
