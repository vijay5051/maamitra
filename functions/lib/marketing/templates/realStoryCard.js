"use strict";
// Inspired Story Card — UGC-driven post (M6).
//
// Layout (1080×1080):
//   ┌─────────────────────────────┐
//   │                             │
//   │   submitter's photo (60%)   │  ← cover-fit
//   │                             │
//   │  ── soft fade ──            │
//   ├─────────────────────────────┤
//   │ INSPIRED STORY · {eyebrow}  │  ← small caps eyebrow
//   │                             │
//   │ "Story body in big quoted   │  ← serif-ish, italic-ish via weight
//   │  type, ~3 lines max."       │
//   │                             │
//   │  — {attribution}    [logo]  │
//   └─────────────────────────────┘
//
// Falls back to a solid brand-colour upper panel when no photoUrl.
Object.defineProperty(exports, "__esModule", { value: true });
exports.realStoryCard = realStoryCard;
const h_1 = require("./h");
function realStoryCard(props, brand) {
    const story = String(props.story ?? '').trim();
    const storyLen = story.length;
    const quoteFontSize = storyLen > 210 ? 29 : storyLen > 165 ? 32 : 35;
    const quoteLineHeight = storyLen > 210 ? 1.25 : 1.28;
    const photoH = 520;
    const panelH = 1080 - photoH;
    return (0, h_1.h)('div', {
        style: {
            width: '1080px',
            height: '1080px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: brand.palette.background,
            fontFamily: 'Inter, "Noto Sans Devanagari"',
        },
    }, 
    // ── Photo panel (or solid brand fallback) ────────────────────────────────
    (0, h_1.h)('div', {
        style: {
            width: '1080px',
            height: `${photoH}px`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            padding: '40px',
            backgroundColor: brand.palette.primary,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
            position: 'relative',
            ...(props.photoUrl ? { backgroundImage: `url(${props.photoUrl})` } : {}),
        },
    }, 
    // Subtle gradient shade at the bottom to blend into the panel.
    (0, h_1.h)('div', {
        style: {
            position: 'absolute',
            left: '0',
            right: '0',
            bottom: '0',
            height: '160px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)',
        },
    })), 
    // ── Story panel ──────────────────────────────────────────────────────────
    (0, h_1.h)('div', {
        style: {
            width: '1080px',
            height: `${panelH}px`,
            display: 'flex',
            flexDirection: 'column',
            padding: '48px 72px 44px 72px',
            backgroundColor: brand.palette.background,
            flex: 1,
        },
    }, 
    // Eyebrow
    (0, h_1.h)('div', {
        style: {
            fontSize: '20px',
            fontWeight: 700,
            color: brand.palette.primary,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: '20px',
        },
    }, `Inspired Story · ${props.eyebrow}`), 
    // Quote
    (0, h_1.h)('div', {
        style: {
            fontSize: `${quoteFontSize}px`,
            fontWeight: 400,
            color: brand.palette.text,
            lineHeight: quoteLineHeight,
            letterSpacing: '0px',
            flex: 1,
            overflow: 'hidden',
        },
    }, `"${story}"`), 
    // Footer — attribution + logo
    (0, h_1.h)('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '24px',
            minHeight: '60px',
        },
    }, (0, h_1.h)('div', {
        style: {
            fontSize: '24px',
            fontWeight: 700,
            color: brand.palette.text,
            letterSpacing: '0.4px',
        },
    }, `— ${props.attribution}`), brand.logoUrl
        ? (0, h_1.h)('img', {
            src: brand.logoUrl,
            width: 56,
            height: 56,
            style: { borderRadius: '12px' },
        })
        : (0, h_1.h)('div', {
            style: {
                fontSize: '20px',
                fontWeight: 700,
                color: brand.palette.primary,
                letterSpacing: '2px',
                textTransform: 'uppercase',
            },
        }, brand.brandName))));
}
