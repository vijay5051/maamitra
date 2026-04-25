import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getScheduleFor,
  SCHEDULE_INFO,
  VaccineScheduleType,
} from '../../data/vaccines';
import { Colors, Fonts } from '../../constants/theme';

interface Props {
  /** Currently chosen schedule, if any — drives the "currently using" hint. */
  currentSchedule?: VaccineScheduleType | null;
  /** Called once the parent confirms a pick — caller persists + syncs. */
  onConfirm: (schedule: VaccineScheduleType) => void;
  /** Title shown above the cards. Defaults to first-time copy. */
  title?: string;
  /** Subtitle copy. */
  subtitle?: string;
  /**
   * When true, picking a schedule shows an extra warning that switching may
   * remap completed vaccines. Used for the "change schedule" flow.
   */
  isChange?: boolean;
}

const TYPES: VaccineScheduleType[] = ['iap', 'nis'];

export default function VaccineScheduleChooser({
  currentSchedule,
  onConfirm,
  title = 'Choose your vaccine schedule',
  subtitle = "Many Indian families follow one of two schedules. Pick the one your paediatrician uses — you'll only need to do this once for this child.",
  isChange = false,
}: Props) {
  const [selected, setSelected] = useState<VaccineScheduleType | null>(currentSchedule ?? null);
  const [previewType, setPreviewType] = useState<VaccineScheduleType | null>(null);
  const [confirmType, setConfirmType] = useState<VaccineScheduleType | null>(null);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.cards}>
        {TYPES.map((type) => {
          const info = SCHEDULE_INFO[type];
          const isCurrent = currentSchedule === type;
          const isSelected = selected === type;
          const total = getScheduleFor(type).length;
          return (
            <TouchableOpacity
              key={type}
              activeOpacity={0.85}
              onPress={() => setSelected(type)}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
              ]}
            >
              {isCurrent && (
                <View style={styles.currentTag}>
                  <Text style={styles.currentTagText}>Currently using</Text>
                </View>
              )}
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardName}>{info.name}</Text>
                <View
                  style={[
                    styles.radio,
                    isSelected && styles.radioOn,
                  ]}
                >
                  {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
              </View>
              <Text style={styles.cardFull}>{info.fullName}</Text>
              <Text style={styles.cardAuthority}>{info.authority}</Text>

              <Text style={styles.tagline}>{info.tagline}</Text>

              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{total}</Text>
                  <Text style={styles.statLabel}>vaccines</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNumSmall} numberOfLines={1}>
                    {info.bestFor}
                  </Text>
                  <Text style={styles.statLabel}>best for</Text>
                </View>
              </View>

              <View style={styles.bullets}>
                {info.highlights.slice(0, 3).map((h) => (
                  <View key={h} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{h}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => setPreviewType(type)}
                style={styles.previewBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="eye-outline" size={14} color={Colors.primary} />
                <Text style={styles.previewBtnText}>Preview full list</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        disabled={!selected || selected === currentSchedule}
        activeOpacity={0.85}
        onPress={() => selected && setConfirmType(selected)}
        style={[
          styles.confirmBtn,
          (!selected || selected === currentSchedule) && styles.confirmBtnDisabled,
        ]}
      >
        <LinearGradient
          colors={selected ? [Colors.primary, Colors.primary] : ['#E5E7EB', '#E5E7EB']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.confirmBtnGrad}
        >
          <Text style={styles.confirmBtnText}>
            {selected
              ? selected === currentSchedule
                ? 'Already on this schedule'
                : isChange
                  ? `Switch to ${SCHEDULE_INFO[selected].name}`
                  : `Use ${SCHEDULE_INFO[selected].name} schedule`
              : 'Pick a schedule above'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        You can change this later from the vaccine tracker. Your logged dates
        are kept either way.
      </Text>

      {/* ── Preview modal ─────────────────────────────────────────────── */}
      <PreviewModal
        type={previewType}
        onClose={() => setPreviewType(null)}
        onPick={(t) => {
          setSelected(t);
          setPreviewType(null);
        }}
      />

      {/* ── Confirm modal ─────────────────────────────────────────────── */}
      <ConfirmModal
        type={confirmType}
        isChange={isChange && currentSchedule != null && currentSchedule !== confirmType}
        onCancel={() => setConfirmType(null)}
        onConfirm={() => {
          if (confirmType) onConfirm(confirmType);
          setConfirmType(null);
        }}
      />
    </View>
  );
}

// ─── Preview modal ───────────────────────────────────────────────────────────

function PreviewModal({
  type,
  onClose,
  onPick,
}: {
  type: VaccineScheduleType | null;
  onClose: () => void;
  onPick: (t: VaccineScheduleType) => void;
}) {
  const groups = useMemo(() => {
    if (!type) return [];
    const list = getScheduleFor(type);
    const order: string[] = [];
    const map = new Map<string, string[]>();
    for (const v of list) {
      if (!map.has(v.ageLabel)) {
        order.push(v.ageLabel);
        map.set(v.ageLabel, []);
      }
      map.get(v.ageLabel)!.push(v.name);
    }
    return order.map((ageLabel) => ({ ageLabel, items: map.get(ageLabel)! }));
  }, [type]);

  if (!type) return null;
  const info = SCHEDULE_INFO[type];

  return (
    <Modal
      visible={!!type}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={previewStyles.header}>
        <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
          <Ionicons name="close" size={22} color={Colors.textLight} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={previewStyles.title}>{info.fullName}</Text>
          <Text style={previewStyles.sub}>{info.authority}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={previewStyles.body}>
        {groups.map((g) => (
          <View key={g.ageLabel} style={previewStyles.group}>
            <Text style={previewStyles.groupAge}>{g.ageLabel}</Text>
            {g.items.map((name) => (
              <View key={name} style={previewStyles.row}>
                <View style={previewStyles.dot} />
                <Text style={previewStyles.rowText}>{name}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={previewStyles.sourceBox}>
          <Ionicons name="document-text-outline" size={14} color={Colors.textLight} />
          <Text style={previewStyles.sourceText}>{info.source}</Text>
        </View>
      </ScrollView>

      <View style={previewStyles.footer}>
        <TouchableOpacity
          onPress={() => onPick(type)}
          activeOpacity={0.85}
          style={previewStyles.pickBtn}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={previewStyles.pickBtnGrad}
          >
            <Text style={previewStyles.pickBtnText}>Use {info.name} schedule</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const previewStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: '#fff',
  },
  title: { fontFamily: Fonts.sansBold, fontSize: 16, color: Colors.textDark },
  sub: { fontFamily: Fonts.sansRegular, fontSize: 12, color: Colors.textLight, marginTop: 1 },
  body: { padding: 16, paddingBottom: 40 },
  group: { marginBottom: 18 },
  groupAge: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.5,
  },
  rowText: { fontFamily: Fonts.sansMedium, fontSize: 13, color: Colors.textDark, flex: 1 },
  sourceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  sourceText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textLight,
    lineHeight: 16,
  },
  footer: {
    padding: 14,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
    backgroundColor: '#fff',
  },
  pickBtn: { borderRadius: 12, overflow: 'hidden' },
  pickBtnGrad: { paddingVertical: 14, alignItems: 'center' },
  pickBtnText: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#fff' },
});

// ─── Confirm modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  type,
  isChange,
  onCancel,
  onConfirm,
}: {
  type: VaccineScheduleType | null;
  isChange: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!type) return null;
  const info = SCHEDULE_INFO[type];
  return (
    <Modal
      visible={!!type}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={confirmStyles.overlay}>
        <View style={confirmStyles.card}>
          <View style={confirmStyles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={28} color={Colors.primary} />
          </View>
          <Text style={confirmStyles.title}>
            {isChange ? `Switch to ${info.name}?` : `Use ${info.name} schedule?`}
          </Text>
          <Text style={confirmStyles.body}>
            {isChange
              ? `Switching remaps the tracker to the ${info.fullName} list. Your previously logged dates stay saved — vaccines that exist in the new schedule will still show as done.`
              : `Once you start, the tracker for this child stays on ${info.fullName}. You can switch later but it's best to confirm with your paediatrician first.`}
          </Text>
          <View style={confirmStyles.btns}>
            <TouchableOpacity onPress={onCancel} style={confirmStyles.cancelBtn} activeOpacity={0.7}>
              <Text style={confirmStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={confirmStyles.okBtn} activeOpacity={0.85}>
              <LinearGradient
                colors={[Colors.primary, Colors.primary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={confirmStyles.okGrad}
              >
                <Text style={confirmStyles.okText}>
                  {isChange ? 'Yes, switch' : 'Lock it in'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: Colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  btns: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelText: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: Colors.textLight },
  okBtn: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  okGrad: { paddingVertical: 12, alignItems: 'center' },
  okText: { fontFamily: Fonts.sansBold, fontSize: 13.5, color: '#fff' },
});

// ─── Chooser styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 17,
    color: Colors.textDark,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.sansRegular,
    fontSize: 13,
    color: Colors.textLight,
    lineHeight: 19,
    marginBottom: 16,
  },
  cards: {
    gap: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.borderSoft,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha05,
  },
  currentTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  currentTagText: {
    fontFamily: Fonts.sansBold,
    fontSize: 10,
    color: '#16a34a',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardName: {
    fontFamily: Fonts.sansBold,
    fontSize: 18,
    color: Colors.textDark,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cardFull: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13.5,
    color: Colors.textDark,
    marginTop: 2,
  },
  cardAuthority: {
    fontFamily: Fonts.sansRegular,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  tagline: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12.5,
    color: Colors.primary,
    marginTop: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.primaryAlpha05,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 12,
    gap: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statNum: {
    fontFamily: Fonts.sansBold,
    fontSize: 20,
    color: Colors.textDark,
    lineHeight: 24,
  },
  statNumSmall: {
    fontFamily: Fonts.sansBold,
    fontSize: 13.5,
    color: Colors.textDark,
    lineHeight: 18,
  },
  statLabel: {
    fontFamily: Fonts.sansRegular,
    fontSize: 10.5,
    color: Colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.borderSoft,
  },
  bullets: {
    marginTop: 12,
    gap: 5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.55,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
    fontFamily: Fonts.sansRegular,
    fontSize: 12.5,
    color: Colors.textLight,
    lineHeight: 18,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  previewBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  confirmBtn: {
    marginTop: 18,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: Fonts.sansBold,
    fontSize: 14,
    color: '#fff',
  },
  disclaimer: {
    fontFamily: Fonts.sansRegular,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
  },
});
