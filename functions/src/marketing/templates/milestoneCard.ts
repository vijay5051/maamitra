// Milestone Card — split layout: photo on top half, milestones list on bottom.
// Used for "what to expect at age X" content.
//
// Layout (1080×1080):
//   ┌─────────────────────────────┐
//   │                             │
//   │    [photo background]       │  ← top 480px
//   │      AGE PILL               │
//   │                             │
//   ├─────────────────────────────┤
//   │ TITLE                       │
//   │ ✓ milestone one             │  ← bottom 600px on bg
//   │ ✓ milestone two             │
//   │ ✓ milestone three           │
//   │                  [logo]     │
//   └─────────────────────────────┘

import { h, SatoriElement } from './h';
import { BrandSnapshot, MilestoneCardProps } from './types';

export function milestoneCard(props: MilestoneCardProps, brand: BrandSnapshot): SatoriElement {
  const milestones = props.milestones.slice(0, 6);

  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: '1080px',
        height: '1080px',
        backgroundColor: brand.palette.background,
        fontFamily: 'Inter, "Noto Sans Devanagari"',
      },
    },
    // ─── Top half: photo + age pill ───────────────────────────────────────
    h(
      'div',
      {
        style: {
          position: 'relative',
          display: 'flex',
          width: '1080px',
          height: '480px',
          backgroundColor: brand.palette.accent,
        },
      },
      props.photoUrl
        ? h('img', {
            src: props.photoUrl,
            width: 1080,
            height: 480,
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '1080px',
              height: '480px',
              objectFit: 'cover',
            },
          })
        : null,
      // Age pill — sits in the bottom-left of the photo area, overlaps the
      // divider for a polished magazine look.
      h(
        'div',
        {
          style: {
            position: 'absolute',
            bottom: '-32px',
            left: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: brand.palette.primary,
            color: '#FFFFFF',
            paddingTop: '20px',
            paddingBottom: '20px',
            paddingLeft: '36px',
            paddingRight: '36px',
            borderRadius: '40px',
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          },
        },
        props.age,
      ),
    ),
    // ─── Bottom half: title + milestones ─────────────────────────────────
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 72px 72px',
          flex: 1,
        },
      },
      h(
        'div',
        {
          style: {
            fontSize: '60px',
            fontWeight: 700,
            color: brand.palette.text,
            letterSpacing: '-1px',
            marginBottom: '40px',
            lineHeight: 1.1,
          },
        },
        props.title,
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
          },
        },
        ...milestones.map((m) =>
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'flex-start',
                marginBottom: '20px',
              },
            },
            h(
              'div',
              {
                style: {
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  backgroundColor: brand.palette.primary,
                  color: '#FFFFFF',
                  fontSize: '22px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '20px',
                  marginTop: '4px',
                  flexShrink: 0,
                },
              },
              '✓',
            ),
            h(
              'div',
              {
                style: {
                  fontSize: '32px',
                  lineHeight: 1.35,
                  color: brand.palette.text,
                  fontWeight: 500,
                  flex: 1,
                },
              },
              m,
            ),
          ),
        ),
      ),
      // Footer with logo.
      h(
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
