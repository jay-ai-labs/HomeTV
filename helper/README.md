# HomeTV: your own IPTV player for the whole house

HomeTV plays your IPTV provider's live TV, TV guide, catch-up, movies and series on every
phone, tablet, computer and Fire Stick at home. Favorites and "continue watching" are
shared between devices. It works with Xtream Codes logins (server address, username, password).

HomeTV provides no channels; you need your own provider subscription.

## 1. Start it on one computer at home

The computer needs to stay on while you watch. Any Mac, Windows PC, Linux box or Raspberry Pi works.

1. Install Python 3 if you don't have it:
   - **Mac:** open Terminal and type `python3 --version`. If macOS offers to install developer tools, accept.
   - **Windows:** install from python.org and tick "Add Python to PATH".
2. Unzip this folder somewhere permanent, for example `Documents/hometv`.
3. Start HomeTV:
   - **Mac / Linux:** in Terminal, `cd` into the folder and run `python3 server.py`
   - **Windows:** double-click `start-hometv.bat` (or run `py server.py`). When Windows Firewall asks, allow **Private networks**
   - To start automatically when you sign in to Windows, run `install-autostart.bat` once (`remove-autostart.bat` undoes it)
4. The window shows two addresses. Keep the window open.

```
  On this computer:   http://localhost:8080
  On your other devices (same Wi-Fi):   http://192.168.1.20:8080
```

5. Open the first address and enter your provider's server address, username and password.
   They are saved only in `data/config.json` on this computer.

If your computer asks whether Python may accept incoming network connections, choose **Allow**.

## 2. Open it on your other devices

Use the second address (`http://192.168.x.x:8080`) on any device on your home Wi-Fi.

| Device | How |
| --- | --- |
| iPhone / iPad | Open in Safari, tap Share, then **Add to Home Screen** |
| Android phone / tablet | Open in Chrome, tap ⋮, then **Add to Home screen** |
| Fire TV Stick | Install **Silk Browser** from the Amazon app store, open the address, bookmark it |
| Fire tablet | Open in Silk, then bookmark it |
| Computer | Any browser |
| Apple TV | Not possible yet; Apple TV has no browser. The native app is Phase 2 of the plan |

## Using it

- **Live TV:** pick a group, then a channel. On big screens, the first select previews and the second goes full screen.
- **TV guide:** select a programme now on to watch it. A ⟲ means it can be watched from the start (catch-up).
- **Remote or keyboard:** arrows move, Enter selects, Back/Esc closes. In the player, Up/Down change channel.
- **Settings:** account expiry, devices watching, refresh lists, hide groups you never watch.

## If a channel won't play

- "Too many devices watching": your provider limits how many devices can watch at once. Stop one and retry.
- On one device only: Settings → **Live stream format** → try **MPEG-TS** or **HLS**.
- Use **Open in VLC** on the error screen; VLC plays formats browsers can't.

## Options

- Different port: set `HOMETV_PORT=8090` before starting.
- Your data lives in the `data` folder: `config.json` (login), `userdata.json` (favorites, resume points), `epg.xml` (TV guide cache).
- Don't expose port 8080 to the internet. HomeTV is for your home network only.

Bundled players: hls.js and mpegts.js (Apache 2.0; licenses in `web/lib`).
