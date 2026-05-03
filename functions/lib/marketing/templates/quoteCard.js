"use strict";
// Quote Card — pull quote on a soft photo/gradient bg. Best for "Sunday
// Reflection" or "Mom-Wisdom Monday" themes.
//
// Layout: full-bleed background, dark overlay for legibility, big serif-feel
// quote centred, attribution below.
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteCard = quoteCard;
const h_1 = require("./h");
function quoteCard(props, brand) {
    const children = [];
    // Background layer (image OR gradient).
    if (props.backgroundUrl) {
        children.push((0, h_1.h)('img', {
            src: props.backgroundUrl,
            width: 1080,
            height: 1080,
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '1080px',
                height: '1080px',
                objectFit: 'cover',
            },
        }));
    }
    // Dark overlay for legibility.
    children.push((0, h_1.h)('div', {
        style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '1080px',
            backgroundColor: props.backgroundUrl ? 'rgba(28, 16, 51, 0.55)' : brand.palette.primary,
        },
    }));
    // Content.
    children.push((0, h_1.h)('div', {
        style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '1080px',
            height: '1080px',
            padding: '96px 80px',
            textAlign: 'center',
        },
    }, 
    // Decorative open-quote glyph.
    (0, h_1.h)('div', {
        style: {
            fontSize: '180px',
            color: 'rgba(255, 255, 255, 0.35)',
            fontWeight: 700,
            lineHeight: 0.6,
            marginBottom: '24px',
            fontFamily: 'Inter',
        },
    }, '“'), 
    // The quote itself.
    (0, h_1.h)('div', {
        style: {
            fontSize: '60px',
            lineHeight: 1.25,
            color: '#FFFFFF',
            fontWeight: 700,
            letterSpacing: '-1px',
            marginBottom: '40px',
            fontFamily: 'Inter, "Noto Sans Devanagari"',
        },
    }, props.quote), 
    // Attribution.
    props.attribution
        ? (0, h_1.h)('div', {
            style: {
                fontSize: '28px',
                color: 'rgba(255, 255, 255, 0.85)',
                letterSpacing: '4px',
                textTransform: 'uppercase',
                fontWeight: 500,
            },
        }, `— ${props.attribution}`)
        : null, 
    // Brand stamp.
    (0, h_1.h)('div', {
        style: {
            position: 'absolute',
            bottom: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        },
    }, brand.logoUrl
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
                color: 'rgba(255, 255, 255, 0.9)',
                letterSpacing: '4px',
                textTransform: 'uppercase',
            },
        }, brand.brandName))));
    return (0, h_1.h)('div', {
        style: {
            position: 'relative',
            display: 'flex',
            width: '1080px',
            height: '1080px',
            backgroundColor: brand.palette.primary,
        },
    }, ...children);
}
