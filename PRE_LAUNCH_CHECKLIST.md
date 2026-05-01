# Pre-launch checklist

Pending changes that need a fresh **EAS production AAB build + Play
Console upload** before they reach Android users. Each item below is
already on `main` (web is live with these fixes); they're waiting
for the next AAB.

> **What needs an AAB vs what doesn't:** anything that touches a
> native module or `app.json` plugins (e.g. adding `expo-audio`,
> `expo-image-picker`, manifest perms, or the AD_ID plugin) needs a
> fresh AAB. Pure JS / styling changes ship via `npm run update`
> (OTA) and reach phones in seconds.
>
> **How this file is used:** every time a change lands that requires
> an AAB to reach Android, append it here with the commit hash + a
> one-line description of what the user will see. When we cut the
> next AAB, clear the list.

---

## Pending for next AAB

| # | Commit | What changes for the user |
|---|---|---|
| 1 | `6a10cbb` | **Voice playback in chat (Google Cloud TTS Neural2)** — every MaaMitra reply gets a Listen button that speaks the answer in the user's preferred Indian language. Hindi + Indian English use Neural2 (most natural female voices); Bengali, Tamil, Telugu, Marathi, Malayalam, Kannada, Gujarati, Punjabi, Urdu use Standard voices. Web works as soon as it deploys; Android needs this AAB because we added `expo-audio` for MP3 playback (native module). |
