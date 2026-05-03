/**
 * Admin · Roles & capabilities.
 *
 * Wave 7. Read-only view of the four built-in roles + capability matrix.
 * Plus a CRUD surface for defining ADDITIONAL custom roles (e.g. viewer,
 * ops) stored in admin_roles. Wiring custom roles into the
 * client-side can() check is a follow-up — see services/customRoles.ts.
 */
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  AdminPage,
  ConfirmDialog,
  StatusBadge,
  ToolbarButton,
} from '../../components/admin/ui';
import {
  AdminCapability,
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  AdminRole,
  can,
} from '../../lib/admin';
import { useAdminRole } from '../../lib/useAdminRole';
import { useAuthStore } from '../../store/useAuthStore';
import {
  CustomRole,
  deleteCustomRole,
  listCustomRoles,
  upsertCustomRole,
} from '../../services/customRoles';

const ALL_CAPABILITIES: { key: AdminCapability; label: string; group: string }[] = [
  { key: 'view_dashboard',         label: 'View dashboard',           group: 'Read' },
  { key: 'view_users',             label: 'View users list',          group: 'Read' },
  { key: 'view_user_360',          label: 'View user 360',            group: 'Read' },
  { key: 'view_audit_log',         label: 'View audit log',           group: 'Read' },
  { key: 'view_support',           label: 'View support inbox',       group: 'Read' },

  { key: 'moderate_posts',         label: 'Moderate posts',           group: 'Moderation' },
  { key: 'moderate_comments',      label: 'Moderate comments',        group: 'Moderation' },
  { key: 'block_user',             label: 'Block user',               group: 'Moderation' },

  { key: 'reply_support',          label: 'Reply to tickets',         group: 'Support' },
  { key: 'close_ticket',           label: 'Close / reopen tickets',   group: 'Support' },

  { key: 'send_personal_push',     label: 'Send personal push',       group: 'Notifications' },
  { key: 'send_broadcast_push',    label: 'Send broadcast push',      group: 'Notifications' },
  { key: 'schedule_push',          label: 'Schedule push',            group: 'Notifications' },
  { key: 'manage_banner',          label: 'Manage in-app banner',     group: 'Notifications' },

  { key: 'edit_content',           label: 'Edit content library',     group: 'Content' },
  { key: 'edit_vaccines',          label: 'Edit vaccine schedule',    group: 'Content' },
  { key: 'publish_content',        label: 'Publish content',          group: 'Content' },

  { key: 'edit_settings',          label: 'Edit app settings',        group: 'Org' },
  { key: 'manage_feature_flags',   label: 'Toggle feature flags',     group: 'Org' },
  { key: 'manage_admin_roles',     label: 'Manage admin roles',       group: 'Org' },
  { key: 'change_user_role',       label: 'Change parent role',       group: 'Org' },
  { key: 'export_user_data',       label: 'DSAR export',              group: 'Org' },

  { key: 'delete_user',            label: 'Soft-delete user',         group: 'Destructive' },
  { key: 'hard_delete_user',       label: 'Hard-delete user',         group: 'Destructive' },
];

const CAPABILITY_GROUPS = Array.from(new Set(ALL_CAPABILITIES.map((c) => c.group)));

export default function RolesScreen() {
  const { user: actor } = useAuthStore();
  const role = useAdminRole();
  const canManage = can(role, 'manage_admin_roles');

  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CustomRole | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCustomRoles(await listCustomRoles());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(payload: { key: string; label: string; description: string; capabilities: AdminCapability[] }) {
    if (!actor) return;
    try {
      await upsertCustomRole(actor, payload);
      await load();
      setEditing(null);
      setCreating(false);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function handleDelete(r: CustomRole) {
    if (!actor) return;
    try {
      await deleteCustomRole(actor, r.key);
      setCustomRoles((prev) => prev.filter((x) => x.key !== r.key));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setConfirmDel(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Roles & capabilities' }} />
      <AdminPage
        title="Roles & capabilities"
        description="The four built-in roles are baked into lib/admin.ts and reflect the long-standing capability matrix. Define additional custom roles below — they're stored in admin_roles and can be assigned to users from the user 360."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Roles' }]}
        headerActions={
          canManage ? (
            <>
              <ToolbarButton label="Refresh" icon="refresh" onPress={load} />
              <ToolbarButton label="New custom role" icon="add" variant="primary" onPress={() => { setEditing(null); setCreating(true); }} />
            </>
          ) : null
        }
        error={error}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Built-in roles</Text>
          <View style={styles.matrixCard}>
            <View style={styles.matrixHeader}>
              <Text style={[styles.matrixCell, styles.matrixCellHead, { flex: 2 }]}>Capability</Text>
              {ADMIN_ROLES.map((r) => (
                <Text key={r} style={[styles.matrixCell, styles.matrixCellHead, { flex: 1, textAlign: 'center' }]}>
                  {ADMIN_ROLE_LABELS[r]}
                </Text>
              ))}
            </View>
            {CAPABILITY_GROUPS.map((g) => (
              <View key={g}>
                <Text style={styles.groupLabel}>{g}</Text>
                {ALL_CAPABILITIES.filter((c) => c.group === g).map((c) => (
                  <View key={c.key} style={styles.matrixRow}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.capLabel}>{c.label}</Text>
                      <Text style={styles.capKey}>{c.key}</Text>
                    </View>
                    {ADMIN_ROLES.map((r) => {
                      const has = can(r, c.key);
                      return (
                        <View key={r} style={[styles.matrixCell, { flex: 1, alignItems: 'center' }]}>
                          {has ? (
                            <View style={styles.dotOn} />
                          ) : (
                            <View style={styles.dotOff} />
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Custom roles</Text>
          {loading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : customRoles.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No custom roles yet</Text>
              <Text style={styles.emptyBody}>
                Define a role like "viewer" (read-only) or "ops" (cron + Functions replay) to broaden the team without granting super-admin.
              </Text>
            </View>
          ) : customRoles.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => canManage && setEditing(r)}
              style={styles.customRoleCard}
            >
              <View style={styles.customRoleHead}>
                <Text style={styles.customRoleLabel}>{r.label}</Text>
                <Text style={styles.customRoleKey}>{r.key}</Text>
                <StatusBadge label={`${r.capabilities.length} caps`} color={Colors.primary} />
              </View>
              {r.description ? <Text style={styles.customRoleDesc}>{r.description}</Text> : null}
              <View style={styles.capChipRow}>
                {r.capabilities.slice(0, 8).map((c) => (
                  <View key={c} style={styles.capChip}><Text style={styles.capChipText}>{c}</Text></View>
                ))}
                {r.capabilities.length > 8 ? <Text style={styles.capChipText}>+{r.capabilities.length - 8} more</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </AdminPage>

      <CustomRoleEditor
        visible={creating || !!editing}
        role={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSave={handleSave}
        onDelete={editing ? () => setConfirmDel(editing) : undefined}
      />

      <ConfirmDialog
        visible={!!confirmDel}
        title="Delete custom role?"
        body={confirmDel ? `Remove "${confirmDel.label}" (${confirmDel.key}). Users currently assigned this role will fall back to "no admin role" until reassigned.` : ''}
        destructive
        confirmLabel="Delete"
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) await handleDelete(confirmDel); }}
      />
    </>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────
function CustomRoleEditor({ visible, role, onClose, onSave, onDelete }: {
  visible: boolean;
  role: CustomRole | null;
  onClose: () => void;
  onSave: (p: { key: string; label: string; description: string; capabilities: AdminCapability[] }) => Promise<void>;
  onDelete?: () => void;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [caps, setCaps] = useState<Set<AdminCapability>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setKey(role?.key ?? '');
    setLabel(role?.label ?? '');
    setDescription(role?.description ?? '');
    setCaps(new Set(role?.capabilities ?? []));
    setSaving(false);
  }, [role, visible]);

  function toggleCap(c: AdminCapability) {
    const next = new Set(caps);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setCaps(next);
  }

  async function save() {
    if (!key.trim() || !label.trim()) return;
    setSaving(true);
    try {
      await onSave({
        key: key.trim(),
        label: label.trim(),
        description: description.trim(),
        capabilities: Array.from(caps),
      });
    } finally { setSaving(false); }
  }

  const isEdit = !!role;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isEdit ? `Edit ${role?.label}` : 'New custom role'}</Text>
            <Pressable onPress={onClose} hitSlop={6} style={styles.modalClose}>
              <Text style={{ fontSize: 18, color: Colors.textDark }}>×</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Key (slug) *</Text>
            <Text style={styles.fieldHint}>Lowercase, alphanumeric + dashes / underscores. Cannot be one of the built-ins.</Text>
            <TextInput
              style={styles.fieldInput}
              value={key}
              onChangeText={setKey}
              placeholder="e.g. viewer, ops"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              editable={!isEdit}
            />

            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Display label *</Text>
            <TextInput
              style={styles.fieldInput}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Read-only viewer"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { marginTop: Spacing.md }]}>Description</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 60, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Who is this role for?"
              placeholderTextColor={Colors.textMuted}
              multiline
            />

            <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Capabilities ({caps.size} selected)</Text>
            {CAPABILITY_GROUPS.map((g) => (
              <View key={g} style={{ marginTop: Spacing.sm }}>
                <Text style={styles.groupLabel}>{g}</Text>
                {ALL_CAPABILITIES.filter((c) => c.group === g).map((c) => {
                  const on = caps.has(c.key);
                  return (
                    <Pressable
                      key={c.key}
                      onPress={() => toggleCap(c.key)}
                      style={styles.capCheckRow}
                    >
                      <View style={[styles.checkbox, on && styles.checkboxOn]}>
                        {on ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.capLabel}>{c.label}</Text>
                        <Text style={styles.capKey}>{c.key}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            {onDelete ? <ToolbarButton label="Delete" icon="trash-outline" variant="danger" onPress={onDelete} /> : null}
            <View style={{ flex: 1 }} />
            <ToolbarButton label="Cancel" variant="ghost" onPress={onClose} disabled={saving} />
            <ToolbarButton
              label={saving ? 'Saving…' : (isEdit ? 'Update role' : 'Create role')}
              variant="primary"
              icon="save-outline"
              onPress={save}
              disabled={!key.trim() || !label.trim() || saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 1.2, textTransform: 'uppercase' },
  muted: { fontSize: FontSize.sm, color: Colors.textMuted },

  matrixCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  matrixHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgLight,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  matrixRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  matrixCell: { paddingHorizontal: 4 },
  matrixCellHead: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  groupLabel: {
    fontSize: 10, fontWeight: '800', color: Colors.primary,
    letterSpacing: 1.4, textTransform: 'uppercase',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4,
    backgroundColor: Colors.primarySoft,
  },
  capLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textDark },
  capKey: { fontSize: 10, color: Colors.textMuted, fontFamily: 'DMMono_400Regular', marginTop: 1 },
  dotOn: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  dotOff: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.borderSoft },

  emptyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft, borderStyle: 'dashed',
    gap: 6,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  emptyBody: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 19 },

  customRoleCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 6,
    ...Shadow.sm,
  },
  customRoleHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  customRoleLabel: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textDark },
  customRoleKey: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'DMMono_400Regular' },
  customRoleDesc: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 19 },
  capChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  capChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.borderSoft },
  capChipText: { fontSize: 10, color: Colors.textDark, fontFamily: 'DMMono_400Regular' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,16,51,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  modalCard: { width: '100%', maxWidth: 640, maxHeight: '92%', backgroundColor: Colors.cardBg, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textDark },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: Spacing.xl },
  modalFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderSoft },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  fieldInput: {
    backgroundColor: Colors.bgLight, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.sm, color: Colors.textDark,
    borderWidth: 1, borderColor: Colors.border,
  },

  capCheckRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 8, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.cardBg,
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkboxMark: { color: Colors.white, fontSize: 12, fontWeight: '800' },
});
