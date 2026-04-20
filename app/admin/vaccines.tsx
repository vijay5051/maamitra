/**
 * Admin — Vaccine Schedule Manager
 * View, edit, and manage the IAP vaccine schedule.
 * Changes saved to Firestore override the static data/vaccines.ts defaults.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VACCINE_SCHEDULE } from '../../data/vaccines';
import { getContent, createContent, updateContent, deleteContent, setContentById } from '../../services/firebase';

interface VaccineItem {
  id: string;
  name: string;
  shortName: string;
  description: string;
  daysFromBirth: number;
  ageLabel: string;
  category: string;
  isCustom?: boolean; // true = admin-added via Firestore
}

const CATEGORIES = ['Birth Doses', 'Primary Series', 'Booster Doses', 'Optional', 'Catch-up'];

// ─── Form Modal ───────────────────────────────────────────────────────────────

function VaccineFormModal({
  visible,
  vaccine,
  onClose,
  onSave,
}: {
  visible: boolean;
  vaccine: VaccineItem | null;
  onClose: () => void;
  onSave: (data: Omit<VaccineItem, 'id'>) => Promise<void>;
}) {
  const isEdit = !!vaccine; // any vaccine can be edited
  const [form, setForm] = useState({
    name: '', shortName: '', description: '',
    daysFromBirth: '', ageLabel: '', category: 'Primary Series',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vaccine) {
      setForm({
        name: vaccine.name ?? '',
        shortName: vaccine.shortName ?? '',
        description: vaccine.description ?? '',
        daysFromBirth: String(vaccine.daysFromBirth ?? ''),
        ageLabel: vaccine.ageLabel ?? '',
        category: vaccine.category ?? 'Primary Series',
      });
    } else {
      setForm({ name: '', shortName: '', description: '', daysFromBirth: '', ageLabel: '', category: 'Primary Series' });
    }
  }, [vaccine, visible]);

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave({
      name: form.name.trim(),
      shortName: form.shortName.trim(),
      description: form.description.trim(),
      daysFromBirth: parseInt(form.daysFromBirth) || 0,
      ageLabel: form.ageLabel.trim(),
      category: form.category,
      isCustom: true,
    });
    setSaving(false);
  }

  const isValid = form.name.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={fs.header}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color="#6b7280" />
          </TouchableOpacity>
          <Text style={fs.title}>{isEdit ? 'Edit Vaccine' : 'Add Custom Vaccine'}</Text>
          <TouchableOpacity
            style={[fs.saveBtn, !isValid && { opacity: 0.4 }]}
            onPress={handleSave} disabled={!isValid || saving} activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={fs.saveBtnText}>{isEdit ? 'Update' : 'Add'}</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={fs.body} keyboardShouldPersistTaps="handled">
          {[
            { key: 'name', label: 'Vaccine Name *', hint: 'e.g. OPV1 + Pentavalent Dose 1' },
            { key: 'shortName', label: 'Short Name', hint: 'e.g. OPV1+Penta1' },
            { key: 'description', label: 'Description', multiline: true },
            { key: 'daysFromBirth', label: 'Days From Birth', numeric: true, hint: '0 = birth, 42 = 6 weeks, 270 = 9 months' },
            { key: 'ageLabel', label: 'Age Label', hint: 'e.g. 6 Weeks, 9 Months' },
          ].map((f) => (
            <View key={f.key} style={fs.field}>
              <Text style={fs.label}>{f.label}</Text>
              {f.hint && <Text style={fs.hint}>{f.hint}</Text>}
              <TextInput
                style={[fs.input, f.multiline && fs.textArea]}
                value={String((form as any)[f.key])}
                onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                multiline={f.multiline}
                keyboardType={f.numeric ? 'number-pad' : 'default'}
                placeholderTextColor="#9ca3af"
                placeholder={f.label.replace(' *', '')}
              />
            </View>
          ))}

          <Text style={fs.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[fs.chip, c === form.category && fs.chipActive]}
                onPress={() => setForm((p) => ({ ...p, category: c }))}
              >
                <Text style={[fs.chipText, c === form.category && fs.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fs = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '700', color: '#1a1a2e' },
  saveBtn: { backgroundColor: '#10b981', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { padding: 16, gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  hint: { fontSize: 11, color: '#9ca3af', marginBottom: 4 },
  input: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#10b981' },
  chipText: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  chipTextActive: { color: '#059669' },
});

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VaccinesScreen() {
  // firestoreVaccines = custom vaccines + static overrides from Firestore
  const [firestoreVaccines, setFirestoreVaccines] = useState<VaccineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<VaccineItem | null>(null);

  // Static vaccine base list
  const staticVaccines: VaccineItem[] = VACCINE_SCHEDULE.map((v) => ({
    id: v.id,
    name: v.name,
    shortName: v.shortName,
    description: v.description,
    daysFromBirth: v.daysFromBirth,
    ageLabel: v.ageLabel,
    category: v.category,
    isCustom: false,
  }));

  // Merge: Firestore docs override static vaccines with matching ids; new ids appended
  const staticIds = new Set(staticVaccines.map((v) => v.id));
  const overrideMap = Object.fromEntries(firestoreVaccines.filter((v) => staticIds.has(v.id)).map((v) => [v.id, v]));
  const pureCustom = firestoreVaccines.filter((v) => !staticIds.has(v.id));
  const mergedStatic = staticVaccines.map((v) => overrideMap[v.id] ? { ...overrideMap[v.id], isCustom: false, isOverridden: true } : v);
  const allVaccines = [...mergedStatic, ...pureCustom].sort((a, b) => a.daysFromBirth - b.daysFromBirth);

  const customCount = pureCustom.length;
  const overrideCount = Object.keys(overrideMap).length;

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await getContent('vaccines');
    setFirestoreVaccines(data as VaccineItem[]);
    setLoading(false);
  }

  async function handleSave(data: Omit<VaccineItem, 'id'>) {
    if (editingVaccine) {
      const isExistingFirestore = firestoreVaccines.some((v) => v.id === editingVaccine.id);
      if (isExistingFirestore) {
        // Update existing Firestore doc (custom or override)
        await updateContent('vaccines', editingVaccine.id, data);
      } else {
        // Static vaccine being overridden for the first time — upsert with its static id
        await setContentById('vaccines', editingVaccine.id, data);
      }
      setFirestoreVaccines((prev) =>
        prev.some((v) => v.id === editingVaccine.id)
          ? prev.map((v) => v.id === editingVaccine.id ? { ...v, ...data } : v)
          : [...prev, { ...data, id: editingVaccine.id }]
      );
    } else {
      // New custom vaccine
      const newId = await createContent('vaccines', data);
      setFirestoreVaccines((prev) => [...prev, { ...data, id: newId ?? Date.now().toString(), isCustom: true }]);
    }
    setModalVisible(false);
    setEditingVaccine(null);
  }

  function confirmDelete(vaccine: VaccineItem) {
    Alert.alert('Delete Vaccine', `Remove "${vaccine.name}" from the custom schedule?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteContent('vaccines', vaccine.id);
          setFirestoreVaccines((prev) => prev.filter((v: VaccineItem) => v.id !== vaccine.id));
        },
      },
    ]);
  }

  const categoryColors: Record<string, string> = {
    'Birth Doses': '#7C3AED',
    'Primary Series': '#8b5cf6',
    'Booster Doses': '#10b981',
    'Optional': '#f59e0b',
    'Catch-up': '#06b6d4',
  };

  return (
    <View style={styles.container}>
      {/* Add button */}
      <View style={styles.addRow}>
        <Text style={styles.note}>
          <Ionicons name="information-circle-outline" size={13} color="#8b5cf6" /> {staticVaccines.length} IAP · {overrideCount} edited · {customCount} custom
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingVaccine(null); setModalVisible(true); }} activeOpacity={0.85}>
          <LinearGradient colors={['#10b981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addBtnGrad}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Custom</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#10b981" style={{ marginTop: 32 }} />
        ) : (
          allVaccines.map((v) => (
            <View key={`${v.id}-${v.isCustom}`} style={[styles.card, pureCustom.some(c=>c.id===v.id) && styles.cardCustom, (v as any).isOverridden && styles.cardOverridden]}>
              <View style={[styles.categoryDot, { backgroundColor: categoryColors[v.category] ?? '#9ca3af' }]} />
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{v.name}</Text>
                  {pureCustom.some((c) => c.id === v.id) && <View style={styles.customBadge}><Text style={styles.customBadgeText}>Custom</Text></View>}
                  {(v as any).isOverridden && <View style={[styles.customBadge, { backgroundColor: '#fef3c7' }]}><Text style={[styles.customBadgeText, { color: '#b45309' }]}>Edited</Text></View>}
                </View>
                <Text style={styles.sub}>{v.ageLabel} · {v.category}</Text>
                {v.description ? <Text style={styles.desc} numberOfLines={2}>{v.description}</Text> : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => { setEditingVaccine(v); setModalVisible(true); }} style={styles.actionBtn}>
                  <Ionicons name="pencil-outline" size={16} color="#8b5cf6" />
                </TouchableOpacity>
                {/* Only pure custom vaccines can be fully deleted; static overrides just keep the edit */}
                {pureCustom.some((c) => c.id === v.id) && (
                  <TouchableOpacity onPress={() => confirmDelete(v)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <VaccineFormModal
        visible={modalVisible}
        vaccine={editingVaccine}
        onClose={() => { setModalVisible(false); setEditingVaccine(null); }}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  note: { fontSize: 12, color: '#6b7280', flex: 1 },
  addBtn: { borderRadius: 10, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: 16 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  cardCustom: { borderColor: 'rgba(139,92,246,0.2)', backgroundColor: '#fdf6ff' },
  cardOverridden: { borderColor: 'rgba(245,158,11,0.3)', backgroundColor: '#fffbeb' },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 14, fontWeight: '700', color: '#1a1a2e', flex: 1 },
  customBadge: { backgroundColor: '#ede9fe', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  customBadgeText: { fontSize: 10, color: '#7c3aed', fontWeight: '700' },
  sub: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  desc: { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8 },
});
