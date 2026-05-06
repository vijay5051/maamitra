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

import { h, SatoriElement } from './h';
import { BrandSnapshot, RealStoryCardProps } from './types';

export function realStoryCard(props: RealStoryCardProps, brand: BrandSnapshot): SatoriElement {
  const photoH = 648; // 60% of 1080
  const panelH = 1080 - photoH;

  return h(
    'div',
    {
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
    h(
      'div',
      {
        style: {
          width: '1080px',
          height: `${photoH}px`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start',
          padding: '40px',
          backgroundColor: brand.palette.primary,
          backgroundImage: props.photoUrl ? `url(${props.photoUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        },
      },
      // Subtle gradient shade at the bottom to blend into the panel.
      h('div', {
        style: {
          position: 'absolute',
          left: '0',
          right: '0',
          bottom: '0',
          height: '160px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%)',
        },
      }),
    ),
    // ── Story panel ──────────────────────────────────────────────────────────
    h(
      'div',
      {
        style: {
          width: '1080px',
          height: `${panelH}px`,
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 64px 48px 64px',
          backgroundColor: brand.palette.background,
          flex: 1,
        },
      },
      // Eyebrow
      h(
        'div',
        {
          style: {
            fontSize: '22px',
            fontWeight: 700,
            color: brand.palette.primary,
            letterSpacing: '5px',
            textTransform: 'uppercase',
            marginBottom: '16px',
          },
        },
        `Inspired Story · ${props.eyebrow}`,
      ),
      // Quote
      h(
        'div',
        {
          style: {
            fontSize: '38px',
            fontWeight: 400,
            color: brand.palette.text,
            lineHeight: 1.32,
            letterSpacing: '-0.5px',
            flex: 1,
          },
        },
        `"${props.story}"`,
      ),
      // Footer — attribution + logo
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '20px',
          },
        },
        h(
          'div',
          {
            style: {
              fontSize: '24px',
              fontWeight: 700,
              color: brand.palette.text,
              letterSpacing: '0.4px',
            },
          },
          `— ${props.attribution}`,
        ),
        brand.logoUrl
          ? h('img', {
              src: brand.logoUrl,
              width: 56,
              height: 56,
              style: { borderRadius: '12px' },
            })
          : h(
              'div',
              {
                style: {
                  fontSize: '20px',
                  fontWeight: 700,
                  color: brand.palette.primary,
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                },
              },
              brand.brandName,
            ),
      ),
    ),
  );
}
