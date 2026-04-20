/**
 * Admin — Push Notifications
 * Compose and send targeted push notifications to all users or specific segments.
 * Uses Expo Push Notification API via a server-side call to Firestore trigger.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createContent } from '../../services/firebase';
import { Colors } from '../../constants/theme';

type Audience = 'all' | 'pregnant' | 'newborn' | 'toddler';
type NotifType = 'info' | 'reminder' | 'alert' | 'celebration';

const AUDIENCE_OPTIONS: { key: Audience; label: string; icon: string; desc: string }[] = [
  { key: 'all',      label: 'All Users',       icon: 'people-outline',       desc: 'Every registered user' },
  { key: 'pregnant', label: 'Expecting Moms',  icon: 'heart-outline',        desc: 'Users with pregnancy profile' },
  { key: 'newborn',  label: 'Newborn Parents', icon: 'baby-outline',         desc: 'Babies under 6 months' },
  { key: 'toddler',  label: 'Toddler Parents', icon: 'walk-outline',         desc: 'Kids 1–3 years old' },
];

const TYPE_OPTIONS: { key: NotifType; label: string; emoji: string; color: string }[] = [
  { key: 'info',        label: 'Info',        emoji: '💬', color: '#6b7280' },
  { key: 'reminder',    label: 'Reminder',    emoji: '⏰', color: '#8b5cf6' },
  { key: 'alert',       label: 'Alert',       emoji: '🚨', color: '#ef4444' },
  { key: 'celebration', label: 'Celebration', emoji: '🎉', color: Colors.primary },
];

const QUICK_TEMPLATES = [
  { title: 'Vaccine Reminder', body: 'Your baby\'s next vaccine appointment may be coming up soon. Check your schedule in MaaMitra 💉' },
  { title: 'New Article', body: 'We just added new articles to the library — curated for your baby\'s age. Tap to read 📚' },
  { title: 'Community Tip', body: 'Mothers in your community are sharing helpful tips today. Join the conversation! 👥' },
  { title: 'Wellness Check', body: 'How are you feeling today? Log your mood in the Wellness tab and track your wellbeing 💙' },
  { title: 'New Government Scheme', body: 'A new benefit scheme is available for mothers in India. Check the Health tab for details 🇮🇳' },
];

// ─── History Item ─────────────────────────────────────────────────────────────

interface NotifRecord {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  type: NotifType;
  sentAt: string;
  status: 'sent' | 'scheduled' | 'failed';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [type, setType] = useState<NotifType>('info');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<NotifRecord[]>([]);

  const isValid = title.trim().length > 0 && body.trim().length > 0;

  function applyTemplate(tpl: typeof QUICK_TEMPLATES[0]) {
    setTitle(tpl.title);
    setBody(tpl.body);
  }

  async function handleSend() {
    if (!isValid) return;
    Alert.alert(
      'Send Notification',
      `Send "${title}" to ${AUDIENCE_OPTIONS.find((a) => a.key === audience)?.label}?\n\nThis will appear as a push notification on all matching devices.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Now',
          onPress: async () => {
            setSending(true);
            const payload = {
              title,
              body,
              audience,
              type,
              scheduleDate: scheduleEnabled ? scheduleDate : null,
              sentAt: new Date().toISOString(),
              status: 'sent',
            };
            // Save to Firestore — a Cloud Function / backend picks this up and dispatches via Expo Push API
            await createContent('push_notifications', payload);
            setSent((prev) => [
              { ...payload, id: Date.now().toString(), status: 'sent' as const },
              ...prev,
            ]);
            setTitle('');
            setBody('');
            setSending(false);
            Alert.alert('✅ Notification Queued', 'The push notification has been saved. Make sure your backend Cloud Function is deployed to dispatch it via Expo Push API.');
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#8b5cf6" />
        <Text style={styles.infoText}>
          Notifications are queued in Firestore. A backend Cloud Function or Expo push service must be deployed to dispatch them to devices.
        </Text>
      </View>

      {/* Compose */}
      <Text style={styles.sectionTitle}>Compose</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Vaccine Reminder"
          placeholderTextColor="#9ca3af"
          maxLength={60}
        />
        <Text style={styles.charCount}>{title.length}/60</Text>

        <Text style={styles.fieldLabel}>Message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="Write your message here…"
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={200}
        />
        <Text style={styles.charCount}>{body.length}/200</Text>
      </View>

      {/* Quick Templates */}
      <Text style={styles.sectionTitle}>Quick Templates</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll} contentContainerStyle={styles.templateRow}>
        {QUICK_TEMPLATES.map((t) => (
          <TouchableOpacity key={t.title} style={styles.templateChip} onPress={() => applyTemplate(t)} activeOpacity={0.75}>
            <Text style={styles.templateText}>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notification Type */}
      <Text style={styles.sectionTitle}>Type</Text>
      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.typeChip, type === t.key && { backgroundColor: t.color + '18', borderColor: t.color, borderWidth: 1.5 }]}
            onPress={() => setType(t.key)}
            activeOpacity={0.75}
          >
            <Text style={styles.typeEmoji}>{t.emoji}</Text>
            <Text style={[styles.typeLabel, type === t.key && { color: t.color }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Audience */}
      <Text style={styles.sectionTitle}>Audience</Text>
      <View style={styles.card}>
        {AUDIENCE_OPTIONS.map((a, i) => (
          <View key={a.key}>
            <TouchableOpacity
              style={styles.audienceRow}
              onPress={() => setAudience(a.key)}
              activeOpacity={0.75}
            >
              <View style={[styles.audienceIcon, audience === a.key && { backgroundColor: Colors.primary }]}>
                <Ionicons name={a.icon as any} size={16} color={audience === a.key ? '#fff' : '#9ca3af'} />
              </View>
              <View style={styles.audienceInfo}>
                <Text style={styles.audienceLabel}>{a.label}</Text>
                <Text style={styles.audienceDesc}>{a.desc}</Text>
              </View>
              <View style={[styles.radio, audience === a.key && styles.radioActive]}>
                {audience === a.key && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
            {i < AUDIENCE_OPTIONS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>

      {/* Schedule */}
      <View style={styles.scheduleRow}>
        <View>
          <Text style={styles.sectionTitle}>Schedule for Later</Text>
          <Text style={styles.scheduleSub}>Send at a specific date/time</Text>
        </View>
        <Switch
          value={scheduleEnabled}
          onValueChange={setScheduleEnabled}
          trackColor={{ false: '#e5e7eb', true: Colors.primary }}
          thumbColor="#fff"
        />
      </View>

      {scheduleEnabled && (
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Date & Time (YYYY-MM-DD HH:MM)</Text>
          <TextInput
            style={styles.input}
            value={scheduleDate}
            onChangeText={setScheduleDate}
            placeholder="e.g. 2026-05-01 09:00"
            placeholderTextColor="#9ca3af"
          />
        </View>
      )}

      {/* Send Button */}
      <TouchableOpacity
        style={[styles.sendBtn, !isValid && styles.sendBtnDim]}
        onPress={handleSend}
        disabled={!isValid || sending}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[Colors.primary, '#8b5cf6']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.sendBtnGrad}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Ionicons name="send" size={16} color="#fff" /><Text style={styles.sendBtnText}>Send Notification</Text></>
          }
        </LinearGradient>
      </TouchableOpacity>

      {/* History */}
      {sent.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sent This Session</Text>
          {sent.map((n) => (
            <View key={n.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>{n.title}</Text>
                <View style={styles.sentBadge}><Text style={styles.sentBadgeText}>Sent</Text></View>
              </View>
              <Text style={styles.historyBody} numberOfLines={2}>{n.body}</Text>
              <Text style={styles.historyMeta}>
                {AUDIENCE_OPTIONS.find((a) => a.key === n.audience)?.label} · {new Date(n.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 16 },

  infoBanner: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#ede9fe', borderRadius: 12, padding: 12, marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 12, color: '#5b21b6', lineHeight: 17 },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a2e', marginBottom: 10, marginTop: 16 },

  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#f3f4f6', padding: 14, marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 10, fontSize: 14, color: '#1a1a2e', borderWidth: 1, borderColor: '#e5e7eb' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: '#d1d5db', textAlign: 'right', marginTop: 4, marginBottom: 2 },

  templateScroll: { marginBottom: 4 },
  templateRow: { gap: 8, paddingBottom: 4 },
  templateChip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  templateText: { fontSize: 13, color: '#374151', fontWeight: '600' },

  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  typeChip: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  typeEmoji: { fontSize: 18 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280' },

  audienceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  audienceIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  audienceInfo: { flex: 1 },
  audienceLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  audienceDesc: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: Colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  divider: { height: 1, backgroundColor: '#f9fafb' },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  scheduleSub: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },

  sendBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20 },
  sendBtnDim: { opacity: 0.4 },
  sendBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  sendBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  historyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  sentBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  sentBadgeText: { fontSize: 11, color: '#16a34a', fontWeight: '700' },
  historyBody: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 6 },
  historyMeta: { fontSize: 11, color: '#9ca3af' },
});
