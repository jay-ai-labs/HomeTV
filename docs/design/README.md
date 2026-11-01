# HomeTV design

HomeTV uses the **household app's design system**: the same fonts, colours, shapes and components as
[Ghar Ledger](https://claude.ai/artifact/Wjqnp9enX3cSCpKMSD4MdG), in a dark theme. The background is neutral graphite instead of the household app's green-black ([ADR-0009](../decisions/0009-neutral-graphite-background.md)). It is built for
iPhone and iPad first and also works on desktop and TV with a remote or keyboard.
The live, clickable version is the [cloud prototype](https://claude.ai/artifact/GyjvUcnXkD8NqXS8JD7S3i)
(sample data); its files are in `prototype\` next to this README. The production code is `helper\web\`.

| File | What it is |
| --- | --- |
| `tokens.json` | Colours, fonts, radii, shadows, components, layouts, motion and touch rules. Use it for the native Apple and Android apps too |
| `screenshots\` | Every screen on iPhone (portrait and landscape), iPad (portrait and landscape), desktop and TV |
| `prototype\` | The cloud prototype's files (sample data, fonts inlined, sample art in `art\`). Open `index.html` in a browser |
| `tools\gen-art.js` (repo tools folder) | Draws the sample posters and channel logos in `prototype\art\` |

## From the household system

- **Colours:** the household app's accents on neutral graphite: ground `#0F1013`, surfaces `#1A1C20` / `#24272C` / `#2E3238`.
  Teal `#45AD96` is the primary accent, used sparingly: primary buttons, the active tab, selected chips, progress bars, the guide's now line.
  Selected rows and the current programme are grey with a teal edge, not teal-tinted.
  Saffron `#DE8C46` is the second accent; HomeTV uses it for catch-up. Coral `#E4685E` marks live and errors.
- **Type:** Figtree for the interface, with headings at weight 600. Archivo for numbers and big titles:
  channel numbers, times, time left, ratings, the clock, hero and detail titles.
  Small labels use the household app's uppercase eyebrow style.
- **Shapes:** 13 px buttons and cards, 12 px controls, pill chips, 22 px dialogs, soft dark shadows.
- **Components:** the household app's button, chip, tab bar, bottom sheet and toast, applied as they are.

## What HomeTV adds

The household app is a single-column phone app. HomeTV extends the same system for a video app:

- **Artwork:** posters and blurred artwork behind the hero and detail pages. The interface around them stays flat.
- **Side rail:** for iPad, desktop and TV, styled like the tab bar (same surface, same teal active state).
- **TV focus:** a teal ring and tint for remote control and keyboard navigation.
- **Extra surface:** a `surface3` hover step.

## Screens

| Screen | What's on it |
| --- | --- |
| Home | Featured hero (rotates through 5 titles), On now in your favorites, Continue watching, Recently watched channels, first movie and series categories |
| Live TV | Groups (list or chips), channel rows with logo, now playing, progress, time left, catch-up and favorite icons; preview with now, later and favorite. Tap once to preview, again for full screen. On iPhone a tap goes straight to full screen |
| Guide | Info panel above the grid for the programme in focus (hidden on iPhone); now line with time label; catch-up programmes marked in saffron |
| Movies / Series | Browse (hero + rows per category, loaded as you scroll) or one category as a grid via chips |
| Detail page | Full-screen, blurred artwork background, title, year, runtime, genre, rating, plot, cast. Movies: Resume / Start over / Favorite. Series: Resume or Play S1 E1, season chips, episode cards with progress |
| Player | Top overlay: channel number and name, programme, progress, next; channel up/down, favorite, close |
| Search | One box for channels, movies and series |
| Settings | Provider and account, other devices, stream format, hide groups |

## Provider login (F-036)

The household's provider is a MAC (Stalker) portal, so the first screen supports both kinds of login.
Screenshots: `screenshots\*-setup-*.jpg` and `ipad-landscape-settings-mac-portal.jpg`.

| Element | Design |
| --- | --- |
| Login type | Segmented control at the top: **Username and password** and **MAC portal**, with icons. The selected option is teal, like a selected chip. Arrow keys switch it. Opens on the type in use (MAC portal for this household) |
| Hint line | One sentence under the control naming what the provider gave you: "Also called Xtream Codes..." or "Also called a Stalker or MAG portal... the same ones you entered in iSTB" |
| Portal URL | URL keyboard; placeholder `http://portal.example.com:8080/c/`; help "Copy it exactly as your provider sent it. It often ends in /c/." `http://` is added if missing |
| MAC address | Monospace, upper case, formats itself as you type (`001a79...` becomes `00:1A:79:...`; dashes accepted), max 17 characters, placeholder `00:1A:79:00:00:00`. Help: "The MAC address your provider registered for you. It doesn't need to match this phone or computer." |
| Errors | Inline under the field, in coral, with a coral ring on the field: missing or short MAC, bad URL. These checks run before any network call. Errors from the portal (for example "The portal didn't accept this MAC address") appear above the buttons |
| One-device notice | A notice box (info icon in warn yellow on surface2) on the MAC form and in Settings: "One device at a time. Most portals allow one active session per MAC address..." |
| Advanced | Collapsed. Serial number, Device ID 1 and 2, Signature (monospace) and Time zone, with "Leave these empty unless your provider asks for them" |
| Switching type | When a configured household switches type, a notice says favorites and Continue watching are kept but may not match |
| Settings, Your provider | Login type "MAC portal", Portal (host only), MAC address shown only as `…:A1:B2` in monospace, Account, Expires ("Not reported" if the portal doesn't say). "Watching now" appears only for providers that report it (Xtream) |
| iPhone | The form fills the screen (no card), safe areas respected, Connect and Cancel share the bottom row. The segmented options stack icon above label |

The MAC address is a credential: it's sent to the helper once and is never shown again in full, put in a URL, or stored on a device.

## Layouts

| Width | Devices | Navigation | Live TV |
| --- | --- | --- | --- |
| ≤ 700 px | iPhone portrait | Top bar (Search, Settings) + bottom tab bar | One column, group chips |
| 701–1180 px | iPad portrait/landscape, iPhone landscape | Side rail | Channel list + preview |
| > 1180 px | iPad Pro landscape, desktop, TV | Side rail | Groups + channel list + preview |

Safe areas (notch, home bar, rounded corners) are respected in every layout, including Add to Home Screen mode.
On iPhone, dialogs open as bottom sheets.

## Interaction rules

- **Touch:** targets at least 44 px, no hover-only controls, a short press-down effect. Inputs are at least 16 px so iOS doesn't zoom.
- **Remote and keyboard:** arrow keys move focus spatially; Back or Escape closes the top layer.
- **Motion:** only the hero rotates on its own (every 9 s, paused while you're in it), and it stops with Reduce Motion. Sheets rise with the household app's curve.
- **Copy:** sentence case, plain verbs ("Resume from 51:40", "Watch from the start"). Empty states say what to do next.

## Notes for the native apps (Phases 2 and 3)

- Use the same tokens: in SwiftUI as a `Color`/`Font` extension, in Compose as a `MaterialTheme` override.
  Bundle Figtree and Archivo (both SIL Open Font License).
- tvOS/Android TV: keep the side rail and the three-column Live TV; map the teal focus ring to the platform focus engine.
- The household app also has a light theme. HomeTV uses only the dark theme, because people watch TV in dark rooms.
