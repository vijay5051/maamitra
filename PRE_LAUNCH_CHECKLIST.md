# Pre-launch checklist

Pending changes that need a fresh **EAS production AAB build + Play
Console upload** before they reach Android users. Each item below is
already on `main` (web is live with these fixes); they're waiting for
the next AAB to ship.

> **Why a list and not just rolling AABs:** OTA delivery is currently
> blocked at the EAS server (`sdkVersion … is not supported`). Until
> Expo support unblocks our account, native code reaches users only
> via fresh AABs. Batching reduces Play review cycles.
>
> **How this file is used:** every time a change lands that requires
> an AAB to reach Android, append it here with the commit hash + a
> one-line description of what the user will see. When we cut the
> next AAB, clear the list.

---

## Pending for next AAB

| # | Commit | What changes for the user |
|---|---|---|
| 1 | `42cc988` | **Chat image upload works on Android** — tap the photo button to attach an image from the gallery to a chat message. Used to show "Image upload is available on the web app" and do nothing. |
| 2 | `22b844f` | **Date picker now reaches next year** — expecting parents can pick a 2027 due date on the kid date field. Default year list was capped at the current year (2026), making future due dates impossible. Now allows today's year + 1 unless the caller explicitly clamps with `maxDate`. |
