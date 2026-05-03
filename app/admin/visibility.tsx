// Visibility control — single screen to flip every gateable surface in the
// app. Lives at /admin/visibility. Backed by app_config/runtime, with audit
// logging on every toggle.

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  ConfirmDialog,
  EmptyState,
  StatusBadge,
  ToolbarButton,
} from '../../components/admin/ui';
import { useAuthStore } from '../../store/useAuthStore';
import { useRuntimeConfigStore } from '../../store/useRuntimeConfigStore';
import {
  FEATURE_GROUPS,
  FEATURE_LABELS,
  FeatureKey,
  setFeatureFlag,
  setForceUpdate,
  setMaintenance,
  setModeration,
} from '../../services/featureFlags';

export default function AdminVisibilityScreen() {
  const user = useAuthStore((s) => s.user);
  const config = useRuntimeConfigStore((s) => s.config);
  const ready = useRuntimeConfigStore((s) => s.ready);

  // Subscribe at mount in case admin lands here before root finishes
  // (e.g. cold reload directly to /admin/visibility).
  useEffect(() => {
    useRuntimeConfigStore.getState().subscribe();
  }, []);

  const actor = useMemo(() => ({ uid: user?.uid ?? '', email: user?.email ?? null }), [user]);
  const canAct = !!actor.uid;

  // Confirmation modal for high-blast-radius actions.
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmBody, setConfirmBody] = useState<string | undefined>();
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [confirmRequireType, setConfirmRequireType] = useState<string | undefined>();

  function ask(opts: {
    title: string;
    body?: string;
    destructive?: boolean;
    requireType?: string;
    run: () => Promise<void>;
  }) {
    setConfirmTitle(opts.title);
    setConfirmBody(opts.body);
    setConfirmDestructive(!!opts.destructive);
    setConfirmRequireType(opts.requireType);
    setConfirmAction(() => opts.run);
  }

  async function toggleFeature(key: FeatureKey, next: boolean) {
    const apply = async () => {
      try {
        await setFeatureFlag(key, { enabled: next }, actor);
      } catch (e: any) {
        Alert.alert('Could not update flag', e?.message ?? String(e));
      }
    };
    // Toggling Community / chat off affects all users — confirm.
    if (!next && (key === 'community' || key === 'chat' || key === 'messaging' || key === 'wellness')) {
      ask({
        title: `Turn off ${FEATURE_LABELS[key]}?`,
        body: `Every user will immediately lose access. Turn it back on at any time from this screen.`,
        destructive: true,
        run: apply,
      });
      return;
    }
    await apply();
  }

  async function changeRollout(key: FeatureKey, pct: number) {
    try {
      await setFeatureFlag(key, { rolloutPct: Math.max(0, Math.min(100, Math.round(pct))) }, actor);
    } catch (e: any) {
      Alert.alert('Could not update rollout', e?.message ?? String(e));
    }
  }

  async function applyMaintenance(next: boolean) {
    if (next) {
      ask({
        title: 'Enable maintenance mode?',
        body: 'All non-admin users will see a full-screen maintenance message and the app will be unusable until you turn this off.',
        destructive: true,
        requireType: 'MAINTENANCE',
        run: async () => {
          try { await setMaintenance({ enabled: true }, actor); }
          catch (e: any) { Alert.alert('Failed', e?.message ?? String(e)); }
        },
      });
    } else {
      try { await setMaintenance({ enabled: false }, actor); }
      catch (e: any) { Alert.alert('Failed', e?.message ?? String(e)); }
    }
  }

  if (!ready) {
    return (
      <AdminPage title="Visibility" loading description="Loading runtime config…" />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Visibility' }} />
      <AdminPage
        title="Visibility & feature flags"
        description="Flip features on or off across the live app. Changes apply within seconds — every client subscribes to runtime config."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Visibility' }]}
      >
        {/* ─── Maintenance mode ─────────────────────────────────────── */}
        <Section
          title="Maintenance mode"
          subtitle="Take the app offline for everyone except admins. Use during deploys or to stop traffic during an incident."
          danger={config.maintenance.enabled}
        >
          <ToggleRow
            label="Enable maintenance"
            sub={config.maintenance.enabled ? 'App is currently OFFLINE for all non-admin users.' : 'App is live for all users.'}
            value={config.maintenance.enabled}
            onChange={applyMaintenance}
            disabled={!canAct}
          />
          <FieldRow
            label="Title"
            value={config.maintenance.title}
            onSubmit={(v) => setMaintenance({ title: v }, actor)}
          />
          <FieldRow
            label="Message"
            multiline
            value={config.maintenance.message}
            onSubmit={(v) => setMaintenance({ message: v }, actor)}
          />
          <ToggleRow
            label="Allow read-only access"
            sub="When on, users can still load the app but can't post, comment, or message."
            value={config.maintenance.allowReadOnly}
            onChange={(v) => setMaintenance({ allowReadOnly: v }, actor)}
            disabled={!canAct}
          />
        </Section>

        {/* ─── Force update ─────────────────────────────────────────── */}
        <Section
          title="Force update"
          subtitle="Block users on app builds older than this from using the app. Native only — web is always current."
        >
          <ToggleRow
            label="Enforce minimum build"
            value={config.forceUpdate.enabled}
            onChange={(v) => setForceUpdate({ enabled: v }, actor)}
            disabled={!canAct}
          />
          <FieldRow
            label="Min build number"
            keyboard="number-pad"
            value={String(config.forceUpdate.minBuildNumber)}
            onSubmit={(v) => {
              const n = parseInt(v, 10);
              if (!Number.isFinite(n)) return;
              return setForceUpdate({ minBuildNumber: n }, actor);
            }}
          />
          <FieldRow
            label="Title"
            value={config.forceUpdate.title}
            onSubmit={(v) => setForceUpdate({ title: v }, actor)}
          />
          <FieldRow
            label="Message"
            multiline
            value={config.forceUpdate.message}
            onSubmit={(v) => setForceUpdate({ message: v }, actor)}
          />
        </Section>

        {/* ─── Moderation ───────────────────────────────────────────── */}
        <Section
          title="Moderation policy"
          subtitle="Switch new posts into a pending queue and define keyword auto-hide rules."
        >
          <ToggleRow
            label="Require approval for new posts"
            sub="When on, new community posts wait in /admin/community pending queue until approved."
            value={config.moderation.requireApproval}
            onChange={(v) => setModeration({ requireApproval: v }, actor)}
            disabled={!canAct}
          />
          <KeywordList
            label="Auto-hide keywords"
            sub="Comma-separated. Posts containing any of these are auto-hidden and routed to the moderation queue."
            value={config.moderation.autoHideKeywords}
            onSubmit={(arr) => setModeration({ autoHideKeywords: arr }, actor)}
          />
        </Section>

        {/* ─── Feature flags grouped ────────────────────────────────── */}
        {FEATURE_GROUPS.map((group) => (
          <Section
            key={group.label}
            title={group.label}
            subtitle="Toggle individual surfaces. Off = hidden from end users; admins still see everything for QA."
          >
            {group.keys.map((k) => {
              const f = config.features[k];
              return (
                <View key={k} style={styles.flagRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.flagHeader}>
                      <Text style={styles.flagLabel}>{FEATURE_LABELS[k]}</Text>
                      {f.enabled ? (
                        f.rolloutPct === 100
                          ? <StatusBadge label="Live" color={Colors.success} />
                          : <StatusBadge label={`${f.rolloutPct}% rollout`} color={Colors.warning} />
                      ) : (
                        <StatusBadge label="Off" color={Colors.textMuted} />
                      )}
                      {f.audience !== 'all' ? (
                        <StatusBadge label={f.audience === 'admins' ? 'Admins only' : 'Beta'} color={Colors.primary} variant="outline" />
                      ) : null}
                    </View>
                    {f.enabled ? (
                      <RolloutSlider
                        value={f.rolloutPct}
                        onChange={(v) => changeRollout(k, v)}
                      />
                    ) : null}
                  </View>
                  <Switch
                    value={f.enabled}
                    onValueChange={(v) => toggleFeature(k, v)}
                    disabled={!canAct}
                    thumbColor={Colors.white}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                  />
                </View>
              );
            })}
          </Section>
        ))}

        {!canAct ? (
          <EmptyState
            kind="error"
            title="Sign in required"
            body="You must be signed in as an admin to flip flags from this screen."
          />
        ) : null}
      </AdminPage>

      <ConfirmDialog
        visible={!!confirmAction}
        title={confirmTitle}
        body={confirmBody}
        destructive={confirmDestructive}
        requireType={confirmRequireType}
        confirmLabel="Apply"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const fn = confirmAction;
          setConfirmAction(null);
          if (fn) await fn();
        }}
      />
    </>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────
function Section({ title, subtitle, danger, children }: {
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, danger && styles.sectionDanger]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({ label, sub, value, onChange, disabled }: {
  label: string;
  sub?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        thumbColor={Colors.white}
        trackColor={{ false: Colors.border, true: Colors.primary }}
      />
    </View>
  );
}

function FieldRow({ label, value, onSubmit, multiline, keyboard }: {
  label: string;
  value: string;
  onSubmit: (v: string) => Promise<any> | void;
  multiline?: boolean;
  keyboard?: 'default' | 'number-pad';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowSub} numberOfLines={multiline ? 3 : 1}>{value || '—'}</Text>
        </View>
        <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
          <Ionicons name="create-outline" size={16} color={Colors.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline={multiline}
          keyboardType={keyboard ?? 'default'}
          style={[styles.input, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
          autoFocus
        />
        <View style={styles.editActions}>
          <ToolbarButton label="Cancel" variant="ghost" onPress={() => { setDraft(value); setEditing(false); }} />
          <ToolbarButton
            label="Save"
            variant="primary"
            onPress={async () => {
              await onSubmit(draft);
              setEditing(false);
            }}
          />
        </View>
      </View>
    </View>
  );
}

function KeywordList({ label, sub, value, onSubmit }: {
  label: string;
  sub?: string;
  value: string[];
  onSubmit: (arr: string[]) => Promise<any> | void;
}) {
  const [draft, setDraft] = useState(value.join(', '));
  useEffect(() => { setDraft(value.join(', ')); }, [value]);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          style={[styles.input, { minHeight: 56, textAlignVertical: 'top' }]}
          multiline
          placeholder="word1, word2, …"
          placeholderTextColor={Colors.textMuted}
        />
        <View style={styles.editActions}>
          <ToolbarButton
            label="Save list"
            variant="primary"
            icon="save-outline"
            onPress={() => {
              const arr = draft
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              return onSubmit(arr);
            }}
          />
        </View>
      </View>
    </View>
  );
}

function RolloutSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const presets = [0, 10, 25, 50, 75, 100];
  return (
    <View style={styles.rolloutRow}>
      <Text style={styles.rolloutLabel}>Rollout</Text>
      {presets.map((p) => (
        <Pressable
          key={p}
          onPress={() => onChange(p)}
          style={[styles.rolloutChip, value === p && styles.rolloutChipActive]}
        >
          <Text style={[styles.rolloutChipText, value === p && styles.rolloutChipTextActive]}>
            {p}%
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  sectionDanger: { borderColor: Colors.error },
  sectionHeader: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  sectionSub: { fontSize: FontSize.sm, color: Colors.textLight, marginTop: 4, lineHeight: 19 },
  sectionBody: { padding: Spacing.md, gap: 4 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  rowLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, marginBottom: 2 },
  rowSub: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 17 },

  flagRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  flagHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    flexWrap: 'wrap', marginBottom: 6,
  },
  flagLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },

  rolloutRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    marginTop: 4,
  },
  rolloutLabel: { fontSize: FontSize.xs, color: Colors.textLight, marginRight: 4 },
  rolloutChip: {
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  rolloutChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rolloutChipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  rolloutChipTextActive: { color: Colors.white },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
  },
  editBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  input: {
    marginTop: 6,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    fontSize: FontSize.sm, color: Colors.textDark,
    backgroundColor: Colors.bgLight,
  },
  editActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm,
    marginTop: 8,
  },
});
