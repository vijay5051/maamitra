# MaaMitra — Tester outreach

Google requires **12 testers** to stay in the internal testing track for 14 consecutive days before you can promote to production. Plan to collect 15-18 emails so you have buffer if 1-2 don't install.

**Testers must have Gmail accounts** (the address they use on their Android phone's Play Store). Non-Gmail addresses won't work.

---

## Who to ask (in order of likelihood)

1. Close friends/family with Android phones who are parents or expecting
2. Your spouse / family members — even if not the target audience, they count
3. Mom-group WhatsApp contacts
4. Any mother you've pitched MaaMitra to in conversation
5. 1-2 fellow founders / people building in public who'd give feedback

---

## WhatsApp message (most will come from here)

```
Hey! 👋

I've built an app called MaaMitra — an AI companion for Indian mothers (pregnancy + early parenthood). It's at https://maamitra.co.in if you want a look.

To get it on Google Play, I need 12 testers for 2 weeks on the private pre-release track.

Can I add you? I'll just need the Gmail address you use on your Android phone. No spam, no commitments — install, use it a few times, tell me what sucks.

🙏
```

---

## Email (for less-close contacts or if WhatsApp isn't appropriate)

**Subject:** Quick favor — would you test MaaMitra for 2 weeks?

```
Hi [Name],

I've spent the last few months building MaaMitra — an India-first AI companion for new and expecting mothers. Think: a mitra who knows pregnancy nutrition, vaccine schedules, PMMVY eligibility, and can answer questions at 2 a.m. without the patronising tone of most parenting apps.

It's live at https://maamitra.co.in and I'm now getting it into the Google Play Store. For that, Google requires 12 people to test the private pre-release for 14 days.

If you (or someone in your family with an Android phone) would be up for it, I'd be grateful. I just need:

• The Gmail address you use on your Android phone

You'll get an email from Google with a Play Store link — install it, poke around, and ignore it after. Feedback welcome but not required.

Thank you 🙏
Vijay

—
MaaMitra — https://maamitra.co.in
```

---

## Tracking sheet (paste into your notes app or Google Sheet)

| # | Name | Gmail | Source | Added to Play? | Installed? | Feedback |
|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |
| 6 |  |  |  |  |  |  |
| 7 |  |  |  |  |  |  |
| 8 |  |  |  |  |  |  |
| 9 |  |  |  |  |  |  |
| 10 |  |  |  |  |  |  |
| 11 |  |  |  |  |  |  |
| 12 |  |  |  |  |  |  |
| 13 |  |  |  |  |  |  |
| 14 |  |  |  |  |  |  |
| 15 |  |  |  |  |  |  |

---

## Adding testers in Play Console (once verification clears)

1. Play Console → MaaMitra → **Testing** → **Internal testing** → **Testers** tab
2. Click **Create email list** → name it `MaaMitra core testers`
3. Paste all 12+ Gmail addresses (one per line) → **Save**
4. Under **Releases** tab → **How testers join your test** → copy the **Join URL**
5. Share that URL with each tester + a 1-line instruction:
   ```
   Tap this link on your Android phone, then install from Play Store:
   [paste URL]
   ```
6. Tester taps link → Play Store opens → big green **Install** button → they install MaaMitra.

### What counts for the 14-day requirement

Per Google's 2024 rules:
- Each tester must **open the app at least once** during the 14-day window for their opt-in to count.
- Google tracks "opted-in testers" via the Play Console. You need **12 opted-in** (not just added) for 14 consecutive days.
- If a tester opts out or uninstalls, the counter may reset. This is why we aim for 15-18 adds.

Check daily: Play Console → Testing → Internal testing → **Testers** → see "opted-in testers" count.

---

## After 14 days

Play Console will show a green check on "Closed testing" eligibility. At that point:
1. Promote the build to **Closed testing** (fills the same form again, quicker)
2. Wait for any required additional testing period
3. Promote to **Production** → submit for review → live in ~hours to a few days

This is Google's newer policy to prevent spammy launches — mildly annoying once, then never again.
