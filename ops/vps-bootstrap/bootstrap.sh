#!/usr/bin/env bash
# Once-off bootstrap as root on the VPS. Usage: sudo ./server/bootstrap.sh /root/brain-deploy.pub
set -Eeuo pipefail
[[ "${EUID}" -eq 0 ]] || { echo 'Lancer avec sudo.' >&2; exit 1; }
PUBKEY_FILE="${1:-}"
[[ "$#" -eq 1 && -f "$PUBKEY_FILE" ]] || { echo 'Usage: sudo bash server/bootstrap.sh /chemin/cle.pub' >&2; exit 64; }
for cmd in docker git curl sudo ssh-keygen visudo flock python3 useradd chown install systemctl; do
  command -v "$cmd" >/dev/null || { echo "Prérequis manquant: $cmd" >&2; exit 1; }
done
docker compose version >/dev/null || { echo 'Docker Compose v2 est requis.' >&2; exit 1; }
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
read -r key < "$PUBKEY_FILE"
[[ "$key" =~ ^ssh-ed25519[[:space:]][A-Za-z0-9+/=]+([[:space:]].*)?$ ]] || { echo 'Clé publique ed25519 invalide.' >&2; exit 1; }
ssh-keygen -l -f "$PUBKEY_FILE" >/dev/null || { echo 'Clé SSH invalide.' >&2; exit 1; }

if ! id brain-deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash brain-deploy
fi
home_dir="$(getent passwd brain-deploy | cut -d: -f6)"
install -d -m 0700 -o brain-deploy -g brain-deploy "$home_dir/.ssh"
printf 'command="/usr/local/sbin/vps-auto-entry",restrict %s\n' "$key" > "$home_dir/.ssh/authorized_keys"
chown brain-deploy:brain-deploy "$home_dir/.ssh/authorized_keys"
chmod 0600 "$home_dir/.ssh/authorized_keys"

install -d -m 0755 /etc/vps-auto /etc/brain /opt/brain /var/lib/brain
install -d -m 0700 /var/lib/brain/data
chown 10001:10001 /var/lib/brain/data
install -m 0755 -o root -g root "$source_dir/vps-auto-entry" /usr/local/sbin/vps-auto-entry
install -m 0755 -o root -g root "$source_dir/vps-auto-deploy-brain" /usr/local/sbin/vps-auto-deploy-brain
install -m 0755 -o root -g root "$source_dir/backup-brain" /usr/local/sbin/vps-auto-backup-brain
install -m 0644 -o root -g root "$source_dir/brain.compose.yml" /etc/vps-auto/brain.compose.yml
if [[ ! -f /etc/brain/.env ]]; then
  cat > /etc/brain/.env <<'ENV'
BRAIN_PASSWORD=REPLACE_ME_WITH_UNIQUE_LONG_PASSWORD
BRAIN_SIGNING_KEY=REPLACE_ME_WITH_RANDOM_64_CHARACTER_SECRET
BRAIN_ALLOWED_ORIGINS=https://rambouraxel-del.github.io
ENV
  chmod 0600 /etc/brain/.env
fi
printf 'brain-deploy ALL=(root) NOPASSWD: /usr/local/sbin/vps-auto-deploy-brain *\n' > /etc/sudoers.d/vps-auto-brain
chmod 0440 /etc/sudoers.d/vps-auto-brain
visudo -cf /etc/sudoers.d/vps-auto-brain >/dev/null

install -m 0644 "$source_dir/brain-backup.service" /etc/systemd/system/brain-backup.service
install -m 0644 "$source_dir/brain-backup.timer" /etc/systemd/system/brain-backup.timer
systemctl daemon-reload
systemctl enable --now brain-backup.timer >/dev/null
printf '\nBootstrap terminé, sans toucher aux autres conteneurs.\n'
printf 'PROCHAINES ÉTAPES :\n  1. sudo nano /etc/brain/.env (créer des secrets uniques)\n  2. Configurer le DNS et ajouter le bloc Caddy SANS écraser Polar Rift.\n  3. Définir VPS_HOST / VPS_DEPLOY_SSH_KEY / VPS_SSH_KNOWN_HOSTS dans GitHub Brain.\n  4. Activer BRAIN_VPS_DEPLOY_ENABLED=true dans les variables GitHub Brain.\n'
