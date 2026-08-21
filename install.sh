#!/usr/bin/env bash
# Copyright (c) 2024 BulletJournal
# License: MIT | https://github.com/HatchetMan111/BulletJournal

YW=$(echo '\033[33m')
GN=$(echo '\033[1;32m')
RD=$(echo '\033[1;31m')
CL=$(echo '\033[m')
CM="${GN}✓${CL}"
CR="${RD}✗${CL}"

set -e
trap 'echo -e "\n${CR} Install abgebrochen.${CL}"; exit 1' ERR

header_info() {
  clear
  cat <<EOF

  ${GN}==============================================${CL}
  ${GN}     BULLET JOURNAL - LIFE OS${CL}
  ${GN}==============================================${CL}
  ${YW}   Dein persoenliches Journaling-System${CL}
  ${YW}   https://github.com/HatchetMan111/BulletJournal${CL}

EOF
}

msg_info() { echo -ne "  ${YW}● ${1}...${CL}"; }
msg_ok()   { echo -e "  ${CM} ${GN}${1}${CL}"; }
msg_error(){ echo -e "  ${CR} ${RD}${1}${CL}"; }

header_info

echo -e "  ${YW}Dies installiert BulletJournal auf deinem System.${CL}\n"
echo -e "  Installationsverzeichnis: ${GN}/opt/bulletjournal${CL}"
echo -e "  Port:                     ${GN}8000${CL}"
echo -e "  Service:                  ${GN}bulletjournal.service${CL}\n"

read -p "  Fortfahren? (j/n) " -n 1 -r
echo
[[ ! $REPLY =~ ^[Jj]$ ]] && echo -e "\n  ${RD}Abgebrochen.${CL}" && exit 0

# ── Dependencies ─────────────────────────────────────────────────────
msg_info "System wird aktualisiert"
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq curl git python3 python3-pip python3-venv >/dev/null 2>&1
msg_ok "System aktualisiert"

# ── Create directories ──────────────────────────────────────────────
msg_info "Verzeichnisse werden erstellt"
mkdir -p /opt/bulletjournal/data
mkdir -p /opt/bulletjournal/frontend/dist
msg_ok "Verzeichnisse erstellt"

# ── Clone ───────────────────────────────────────────────────────────
msg_info "BulletJournal wird heruntergeladen"
if [ -d "/opt/bulletjournal/.git" ]; then
  cd /opt/bulletjournal && git pull >/dev/null 2>&1
else
  rm -rf /opt/bulletjournal
  git clone https://github.com/HatchetMan111/BulletJournal.git /opt/bulletjournal >/dev/null 2>&1
fi
msg_ok "BulletJournal heruntergeladen"

# ── Python deps ─────────────────────────────────────────────────────
msg_info "Python-Pakete werden installiert"
cd /opt/bulletjournal
pip3 install -q fastapi uvicorn sqlalchemy httpx pydantic 2>/dev/null || \
  python3 -m pip install -q fastapi uvicorn sqlalchemy httpx pydantic 2>/dev/null
msg_ok "Python-Pakete installiert"

# ── Frontend ────────────────────────────────────────────────────────
msg_info "Frontend wird vorbereitet"
cat <<'HTMLEOF' > /opt/bulletjournal/frontend/dist/index.html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BulletJournal Life-OS</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📓</text></svg>">
  <meta name="theme-color" content="#111827">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/main.jsx"></script>
</body>
</html>
HTMLEOF

cp /opt/bulletjournal/main.jsx /opt/bulletjournal/frontend/dist/main.jsx 2>/dev/null || true
cp /opt/bulletjournal/styles.css /opt/bulletjournal/frontend/dist/styles.css 2>/dev/null || true

cat <<'MANEOF' > /opt/bulletjournal/frontend/dist/manifest.json
{
  "name": "BulletJournal Life-OS",
  "short_name": "BulletJournal",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#111827",
  "theme_color": "#111827"
}
MANEOF
msg_ok "Frontend vorbereitet"

# ── Systemd service ─────────────────────────────────────────────────
msg_info "Systemd-Service wird erstellt"
cat <<EOF > /etc/systemd/system/bulletjournal.service
[Unit]
Description=BulletJournal Life-OS
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bulletjournal
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now bulletjournal >/dev/null 2>&1
msg_ok "Service gestartet"

# ── Done ────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "  ${CM} ${GN}BulletJournal Life-OS erfolgreich installiert!${CL}"
echo -e "  ${CM} URL:       ${YW}http://${IP}:8000${CL}"
echo -e "  ${CM} Service:   ${YW}systemctl status bulletjournal${CL}"
echo -e "  ${CM} Logs:      ${YW}journalctl -u bulletjournal -f${CL}"
echo -e "  ${CM} Daten:     ${YW}/opt/bulletjournal/data/${CL}"
echo -e "  ${CM} Export:    ${YW}http://${IP}:8000/api/export${CL}"
echo ""
echo -e "  ${YW}Tipp: Ollama für KI-Briefing installieren:${CL}"
echo -e "  ${YW}  curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2:3b${CL}"
echo ""
