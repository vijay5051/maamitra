/**
 * Marketing → Templates: admin-managed library of reusable PNGs the Studio
 * picker pulls from.
 *
 * Live-subscribes to Firestore `template_images`. Every action (upload,
 * edit, delete, import-starters) hits the live collection so the picker
 * across other tabs reflects changes within a tick.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  TemplateImageDoc,
  deleteTemplateImage,
  importStaticTemplate,
  subscribeTemplateImages,
  updateTemplateImage,
  uploadTemplateImage,
} from '../../../services/templateLibrary';
import { TEMPLATE_IMAGES } from '../../../lib/templateImages';

const STARTER_CATEGORY = 'Quote backgrounds';

type Banner = { tone: 'ok' | 'err' | 'info'; text: string } | null;

type EditingState =
  | { mode: 'closed' }
  | { mode: 'edit'; row: TemplateImageDoc; label: string; category: string; saving: boolean; error: string | null }
  | { mode: 'upload'; file: File | null; label: string; category: string; saving: boolean; error: string | null };

export default function MarketingTemplatesScreen() {
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 720;

  const [rows, setRows] = useState<TemplateImageDoc[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [banner, setBanner] = useState<Banner>(null);
  const [editing, setEditing] = useState<EditingState>({ mode: 'closed' });
  const [confirmDelete, setConfirmDelete] = useState<TemplateImageDoc | null>(null);
  const [importing, setImporting] = useState<{ done: number; total: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = subscribeTemplateImages((next) => {
      setRows(next);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const showBanner = useCallback((tone: 'ok' | 'err' | 'info', text: string) => {
    setBanner({ tone, text });
    if (tone === 'ok') setTimeout(() => setBanner(null), 2400);
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.category || 'Uncategorised');
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterCategory !== 'all' && (r.category || 'Uncategorised') !== filterCategory) return false;
      if (!needle) return true;
      return r.label.toLowerCase().includes(needle) || r.category.toLowerCase().includes(needle);
    });
  }, [rows, filterCategory, search]);

  // Has the admin imported the static-manifest starters yet? We detect by
  // counting docs whose legacyFileName came from the manifest. Used to show
  // an "Import 67 starters" banner once.
  const importedFilenames = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.legacyFileName) set.add(r.legacyFileName);
    return set;
  }, [rows]);
  const startersAvailable = useMemo(
    () => TEMPLATE_IMAGES.filter((s) => !importedFilenames.has(s.filename)),
    [importedFilenames],
  );

  function openUploadFromFile(file: File) {
    setEditing({
      mode: 'upload',
      file,
      label: file.name.replace(/\.[^.]+$/, '').slice(0, 60),
      category: filterCategory !== 'all' ? filterCategory : (categories[0] ?? STARTER_CATEGORY),
      saving: false,
      error: null,
    });
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function handleUploadConfirm() {
    if (editing.mode !== 'upload' || !editing.file || !user) return;
    setEditing({ ...editing, saving: true, error: null });
    try {
      await uploadTemplateImage(
        { uid: user.uid, email: user.email },
        editing.file,
        { label: editing.label, category: editing.category },
      );
      setEditing({ mode: 'closed' });
      showBanner('ok', 'Template added.');
    } catch (e: any) {
      setEditing({ ...editing, saving: false, error: friendlyUploadError(e) });
    }
  }

  async function handleEditConfirm() {
    if (editing.mode !== 'edit' || !user) return;
    setEditing({ ...editing, saving: true, error: null });
    try {
      await updateTemplateImage(
        { uid: user.uid, email: user.email },
        editing.row.id,
        { label: editing.label, category: editing.category },
      );
      setEditing({ mode: 'closed' });
      showBanner('ok', 'Saved.');
    } catch (e: any) {
      setEditing({ ...editing, saving: false, error: e?.message ?? 'Could not save — try again.' });
    }
  }

  async function handleDelete() {
    if (!confirmDelete || !user) return;
    const row = confirmDelete;
    setConfirmDelete(null);
    try {
      await deleteTemplateImage({ uid: user.uid, email: user.email }, row);
      showBanner('ok', 'Deleted.');
    } catch (e: any) {
      showBanner('err', e?.message ?? 'Delete failed — try again.');
    }
  }

  function handleDownload(row: TemplateImageDoc) {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const a = document.createElement('a');
    a.href = row.url;
    a.download = `${row.label || 'template'}.png`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function importStarters() {
    if (!user || importing) return;
    const total = startersAvailable.length;
    if (!total) return;
    setImporting({ done: 0, total, failed: 0 });
    let done = 0;
    let failed = 0;
    // Sequential to avoid hammering Storage with 67 parallel uploads.
    for (const s of startersAvailable) {
      try {
        await importStaticTemplate(
          { uid: user.uid, email: user.email },
          { fileName: s.filename, label: s.label, sourceUrl: s.url },
          STARTER_CATEGORY,
        );
        done += 1;
      } catch (e) {
        console.warn('[templates] import failed for', s.filename, e);
        failed += 1;
      }
      setImporting({ done: done + failed, total, failed });
    }
    setImporting(null);
    if (failed === 0) showBanner('ok', `Imported ${done} starter templates.`);
    else showBanner('err', `Imported ${done}, ${failed} failed — try the rest again.`);
  }

  // Web-only (the picker itself is web-only too).
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.nativeMsg}>
        <Ionicons name="globe-outline" size={28} color={Colors.textMuted} />
        <Text style={styles.nativeMsgTitle}>Templates is web-only</Text>
        <Text style={styles.nativeMsgBody}>
          Open the admin panel in your browser to manage the template library.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Templates' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
      >
        {banner ? (
          <View style={[styles.banner, banner.tone === 'err' && styles.bannerErr]}>
            <Ionicons
              name={banner.tone === 'ok' ? 'checkmark-circle' : banner.tone === 'err' ? 'alert-circle' : 'information-circle'}
              size={16}
              color={banner.tone === 'ok' ? Colors.success : banner.tone === 'err' ? Colors.error : Colors.primary}
            />
            <Text style={[styles.bannerText, banner.tone === 'err' && { color: Colors.error }]}>{banner.text}</Text>
          </View>
        ) : null}

        {/* Header card — title + count + primary actions */}
        <View style={styles.headerCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Template library</Text>
            <Text style={styles.subtitle}>
              {loaded ? `${rows.length} template${rows.length === 1 ? '' : 's'}` : 'Loading…'}
              {categories.length ? ` · ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}` : ''}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={openFilePicker} style={styles.primaryBtn} accessibilityLabel="Upload new template">
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              <Text style={styles.primaryBtnLabel}>Upload</Text>
            </Pressable>
          </View>
          {/* Hidden file input — clicked imperatively from the Upload button. */}
          {/* eslint-disable-next-line react/forbid-elements */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) openUploadFromFile(f);
              e.currentTarget.value = '';
            }}
          />
        </View>

        {/* Import-starters card — visible only while there are unmigrated entries */}
        {loaded && startersAvailable.length > 0 ? (
          <View style={styles.importCard}>
            <Ionicons name="cloud-download-outline" size={18} color={Colors.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.importTitle}>Bring in {startersAvailable.length} starter templates</Text>
              <Text style={styles.importBody}>
                The {startersAvailable.length} {startersAvailable.length === TEMPLATE_IMAGES.length ? '' : 'remaining '}
                quote backgrounds you uploaded earlier are still in the static folder.
                Import them once to make them editable here and discoverable in Studio.
              </Text>
            </View>
            <Pressable
              onPress={importStarters}
              disabled={!!importing}
              style={[styles.secondaryBtn, importing && styles.secondaryBtnDisabled]}
            >
              {importing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Ionicons name="arrow-down-circle-outline" size={16} color={Colors.primary} />
              )}
              <Text style={styles.secondaryBtnLabel}>{importing ? `${importing.done}/${importing.total}` : 'Import all'}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Search + category filter row */}
        <View style={[styles.toolbar, isWide ? styles.toolbarWide : styles.toolbarNarrow]}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by label or category"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {categories.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <CategoryChip label="All" count={rows.length} active={filterCategory === 'all'} onPress={() => setFilterCategory('all')} />
            {categories.map((c) => (
              <CategoryChip
                key={c}
                label={c}
                count={rows.filter((r) => (r.category || 'Uncategorised') === c).length}
                active={filterCategory === c}
                onPress={() => setFilterCategory(c)}
              />
            ))}
          </ScrollView>
        ) : null}

        {/* Grid */}
        {!loaded ? (
          <View style={styles.empty}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="images-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>{rows.length === 0 ? 'Library is empty' : 'No templates match'}</Text>
            <Text style={styles.emptyBody}>
              {rows.length === 0
                ? 'Upload your first template, or import the 67 starters above.'
                : 'Try a different search or pick a different category.'}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((row) => (
              <TemplateCard
                key={row.id}
                row={row}
                categories={categories}
                onEdit={() =>
                  setEditing({
                    mode: 'edit',
                    row,
                    label: row.label,
                    category: row.category,
                    saving: false,
                    error: null,
                  })
                }
                onDelete={() => setConfirmDelete(row)}
                onDownload={() => handleDownload(row)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Upload + Edit shared modal */}
      <FormModal
        editing={editing}
        categories={categories}
        onCancel={() => setEditing({ mode: 'closed' })}
        onSetLabel={(label) => setEditing(editing.mode === 'closed' ? editing : { ...editing, label })}
        onSetCategory={(category) => setEditing(editing.mode === 'closed' ? editing : { ...editing, category })}
        onConfirm={editing.mode === 'upload' ? handleUploadConfirm : handleEditConfirm}
      />

      {/* Delete confirm */}
      <Modal visible={!!confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(null)}>
        <View style={modalStyles.backdrop}>
          <View style={modalStyles.confirmCard}>
            <Text style={modalStyles.title}>Delete this template?</Text>
            <Text style={modalStyles.body}>
              "{confirmDelete?.label}" will be removed from the library and from Storage. This can't be undone — re-upload if you change your mind.
            </Text>
            <View style={modalStyles.actions}>
              <Pressable onPress={() => setConfirmDelete(null)} style={[modalStyles.btn, modalStyles.btnGhost]}>
                <Text style={modalStyles.btnGhostLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleDelete} style={[modalStyles.btn, modalStyles.btnDanger]}>
                <Text style={modalStyles.btnDangerLabel}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import overlay */}
      {importing ? (
        <View style={modalStyles.backdrop} pointerEvents="auto">
          <View style={modalStyles.importCard}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={modalStyles.title}>Importing starters…</Text>
            <Text style={modalStyles.body}>
              {importing.done} of {importing.total}{importing.failed ? ` · ${importing.failed} failed` : ''}
            </Text>
            <View style={modalStyles.progressTrack}>
              <View style={[modalStyles.progressFill, { width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }]} />
            </View>
          </View>
        </View>
      ) : null}
    </>
  );
}

function TemplateCard({
  row,
  categories,
  onEdit,
  onDelete,
  onDownload,
}: {
  row: TemplateImageDoc;
  categories: string[];
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.imageWrap}>
        {row.url && !imgError ? (
          <Image source={{ uri: row.url }} style={cardStyles.image} resizeMode="cover" onError={() => setImgError(true)} />
        ) : (
          <View style={cardStyles.imagePlaceholder}>
            <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
          </View>
        )}
      </View>
      <View style={cardStyles.body}>
        <Text style={cardStyles.label} numberOfLines={1}>{row.label}</Text>
        <View style={cardStyles.categoryBadge}>
          <Ionicons name="pricetag-outline" size={11} color={Colors.primary} />
          <Text style={cardStyles.categoryLabel}>{row.category}</Text>
        </View>
      </View>
      <View style={cardStyles.actions}>
        <CardAction icon="create-outline" label="Edit" onPress={onEdit} />
        <CardAction icon="download-outline" label="Download" onPress={onDownload} />
        <CardAction icon="trash-outline" label="Delete" onPress={onDelete} variant="danger" />
      </View>
    </View>
  );
}

function CardAction({
  icon,
  label,
  onPress,
  variant,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'danger';
}) {
  const color = variant === 'danger' ? Colors.error : Colors.textDark;
  return (
    <Pressable onPress={onPress} style={cardStyles.actionBtn} accessibilityLabel={label}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[cardStyles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function CategoryChip({
  label, count, active, onPress,
}: {
  label: string; count: number; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, active && chipStyles.chipActive]}>
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{label}</Text>
      <View style={[chipStyles.count, active && chipStyles.countActive]}>
        <Text style={[chipStyles.countLabel, active && chipStyles.countLabelActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function FormModal({
  editing,
  categories,
  onSetLabel,
  onSetCategory,
  onCancel,
  onConfirm,
}: {
  editing: EditingState;
  categories: string[];
  onSetLabel: (v: string) => void;
  onSetCategory: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const visible = editing.mode !== 'closed';
  const isUpload = editing.mode === 'upload';
  const previewUrl = useMemo(() => {
    if (editing.mode === 'edit') return editing.row.url;
    if (editing.mode === 'upload' && editing.file) return URL.createObjectURL(editing.file);
    return null;
  }, [editing]);

  // Revoke object URLs when switching upload subjects.
  useEffect(() => {
    if (editing.mode === 'upload' && editing.file && previewUrl) {
      return () => URL.revokeObjectURL(previewUrl);
    }
    return undefined;
  }, [editing, previewUrl]);

  const datalistId = 'template-category-suggestions';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={modalStyles.backdrop}>
        <View style={modalStyles.formCard}>
          <View style={modalStyles.formHeader}>
            <Text style={modalStyles.title}>{isUpload ? 'New template' : 'Edit template'}</Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.textDark} />
            </Pressable>
          </View>
          {previewUrl ? (
            <Image source={{ uri: previewUrl }} style={modalStyles.preview} resizeMode="cover" />
          ) : null}
          <Text style={modalStyles.fieldLabel}>Label</Text>
          <TextInput
            value={editing.mode === 'closed' ? '' : editing.label}
            onChangeText={onSetLabel}
            placeholder="e.g. Pastel sunrise quote bg"
            placeholderTextColor={Colors.textMuted}
            style={modalStyles.input}
            maxLength={80}
          />
          <Text style={modalStyles.fieldLabel}>Category</Text>
          {/* Native HTML input + datalist gives autocomplete from existing categories. */}
          {/* eslint-disable-next-line react/forbid-elements */}
          <input
            type="text"
            value={editing.mode === 'closed' ? '' : editing.category}
            onChange={(e) => onSetCategory(e.currentTarget.value)}
            placeholder="e.g. Quote backgrounds"
            list={datalistId}
            maxLength={60}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${Colors.borderSoft}`,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              backgroundColor: Colors.bgLight,
              color: Colors.textDark,
            }}
          />
          {/* eslint-disable-next-line react/forbid-elements */}
          <datalist id={datalistId}>
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
          {editing.mode !== 'closed' && editing.error ? (
            <View style={modalStyles.formError}>
              <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
              <Text style={modalStyles.formErrorText}>{editing.error}</Text>
            </View>
          ) : null}
          <View style={modalStyles.actions}>
            <Pressable
              onPress={onCancel}
              style={[modalStyles.btn, modalStyles.btnGhost]}
              disabled={editing.mode !== 'closed' && editing.saving}
            >
              <Text style={modalStyles.btnGhostLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[modalStyles.btn, modalStyles.btnPrimary, editing.mode !== 'closed' && editing.saving && modalStyles.btnDisabled]}
              disabled={editing.mode === 'closed' || editing.saving}
            >
              {editing.mode !== 'closed' && editing.saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={modalStyles.btnPrimaryLabel}>{isUpload ? 'Upload' : 'Save'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function friendlyUploadError(e: any): string {
  const msg = e?.message ?? String(e);
  if (msg.includes('too-large')) return 'That file is over 8 MB — please compress and try again.';
  if (msg.includes('image-empty')) return 'That file looks empty — try a different image.';
  if (msg.includes('storage/unauthorized')) return 'Storage rules rejected the upload. Sign out and back in if this persists.';
  return msg.replace(/^Error:\s*/, '');
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.md,
    paddingTop: 0,
    gap: Spacing.md,
  },
  bodyWide: { paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.sm },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  bannerErr: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  bannerText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },

  headerCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
    ...Shadow.sm,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textDark },
  subtitle: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
  },
  primaryBtnLabel: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },

  importCard: {
    backgroundColor: '#eef2ff',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  importTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  importBody: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2, lineHeight: 18 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.cardBg, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary,
  },
  secondaryBtnDisabled: { opacity: 0.65 },
  secondaryBtnLabel: { color: Colors.primary, fontWeight: '800', fontSize: FontSize.sm },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toolbarWide: {},
  toolbarNarrow: { flexWrap: 'wrap' },
  searchWrap: {
    flex: 1, minWidth: 220,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.cardBg, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, outlineStyle: 'none' as any },

  chipRow: { flexDirection: 'row', gap: 6, paddingVertical: 4, paddingRight: Spacing.md },

  empty: {
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xxl, gap: 8,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft, borderStyle: 'dashed' as any,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  emptyBody: { fontSize: FontSize.xs, color: Colors.textLight, textAlign: 'center', maxWidth: 320 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },

  nativeMsg: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: Spacing.xxl },
  nativeMsgTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  nativeMsgBody: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center' },
});

const cardStyles = StyleSheet.create({
  card: {
    width: 220,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  imageWrap: { width: '100%', aspectRatio: 1, backgroundColor: Colors.bgLight },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.md, gap: 6 },
  label: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textDark },
  categoryBadge: {
    flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: Colors.primarySoft, borderRadius: Radius.sm,
  },
  categoryLabel: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  actions: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.borderSoft,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 10,
  },
  actionLabel: { fontSize: 11, fontWeight: '700' },
});

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.cardBg, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  label: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textLight },
  labelActive: { color: Colors.primary },
  count: {
    minWidth: 22, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, backgroundColor: Colors.bgLight, alignItems: 'center',
  },
  countActive: { backgroundColor: '#fff' },
  countLabel: { fontSize: 10, fontWeight: '800', color: Colors.textLight },
  countLabelActive: { color: Colors.primary },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  formCard: {
    width: '100%', maxWidth: 480,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: 8,
    ...Shadow.md,
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: {
    width: '100%', aspectRatio: 1.4, marginVertical: 8,
    borderRadius: Radius.md, backgroundColor: Colors.bgLight,
  },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark, marginTop: 6 },
  input: {
    padding: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    fontSize: FontSize.sm, color: Colors.textDark, backgroundColor: Colors.bgLight,
  },
  formError: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: Spacing.sm, borderRadius: Radius.sm,
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
  },
  formErrorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, fontWeight: '700' },

  confirmCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    padding: Spacing.lg, gap: 8,
    ...Shadow.md,
  },
  importCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center', gap: 12,
    ...Shadow.md,
  },
  progressTrack: {
    width: '100%', height: 6, borderRadius: 999,
    backgroundColor: Colors.bgLight, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary },

  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  body: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  btnGhost: { backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.borderSoft },
  btnGhostLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  btnPrimary: { backgroundColor: Colors.primary },
  btnPrimaryLabel: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  btnDanger: { backgroundColor: Colors.error },
  btnDangerLabel: { fontSize: FontSize.sm, fontWeight: '800', color: '#fff' },
  btnDisabled: { opacity: 0.65 },
});
