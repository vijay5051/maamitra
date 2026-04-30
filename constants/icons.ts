// Brand-aware icon registry.
//
// Why this file exists:
// The app previously used Ionicons inline with inconsistent coloring —
// some icons were Colors.primary, some hardcoded #9CA3AF, some random
// green/orange/blue tints from the deprecated palette. Result: visual
// fragmentation. Every icon now goes through `<AppIcon>` and inherits a
// semantic brand color rule defined here.
//
// FOUNDATIONAL SCOPE: this PR replaces colors, not glyphs. Glyphs stay
// Ionicons. Phase 3 of the icon work (deferred, requires Codex batch
// generation) replaces the highest-visibility glyphs with custom brand
// SVG illustrations.
//
// How to color an icon (from least to most surgical):
//   1. Default — just `<AppIcon name="health.vaccine" />`. Picks the
//      registry's default role (`action` here → brand purple).
//   2. Role override — `<AppIcon name="action.delete" role="muted" />`
//      when the icon is on a quiet list row vs. a confirmation dialog.
//   3. Color override — `<AppIcon name="..." color="#fff" />`. Last
//      resort — prefer adding a new role to ROLE_COLOR if you need a new
//      semantic colour rather than ad-hoc-ing.
//
// Migration path: tabs/_layout, tabs/index, tabs/health are migrated as
// part of the foundation. The remaining screens (admin, auth, community
// sub-screens, etc.) migrate incrementally as we touch them.

import { Ionicons } from '@expo/vector-icons';

export type IconRole =
  | 'action'      // primary action (purple)
  | 'success'     // positive state (sage)
  | 'warning'     // attention needed (ochre)
  | 'error'       // failure (red)
  | 'info'        // neutral info (lavender)
  | 'love'        // social/heart accent
  | 'muted';      // chrome / decoration (textMuted)

export type IconKey =
  // Navigation
  | 'nav.back' | 'nav.forward' | 'nav.close' | 'nav.menu'
  | 'nav.search' | 'nav.settings' | 'nav.notifications' | 'nav.messages'
  // Actions
  | 'action.add' | 'action.add-circle' | 'action.edit' | 'action.delete' | 'action.share'
  | 'action.save' | 'action.send' | 'action.copy' | 'action.more'
  | 'action.expand' | 'action.collapse' | 'action.swap' | 'action.refresh'
  // Status
  | 'status.success' | 'status.success-outline' | 'status.check'
  | 'status.warning' | 'status.error' | 'status.info'
  | 'status.pending' | 'status.locked' | 'status.shield'
  // Domain — baby/health
  | 'health.vaccine' | 'health.growth' | 'health.tooth' | 'health.food'
  | 'health.routine' | 'health.milestone' | 'health.scheme'
  | 'health.heart' | 'health.flower' | 'health.scale' | 'health.head'
  // Domain — wellness
  | 'wellness.mood' | 'wellness.yoga' | 'wellness.sleep' | 'wellness.water'
  | 'wellness.walk' | 'wellness.alert'
  // Domain — community
  | 'community.heart' | 'community.heart-filled'
  | 'community.comment' | 'community.bookmark'
  | 'community.repost' | 'community.flag'
  // Objects
  | 'object.user' | 'object.family' | 'object.calendar' | 'object.clock'
  | 'object.gift' | 'object.book' | 'object.chat' | 'object.sparkles' | 'object.sparkles-outline'
  | 'object.mic' | 'object.gender-boy' | 'object.gender-girl' | 'object.gender-other'
  | 'object.pencil' | 'object.heart' | 'object.heart-filled' | 'object.arrow-forward'
  | 'object.document' | 'object.user-circle' | 'object.navigate' | 'object.globe';

interface IconEntry {
  glyph: keyof typeof Ionicons.glyphMap;
  defaultRole: IconRole;
}

export const ICONS: Record<IconKey, IconEntry> = {
  // Navigation — chrome by default
  'nav.back':           { glyph: 'chevron-back',              defaultRole: 'muted'   },
  'nav.forward':        { glyph: 'chevron-forward',           defaultRole: 'muted'   },
  'nav.close':          { glyph: 'close',                     defaultRole: 'muted'   },
  'nav.menu':           { glyph: 'menu',                      defaultRole: 'muted'   },
  'nav.search':         { glyph: 'search',                    defaultRole: 'muted'   },
  'nav.settings':       { glyph: 'settings-outline',          defaultRole: 'muted'   },
  'nav.notifications':  { glyph: 'notifications-outline',     defaultRole: 'muted'   },
  'nav.messages':       { glyph: 'chatbubbles-outline',       defaultRole: 'muted'   },
  // Actions — primary
  'action.add':         { glyph: 'add',                       defaultRole: 'action'  },
  'action.add-circle':  { glyph: 'add-circle-outline',        defaultRole: 'action'  },
  'action.edit':        { glyph: 'pencil',                    defaultRole: 'action'  },
  'action.delete':      { glyph: 'trash-outline',             defaultRole: 'error'   },
  'action.share':       { glyph: 'share-outline',             defaultRole: 'action'  },
  'action.save':        { glyph: 'bookmark-outline',          defaultRole: 'action'  },
  'action.send':        { glyph: 'paper-plane-outline',       defaultRole: 'action'  },
  'action.copy':        { glyph: 'copy-outline',              defaultRole: 'muted'   },
  'action.more':        { glyph: 'ellipsis-horizontal',       defaultRole: 'muted'   },
  'action.expand':      { glyph: 'chevron-down',              defaultRole: 'action'  },
  'action.collapse':    { glyph: 'chevron-up',                defaultRole: 'action'  },
  'action.swap':        { glyph: 'swap-horizontal-outline',   defaultRole: 'action'  },
  'action.refresh':     { glyph: 'refresh-outline',           defaultRole: 'muted'   },
  // Status
  'status.success':         { glyph: 'checkmark-circle',          defaultRole: 'success' },
  'status.success-outline': { glyph: 'checkmark-circle-outline',  defaultRole: 'success' },
  'status.check':           { glyph: 'checkmark',                 defaultRole: 'success' },
  'status.warning':     { glyph: 'alert-circle-outline',      defaultRole: 'warning' },
  'status.error':       { glyph: 'close-circle',              defaultRole: 'error'   },
  'status.info':        { glyph: 'information-circle-outline',defaultRole: 'info'    },
  'status.pending':     { glyph: 'time-outline',              defaultRole: 'muted'   },
  'status.locked':      { glyph: 'lock-closed',               defaultRole: 'muted'   },
  'status.shield':      { glyph: 'shield-checkmark-outline',  defaultRole: 'action'  },
  // Domain — health
  'health.vaccine':     { glyph: 'shield-checkmark-outline',  defaultRole: 'action'  },
  'health.growth':      { glyph: 'trending-up-outline',       defaultRole: 'action'  },
  'health.tooth':       { glyph: 'happy-outline',             defaultRole: 'action'  },
  'health.food':        { glyph: 'restaurant-outline',        defaultRole: 'action'  },
  'health.routine':     { glyph: 'time-outline',              defaultRole: 'action'  },
  'health.milestone':   { glyph: 'sparkles-outline',          defaultRole: 'action'  },
  'health.scheme':      { glyph: 'ribbon-outline',            defaultRole: 'action'  },
  'health.heart':       { glyph: 'heart-outline',             defaultRole: 'action'  },
  'health.flower':      { glyph: 'flower-outline',            defaultRole: 'action'  },
  'health.scale':       { glyph: 'scale-outline',             defaultRole: 'action'  },
  'health.head':        { glyph: 'ellipse-outline',           defaultRole: 'action'  },
  // Domain — wellness
  'wellness.mood':      { glyph: 'happy-outline',             defaultRole: 'action'  },
  'wellness.yoga':      { glyph: 'leaf-outline',              defaultRole: 'success' },
  'wellness.sleep':     { glyph: 'moon-outline',              defaultRole: 'muted'   },
  'wellness.water':     { glyph: 'water-outline',             defaultRole: 'info'    },
  'wellness.walk':      { glyph: 'walk-outline',              defaultRole: 'success' },
  'wellness.alert':     { glyph: 'alert-circle-outline',      defaultRole: 'warning' },
  // Domain — community
  'community.heart':         { glyph: 'heart-outline',         defaultRole: 'love'   },
  'community.heart-filled':  { glyph: 'heart',                 defaultRole: 'love'   },
  'community.comment':       { glyph: 'chatbubble-outline',    defaultRole: 'muted'  },
  'community.bookmark':      { glyph: 'bookmark-outline',      defaultRole: 'action' },
  'community.repost':        { glyph: 'repeat-outline',        defaultRole: 'muted'  },
  'community.flag':          { glyph: 'flag-outline',          defaultRole: 'warning'},
  // Objects
  'object.user':            { glyph: 'person-outline',         defaultRole: 'muted'  },
  'object.family':          { glyph: 'people-outline',         defaultRole: 'muted'  },
  'object.calendar':        { glyph: 'calendar-outline',       defaultRole: 'muted'  },
  'object.clock':           { glyph: 'time-outline',           defaultRole: 'muted'  },
  'object.gift':            { glyph: 'gift-outline',           defaultRole: 'action' },
  'object.book':            { glyph: 'book-outline',           defaultRole: 'action' },
  'object.chat':            { glyph: 'chatbubbles-outline',    defaultRole: 'action' },
  'object.sparkles':        { glyph: 'sparkles',               defaultRole: 'action' },
  'object.sparkles-outline':{ glyph: 'sparkles-outline',       defaultRole: 'action' },
  'object.mic':             { glyph: 'mic',                    defaultRole: 'action' },
  'object.gender-boy':      { glyph: 'male-outline',           defaultRole: 'muted'  },
  'object.gender-girl':     { glyph: 'female-outline',         defaultRole: 'muted'  },
  'object.gender-other':    { glyph: 'help-circle-outline',    defaultRole: 'muted'  },
  'object.pencil':          { glyph: 'pencil-outline',         defaultRole: 'action' },
  'object.heart':           { glyph: 'heart-outline',          defaultRole: 'love'   },
  'object.heart-filled':    { glyph: 'heart',                  defaultRole: 'love'   },
  'object.arrow-forward':   { glyph: 'arrow-forward',          defaultRole: 'action' },
  'object.document':        { glyph: 'document-text-outline',  defaultRole: 'muted'  },
  'object.user-circle':     { glyph: 'person-circle-outline',  defaultRole: 'muted'  },
  'object.navigate':        { glyph: 'navigate-outline',       defaultRole: 'muted'  },
  'object.globe':           { glyph: 'globe-outline',          defaultRole: 'muted'  },
};
