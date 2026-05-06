/**
 * Admin — Library (unified).
 *
 * Two-tier navigation:
 *   Tier 1 — Kind tabs: Articles · Books · Products
 *   Tier 2 — Section tabs: Library (content CRUD) · Autopilot (AI settings) · History
 *
 * "Library" is the default — admin sees content first, not settings.
 * "Autopilot" holds the AI schedule controls + generate-now.
 * "History" shows cron run logs (Articles only; other kinds show a placeholder).
 */

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  AdminPage,
  ConfirmDialog,
  StatusBadge,
  Toolbar,
  ToolbarButton,
} from '../../components/admin/ui';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { createContent, deleteContent, setContentById, updateContent } from '../../services/firebase';
import { uploadLibraryImage } from '../../services/storage';
import {
  archiveLibraryItem,
  DEFAULT_LIBRARY_AI,
  FREQUENCIES,
  FREQUENCY_LABELS,
  GenArticleInput,
  GenBooksInput,
  GenProductsInput,
  generateArticleNow,
  generateBooksNow,
  generateProductsNow,
  KindSettings,
  LibraryAiSettings,
  LibraryContentItem,
  listRecentRuns,
  sendArticleToMarketingDraft,
  subscribeAllLibraryItems,
  subscribeLibraryAiSettings,
  updateLibraryAiSettings,
} from '../../services/libraryAi';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type Kind    = 'articles' | 'books' | 'products';
type Section = 'library' | 'autopilot' | 'history';
type StatusFilter = 'all' | 'published' | 'draft' | 'archived';

const KIND_META: Record<Kind, { label: string; emoji: string; noun: string }> = {
  articles: { label: 'Articles', emoji: '📰', noun: 'article' },
  books:    { label: 'Books',    emoji: '📚', noun: 'book'    },
  products: { label: 'Products', emoji: '🛍️', noun: 'product' },
};

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'library',  label: 'Library',  icon: 'library-outline'  },
  { key: 'autopilot',label: 'Autopilot',icon: 'sparkles-outline' },
  { key: 'history',  label: 'History',  icon: 'time-outline'     },
];

async function pickWebImageFile(): Promise<File | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      resolve(target?.files?.[0] ?? null);
    };
    input.click();
  });
}

function formatLibraryUploadError(error: any): string {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (message === 'too-large') return 'Image is larger than 8 MB. Choose a smaller image and reupload.';
  if (code === 'storage/unauthorized') {
    return 'Upload failed: storage/unauthorized. This signed-in account is blocked by Firebase Storage rules.';
  }
  if (code === 'storage/unauthenticated') {
    return 'Upload failed: storage/unauthenticated. Refresh and sign in again before uploading.';
  }
  if (code === 'storage/invalid-format') {
    return 'Upload failed: storage/invalid-format. Try JPG, PNG, or WEBP.';
  }
  if (message.startsWith('image-read-')) {
    return `Upload failed: ${message}. The browser could not read the selected image.`;
  }
  if (code || message) return `Upload failed: ${[code, message].filter(Boolean).join(' · ')}`;
  return `Upload failed: ${String(error ?? 'unknown error')}`;
}

// ─── Field schemas for the edit form ─────────────────────────────────────────

interface FieldSpec {
  key: string;
  label: string;
  multiline?: boolean;
  numeric?: boolean;
  hint?: string;
}

const SCHEMAS: Record<Kind, FieldSpec[]> = {
  articles: [
    { key: 'title',     label: 'Title *' },
    { key: 'preview',   label: 'Preview *',  multiline: true },
    { key: 'body',      label: 'Full body',  multiline: true },
    { key: 'topic',     label: 'Topic',      hint: 'Feeding, Sleep, Nutrition…' },
    { key: 'readTime',  label: 'Read time',  hint: 'e.g. "4 min read"' },
    { key: 'emoji',     label: 'Emoji icon' },
    { key: 'tag',       label: 'Tag',        hint: 'e.g. Breastfeeding' },
    { key: 'url',       label: 'External URL' },
    { key: 'imageUrl',  label: 'Header image URL' },
    { key: 'ageMin',    label: 'Age min (months)', numeric: true },
    { key: 'ageMax',    label: 'Age max (months)', numeric: true },
  ],
  books: [
    { key: 'title',       label: 'Title *' },
    { key: 'author',      label: 'Author *' },
    { key: 'description', label: 'Description',  multiline: true },
    { key: 'topic',       label: 'Topic',         hint: 'e.g. Pregnancy, Sleep' },
    { key: 'rating',      label: 'Rating (1–5)',  numeric: true },
    { key: 'reviews',     label: 'Review count',  numeric: true },
    { key: 'url',         label: 'Buy URL' },
    { key: 'sampleUrl',   label: 'Sample / preview URL' },
    { key: 'imageUrl',    label: 'Cover image URL' },
    { key: 'ageMin',      label: 'Age min (months)', numeric: true, hint: '-9 = pregnancy' },
    { key: 'ageMax',      label: 'Age max (months)', numeric: true, hint: '999 = all ages' },
  ],
  products: [
    { key: 'name',          label: 'Product name *' },
    { key: 'category',      label: 'Category',          hint: 'Feeding, Sleep, Skincare…' },
    { key: 'emoji',         label: 'Emoji' },
    { key: 'price',         label: 'Price (₹)',          numeric: true },
    { key: 'originalPrice', label: 'Original price (₹)', numeric: true },
    { key: 'rating',        label: 'Rating (1–5)',       numeric: true },
    { key: 'reviews',       label: 'Review count',       numeric: true },
    { key: 'badge',         label: 'Badge',              hint: 'e.g. Best Seller' },
    { key: 'description',   label: 'Description',        multiline: true },
    { key: 'url',           label: 'Affiliate / buy URL' },
    { key: 'imageUrl',      label: 'Image URL' },
    { key: 'ageMin',        label: 'Age min (months)',   numeric: true },
    { key: 'ageMax',        label: 'Age max (months)',   numeric: true },
  ],
};

function blankItem(kind: Kind): Record<string, any> {
  const item: Record<string, any> = {};
  SCHEMAS[kind].forEach((f) => { item[f.key] = ''; });
  return item;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LibraryAiAdmin() {
  const auth = useAuthStore((s) => s.user);
  const [kind, setKind]       = useState<Kind>('articles');
  const [section, setSection] = useState<Section>('library');
  const [settings, setSettings] = useState<LibraryAiSettings>(DEFAULT_LIBRARY_AI);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeLibraryAiSettings(setSettings);
    return () => unsub();
  }, []);

  // Reset section to 'library' when kind changes so users always land on content
  useEffect(() => { setSection('library'); }, [kind]);

  const k = settings[kind];

  async function persistKindPatch(patch: Partial<KindSettings>) {
    if (!auth) return;
    setSavingKey(kind);
    try {
      await updateLibraryAiSettings(
        { uid: auth.uid, email: auth.email },
        { [kind]: { ...k, ...patch } } as Partial<LibraryAiSettings>,
      );
    } catch (e: any) { setGlobalErr(e?.message ?? String(e)); }
    finally { setSavingKey(null); }
  }

  async function persistGlobal(patch: Partial<LibraryAiSettings>) {
    if (!auth) return;
    try {
      await updateLibraryAiSettings({ uid: auth.uid, email: auth.email }, patch);
    } catch (e: any) { setGlobalErr(e?.message ?? String(e)); }
  }

  const autopilotEnabled = k.enabled && !settings.paused;

  return (
    <>
      <Stack.Screen options={{ title: 'Library' }} />
      <AdminPage
        title="Library"
        description="Content manager and AI autopilot for Articles, Books & Products."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Library' }]}
        headerActions={
          <View style={s.headerCtrls}>
            <Text style={s.pausedLabel}>AI paused</Text>
            <Switch
              value={settings.paused}
              onValueChange={(v) => persistGlobal({ paused: v })}
              trackColor={{ false: '#e5e7eb', true: Colors.warning }}
            />
          </View>
        }
        toolbar={
          <View style={{ gap: 6 }}>
            {/* Tier 1: Kind */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabRow}>
              {(Object.keys(KIND_META) as Kind[]).map((kk) => {
                const active = kk === kind;
                return (
                  <Pressable
                    key={kk}
                    onPress={() => setKind(kk)}
                    style={[s.kindTab, active && s.kindTabActive]}
                  >
                    <Text style={[s.kindTabText, active && s.kindTabTextActive]}>
                      {KIND_META[kk].emoji} {KIND_META[kk].label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Tier 2: Section — with live dot on Autopilot */}
            <View style={s.sectionTabRow}>
              {SECTIONS.map((sec) => {
                const active = sec.key === section;
                const showDot = sec.key === 'autopilot';
                const dotColor = settings.paused
                  ? Colors.warning
                  : k.enabled ? Colors.success : Colors.textMuted;
                return (
                  <Pressable
                    key={sec.key}
                    onPress={() => setSection(sec.key)}
                    style={[s.sectionTab, active && s.sectionTabActive]}
                  >
                    <Ionicons
                      name={sec.icon as any}
                      size={13}
                      color={active ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={[s.sectionTabText, active && s.sectionTabTextActive]}>
                      {sec.label}
                    </Text>
                    {showDot && (
                      <View style={[s.statusDot, { backgroundColor: dotColor }]} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
      >
        {globalErr ? (
          <View style={s.inlineError}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={s.inlineErrorText}>{globalErr}</Text>
            <Pressable onPress={() => setGlobalErr(null)} hitSlop={8}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Section: Library (content CRUD) ── */}
        {section === 'library' && (
          <ContentLibrarySection
            kind={kind}
            kindSettings={k}
            globalPaused={settings.paused}
            onGoToAutopilot={() => setSection('autopilot')}
            onError={setGlobalErr}
          />
        )}

        {/* ── Section: Autopilot (settings + generate) ── */}
        {section === 'autopilot' && (
          <AutopilotSection
            kind={kind}
            settings={k}
            globalPaused={settings.paused}
            saving={savingKey === kind}
            onPatch={persistKindPatch}
            onError={setGlobalErr}
          />
        )}

        {/* ── Section: History (cron runs) ── */}
        {section === 'history' && (
          <HistorySection kind={kind} />
        )}
      </AdminPage>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Content library (all items, full CRUD)
// ═════════════════════════════════════════════════════════════════════════════

function ContentLibrarySection({ kind, kindSettings, globalPaused, onGoToAutopilot, onError }: {
  kind: Kind;
  kindSettings: KindSettings;
  globalPaused: boolean;
  onGoToAutopilot: () => void;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<LibraryContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editItem, setEditItem] = useState<LibraryContentItem | null>(null);
  const [previewItem, setPreviewItem] = useState<LibraryContentItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<LibraryContentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingArticleId, setSendingArticleId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    const unsub = subscribeAllLibraryItems(kind, (rows) => {
      setItems(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [kind]);

  const counts = useMemo(() => ({
    all:       items.length,
    published: items.filter((r) => r.status === 'published').length,
    draft:     items.filter((r) => r.status === 'draft').length,
    archived:  items.filter((r) => r.status === 'archived').length,
  }), [items]);

  const filtered = useMemo(() => {
    let rows = statusFilter === 'all' ? items : items.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q) || r.topic.toLowerCase().includes(q));
    return rows;
  }, [items, statusFilter, search]);

  async function handleSave(form: Record<string, any>, isNew: boolean, item?: LibraryContentItem | null) {
    setSaving(true);
    onError(null);
    const schema = SCHEMAS[kind];
    const cleaned: Record<string, any> = {};
    schema.forEach((f) => {
      const v = form[f.key];
      cleaned[f.key] = f.numeric ? (parseFloat(String(v)) || 0) : String(v ?? '');
    });
    try {
      if (isNew) {
        await createContent(kind, { ...cleaned, source: 'manual', status: 'draft' });
      } else if (item?.id) {
        if (item.source === 'static') {
          await setContentById(kind, item.id, {
            ...item.raw,
            ...cleaned,
            source: 'manual',
            status: item.status || 'published',
          });
        } else {
          await updateContent(kind, item.id, cleaned);
        }
      }
      setEditItem(null);
      setAddOpen(false);
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(item: LibraryContentItem, next: 'published' | 'draft' | 'archived') {
    try {
      if (next === 'archived' && item.source === 'ai') {
        await archiveLibraryItem(kind, item.id);
      } else if (item.source === 'static') {
        await setContentById(kind, item.id, {
          ...item.raw,
          status: next,
          source: 'manual',
        });
      } else {
        await updateContent(kind, item.id, { status: next });
      }
      setEditItem(null);
    } catch (e: any) { onError(e?.message ?? String(e)); }
  }

  async function handleDelete(item: LibraryContentItem) {
    try {
      if (item.source === 'static') {
        await setContentById(kind, item.id, {
          ...item.raw,
          status: 'archived',
          source: 'manual',
        });
      } else {
        await deleteContent(kind, item.id);
      }
      setConfirmDel(null);
    } catch (e: any) { onError(e?.message ?? String(e)); }
  }

  async function handleSendToMarketing(item: LibraryContentItem) {
    if (kind !== 'articles' || sendingArticleId) return;
    setSendingArticleId(item.id);
    onError(null);
    try {
      const r = await sendArticleToMarketingDraft(item.id);
      if (!r.ok) throw new Error(r.message);
      router.push(`/admin/marketing/drafts?open=${r.draftId}` as any);
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setSendingArticleId(null);
    }
  }

  const meta = KIND_META[kind];
  const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})` },
    { key: 'published', label: `Live (${counts.published})` },
    { key: 'draft',     label: `Draft (${counts.draft})` },
    { key: 'archived',  label: `Archived (${counts.archived})` },
  ];

  // Autopilot teaser strip
  const paused = globalPaused;
  const enabled = kindSettings.enabled;
  const teaserColor = paused ? Colors.warning : enabled ? Colors.success : Colors.textMuted;
  const teaserBg   = paused ? '#fff7ed'       : enabled ? '#f0fdf4'      : Colors.bgLight;
  const teaserBorder = paused ? '#fdba74'     : enabled ? '#86efac'      : Colors.borderSoft;
  const teaserDot  = paused ? Colors.warning  : enabled ? Colors.success : Colors.textMuted;
  const teaserStatus = paused
    ? '⏸ AI paused globally'
    : enabled
      ? `✅ Autopilot ON · ${FREQUENCY_LABELS[kindSettings.frequency]} · ${kindSettings.autoPublish ? 'auto-publish' : 'saves as drafts'}`
      : `💤 Autopilot is OFF`;
  const teaserSub = paused
    ? 'Flip the "AI paused" toggle in the header to resume.'
    : enabled
      ? 'AI generates content automatically on schedule. You can also generate on demand.'
      : 'Turn on autopilot to have AI write and publish content automatically.';

  return (
    <>
      {/* ── Autopilot teaser — always visible so admin knows the feature exists ── */}
      <Pressable
        style={[s.teaserBanner, { backgroundColor: teaserBg, borderColor: teaserBorder }]}
        onPress={onGoToAutopilot}
      >
        <View style={[s.teaserDot, { backgroundColor: teaserDot }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.teaserStatus, { color: teaserColor }]}>{teaserStatus}</Text>
          <Text style={s.teaserSub}>{teaserSub}</Text>
        </View>
        <View style={s.teaserActions}>
          <Pressable style={s.teaserBtn} onPress={onGoToAutopilot}>
            <Ionicons name="sparkles-outline" size={12} color={Colors.primary} />
            <Text style={s.teaserBtnText}>{enabled ? 'Configure' : 'Set up'}</Text>
          </Pressable>
          {enabled && !paused && (
            <Pressable style={[s.teaserBtn, s.teaserBtnPrimary]} onPress={onGoToAutopilot}>
              <Ionicons name="flash-outline" size={12} color="#fff" />
              <Text style={[s.teaserBtnText, { color: '#fff' }]}>Generate now</Text>
            </Pressable>
          )}
        </View>
      </Pressable>

      {/* Toolbar row */}
      <View style={s.libraryToolbar}>
        <Toolbar
          search={{ value: search, onChange: setSearch, placeholder: `Search ${meta.label.toLowerCase()}…` }}
        />
        <ToolbarButton
          label={`Add ${meta.noun}`}
          icon="add-circle-outline"
          variant="primary"
          onPress={() => setAddOpen(true)}
        />
      </View>

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filterChipRow}>
        {STATUS_CHIPS.map((chip) => (
          <Pressable
            key={chip.key}
            onPress={() => setStatusFilter(chip.key)}
            style={[s.filterChip, statusFilter === chip.key && s.filterChipActive]}
          >
            <Text style={[s.filterChipText, statusFilter === chip.key && s.filterChipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Items */}
      {loading ? (
        <View style={s.centerPad}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={s.mutedText}>Loading…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.centerPad}>
          <Text style={{ fontSize: 32 }}>{meta.emoji}</Text>
          <Text style={s.emptyTitle}>
            {search || statusFilter !== 'all' ? 'Nothing matches' : `No ${meta.label.toLowerCase()} yet`}
          </Text>
          <Text style={s.mutedText}>
            {search || statusFilter !== 'all'
              ? 'Clear the filter to see all items.'
              : `Go to the Autopilot tab to generate ${meta.label.toLowerCase()}, or add one manually above.`}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {filtered.map((item) => (
            <ContentRow
              key={item.id}
              item={item}
              onPreview={() => setPreviewItem(item)}
              onEdit={() => setEditItem(item)}
              onSendToMarketing={() => handleSendToMarketing(item)}
              sendBusy={sendingArticleId === item.id}
              onToggle={() => handleStatus(item, item.status === 'published' ? 'draft' : 'published')}
              onArchive={() => handleStatus(item, 'archived')}
              onRestore={() => handleStatus(item, 'draft')}
              onDelete={() => setConfirmDel(item)}
            />
          ))}
        </View>
      )}

      {/* Edit modal */}
      <ContentFormModal
        visible={!!editItem}
        kind={kind}
        item={editItem}
        saving={saving}
        sendingToMarketing={sendingArticleId === editItem?.id}
        onClose={() => setEditItem(null)}
        onSave={(form) => handleSave(form, false, editItem)}
        onPreview={editItem ? () => { setPreviewItem(editItem); setEditItem(null); } : undefined}
        onSendToMarketing={editItem && kind === 'articles' ? () => handleSendToMarketing(editItem) : undefined}
        onToggle={editItem ? () => handleStatus(editItem, editItem.status === 'published' ? 'draft' : 'published') : undefined}
        onArchive={editItem && editItem.status !== 'archived' ? () => handleStatus(editItem, 'archived') : undefined}
        onRestore={editItem && editItem.status === 'archived' ? () => handleStatus(editItem, 'draft') : undefined}
        onDelete={editItem ? () => { setConfirmDel(editItem); setEditItem(null); } : undefined}
      />

      {/* Add modal */}
      <ContentFormModal
        visible={addOpen}
        kind={kind}
        item={null}
        saving={saving}
        onClose={() => setAddOpen(false)}
        onSave={(form) => handleSave(form, true, null)}
      />

      <ContentPreviewModal
        visible={!!previewItem}
        kind={kind}
        item={previewItem}
        onClose={() => setPreviewItem(null)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        visible={!!confirmDel}
        title="Delete permanently?"
        body={confirmDel ? `"${confirmDel.title}" will be removed from Firestore and the Library immediately.` : ''}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) await handleDelete(confirmDel); }}
      />
    </>
  );
}

// ─── Content row ──────────────────────────────────────────────────────────────

function ContentRow({ item, onPreview, onEdit, onSendToMarketing, sendBusy, onToggle, onArchive, onRestore, onDelete }: {
  item: LibraryContentItem;
  onPreview: () => void;
  onEdit: () => void;
  onSendToMarketing: () => void;
  sendBusy: boolean;
  onToggle: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const ts = item.createdAt?.toDate?.()?.toLocaleDateString?.() ?? '';
  const ageLabel = item.ageMin < 0 ? 'pregnancy' : item.ageMax >= 999 ? 'all ages' : `${item.ageMin}–${item.ageMax}m`;
  const meta = KIND_META[item.kind];
  const imagePending = item.source === 'ai' && !item.imageUrl && (
    item.imageStatus === 'pending' ||
    (item.status === 'draft' && (
      item.raw?.aiImageStatus === 'pending' ||
      item.raw?.aiImageSource === 'pending' ||
      typeof item.raw?.aiRequestedImageModel === 'string'
    ))
  );
  const imageFailed = item.source === 'ai' && !item.imageUrl && (
    item.imageStatus === 'failed' || item.raw?.aiImageStatus === 'failed'
  );
  const alreadySent = !!item.raw?.marketingDraftLastId;

  return (
    <Pressable style={s.contentRow} onPress={onEdit}>
      <View style={s.rowThumbWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.rowThumb} resizeMode="cover" />
        ) : (
          <View style={[s.rowThumb, s.rowThumbEmpty]}>
            <Text style={{ fontSize: 20 }}>{meta.emoji}</Text>
          </View>
        )}
        {imagePending ? (
          <View style={s.rowThumbLoading}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={s.rowThumbLoadingText}>Generating image…</Text>
            <View style={s.rowThumbProgressTrack}>
              <View style={s.rowThumbProgressBar} />
            </View>
          </View>
        ) : null}
        {imageFailed ? (
          <View style={s.rowThumbFailed}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
          </View>
        ) : null}
      </View>
      
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {[item.topic, ageLabel, ts].filter(Boolean).join(' · ')}
        </Text>
        <View style={s.badgeRow}>
          <StatusBadge
            label={item.status === 'published' ? 'Live' : item.status === 'archived' ? 'Archived' : 'Draft'}
            color={item.status === 'published' ? Colors.success : item.status === 'archived' ? Colors.textMuted : Colors.warning}
          />
          <StatusBadge
            label={item.source === 'ai' ? 'AI' : item.source === 'static' ? 'Bundled' : 'Manual'}
            color={item.source === 'ai' ? Colors.primary : item.source === 'static' ? Colors.textMuted : Colors.textLight}
          />
          {imagePending && (
            <StatusBadge label="Image loading" color={Colors.primary} />
          )}
          {imageFailed && (
            <StatusBadge label="Image failed" color={Colors.error} />
          )}
          {item.flags.length > 0 && (
            <StatusBadge label={`⚠ ${item.flags.length} flag`} color={Colors.warning} />
          )}
        </View>
        {item.kind === 'articles' ? (
          <Pressable style={s.inlineActionBtn} disabled={sendBusy} onPress={(e) => { e.stopPropagation?.(); onSendToMarketing(); }}>
            <Ionicons
              name={sendBusy ? 'hourglass-outline' : alreadySent ? 'checkmark-done-outline' : 'megaphone-outline'}
              size={14}
              color={alreadySent ? Colors.success : Colors.primary}
            />
            <Text style={[s.inlineActionBtnText, alreadySent && { color: Colors.success }]}>
              {sendBusy ? 'Sending…' : alreadySent ? 'Sent to Drafts · Resend' : 'Send to Drafts'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.rowActions}>
        <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onPreview(); }}>
          <Ionicons name="reader-outline" size={18} color={Colors.primary} />
        </Pressable>
        {item.kind === 'articles' ? (
          <Pressable hitSlop={8} disabled={sendBusy} onPress={(e) => { e.stopPropagation?.(); onSendToMarketing(); }}>
            <Ionicons
              name={sendBusy ? 'hourglass-outline' : alreadySent ? 'checkmark-done-outline' : 'megaphone-outline'}
              size={18}
              color={alreadySent ? Colors.success : Colors.primary}
            />
          </Pressable>
        ) : null}
        {item.url ? (
          <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); Linking.openURL(item.url!).catch(() => {}); }}>
            <Ionicons name="open-outline" size={18} color={Colors.textLight} />
          </Pressable>
        ) : null}
        <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onToggle(); }}>
          <Ionicons
            name={item.status === 'published' ? 'eye-off-outline' : 'eye-outline'}
            size={18} color={Colors.textLight}
          />
        </Pressable>
        {item.status !== 'archived' ? (
          <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onArchive(); }}>
            <Ionicons name="archive-outline" size={18} color={Colors.textLight} />
          </Pressable>
        ) : (
          <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onRestore(); }}>
            <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
          </Pressable>
        )}
        <Pressable hitSlop={8} onPress={(e) => { e.stopPropagation?.(); onDelete(); }}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Content form modal ───────────────────────────────────────────────────────

function ContentFormModal({ visible, kind, item, saving, sendingToMarketing, onClose, onSave, onPreview, onSendToMarketing, onToggle, onArchive, onRestore, onDelete }: {
  visible: boolean;
  kind: Kind;
  item: LibraryContentItem | null;
  saving: boolean;
  sendingToMarketing?: boolean;
  onClose: () => void;
  onSave: (form: Record<string, any>) => Promise<void>;
  onPreview?: () => void;
  onSendToMarketing?: () => void;
  onToggle?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}) {
  const isEdit = !!(item?.id);
  const schema = SCHEMAS[kind];
  const [form, setForm] = useState<Record<string, any>>({});
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (item) {
        const populated: Record<string, any> = {};
        schema.forEach((f) => { populated[f.key] = item.raw[f.key] ?? ''; });
        setForm(populated);
      } else {
        setForm(blankItem(kind));
      }
      setImageUploading(false);
      setImageUploadError(null);
    }
  }, [visible, item, kind]);

  const primaryKey = kind === 'products' ? 'name' : 'title';
  const isValid = !!(form[primaryKey]?.toString().trim());
  const imageBlocked = kind === 'articles' && (imageUploading || !!imageUploadError);

  async function pickAndUploadArticleImage() {
    if (kind !== 'articles' || imageUploading) return;
    setImageUploadError(null);
    try {
      setImageUploading(true);
      let blob: Blob | null = null;
      if (Platform.OS === 'web') {
        const file = await pickWebImageFile();
        if (!file) return;
        blob = file;
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setImageUploadError('Photo access is needed to upload an article thumbnail.');
          return;
        }
        const picked = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.92,
        });
        if (picked.canceled || !picked.assets?.[0]?.uri) return;
        const asset = picked.assets[0];
        const res = await fetch(asset.uri);
        if (!res.ok) throw new Error(`image-read-${res.status}`);
        blob = await res.blob();
      }
      if (!blob) throw new Error('image-read-empty');
      if (blob.size > 8 * 1024 * 1024) {
        throw new Error('too-large');
      }
      const url = await uploadLibraryImage('articles', blob);
      setForm((f) => ({ ...f, imageUrl: url }));
      setImageUploadError(null);
    } catch (e: any) {
      console.error('[library-ai] article image upload failed', e);
      setImageUploadError(formatLibraryUploadError(e));
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {isEdit
                ? `${KIND_META[kind].emoji} Edit ${KIND_META[kind].noun}`
                : `${KIND_META[kind].emoji} Add ${KIND_META[kind].noun}`}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              {item?.source === 'ai' && (
                <View style={s.aiBadge}><Text style={s.aiBadgeText}>✨ AI</Text></View>
              )}
              <Pressable onPress={onClose} style={s.modalClose} hitSlop={6}>
                <Ionicons name="close" size={20} color={Colors.textDark} />
              </Pressable>
            </View>
          </View>

          {(item?.flags?.length ?? 0) > 0 && (
            <View style={s.flagBanner}>
              <Ionicons name="warning-outline" size={15} color={Colors.warning} />
              <Text style={s.flagText}>Compliance flags: {item!.flags.join(', ')}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
            {schema.map((field) => (
              <View key={field.key} style={{ marginBottom: Spacing.md }}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                {field.hint ? <Text style={s.fieldHint}>{field.hint}</Text> : null}
                {kind === 'articles' && field.key === 'imageUrl' ? (
                  <ArticleImageUploader
                    imageUrl={String(form.imageUrl ?? '')}
                    uploading={imageUploading}
                    error={imageUploadError}
                    onPick={pickAndUploadArticleImage}
                    onClear={() => {
                      setForm((f) => ({ ...f, imageUrl: '' }));
                      setImageUploadError(null);
                    }}
                  />
                ) : (
                  <TextInput
                    style={[
                      s.fieldInput,
                      field.multiline && { minHeight: field.key === 'body' ? 200 : 80, textAlignVertical: 'top' },
                    ]}
                    value={String(form[field.key] ?? '')}
                    onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                    multiline={field.multiline}
                    keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                    autoCapitalize={
                      ['url', 'imageUrl', 'sampleUrl'].includes(field.key) ? 'none' : 'sentences'
                    }
                    placeholderTextColor={Colors.textMuted}
                    placeholder={field.label.replace(' *', '')}
                    scrollEnabled={false}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          <View style={s.modalFooter}>
            {onPreview && <ToolbarButton label="Preview" icon="reader-outline" variant="secondary" onPress={onPreview} />}
            {onSendToMarketing && (
              <ToolbarButton
                label={
                  sendingToMarketing
                    ? 'Sending…'
                    : item?.raw?.marketingDraftLastId
                      ? 'Sent to Drafts · Resend'
                      : 'Send to Marketing Drafts'
                }
                icon={
                  sendingToMarketing
                    ? 'hourglass-outline'
                    : item?.raw?.marketingDraftLastId
                      ? 'checkmark-done-outline'
                      : 'megaphone-outline'
                }
                variant="secondary"
                onPress={onSendToMarketing}
                disabled={sendingToMarketing}
              />
            )}
            {onDelete    && <ToolbarButton label="Delete"  icon="trash-outline"   variant="danger"     onPress={onDelete}  />}
            {onArchive   && <ToolbarButton label="Archive" icon="archive-outline" variant="secondary"  onPress={onArchive} />}
            {onRestore   && <ToolbarButton label="Restore" icon="refresh-outline" variant="secondary"  onPress={onRestore} />}
            {onToggle && isEdit && item && (
              <ToolbarButton
                label={item.status === 'published' ? 'Unpublish' : 'Publish'}
                icon={item.status === 'published' ? 'eye-off-outline' : 'rocket-outline'}
                variant="secondary"
                onPress={onToggle}
              />
            )}
            <View style={{ flex: 1 }} />
            <ToolbarButton label="Cancel"  variant="ghost"    onPress={onClose}  disabled={saving} />
            <ToolbarButton
              label={saving ? 'Saving…' : imageUploading ? 'Uploading image…' : isEdit ? 'Save' : 'Add as draft'}
              variant="primary"
              icon="save-outline"
              onPress={async () => { if (isValid && !imageBlocked) await onSave(form); }}
              disabled={!isValid || saving || imageBlocked}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ArticleImageUploader({ imageUrl, uploading, error, onPick, onClear }: {
  imageUrl: string;
  uploading: boolean;
  error: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={s.imageUploadBox}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={s.imageUploadPreview} resizeMode="cover" />
      ) : (
        <View style={[s.imageUploadPreview, s.imageUploadEmpty]}>
          <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
          <Text style={s.imageUploadHint}>No Firebase image uploaded yet</Text>
        </View>
      )}
      <View style={s.imageUploadActions}>
        <ToolbarButton
          label={uploading ? 'Uploading…' : imageUrl ? 'Replace image' : 'Upload image'}
          icon={uploading ? 'cloud-upload-outline' : 'image-outline'}
          variant="secondary"
          disabled={uploading}
          onPress={onPick}
        />
        {imageUrl ? (
          <ToolbarButton
            label="Clear"
            icon="close-outline"
            variant="ghost"
            disabled={uploading}
            onPress={onClear}
          />
        ) : null}
      </View>
      <Text style={s.imageUploadNote}>
        Images are uploaded to Firebase Storage first. Save is disabled if upload fails.
      </Text>
      {error ? (
        <View style={s.imageUploadError}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
          <Text style={s.imageUploadErrorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ContentPreviewModal({ visible, kind, item, onClose }: {
  visible: boolean;
  kind: Kind;
  item: LibraryContentItem | null;
  onClose: () => void;
}) {
  const meta = KIND_META[kind];
  const raw = item?.raw ?? {};
  const title = item?.title ?? '';
  const preview = typeof raw.preview === 'string' ? raw.preview : typeof raw.description === 'string' ? raw.description : '';
  const body = typeof raw.body === 'string' ? raw.body : typeof raw.description === 'string' ? raw.description : '';
  const tag = typeof raw.tag === 'string' && raw.tag.trim() ? raw.tag : item?.topic ?? '';
  const readTime = typeof raw.readTime === 'string' ? raw.readTime : '';
  const ageLabel = item
    ? item.ageMin < 0 ? 'Pregnancy' : item.ageMax >= 999 ? 'All ages' : `${item.ageMin}-${item.ageMax} months`
    : '';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.previewCard}>
          <View style={s.modalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.previewKicker}>{meta.emoji} {meta.label} preview</Text>
              <Text style={s.previewTitle} numberOfLines={2}>{title || `Untitled ${meta.noun}`}</Text>
            </View>
            <Pressable onPress={onClose} style={s.modalClose} hitSlop={6}>
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.previewBody}>
            {item?.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={s.previewHero} resizeMode="cover" />
            ) : null}

            <View style={s.previewMetaRow}>
              {[tag, readTime, ageLabel, item?.status].filter(Boolean).map((part) => (
                <View key={String(part)} style={s.previewPill}>
                  <Text style={s.previewPillText}>{String(part)}</Text>
                </View>
              ))}
            </View>

            {preview ? <Text style={s.previewDeck}>{preview}</Text> : null}
            {body ? (
              body.split(/\n{2,}/).map((para, index) => {
                const trimmed = para.trim();
                const heading = trimmed.match(/^\*\*(.+?)\*\*$/)?.[1]?.trim();
                return heading ? (
                  <Text key={`${index}-${heading}`} style={s.previewHeading}>
                    {heading}
                  </Text>
                ) : (
                  <Text key={`${index}-${trimmed.slice(0, 12)}`} style={s.previewPara}>
                    {renderPreviewInlineBold(trimmed)}
                  </Text>
                );
              })
            ) : (
              <Text style={s.mutedText}>No full body has been saved for this {meta.noun}.</Text>
            )}
          </ScrollView>

          <View style={s.modalFooter}>
            {item?.url ? (
              <ToolbarButton label="Open link" icon="open-outline" variant="secondary" onPress={() => Linking.openURL(item.url!).catch(() => {})} />
            ) : null}
            <View style={{ flex: 1 }} />
            <ToolbarButton label="Close" variant="primary" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function renderPreviewInlineBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    return m
      ? <Text key={index} style={s.previewBold}>{m[1]}</Text>
      : <Text key={index}>{part}</Text>;
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Autopilot (settings + generate-now)
// ═════════════════════════════════════════════════════════════════════════════

function AutopilotSection({ kind, settings: k, globalPaused, saving, onPatch, onError }: {
  kind: Kind;
  settings: KindSettings;
  globalPaused: boolean;
  saving: boolean;
  onPatch: (patch: Partial<KindSettings>) => void;
  onError: (msg: string | null) => void;
}) {
  return (
    <>
      <StatusBanner kind={kind} k={k} paused={globalPaused} />
      <SettingsCard kind={kind} k={k} saving={saving} onPatch={onPatch} />
      <GenerateCard kind={kind} k={k} onError={onError} />
    </>
  );
}

function StatusBanner({ kind, k, paused }: { kind: Kind; k: KindSettings; paused: boolean }) {
  const meta = KIND_META[kind];
  const stateLabel = paused
    ? '⏸ Globally paused'
    : k.enabled
      ? `✅ ${meta.label} autopilot ON`
      : `💤 ${meta.label} autopilot OFF`;
  const stateColor = paused ? '#f97316' : k.enabled ? Colors.success : Colors.textMuted;
  const cadence = k.enabled && !paused && k.frequency !== 'off'
    ? `${FREQUENCY_LABELS[k.frequency]} · ${k.perRun}/run · ${k.autoPublish ? 'auto-publish' : 'drafts'} · ${k.expireAfterDays === 0 ? 'no expiry' : `expires ${k.expireAfterDays}d`}`
    : paused ? 'Toggle "AI paused" off in the header to resume.' : 'Enable autopilot below to schedule AI generation.';

  return (
    <View style={[s.statusBanner, paused && { backgroundColor: '#fff7ed', borderColor: '#fdba74' }]}>
      <Text style={[s.statusLabel, { color: stateColor }]}>{stateLabel}</Text>
      <Text style={s.statusSub}>{cadence}</Text>
    </View>
  );
}

function SettingsCard({ kind, k, saving, onPatch }: {
  kind: Kind;
  k: KindSettings;
  saving: boolean;
  onPatch: (patch: Partial<KindSettings>) => void;
}) {
  const [topicDraft, setTopicDraft] = useState(k.topics.join('\n'));
  const [toneDraft,  setToneDraft]  = useState(k.tone);
  useEffect(() => { setTopicDraft(k.topics.join('\n')); }, [k.topics]);
  useEffect(() => { setToneDraft(k.tone); }, [k.tone]);

  return (
    <View style={s.card}>
      {/* Enable + frequency row */}
      <View style={s.settingsHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>⚙️ Autopilot settings</Text>
        </View>
        <View style={s.toggleRow}>
          <Text style={[s.toggleLabel, k.enabled && { color: Colors.primary }]}>
            {k.enabled ? 'Enabled' : 'Off'}
          </Text>
          <Switch
            value={k.enabled}
            onValueChange={(v) => onPatch({ enabled: v })}
            trackColor={{ false: '#e5e7eb', true: Colors.primary }}
          />
        </View>
      </View>

      {/* Frequency chips */}
      <View style={{ marginBottom: Spacing.md }}>
        <Text style={s.label}>Frequency</Text>
        <View style={s.chipRow}>
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f}
              onPress={() => onPatch({ frequency: f })}
              style={[s.chip, k.frequency === f && s.chipActive]}
            >
              <Text style={[s.chipText, k.frequency === f && s.chipTextActive]}>
                {FREQUENCY_LABELS[f]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Number fields */}
      <View style={s.fieldGrid}>
        <NumberField label="Items per run" value={k.perRun} min={1} max={10} onChange={(v) => onPatch({ perRun: v })} />
        <NumberField label="Auto-archive (days)" hint="0 = never" value={k.expireAfterDays} min={0} max={365} onChange={(v) => onPatch({ expireAfterDays: v })} />
        <View style={s.switchField}>
          <Text style={s.label}>Auto-publish</Text>
          <View style={s.toggleRow}>
            <Text style={s.toggleLabel}>{k.autoPublish ? 'Yes' : 'No (drafts)'}</Text>
            <Switch
              value={k.autoPublish}
              onValueChange={(v) => onPatch({ autoPublish: v })}
              trackColor={{ false: '#e5e7eb', true: Colors.primary }}
            />
          </View>
        </View>
      </View>

      {/* Topic catalog */}
      <View style={{ marginTop: Spacing.md }}>
        <Text style={s.label}>{kind === 'products' ? 'Categories' : 'Topic catalog'} (one per line)</Text>
        <TextInput
          value={topicDraft}
          onChangeText={setTopicDraft}
          multiline
          style={[s.input, { minHeight: 100 }]}
          placeholder="Sleep&#10;Feeding&#10;Indian Festivals"
          placeholderTextColor={Colors.textMuted}
        />
        <View style={s.saveRow}>
          <ToolbarButton
            label="Save catalog"
            icon="save-outline"
            variant="secondary"
            disabled={saving || topicDraft === k.topics.join('\n')}
            onPress={() => onPatch({
              topics: topicDraft.split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 50),
            })}
          />
        </View>
      </View>

      {/* Tone */}
      <View style={{ marginTop: Spacing.md }}>
        <Text style={s.label}>Tone instruction</Text>
        <TextInput
          value={toneDraft}
          onChangeText={setToneDraft}
          multiline
          style={[s.input, { minHeight: 70 }]}
          placeholderTextColor={Colors.textMuted}
        />
        <View style={s.saveRow}>
          <ToolbarButton
            label="Save tone"
            icon="save-outline"
            variant="secondary"
            disabled={saving || toneDraft === k.tone}
            onPress={() => onPatch({ tone: toneDraft.trim() })}
          />
        </View>
      </View>

      {/* Age buckets */}
      <View style={{ marginTop: Spacing.md }}>
        <Text style={s.label}>Age buckets</Text>
        <View style={s.chipRow}>
          {k.ageBuckets.map((b) => (
            <View key={b.key} style={s.chip}>
              <Text style={s.chipText}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function GenerateCard({ kind, k, onError }: {
  kind: Kind;
  k: KindSettings;
  onError: (msg: string | null) => void;
}) {
  const [running, setRunning]         = useState(false);
  const [topic, setTopic]             = useState('');
  const [bucketKey, setBucketKey]     = useState('');
  const [count, setCount]             = useState(String(k.perRun));
  const [publishMode, setPublishMode] = useState<'auto' | 'published' | 'draft'>('auto');
  const [lastResult, setLastResult]   = useState<string | null>(null);
  const [showOpts, setShowOpts]       = useState(false);

  async function run() {
    setRunning(true);
    onError(null);
    setLastResult(null);
    try {
      const pub = publishMode === 'auto' ? undefined : publishMode;
      if (kind === 'articles') {
        const input: GenArticleInput = { topic: topic.trim() || undefined, ageBucketKey: (bucketKey || undefined) as any, publish: pub as any };
        const r = await generateArticleNow(input);
        if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
        setLastResult(
          r.imageStatus === 'pending'
            ? `✓ "${r.title}" draft created. Thumbnail is generating in the background. Check Library tab in a bit.`
            : `✓ "${r.title}" created (${r.status}). Check Library tab.`,
        );
      } else if (kind === 'books') {
        const input: GenBooksInput = { topic: topic.trim() || undefined, ageBucketKey: (bucketKey || undefined) as any, count: parseInt(count, 10) || k.perRun, publish: pub as any };
        const r = await generateBooksNow(input);
        if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
        setLastResult(`✓ ${r.inserted.length} book(s) added. ${r.skipped.length} skipped. Check Library tab.`);
      } else {
        const input: GenProductsInput = { category: topic.trim() || undefined, ageBucketKey: (bucketKey || undefined) as any, count: parseInt(count, 10) || k.perRun, publish: pub as any };
        const r = await generateProductsNow(input);
        if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
        setLastResult(`✓ ${r.inserted.length} product(s) added. ${r.skipped.length} skipped. Check Library tab.`);
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setLastResult(`✗ ${msg}`);
      onError(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <View style={s.card}>
      <View style={s.settingsHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>⚡ Generate now</Text>
          <Text style={s.cardSub}>Run the {KIND_META[kind].label.toLowerCase()} pipeline on demand.</Text>
        </View>
        <ToolbarButton
          label={showOpts ? 'Simple' : 'Options'}
          icon={showOpts ? 'chevron-up-outline' : 'options-outline'}
          variant="ghost"
          onPress={() => setShowOpts((v) => !v)}
        />
      </View>

      {showOpts && (
        <View style={s.optsGrid}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{kind === 'products' ? 'Category' : 'Topic'} override</Text>
            <TextInput
              value={topic}
              onChangeText={setTopic}
              placeholder={`Blank → picks from catalog`}
              placeholderTextColor={Colors.textMuted}
              style={s.input}
            />
          </View>
          {kind !== 'articles' && (
            <View style={{ minWidth: 80 }}>
              <Text style={s.label}>Count</Text>
              <TextInput value={count} onChangeText={setCount} style={s.input} keyboardType="number-pad" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Age bucket</Text>
            <View style={s.chipRow}>
              <Pressable style={[s.chip, !bucketKey && s.chipActive]} onPress={() => setBucketKey('')}>
                <Text style={[s.chipText, !bucketKey && s.chipTextActive]}>Auto</Text>
              </Pressable>
              {k.ageBuckets.map((b) => (
                <Pressable key={b.key} style={[s.chip, bucketKey === b.key && s.chipActive]} onPress={() => setBucketKey(b.key)}>
                  <Text style={[s.chipText, bucketKey === b.key && s.chipTextActive]}>{b.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Publish mode</Text>
            <View style={s.chipRow}>
              {(['auto', 'published', 'draft'] as const).map((m) => (
                <Pressable key={m} style={[s.chip, publishMode === m && s.chipActive]} onPress={() => setPublishMode(m)}>
                  <Text style={[s.chipText, publishMode === m && s.chipTextActive]}>{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={s.genRow}>
        <ToolbarButton
          label={running ? 'Generating…' : kind === 'articles' ? 'Generate article' : `Generate ${count} ${KIND_META[kind].label.toLowerCase()}`}
          icon="sparkles-outline"
          variant="primary"
          disabled={running}
          onPress={run}
        />
        {lastResult && (
          <Text style={[s.genResult, lastResult.startsWith('✗') && { color: Colors.error }]}>
            {lastResult}
          </Text>
        )}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — History (cron run log)
// ═════════════════════════════════════════════════════════════════════════════

function HistorySection({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<{ id: string; ts: string; summary: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await listRecentRuns(20);
      setRows(r.map((x) => ({
        id: x.id,
        ts: x.ts?.toDate?.()?.toLocaleString?.() ?? '',
        summary: summariseRun(x.kindSummary),
      })));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (kind !== 'articles') {
    return (
      <View style={s.centerPad}>
        <Text style={{ fontSize: 28 }}>🕒</Text>
        <Text style={s.emptyTitle}>Cron history</Text>
        <Text style={s.mutedText}>Run logs are shared across all three kinds. Switch to the Articles tab to see them here, or check Firebase Functions logs directly.</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.settingsHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>🕒 Cron history</Text>
          <Text style={s.cardSub}>Last 20 daily-cron runs (06:30 IST). Useful when something didn't generate.</Text>
        </View>
        <ToolbarButton label="Refresh" icon="refresh" variant="ghost" onPress={load} disabled={loading} />
      </View>
      {rows.length === 0 ? (
        <Text style={s.mutedText}>{loading ? 'Loading…' : 'No runs yet — wait for the first 06:30 IST tick.'}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={s.histRow}>
            <Text style={s.histTs}>{r.ts}</Text>
            <Text style={s.histSummary}>{r.summary}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function summariseRun(d: any): string {
  if (d?.kind === 'expire') {
    const b = d?.summary ?? {};
    return `Expired: articles=${b.articles ?? 0} · books=${b.books ?? 0} · products=${b.products ?? 0}`;
  }
  const parts: string[] = [];
  for (const kk of ['articles', 'books', 'products'] as const) {
    const v = d?.[kk];
    if (!v || v === 'skipped') { parts.push(`${kk}: —`); continue; }
    parts.push(`${kk}: ${v.ok}/${v.attempted}${v.errors?.length ? ` (${v.errors.length} err)` : ''}`);
  }
  return parts.join(' · ');
}

// ─── NumberField ──────────────────────────────────────────────────────────────

function NumberField({ label, hint, value, min, max, onChange }: {
  label: string; hint?: string; value: number; min: number; max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  return (
    <View style={s.numField}>
      <Text style={s.label}>{label}</Text>
      {hint && <Text style={s.fieldHint}>{hint}</Text>}
      <View style={s.numRow}>
        <Pressable style={s.numStep} onPress={() => onChange(Math.max(min, value - 1))}>
          <Ionicons name="remove" size={16} color={Colors.textDark} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => {
            const n = parseInt(draft, 10);
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
            else setDraft(String(value));
          }}
          style={s.numInput}
          keyboardType="number-pad"
        />
        <Pressable style={s.numStep} onPress={() => onChange(Math.min(max, value + 1))}>
          <Ionicons name="add" size={16} color={Colors.textDark} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  headerCtrls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pausedLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },

  // Kind tabs (tier 1)
  tabRow: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  kindTab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgLight,
    borderWidth: 1.5, borderColor: Colors.borderSoft,
  },
  kindTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  kindTabText: { fontSize: 13, fontWeight: '700', color: Colors.textLight },
  kindTabTextActive: { color: '#fff' },

  // Section tabs (tier 2)
  sectionTabRow: { flexDirection: 'row', gap: 0, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  sectionTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  sectionTabActive: { borderBottomColor: Colors.primary },
  sectionTabText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  sectionTabTextActive: { color: Colors.primary, fontWeight: '700' },

  // Library section toolbar
  libraryToolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 8 },
  filterChipRow: { flexDirection: 'row', gap: 6, paddingBottom: 10 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 12, fontWeight: '600', color: Colors.textDark },
  filterChipTextActive: { color: '#fff' },

  // Content rows
  contentRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    padding: Spacing.md,
  },
  rowThumbWrap: {
    width: 50, height: 50, flexShrink: 0,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  rowThumb: {
    width: 50, height: 50, borderRadius: Radius.md,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderSoft, flexShrink: 0,
  },
  rowThumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bgLight },
  rowThumbLoading: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,247,0.94)',
    paddingHorizontal: 4,
    gap: 3,
  },
  rowThumbLoadingText: {
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '700',
    color: Colors.primary,
    textAlign: 'center',
  },
  rowThumbProgressTrack: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.primaryAlpha12,
    overflow: 'hidden',
  },
  rowThumbProgressBar: {
    width: '65%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  rowThumbFailed: {
    position: 'absolute',
    right: 3,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rowTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  rowSub: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  inlineActionBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha12,
    backgroundColor: Colors.primarySoft,
  },
  inlineActionBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 0 },

  // Status banner (autopilot section)
  statusBanner: {
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.primaryAlpha12,
  },
  statusLabel: { fontSize: FontSize.sm, fontWeight: '800' },
  statusSub: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 3 },

  // Cards
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  cardSub: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  settingsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },
  switchField: { minWidth: 180 },

  // Fields
  fieldGrid: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  label: {
    fontSize: 10, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
  },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: Colors.textLight,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },
  fieldInput: {
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 9,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },
  imageUploadBox: {
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgLight,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  imageUploadPreview: {
    width: '100%',
    height: 180,
    borderRadius: Radius.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  imageUploadEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageUploadHint: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  imageUploadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  imageUploadNote: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  imageUploadError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  imageUploadErrorText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.error,
  },
  saveRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.bgLight, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textDark },
  chipTextActive: { color: '#fff' },

  // NumberField
  numField: { minWidth: 140, flex: 1 },
  numRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  numStep: {
    width: 30, height: 30, borderRadius: Radius.md,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  numInput: {
    flex: 1, textAlign: 'center', backgroundColor: Colors.cardBg,
    borderRadius: Radius.md, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.border,
    fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark,
  },

  // Generate card
  optsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  genRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  genResult: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600', flex: 1 },

  // History
  histRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  histTs: { fontSize: 10, color: Colors.textMuted, fontVariant: ['tabular-nums'] },
  histSummary: { fontSize: FontSize.xs, color: Colors.textDark, marginTop: 2 },

  // Empty / center states
  centerPad: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  mutedText: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', maxWidth: 340 },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(28,16,51,0.55)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 680, maxHeight: '92%',
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl,
    overflow: 'hidden', ...Shadow.lg,
  },
  previewCard: {
    width: '100%', maxWidth: 760, maxHeight: '92%',
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl,
    overflow: 'hidden', ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  modalClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
  },
  modalBody: { padding: Spacing.xl },
  previewBody: { padding: Spacing.xl, gap: Spacing.md },
  previewKicker: {
    fontSize: 10, fontWeight: '800', color: Colors.primary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  previewTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark },
  previewHero: {
    width: '100%', height: 260, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
  },
  previewMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previewPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  previewPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },
  previewDeck: {
    fontSize: FontSize.md, lineHeight: 23,
    color: Colors.textDark, fontWeight: '600',
  },
  previewPara: {
    fontSize: FontSize.sm, lineHeight: 23,
    color: Colors.textDark,
  },
  previewHeading: {
    fontSize: FontSize.md,
    lineHeight: 23,
    color: Colors.textDark,
    fontWeight: '800',
  },
  previewBold: {
    fontWeight: '800',
    color: Colors.textDark,
  },
  modalFooter: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft, flexWrap: 'wrap',
  },
  aiBadge: {
    backgroundColor: Colors.primaryAlpha05, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.primaryAlpha12,
  },
  aiBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  flagBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff7ed', paddingHorizontal: Spacing.xl, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#fdba74',
  },
  flagText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '600', flex: 1 },

  // Section tab live dot
  statusDot: {
    width: 7, height: 7, borderRadius: 4,
    marginLeft: 2,
  },

  // Autopilot teaser strip (Library section)
  teaserBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  teaserDot: {
    width: 9, height: 9, borderRadius: 5, flexShrink: 0,
  },
  teaserStatus: { fontSize: FontSize.sm, fontWeight: '700' },
  teaserSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  teaserActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  teaserBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: Colors.primary,
  },
  teaserBtnPrimary: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  teaserBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  inlineErrorText: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
