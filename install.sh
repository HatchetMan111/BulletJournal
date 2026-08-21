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
  ${YW}   LXC Container Installer fuer Proxmox VE${CL}
  ${YW}   https://github.com/HatchetMan111/BulletJournal${CL}

EOF
}

msg_info() { echo -ne "  ${YW}● ${1}...${CL}"; }
msg_ok()   { echo -e "  ${CM} ${GN}${1}${CL}"; }
msg_error(){ echo -e "  ${CR} ${RD}${1}${CL}"; }

header_info

echo -e "  ${YW}Dies erstellt einen LXC-Container mit BulletJournal.${CL}\n"
echo -e "  Container-ID:    ${GN}250${CL}"
echo -e "  Container-Name:  ${GN}bulletjournal${CL}"
echo -e "  Port:            ${GN}8000${CL}"
echo -e "  Service:         ${GN}bulletjournal.service${CL}\n"

read -p "  Fortfahren? (j/n) " -n 1 -r
echo
[[ ! $REPLY =~ ^[Jj]$ ]] && echo -e "\n  ${RD}Abgebrochen.${CL}" && exit 0

# ── Check Proxmox ───────────────────────────────────────────────────
if ! command -v pct &>/dev/null; then
  msg_error "Dieses Script muss auf einem Proxmox VE Host ausgefuehrt werden!"
  exit 1
fi

# ── Check if container already exists ───────────────────────────────
if pct status 250 &>/dev/null; then
  msg_error "Container 250 existiert bereits!"
  read -p "  Container 250 loeschen und neu erstellen? (j/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Jj]$ ]]; then
    echo -e "  ${RD}Abgebrochen.${CL}"
    exit 0
  fi
  msg_info "Stoppe Container 250"
  pct stop 250 2>/dev/null || true
  sleep 2
  msg_info "Loesche Container 250"
  pct destroy 250 --purge 2>/dev/null || true
  sleep 2
fi

# ── Create LXC Container ───────────────────────────────────────────
msg_info "Erstelle LXC Container 250"
pct create 250 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname bulletjournal \
  --memory 2048 \
  --cores 2 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp,firewall=1 \
  --ostype debian \
  --unprivileged 1 \
  --onboot 1 \
  --startup order=2 \
  2>/dev/null
msg_ok "Container erstellt"

# ── Start Container ─────────────────────────────────────────────────
msg_info "Starte Container"
pct start 250
sleep 5
msg_ok "Container gestartet"

# ── Install inside container ────────────────────────────────────────
msg_info "Installiere Abhaengigkeiten im Container"
pct exec 250 -- bash -c "
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq curl git python3 python3-pip python3-venv >/dev/null 2>&1
" 2>/dev/null
msg_ok "Abhaengigkeiten installiert"

msg_info "Erstelle Verzeichnisse"
pct exec 250 -- bash -c "
mkdir -p /opt/bulletjournal/data
mkdir -p /opt/bulletjournal/frontend/dist
" 2>/dev/null
msg_ok "Verzeichnisse erstellt"

msg_info "Klone BulletJournal"
pct exec 250 -- bash -c "
git clone https://github.com/HatchetMan111/BulletJournal.git /opt/bulletjournal >/dev/null 2>&1
" 2>/dev/null
msg_ok "BulletJournal geklont"

msg_info "Installiere Python-Pakete"
pct exec 250 -- bash -c "
cd /opt/bulletjournal
pip3 install -q fastapi uvicorn sqlalchemy httpx pydantic 2>/dev/null || \
  python3 -m pip install -q fastapi uvicorn sqlalchemy httpx pydantic 2>/dev/null
" 2>/dev/null
msg_ok "Python-Pakete installiert"

msg_info "Richte Frontend ein"
pct exec 250 -- bash -c "
cat <<'HTMLEOF' > /opt/bulletjournal/frontend/dist/index.html
<!DOCTYPE html>
<html lang=\"de\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>BulletJournal Life-OS</title>
  <link rel=\"icon\" href=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📓</text></svg>\">
  <meta name=\"theme-color\" content=\"#111827\">
  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">
  <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap\" rel=\"stylesheet\">
</head>
<body>
  <div id=\"root\"></div>
  <script type=\"module\" src=\"/main.jsx\"></script>
</body>
</html>
HTMLEOF

cp /opt/bulletjournal/main.jsx /opt/bulletjournal/frontend/dist/main.jsx 2>/dev/null || true
cp /opt/bulletjournal/styles.css /opt/bulletjournal/frontend/dist/styles.css 2>/dev/null || true

cat <<'MANEOF' > /opt/bulletjournal/frontend/dist/manifest.json
{
  \"name\": \"BulletJournal Life-OS\",
  \"short_name\": \"BulletJournal\",
  \"start_url\": \"/\",
  \"display\": \"standalone\",
  \"background_color\": \"#111827\",
  \"theme_color\": \"#111827\"
}
MANEOF
" 2>/dev/null
msg_ok "Frontend eingerichtet"

msg_info "Erstelle Systemd-Service"
pct exec 250 -- bash -c "
cat <<'EOF' > /etc/systemd/system/bulletjournal.service
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
" 2>/dev/null
msg_ok "Service gestartet"

# ── Get Container IP ────────────────────────────────────────────────
msg_info "Ermittle Container-IP"
sleep 3
CT_IP=$(pct exec 250 -- hostname -I 2>/dev/null | awk '{print $1}')

if [ -z "$CT_IP" ]; then
  msg_error "IP-Adresse konnte nicht ermittelt werden"
  echo -e "  ${YW}Manuell pruefen: pct exec 250 -- hostname -I${CL}"
  CT_IP="<DEINE-IP>"
fi

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "  ${CM} ${GN}BulletJournal Life-OS erfolgreich installiert!${CL}"
echo -e "  ${CM} Container-ID: ${YW}250${CL}"
echo -e "  ${CM} Container:    ${YW}bulletjournal${CL}"
echo -e "  ${CM} URL:          ${YW}http://${CT_IP}:8000${CL}"
echo -e "  ${CM} Service:      ${YW}systemctl status bulletjournal${CL}"
echo -e "  ${CM} Logs:         ${YW}journalctl -u bulletjournal -f${CL}"
echo -e "  ${CM} Daten:        ${YW}/opt/bulletjournal/data/${CL}"
echo -e "  ${CM} Export:       ${YW}http://${CT_IP}:8000/api/export${CL}"
echo ""
echo -e "  ${YW}Container-Shell:${CL}"
echo -e "  ${YW}  pct enter 250${CL}"
echo ""
echo -e "  ${YW}Tipp: Ollama fuer KI-Briefing installieren:${CL}"
echo -e "  ${YW}  curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2:3b${CL}"
echo ""
