#!/usr/bin/env bash
# One-time installation, requires explicit SSH sudo by the server owner.
set -Eeuo pipefail
[[ "${EUID}" -eq 0 && "$#" -eq 1 && -f "$1" ]] || {
 echo 'Usage: sudo bash vps-ops-bootstrap.sh /chemin/cle-ops.pub' >&2; exit 64;
}
key_file="$1"
for cmd in useradd sudo docker ssh-keygen install visudo logger; do
  command -v "$cmd" >/dev/null || { echo "Outil absent: $cmd" >&2; exit 1; }
done
read -r ssh_public_key < "$key_file"
[[ "$ssh_public_key" =~ ^ssh-ed25519[[:space:]][A-Za-z0-9+/=]+([[:space:]].*)?$ ]] || exit 65
ssh-keygen -l -f "$key_file" >/dev/null
source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test -s "$source_dir/vps-ops-entry"
test -s "$source_dir/vps-ops-run"

if ! id vps-ops >/dev/null 2>&1; then
  useradd -m -s /bin/bash vps-ops
fi
user_home="$(getent passwd vps-ops | cut -d: -f6)"
install -d -m 0700 -o vps-ops -g vps-ops "$user_home/.ssh"
printf 'command="/usr/local/sbin/vps-ops-entry",restrict %s\n' "$ssh_public_key" > "$user_home/.ssh/authorized_keys"
chown vps-ops:vps-ops "$user_home/.ssh/authorized_keys"
chmod 0600 "$user_home/.ssh/authorized_keys"
install -m 0755 -o root -g root "$source_dir/vps-ops-entry" /usr/local/sbin/vps-ops-entry
install -m 0755 -o root -g root "$source_dir/vps-ops-run" /usr/local/sbin/vps-ops-run

# Sudo permissions are explicit, not generic root shell.
cat > /etc/sudoers.d/vps-ops <<'SUDOERS'
vps-ops ALL=(root) NOPASSWD: /usr/local/sbin/vps-ops-run status, /usr/local/sbin/vps-ops-run health, /usr/local/sbin/vps-ops-run brain-logs, /usr/local/sbin/vps-ops-run proxy-logs, /usr/local/sbin/vps-ops-run caddy-check, /usr/local/sbin/vps-ops-run caddy-reload, /usr/local/sbin/vps-ops-run brain-restart, /usr/local/sbin/vps-ops-run brain-backup
SUDOERS
chmod 0440 /etc/sudoers.d/vps-ops
visudo -cf /etc/sudoers.d/vps-ops >/dev/null
echo 'VPS OPS INSTALLE : operations limites, compte Brain inchangé.'
