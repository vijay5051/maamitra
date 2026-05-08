/**
 * Studio template-image picker.
 *
 * Sources templates from two places, in this order:
 *   1. Firestore `template_images` (admin-managed library, lives across deploys)
 *   2. The static manifest in lib/templateImages.ts (fallback for entries that
 *      haven't been imported into the library yet — keeps the picker non-empty
 *      after the first deploy, before admin clicks "Import all 67 starters"
 *      in /admin/marketing/templates)
 *
 * Migrated entries are matched by filename so they only appear once.
 *
 * Web-only — depends on fetch + Blob to read images into memory before
 * handing them off to the upload callable.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { TEMPLATE_IMAGES, TemplateImageAsset } from '../../lib/templateImages';
import {
  TemplateImageDoc,
  subscribeTemplateImages,
} from '../../services/templateLibrary';
import { ToolbarButton } from './ui';

interface PickerEntry extends TemplateImageAsset {
  category: string;
  source: 'library' | 'starter';
}

interface Props {
  disabled?: boolean;
  buttonLabel?: string;
  onSelect: (blob: Blob, asset: TemplateImageAsset) => Promise<void> | void;
}

export default function TemplateImagePicker({
  disabled,
  buttonLabel = 'Pick template',
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [libraryDocs, setLibraryDocs] = useState<TemplateImageDoc[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Subscribe on mount so opening the picker is instant — and so live edits
  // from the templates page show up here without a refresh.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const unsub = subscribeTemplateImages(setLibraryDocs);
    return () => unsub();
  }, []);

  const entries: PickerEntry[] = useMemo(() => {
    const migratedFilenames = new Set<string>();
    const libraryEntries: PickerEntry[] = libraryDocs.map((d) => {
      if (d.legacyFileName) migratedFilenames.add(d.legacyFileName);
      return {
        id: d.id,
        label: d.label,
        filename: d.legacyFileName ?? `${d.id}.png`,
        url: d.url,
        category: d.category || 'Uncategorised',
        source: 'library',
      };
    });
    const starterEntries: PickerEntry[] = TEMPLATE_IMAGES
      .filter((s) => !migratedFilenames.has(s.filename))
      .map((s) => ({
        id: s.id,
        label: s.label,
        filename: s.filename,
        url: s.url,
        category: 'Starter set',
        source: 'starter',
      }));
    return [...libraryEntries, ...starterEntries];
  }, [libraryDocs]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (!needle) return true;
      return e.label.toLowerCase().includes(needle) || e.category.toLowerCase().includes(needle);
    });
  }, [entries, filterCategory, search]);

  if (Platform.OS !== 'web') return null;

  async function select(asset: PickerEntry) {
    setBusyId(asset.id);
    setError(null);
    try {
      const res = await fetch(asset.url);
      if (!res.ok) throw new Error(`template-read-${res.status}`);
      const blob = await res.blob();
      await onSelect(blob, asset);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ToolbarButton
        label={buttonLabel}
        icon="images-outline"
        variant="secondary"
        disabled={disabled}
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>Template images</Text>
                <Text style={styles.subtitle}>
                  {entries.length} ready · {libraryDocs.length} in library
                  {entries.length > libraryDocs.length ? ` · ${entries.length - libraryDocs.length} starters` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.textDark} />
              </Pressable>
            </View>

            <View style={styles.toolbar}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by label or category"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.searchInput}
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={6}>
                    <Ionicons name="close-circle" size={14} color={Colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {categories.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip label="All" count={entries.length} active={filterCategory === 'all'} onPress={() => setFilterCategory('all')} />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    count={entries.filter((e) => e.category === c).length}
                    active={filterCategory === c}
                    onPress={() => setFilterCategory(c)}
                  />
                ))}
              </ScrollView>
            ) : null}

            {error ? (
              <View style={styles.error}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                <Text style={styles.errorText}>Could not select image: {error}</Text>
              </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.grid}>
              {visible.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>
                    {entries.length === 0
                      ? 'No templates yet — upload some via the Templates tab.'
                      : 'Nothing matches that search.'}
                  </Text>
                </View>
              ) : (
                visible.map((asset) => {
                  const busy = busyId === asset.id;
                  return (
                    <Pressable
                      key={asset.id}
                      style={styles.tile}
                      disabled={!!busyId}
                      onPress={() => select(asset)}
                    >
                      <Image source={{ uri: asset.url }} style={styles.image} resizeMode="cover" />
                      <View style={styles.tileFooter}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.tileLabel} numberOfLines={1}>{asset.label}</Text>
                          <Text style={styles.tileCategory} numberOfLines={1}>{asset.category}</Text>
                        </View>
                        {busy ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                          <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                        )}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Chip({
  label, count, active, onPress,
}: {
  label: string; count: number; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      <View style={[styles.chipCount, active && styles.chipCountActive]}>
        <Text style={[styles.chipCountLabel, active && styles.chipCountLabelActive]}>{count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 980,
    maxHeight: '88%',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  subtitle: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgLight,
  },
  toolbar: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  searchInput: { flex: 1, fontSize: FontSize.sm, color: Colors.textDark, outlineStyle: 'none' as any },
  chipRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: Colors.cardBg, borderRadius: 999,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight },
  chipLabelActive: { color: Colors.primary },
  chipCount: {
    minWidth: 20, paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 999, backgroundColor: Colors.bgLight, alignItems: 'center',
  },
  chipCountActive: { backgroundColor: '#fff' },
  chipCountLabel: { fontSize: 10, fontWeight: '800', color: Colors.textLight },
  chipCountLabelActive: { color: Colors.primary },
  error: {
    margin: Spacing.lg,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: { flex: 1, fontSize: FontSize.xs, color: Colors.error, fontWeight: '700' },
  grid: {
    padding: Spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tile: {
    width: 180,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
    backgroundColor: Colors.bgLight,
  },
  image: { width: '100%', aspectRatio: 1.6, backgroundColor: Colors.bgLight },
  tileFooter: {
    minHeight: 48,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tileLabel: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark },
  tileCategory: { fontSize: 10, fontWeight: '600', color: Colors.textLight, marginTop: 1 },
  empty: { padding: Spacing.xl, alignItems: 'center', flex: 1, minHeight: 120, justifyContent: 'center' },
  emptyText: { fontSize: FontSize.sm, color: Colors.textLight, textAlign: 'center' },
});
