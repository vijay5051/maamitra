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

import { h, SatoriElement } from './h';
import { BrandSnapshot, TipCardProps } from './types';

export function tipCard(props: TipCardProps, brand: BrandSnapshot): SatoriElement {
  const accent = props.accent ?? brand.palette.accent;
  const tips = props.tips.slice(0, 4);

  return h(
    'div',
    {
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
    h(
      'div',
      {
        style: {
          fontSize: '28px',
          fontWeight: 700,
          color: brand.palette.primary,
          letterSpacing: '6px',
          textTransform: 'uppercase',
          marginBottom: '24px',
        },
      },
      props.eyebrow,
    ),
    // Title
    h(
      'div',
      {
        style: {
          fontSize: '88px',
          fontWeight: 700,
          color: brand.palette.text,
          lineHeight: 1.05,
          marginBottom: '64px',
          letterSpacing: '-2px',
        },
      },
      props.title,
    ),
    // Tip rows
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        },
      },
      ...tips.map((text, i) =>
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '32px',
            },
          },
          h(
            'div',
            {
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
            },
            String(i + 1),
          ),
          h(
            'div',
            {
              style: {
                fontSize: '36px',
                lineHeight: 1.35,
                color: brand.palette.text,
                fontWeight: 500,
                paddingTop: '8px',
              },
            },
            text,
          ),
        ),
      ),
    ),
    // Logo / brand name footer
    footer(brand),
  );
}

function footer(brand: BrandSnapshot): SatoriElement {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 'auto',
      },
    },
    brand.logoUrl
      ? h('img', {
          src: brand.logoUrl,
          width: 64,
          height: 64,
          style: { borderRadius: '12px' },
        })
      : h(
          'div',
          {
            style: {
              fontSize: '24px',
              fontWeight: 700,
              color: brand.palette.primary,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            },
          },
          brand.brandName,
        ),
  );
}
