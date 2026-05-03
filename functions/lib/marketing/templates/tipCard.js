"use strict";
// Tip Card — solid bg + numbered list. Best for "Tip Tuesday" style posts
// that need legibility above all. No background photo needed.
//
// Layout (1080×1080 square):
//   ┌─────────────────────────────┐
//   │ EYEBROW (small, accent)     │
//   │                             │
//   │ Title                       │  ← big, ~3-7 words
//   │ (multi-line)                │
//   │                             │
//   │  1. First tip line          │
//   │  2. Second tip line         │
//   │  3. Third tip line          │
//   │                             │
//   │                  [logo]     │
//   └─────────────────────────────┘
Object.defineProperty(exports, "__esModule", { value: true });
exports.tipCard = tipCard;
const h_1 = require("./h");
function tipCard(props, brand) {
    const accent = props.accent ?? brand.palette.accent;
    const tips = props.tips.slice(0, 4);
    return (0, h_1.h)('div', {
        style: {
            width: '1080px',
            height: '1080px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: brand.palette.background,
            padding: '80px 72px',
            fontFamily: 'Inter, "Noto Sans Devanagari"',
        },
    }, 
    // Eyebrow
    (0, h_1.h)('div', {
        style: {
            fontSize: '28px',
            fontWeight: 700,
            color: brand.palette.primary,
            letterSpacing: '6px',
            textTransform: 'uppercase',
            marginBottom: '24px',
        },
    }, props.eyebrow), 
    // Title
    (0, h_1.h)('div', {
        style: {
            fontSize: '88px',
            fontWeight: 700,
            color: brand.palette.text,
            lineHeight: 1.05,
            marginBottom: '64px',
            letterSpacing: '-2px',
        },
    }, props.title), 
    // Tip rows
    (0, h_1.h)('div', {
        style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
        },
    }, ...tips.map((text, i) => (0, h_1.h)('div', {
        style: {
            display: 'flex',
            alignItems: 'flex-start',
            marginBottom: '32px',
        },
    }, (0, h_1.h)('div', {
        style: {
            width: '60px',
            height: '60px',
            borderRadius: '30px',
            backgroundColor: accent,
            color: brand.palette.primary,
            fontSize: '32px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '28px',
            flexShrink: 0,
        },
    }, String(i + 1)), (0, h_1.h)('div', {
        style: {
            fontSize: '36px',
            lineHeight: 1.35,
            color: brand.palette.text,
            fontWeight: 500,
            paddingTop: '8px',
        },
    }, text)))), 
    // Logo / brand name footer
    footer(brand));
}
function footer(brand) {
    return (0, h_1.h)('div', {
        style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginTop: 'auto',
        },
    }, brand.logoUrl
        ? (0, h_1.h)('img', {
            src: brand.logoUrl,
            width: 64,
            height: 64,
            style: { borderRadius: '12px' },
        })
        : (0, h_1.h)('div', {
            style: {
                fontSize: '24px',
                fontWeight: 700,
                color: brand.palette.primary,
                letterSpacing: '2px',
                textTransform: 'uppercase',
            },
        }, brand.brandName));
}
