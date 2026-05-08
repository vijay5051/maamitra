import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { TEMPLATE_IMAGES, TemplateImageAsset } from '../../lib/templateImages';
import { ToolbarButton } from './ui';

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

  if (Platform.OS !== 'web') return null;

  async function select(asset: TemplateImageAsset) {
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
                <Text style={styles.subtitle}>{TEMPLATE_IMAGES.length} MaaMitra-ready images</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.textDark} />
              </Pressable>
            </View>
            {error ? (
              <View style={styles.error}>
                <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
                <Text style={styles.errorText}>Could not select image: {error}</Text>
              </View>
            ) : null}
            <ScrollView contentContainerStyle={styles.grid}>
              {TEMPLATE_IMAGES.map((asset) => {
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
                      <Text style={styles.tileLabel}>{asset.label}</Text>
                      {busy ? <ActivityIndicator size="small" color={Colors.primary} /> : (
                        <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
  image: { width: '100%', aspectRatio: 2, backgroundColor: Colors.bgLight },
  tileFooter: {
    minHeight: 38,
    paddingHorizontal: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tileLabel: { flex: 1, fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark },
});
