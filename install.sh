#!/usr/bin/env bash
# Copyright (c) 2024 BulletJournal
# License: MIT | https://github.com/HatchetMan111/BulletJournal
#
# LXC Container Installer fuer Proxmox VE - im Stil der Community-Scripts.
# Erstellt einen unprivilegierten Debian-12-Container und installiert
# BulletJournal (FastAPI-Backend + Frontend) als systemd-Dienst.

APP="BulletJournal"
var_disk="8"
var_cpu="2"
var_ram="2048"
var_os="debian"
var_version="12"
DEFAULT_CTID="250"

YW='\033[33m'
GN='\033[1;32m'
RD='\033[1;31m'
BL='\033[36m'
CL='\033[m'
CM="${GN}✓${CL}"
CR="${RD}✗${CL}"

set -Eeuo pipefail
shopt -s expand_aliases

function header_info {
  clear
  cat <<"EOF"
    ____        __       _ __   __ ____  __    ___
   / __ )__  __/ /_  ___(_) /_/ _/ __ \/ /   /__ \
  / __  / / / / __ \/ _ `/ __/ // / / / /   / _  /
 / /_/ / /_/ / /_/ /  __/ /_/ // / / / /___/ /  /
/_____/\__,_/_.___/\___/_/\__/___/_/_____/____/

           BULLET JOURNAL - LIFE OS
     LXC Container Installer fuer Proxmox VE
   https://github.com/HatchetMan111/BulletJournal
EOF
}

function msg_info() { echo -ne "${YW}⠿ ${CL}${BL}${1}${CL}"; }
function msg_ok()   { echo -e "${CM} ${GN}${1}${CL}"; }
function msg_error(){ echo -e "${CR} ${RD}${1}${CL}"; }

function error_handler() {
  local exit_code="$?"
  local line_number="$1"
  echo -e "\n${CR} ${RD}Fehler in Zeile ${line_number} (Exit-Code ${exit_code}). Installation abgebrochen.${CL}"
  echo -e "${YW}Zur Analyse: pct enter ${CTID:-$DEFAULT_CTID} && journalctl -u bulletjournal -e${CL}"
  exit "${exit_code}"
}
trap 'error_handler $LINENO' ERR

function die() {
  msg_error "$1"
  exit 1
}

# ── Voraussetzungen pruefen ─────────────────────────────────────────
command -v pct &>/dev/null || die "Dieses Script muss auf einem Proxmox VE Host ausgefuehrt werden!"
command -v pvesm &>/dev/null || die "pvesm nicht gefunden - ist das ein vollstaendiger Proxmox VE Host?"

# ── Template sicherstellen ──────────────────────────────────────────
TEMPLATE="local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst"
TEMPLATE_FILE="/var/lib/vz/template/cache/debian-12-standard_12.7-1_amd64.tar.zst"
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  msg_info "Lade Debian-12-Template herunter"
  pveam update >/dev/null 2>&1 || true
  pveam download local debian-12-standard_12.7-1_amd64.tar.zst >/dev/null 2>&1 \
    || die "Template konnte nicht geladen werden. Bitte manuell: pveam download local debian-12-standard_12.7-1_amd64.tar.zst"
  msg_ok "Template heruntergeladen"
fi

header_info
echo -e "\n${YW}Dies erstellt einen unprivilegierten LXC-Container mit ${APP}.${CL}\n"
echo -e "  ${BL}Standardwerte:${CL}"
echo -e "  ${BL}CPU-Kerne:  ${GN}${var_cpu}${CL}"
echo -e "  ${BL}RAM (MiB):  ${GN}${var_ram}${CL}"
echo -e "  ${BL}Disk (GiB): ${GN}${var_disk}${CL}"
echo -e "  ${BL}Port:       ${GN}8000${CL}\n"

read -rp "Container-ID eingeben [${DEFAULT_CTID}]: " CTID
CTID="${CTID:-$DEFAULT_CTID}"

if ! [[ "$CTID" =~ ^[0-9]+$ ]] || [[ "$CTID" -lt 100 ]]; then
  die "Ungueltige Container-ID: '$CTID' (muss eine Zahl >= 100 sein)"
fi

if pct status "$CTID" &>/dev/null; then
  echo -ne "${YW}Container ${CTID} existiert bereits. Loeschen und neu erstellen? (j/n) ${CL}"
  read -r -n 1 REPLY
  echo
  if [[ ! $REPLY =~ ^[Jj]$ ]]; then
    die "Abgebrochen."
  fi
  msg_info "Stoppe Container ${CTID}"
  pct stop "$CTID" >/dev/null 2>&1 || true
  sleep 2
  msg_ok "Gestoppt"
  msg_info "Loesche Container ${CTID}"
  pct destroy "$CTID" --purge >/dev/null 2>&1 || true
  sleep 2
  msg_ok "Geloescht"
fi

# ── Container erstellen ─────────────────────────────────────────────
msg_info "Erstelle LXC Container ${CTID}"
pct create "$CTID" "$TEMPLATE" \
  --hostname bulletjournal \
  --memory "$var_ram" \
  --cores "$var_cpu" \
  --rootfs "local-lvm:${var_disk}" \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp,firewall=1 \
  --ostype debian \
  --unprivileged 1 \
  --onboot 1 \
  --startup order=2 \
  --features nesting=1 >/dev/null 2>&1
msg_ok "Container erstellt"

msg_info "Starte Container"
pct start "$CTID" >/dev/null 2>&1
msg_ok "Container gestartet"

# ── Auf Netzwerk warten ─────────────────────────────────────────────
msg_info "Warte auf Netzwerk im Container"
NET_OK=""
for _ in $(seq 1 30); do
  if pct exec "$CTID" -- getent hosts github.com >/dev/null 2>&1; then
    NET_OK=1
    break
  fi
  sleep 2
done
[[ -n "$NET_OK" ]] || die "Netzwerk im Container nach 60s nicht bereit (DHCP/DNS pruefen)."
msg_ok "Netzwerk bereit"

# ── Grundpakete installieren ────────────────────────────────────────
msg_info "Installiere Grundpakete (curl, git, python3, venv)"
pct exec "$CTID" -- bash <<'BJ_SETUP'
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates python3 python3-venv python3-pip >/dev/null
BJ_SETUP
msg_ok "Grundpakete installiert"

# ── BulletJournal klonen (VOR dem Anlegen von Unterverzeichnissen!) ─
msg_info "Klone BulletJournal aus GitHub"
pct exec "$CTID" -- bash <<'BJ_SETUP'
rm -rf /opt/bulletjournal
git clone --depth 1 https://github.com/HatchetMan111/BulletJournal.git /opt/bulletjournal
rm -rf /opt/bulletjournal/.git
mkdir -p /opt/bulletjournal/data /opt/bulletjournal/frontend/dist
BJ_SETUP
msg_ok "BulletJournal geklont"

# ── Python-Pakete in venv installieren (Debian 12: kein System-Pip) ─
msg_info "Installiere Python-Pakete in venv (FastAPI, Uvicorn, SQLAlchemy, httpx, pydantic)"
pct exec "$CTID" -- bash <<'BJ_SETUP'
python3 -m venv /opt/bulletjournal/venv
/opt/bulletjournal/venv/bin/pip install --quiet --upgrade pip
/opt/bulletjournal/venv/bin/pip install --quiet fastapi uvicorn sqlalchemy httpx pydantic
BJ_SETUP
msg_ok "Python-Pakete installiert"

# ── Frontend-Dateien ablegen ────────────────────────────────────────
msg_info "Richte Frontend ein"
pct exec "$CTID" -- bash <<'BJ_SETUP'
cp /opt/bulletjournal/main.jsx /opt/bulletjournal/frontend/dist/main.jsx
cp /opt/bulletjournal/styles.css /opt/bulletjournal/frontend/dist/styles.css

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
BJ_SETUP
msg_ok "Frontend eingerichtet"

# ── systemd-Dienst einrichten ───────────────────────────────────────
msg_info "Erstelle systemd-Dienst (bulletjournal.service)"
pct exec "$CTID" -- bash <<'BJ_SETUP'
cat <<'SVCEOF' > /etc/systemd/system/bulletjournal.service
[Unit]
Description=BulletJournal Life-OS
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bulletjournal
ExecStart=/opt/bulletjournal/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1
Environment=BULLETJOURNAL_DATA_DIR=/opt/bulletjournal/data

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now bulletjournal >/dev/null 2>&1
BJ_SETUP
msg_ok "Dienst aktiviert"

# ── Installation verifizieren ───────────────────────────────────────
msg_info "Verifiziere Installation"
SVC_OK=""
for _ in $(seq 1 15); do
  if pct exec "$CTID" -- systemctl is-active --quiet bulletjournal 2>/dev/null; then
    SVC_OK=1
    break
  fi
  sleep 2
done
if [[ -z "$SVC_OK" ]]; then
  pct exec "$CTID" -- journalctl -u bulletjournal -n 20 --no-pager || true
  die "bulletjournal.service laeuft nicht - Logs siehe oben."
fi
pct exec "$CTID" -- curl -fsS http://localhost:8000/api/health >/dev/null \
  || die "API antwortet nicht auf http://localhost:8000/api/health"
msg_ok "Installation verifiziert"

# ── IP ermitteln ────────────────────────────────────────────────────
msg_info "Ermittle Container-IP"
CT_IP=""
for _ in $(seq 1 10); do
  CT_IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')
  [[ -n "$CT_IP" ]] && break
  sleep 2
done
[[ -n "$CT_IP" ]] || CT_IP="<DEINE-IP>"
msg_ok "IP: ${CT_IP}"

# ── Zusammenfassung ─────────────────────────────────────────────────
echo ""
echo -e "  ${CM} ${GN}${APP} Life-OS erfolgreich installiert!${CL}"
echo -e "  ${CM} Container-ID: ${YW}${CTID}${CL}"
echo -e "  ${CM} URL:          ${YW}http://${CT_IP}:8000${CL}"
echo -e "  ${CM} Service:      ${YW}systemctl status bulletjournal${CL}"
echo -e "  ${CM} Logs:         ${YW}journalctl -u bulletjournal -f${CL}"
echo -e "  ${CM} Daten:        ${YW}/opt/bulletjournal/data/${CL}"
echo -e "  ${CM} Export:       ${YW}http://${CT_IP}:8000/api/export${CL}"
echo ""
echo -e "  ${YW}Container-Shell:${CL}"
echo -e "  ${YW}  pct enter ${CTID}${CL}"
echo ""
echo -e "  ${YW}Tipp: Ollama fuer KI-Briefing installieren:${CL}"
echo -e "  ${YW}  pct exec ${CTID} -- bash -c \"curl -fsSL https://ollama.com/install.sh | sh && ollama pull llama3.2:3b\"${CL}"
echo ""
