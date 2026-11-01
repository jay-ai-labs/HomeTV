# Runbook: running the home helper

## Windows PC
- Start: double-click `helper\start-hometv.bat` (needs Python 3 on PATH). Allow **Private networks** in the firewall prompt.
- Start at sign-in: `helper\install-autostart.bat`; undo with `remove-autostart.bat`. **Re-run it after moving the folder.**
- Stop: close the HomeTV window (or Ctrl+C).
- Port: `set HOMETV_PORT=8090` before starting.

## Synology NAS (Container Manager)
- Project → Create → path `helper`, use `docker-compose.yml` → Build. It restarts automatically.
- Open `http://<NAS IP>:8080`. Data lives in `helper/data` on the NAS.

## Data and backup
- `data\config.json` holds the provider login. `data\userdata.json` holds favorites and resume points. Back up `userdata.json`; never share `config.json`.
- Delete `data\epg.xml` to force a fresh guide download (or Settings → Refresh TV guide).

## Troubleshooting
| Symptom | Check |
| --- | --- |
| Other devices can't open the address | Same Wi-Fi? Firewall allowed Python on Private networks? Use the IP printed in the window |
| "Too many devices watching" | Provider device limit; stop a preview or another device |
| Channel won't start on one device | Settings → Live stream format → try MPEG-TS or HLS; or Open in VLC |
| Guide empty | Settings shows guide state; Refresh TV guide; some providers have no guide for some channels |
| After update, iPhone shows old design | Remove the Home Screen icon and add it again |

## Updating
Stop the helper, replace files in `helper` (keep `data\`), start it again, reload devices.
