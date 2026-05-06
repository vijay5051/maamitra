/**
 * Marketing Settings hub.
 *
 * Studio v2 redesign: a single Settings page split into three sections —
 * Daily knobs (the toggles admin actually touches week-to-week),
 * Setup (the brand kit / strategy / style profile rarely-touched config),
 * and Advanced (template preview + diagnostics).
 *
 * Every "edit" button deep-links into an existing legacy screen so this
 * stays a thin hub — no logic duplication.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import {
  fetchBrandKit,
  probeMarketingHealthNow,
  saveBrandKit,
  subscribeBrandKit,
  subscribeMarketingHealth,
} from '../../../services/marketing';
import { friendlyError } from '../../../services/marketingErrors';
import {
  BrandKit,
  ChannelHealth,
  DEFAULT_STYLE_PROFILE,
  MarketingHealth,
  StyleProfile,
} from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

export default function MarketingSettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [health, setHealth] = useState<MarketingHealth | null>(null);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchBrandKit().then((k) => { setBrand(k); setLoading(false); });
    const unsubBrand = subscribeBrandKit(setBrand);
    const unsubHealth = subscribeMarketingHealth(setHealth);
    return () => { unsubBrand(); unsubHealth(); };
  }, []);

  const showBanner = useCallback((tone: 'ok' | 'err', text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 2400);
  }, []);

  async function update(label: string, patch: Partial<BrandKit>) {
    if (!user || !brand) return;
    setSaving(label);
    try {
      await saveBrandKit({ uid: user.uid, email: user.email }, patch);
      showBanner('ok', 'Saved');
    } catch {
      showBanner('err', "Couldn't save — try again");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
      >
        {banner ? (
          <View style={[styles.banner, banner.tone === 'err' && styles.bannerErr]}>
            <Ionicons
              name={banner.tone === 'ok' ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={banner.tone === 'ok' ? Colors.success : Colors.error}
            />
            <Text style={[styles.bannerText, banner.tone === 'err' && { color: Colors.error }]}>{banner.text}</Text>
          </View>
        ) : null}

        <Card>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Ionicons name="settings-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Workspace settings</Text>
          </View>
          <Text style={styles.cardBody}>
            Keep planning in Content Planner. Use Settings for brand setup, connected accounts, visual direction, templates, and spend controls.
          </Text>
          <View style={styles.settingsQuickRow}>
            <MiniNavPill
              icon="calendar-clear-outline"
              label="Open planner"
              onPress={() => router.push('/admin/marketing/calendar' as any)}
            />
            <MiniNavPill
              icon="stats-chart-outline"
              label="View analytics"
              onPress={() => router.push('/admin/marketing/analytics' as any)}
            />
          </View>
        </Card>

        <SectionHead title="Core setup" subtitle="The essentials that shape every post." />

        <NavCard
          icon="calendar-clear-outline"
          title="Content Planner"
          body="Auto scheduler, slot timings, weekly rhythm, cultural calendar, and crisis pause now live in one place."
          onPress={() => router.push('/admin/marketing/calendar' as any)}
        />

        <Card>
          <View style={styles.cardHead}>
            <View style={styles.cardIcon}>
              <Ionicons name="link-outline" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Connected accounts</Text>
            <Pressable
              disabled={recheckBusy}
              onPress={async () => {
                setRecheckBusy(true);
                try {
                  const out = await probeMarketingHealthNow();
                  showBanner(
                    out.ig.ok && out.fb.ok ? 'ok' : 'err',
                    out.ig.ok && out.fb.ok
                      ? 'Both connections are live.'
                      : `IG ${out.ig.ok ? 'OK' : '✕'} • FB ${out.fb.ok ? 'OK' : '✕'}`,
                  );
                } catch (e: any) {
                  showBanner('err', friendlyError('Re-check connections', e));
                } finally {
                  setRecheckBusy(false);
                }
              }}
              style={styles.editLink}
            >
              {recheckBusy ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.editLinkLabel}>Re-check now</Text>
              )}
            </Pressable>
          </View>
          <View style={{ gap: 8, marginTop: 8 }}>
            <ConnectionRow platform="Instagram" channel={health?.ig ?? null} pending={health === null} fallbackHandle="maamitra.official" />
            <ConnectionRow platform="Facebook Page" channel={health?.fb ?? null} pending={health === null} fallbackHandle="MaaMitra" />
          </View>
          <Text style={styles.cardHint}>
            {health?.lastCheckedAt
              ? `Checked ${formatRelative(health.lastCheckedAt)}. Re-checks every hour automatically.`
              : 'Waiting for first probe — re-check now to populate.'}
          </Text>
        </Card>

        <NavCard
          icon="color-palette-outline"
          title="Brand kit"
          body={brand?.logoUrl ? `${brand.brandName} • logo + palette + voice set.` : 'Add your logo, palette, and voice — drives every generated post.'}
          status={brand?.logoUrl ? 'done' : 'pending'}
          onPress={() => router.push('/admin/marketing/brand-kit' as any)}
        />

        <NavCard
          icon="people-outline"
          title="Strategy and calendar"
          body={
            (brand?.personas?.length ?? 0) > 0
              ? `${brand?.personas.length} personas • ${brand?.pillars.length} pillars • ${brand?.culturalCalendar.length} events`
              : 'Define audience personas, content pillars, cultural calendar, compliance.'
          }
          status={(brand?.personas?.length ?? 0) > 0 ? 'done' : 'pending'}
          onPress={() => router.push('/admin/marketing/strategy' as any)}
        />

        <StyleProfileEditor
          profile={brand?.styleProfile ?? DEFAULT_STYLE_PROFILE}
          loading={loading || saving === 'style'}
          onSave={async (next) => update('style', { styleProfile: next })}
        />

        <SectionHead title="Production tools" subtitle="The supporting controls your team may need occasionally." />

        <NavCard
          icon="image-outline"
          title="Templates and preview"
          body="Add or test template-driven posts before they go into the team’s manual or automated workflow."
          onPress={() => router.push('/admin/marketing/preview' as any)}
        />

        <NavCard
          icon="receipt-outline"
          title="Cost log"
          body={`Daily cap ₹${brand?.costCaps?.dailyInr ?? 0} • monthly ₹${brand?.costCaps?.monthlyInr ?? 0}. Tap to edit cost caps in Strategy.`}
          onPress={() => router.push('/admin/marketing/strategy' as any)}
        />

        <NavCard
          icon="bar-chart-outline"
          title="Analytics"
          body="Review reach, post performance, and trends without cluttering the main workflow."
          onPress={() => router.push('/admin/marketing/analytics' as any)}
        />
      </ScrollView>
    </>
  );
}

// ── Small components ────────────────────────────────────────────────────────

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginTop: Spacing.md, marginBottom: 4 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function CardHead({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.cardHead}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={16} color={Colors.primary} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
  );
}

function MiniNavPill({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.settingsMiniPill}>
      <Ionicons name={icon} size={14} color={Colors.primary} />
      <Text style={styles.settingsMiniPillLabel}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  icon, title, body, on, loading, disabled, onToggle, tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  on: boolean;
  loading: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
  tone?: 'default' | 'warn';
}) {
  return (
    <Pressable
      onPress={() => !disabled && !loading && onToggle(!on)}
      style={[styles.toggleRow, on && tone === 'warn' && styles.toggleRowWarn, on && tone !== 'warn' && styles.toggleRowOn]}
    >
      <View style={[styles.cardIcon, on && tone !== 'warn' && { backgroundColor: Colors.primary }, on && tone === 'warn' && { backgroundColor: Colors.error }]}>
        <Ionicons name={icon} size={16} color={on ? Colors.white : Colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
      <View style={[styles.switch, on && (tone === 'warn' ? { backgroundColor: Colors.error } : { backgroundColor: Colors.primary })]}>
        {loading ? (
          <ActivityIndicator size="small" color={on ? Colors.white : Colors.primary} />
        ) : (
          <View style={[styles.switchKnob, on && styles.switchKnobOn]} />
        )}
      </View>
    </Pressable>
  );
}

function AutomationSchedulerSection({
  brand,
  upcomingSlots,
  cronSaving,
  slotsSaving,
  loading,
  aheadBusy,
  skipBusy,
  onToggleCron,
  onChangeSlots,
  onGenerateAhead,
  onSkipToggle,
}: {
  brand: BrandKit;
  upcomingSlots: ScheduledSlotPreview[];
  cronSaving: boolean;
  slotsSaving: boolean;
  loading: boolean;
  aheadBusy: boolean;
  skipBusy: string | null;
  onToggleCron: (next: boolean) => void;
  onChangeSlots: (slots: AutomationSlot[]) => void;
  onGenerateAhead: () => void;
  onSkipToggle: (slot: ScheduledSlotPreview) => void;
}) {
  return (
    <Card>
      <View style={styles.schedulerShell}>
        <View style={styles.schedulerHeader}>
          <View style={styles.schedulerTitleWrap}>
            <View style={styles.cardIcon}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Auto scheduler</Text>
              <Text style={styles.cardBody}>
                Run multiple daily post slots with template, platform, review, and timing controls in one place.
              </Text>
            </View>
          </View>
          <View style={styles.schedulerHeaderActions}>
            <Pressable
              onPress={aheadBusy ? undefined : onGenerateAhead}
              disabled={aheadBusy}
              style={[styles.schedulerActionBtn, aheadBusy && { opacity: 0.6 }]}
            >
              {aheadBusy ? <ActivityIndicator size="small" color={Colors.primary} /> : <Ionicons name="flash-outline" size={14} color={Colors.primary} />}
              <Text style={styles.schedulerActionLabel}>Queue 7 days</Text>
            </Pressable>
            <View style={[styles.schedulerToggle, brand.cronEnabled && styles.schedulerToggleOn]}>
              <Text style={[styles.schedulerToggleLabel, brand.cronEnabled && { color: Colors.white }]}>
                {brand.cronEnabled ? 'Automation on' : 'Automation off'}
              </Text>
              <Pressable
                onPress={() => !loading && !cronSaving && onToggleCron(!brand.cronEnabled)}
                style={styles.schedulerSwitchTap}
                disabled={loading || cronSaving}
              >
                <View style={[styles.switch, brand.cronEnabled && { backgroundColor: Colors.white }]}>
                  {cronSaving ? (
                    <ActivityIndicator size="small" color={brand.cronEnabled ? Colors.primary : Colors.textMuted} />
                  ) : (
                    <View style={[styles.switchKnob, brand.cronEnabled && styles.switchKnobOn]} />
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.schedulerSummaryRow}>
          <View style={styles.schedulerMetric}>
            <Text style={styles.schedulerMetricValue}>{brand.automationSlots.filter((slot) => slot.enabled).length}</Text>
            <Text style={styles.schedulerMetricLabel}>enabled slots</Text>
          </View>
          <View style={styles.schedulerMetric}>
            <Text style={styles.schedulerMetricValue}>{brand.automationSlots.length}</Text>
            <Text style={styles.schedulerMetricLabel}>total slots</Text>
          </View>
          <View style={styles.schedulerMetricWide}>
            <Text style={styles.schedulerMetricValue}>{brand.cronEnabled ? 'Live' : 'Paused'}</Text>
            <Text style={styles.schedulerMetricLabel}>
              {brand.cronEnabled ? 'Upcoming slots can generate or auto-schedule.' : 'Slots are configured but generation is paused.'}
            </Text>
          </View>
        </View>

        <View style={styles.schedulerSection}>
          <View style={styles.schedulerSectionHead}>
            <Text style={styles.schedulerSectionTitle}>Slot plan</Text>
            <Text style={styles.schedulerSectionHint}>Each slot controls time, template, platforms, and whether it goes straight to schedule or waits for review.</Text>
          </View>
          <AutomationSlotsCard slots={brand.automationSlots} saving={slotsSaving} onChange={onChangeSlots} embedded />
        </View>

        <View style={styles.schedulerSection}>
          <View style={styles.schedulerSectionHead}>
            <Text style={styles.schedulerSectionTitle}>Upcoming runs</Text>
            <Text style={styles.schedulerSectionHint}>Overrides now apply per slot. Skipping one slot won’t mute the rest of that day.</Text>
          </View>
          <View style={styles.schedulerPreviewList}>
            {brand.cronEnabled && upcomingSlots.length > 0 ? upcomingSlots.map((slot) => (
              <SchedulerSlotRow
                key={`${slot.dateIso}-${slot.slotId}`}
                slot={slot}
                skipBusy={skipBusy === `${slot.dateIso}:${slot.slotId}`}
                onSkipToggle={() => onSkipToggle(slot)}
              />
            )) : (
              <View style={styles.schedulerEmpty}>
                <Ionicons name="pause-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.cardHint}>Turn automation on to start generating upcoming slot previews.</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

function NavCard({
  icon, title, body, status, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  status?: 'done' | 'pending';
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        {status ? (
          <View style={[styles.statusChip, status === 'done' ? styles.statusChipDone : styles.statusChipPending]}>
            <Text style={[styles.statusChipLabel, status === 'done' && { color: Colors.success }]}>
              {status === 'done' ? '✓ Set up' : 'Set this up'}
            </Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
      <Text style={styles.cardBody}>{body}</Text>
    </Pressable>
  );
}

function SchedulerSlotRow({
  slot,
  skipBusy,
  onSkipToggle,
}: {
  slot: ScheduledSlotPreview;
  skipBusy: boolean;
  onSkipToggle: () => void;
}) {
  return (
    <View style={[styles.slotRow, slot.skipped && styles.slotRowSkipped]}>
      {/* Date box */}
      <View style={styles.slotDateBox}>
        <Text style={styles.slotDayName}>{slot.weekdayName.slice(0, 3).toUpperCase()}</Text>
        <Text style={styles.slotDate}>{slot.dateIso.slice(5).replace('-', '/')}</Text>
      </View>

      {/* Slot details */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.slotTheme, slot.skipped && { color: Colors.textMuted, textDecorationLine: 'line-through' }]}>
          {slot.slotLabel} · {slot.themeLabel}
        </Text>
        <View style={styles.slotChips}>
          <Text style={styles.slotChip}>{slot.slotTime}</Text>
          <Text style={[styles.slotChip, styles.slotChipSecondary]}>{slot.slotTemplate === 'auto' ? 'AI pick' : slot.slotTemplate}</Text>
          <Text style={[styles.slotChip, slot.autoSchedule ? styles.slotChipEvent : styles.slotChipSecondary]}>
            {slot.autoSchedule ? 'Auto schedule' : 'Needs review'}
          </Text>
          <Text style={styles.slotChip}>{slot.slotPlatforms.join(' + ').toUpperCase()}</Text>
          {slot.pillarLabel ? (
            <Text style={styles.slotChip}>{slot.pillarEmoji ? `${slot.pillarEmoji} ` : ''}{slot.pillarLabel}</Text>
          ) : null}
          {slot.personaLabel ? (
            <Text style={[styles.slotChip, styles.slotChipSecondary]}>{slot.personaLabel}</Text>
          ) : null}
          {slot.eventLabel ? (
            <Text style={[styles.slotChip, styles.slotChipEvent]}>📅 {slot.eventLabel}</Text>
          ) : null}
          {slot.slotOverride ? (
            <Text style={[styles.slotChip, styles.slotChipOverride]}>slot override</Text>
          ) : slot.dateOverride ? (
            <Text style={[styles.slotChip, styles.slotChipSecondary]}>date override</Text>
          ) : null}
        </View>
      </View>

      {/* Skip toggle */}
      <Pressable
        onPress={onSkipToggle}
        disabled={skipBusy}
        style={[styles.slotSkipBtn, slot.skipped && styles.slotSkipBtnActive]}
      >
        {skipBusy ? (
          <ActivityIndicator size="small" color={slot.skipped ? Colors.white : Colors.warning} />
        ) : (
          <Text style={[styles.slotSkipLabel, slot.skipped && { color: Colors.white }]}>
            {slot.skipped ? 'Un-skip' : 'Skip'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function AutomationSlotsCard({
  slots,
  saving,
  onChange,
  embedded = false,
}: {
  slots: AutomationSlot[];
  saving: boolean;
  onChange: (slots: AutomationSlot[]) => void;
  embedded?: boolean;
}) {
  const patch = (id: string, updater: (slot: AutomationSlot) => AutomationSlot) => {
    onChange(slots.map((slot) => (slot.id === id ? updater(slot) : slot)));
  };
  const addSlot = () => {
    const nextIndex = slots.length + 1;
    onChange([
      ...slots,
      {
        id: `slot_${Date.now()}`,
        label: `Slot ${nextIndex}`,
        time: '18:00',
        template: 'auto',
        platforms: ['instagram', 'facebook'],
        enabled: true,
        autoSchedule: false,
      },
    ]);
  };
  return (
    <View style={embedded ? styles.slotEditorEmbedded : undefined}>
      {!embedded ? (
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name="albums-outline" size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Automation slots</Text>
      </View>
      ) : null}
      {!embedded ? <Text style={styles.cardHint}>Add multiple post windows, choose a template per slot, and decide whether each one auto-schedules or lands for review first.</Text> : null}
      <View style={styles.slotEditorList}>
        {slots.map((slot, index) => (
          <View key={slot.id} style={styles.slotEditorCard}>
            <View style={styles.slotEditorHead}>
              <TextInput
                value={slot.label}
                onChangeText={(label) => patch(slot.id, (current) => ({ ...current, label: label.slice(0, 40) }))}
                placeholder={`Slot ${index + 1}`}
                placeholderTextColor={Colors.textMuted}
                style={styles.slotEditorLabelInput}
              />
              <Pressable onPress={() => patch(slot.id, (current) => ({ ...current, enabled: !current.enabled }))} style={[styles.miniToggle, slot.enabled && styles.miniToggleOn]}>
                <Text style={[styles.miniToggleLabel, slot.enabled && { color: Colors.white }]}>{slot.enabled ? 'On' : 'Off'}</Text>
              </Pressable>
              {slots.length > 1 ? (
                <Pressable onPress={() => onChange(slots.filter((item) => item.id !== slot.id))} style={styles.slotDeleteBtn}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.slotEditorGrid}>
              <View style={styles.slotEditorField}>
                <Text style={styles.slotEditorLabel}>Time (IST)</Text>
                <TextInput
                  value={slot.time}
                  onChangeText={(time) => patch(slot.id, (current) => ({ ...current, time: time.slice(0, 5) }))}
                  placeholder="09:00"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.slotEditorInput}
                />
              </View>

              <View style={styles.slotEditorFieldWide}>
                <Text style={styles.slotEditorLabel}>Template</Text>
                <View style={styles.slotChoiceRow}>
                  {(['auto', 'tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'] as const).map((template) => {
                    const active = slot.template === template;
                    return (
                      <Pressable
                        key={template}
                        onPress={() => patch(slot.id, (current) => ({ ...current, template }))}
                        style={[styles.slotChoiceChip, active && styles.slotChoiceChipActive]}
                      >
                        <Text style={[styles.slotChoiceLabel, active && { color: Colors.primary }]}>
                          {template === 'auto' ? 'AI pick' : template.replace('Card', '')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.slotEditorFieldWide}>
                <Text style={styles.slotEditorLabel}>Platforms</Text>
                <View style={styles.slotChoiceRow}>
                  {(['instagram', 'facebook'] as const).map((platform) => {
                    const active = slot.platforms.includes(platform);
                    return (
                      <Pressable
                        key={platform}
                        onPress={() => patch(slot.id, (current) => {
                          const next = active
                            ? current.platforms.filter((item) => item !== platform)
                            : [...current.platforms, platform];
                          return { ...current, platforms: next.length ? next : current.platforms };
                        })}
                        style={[styles.slotChoiceChip, active && styles.slotChoiceChipActive]}
                      >
                        <Text style={[styles.slotChoiceLabel, active && { color: Colors.primary }]}>{platform === 'instagram' ? 'Instagram' : 'Facebook'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.slotEditorFieldWide}>
                <Text style={styles.slotEditorLabel}>Delivery</Text>
                <View style={styles.slotChoiceRow}>
                  {[
                    { label: 'Needs review', value: false },
                    { label: 'Auto schedule', value: true },
                  ].map((mode) => {
                    const active = slot.autoSchedule === mode.value;
                    return (
                      <Pressable
                        key={mode.label}
                        onPress={() => patch(slot.id, (current) => ({ ...current, autoSchedule: mode.value }))}
                        style={[styles.slotChoiceChip, active && styles.slotChoiceChipActive]}
                      >
                        <Text style={[styles.slotChoiceLabel, active && { color: Colors.primary }]}>{mode.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={addSlot} disabled={saving || slots.length >= 8} style={styles.editLink}>
        <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
        <Text style={styles.editLinkLabel}>{saving ? 'Saving…' : 'Add slot'}</Text>
      </Pressable>
    </View>
  );
}

function ConnectionRow({
  platform, channel, pending, fallbackHandle,
}: {
  platform: string;
  channel: ChannelHealth | null;
  /** True while we're waiting for the first probe to land. */
  pending: boolean;
  /** Shown when the probe hasn't returned a handle yet. */
  fallbackHandle: string;
}) {
  // Three states: pending (no probe yet), ok (last probe succeeded), fail.
  const dotColor = pending
    ? Colors.textMuted
    : channel?.ok ? Colors.success : Colors.error;
  const handleText = (channel?.handle && channel.handle.trim()) || fallbackHandle;
  const statusText = pending ? 'Checking…' : channel?.ok ? 'Connected' : 'Reconnect';
  const statusColor = pending
    ? Colors.textMuted
    : channel?.ok ? Colors.success : Colors.error;
  return (
    <View style={{ gap: 2 }}>
      <View style={styles.connectionRow}>
        <View style={styles.connectionDot}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        </View>
        <Text style={styles.connectionPlatform}>{platform}</Text>
        <Text style={styles.connectionHandle}>{handleText}</Text>
        <Text style={[styles.connectionStatus, { color: statusColor }]}>{statusText}</Text>
      </View>
      {channel && !channel.ok && channel.error ? (
        <Text style={styles.connectionError}>{channel.error}</Text>
      ) : null}
    </View>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const sec = Math.round(ms / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  return `${day} d ago`;
}

function StyleProfileEditor({
  profile, loading, onSave,
}: {
  profile: StyleProfile;
  loading: boolean;
  onSave: (next: StyleProfile) => Promise<void>;
}) {
  const [oneLiner, setOneLiner] = useState(profile.oneLiner);
  const [description, setDescription] = useState(profile.description);
  const [keywords, setKeywords] = useState(profile.artKeywords);
  const [prohibited, setProhibited] = useState(profile.prohibited.join(', '));
  const [editing, setEditing] = useState(false);

  // Reset locals when profile prop changes (server save flushed back).
  useEffect(() => {
    setOneLiner(profile.oneLiner);
    setDescription(profile.description);
    setKeywords(profile.artKeywords);
    setProhibited(profile.prohibited.join(', '));
  }, [profile.oneLiner, profile.description, profile.artKeywords, profile.prohibited]);

  function fillDefaultStyle() {
    setOneLiner(DEFAULT_STYLE_PROFILE.oneLiner);
    setDescription(DEFAULT_STYLE_PROFILE.description);
    setKeywords(DEFAULT_STYLE_PROFILE.artKeywords);
    setProhibited(DEFAULT_STYLE_PROFILE.prohibited.join(', '));
  }

  return (
    <Card>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name="brush-outline" size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Visual style</Text>
        <View style={styles.newPill}>
          <Text style={styles.newPillLabel}>NEW</Text>
        </View>
        <Pressable onPress={() => setEditing((e) => !e)} style={styles.editLink}>
          <Text style={styles.editLinkLabel}>{editing ? 'Hide' : 'Edit'}</Text>
        </Pressable>
      </View>
      <Text style={styles.cardBody}>
        {profile.oneLiner}
      </Text>

      {editing ? (
        <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
          <Field label="One-line summary">
            <TextInput
              value={oneLiner}
              onChangeText={setOneLiner}
              style={styles.input}
              maxLength={240}
              multiline
            />
          </Field>
          <Field label="Detailed description">
            <Text style={styles.fieldHint}>Fed to AI image-gen as a style preamble.</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, { minHeight: 80 }]}
              maxLength={1500}
              multiline
            />
          </Field>
          <Field label="Art keywords">
            <Text style={styles.fieldHint}>Comma-separated. Suffixed onto every prompt.</Text>
            <TextInput
              value={keywords}
              onChangeText={setKeywords}
              style={styles.input}
              maxLength={240}
            />
          </Field>
          <Field label="Things to avoid">
            <Text style={styles.fieldHint}>Comma-separated. The AI is told NOT to produce these.</Text>
            <TextInput
              value={prohibited}
              onChangeText={setProhibited}
              style={[styles.input, { minHeight: 60 }]}
              multiline
            />
          </Field>
          <View style={styles.styleActionRow}>
            <Pressable
              disabled={loading}
              style={[styles.resetPillBtn, loading && { opacity: 0.6 }]}
              onPress={fillDefaultStyle}
            >
              <Ionicons name="refresh" size={14} color={Colors.primary} />
              <Text style={styles.resetPillBtnLabel}>Reset to MaaMitra default</Text>
            </Pressable>
            <Pressable
              disabled={loading}
              style={[styles.savePillBtn, loading && { opacity: 0.6 }]}
              onPress={async () => {
                await onSave({
                  oneLiner: oneLiner.trim(),
                  description: description.trim(),
                  artKeywords: keywords.trim(),
                  prohibited: prohibited.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30),
                });
                setEditing(false);
              }}
            >
              {loading ? <ActivityIndicator size="small" color={Colors.white} /> :
                <Text style={styles.savePillBtnLabel}>Save changes</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 80 },
  bodyWide: { paddingHorizontal: Spacing.xxxl },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
  },
  bannerErr: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: Colors.error },
  bannerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionSubtitle: { fontSize: FontSize.xs, color: Colors.textLight, marginTop: 2 },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, flex: 1 },
  cardBody: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },
  cardHint: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic', marginTop: 4 },

  // Toggle
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  toggleRowOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  toggleRowWarn: { borderColor: Colors.error, backgroundColor: 'rgba(239,68,68,0.05)' },
  switch: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: Colors.borderSoft,
    padding: 2, justifyContent: 'center',
  },
  switchKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white, ...Shadow.sm },
  switchKnobOn: { transform: [{ translateX: 18 }] },

  // Connection
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  connectionDot: { width: 16, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connectionPlatform: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, width: 110 },
  connectionHandle: { fontSize: FontSize.xs, color: Colors.textLight, flex: 1 },
  connectionStatus: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  connectionError: {
    fontSize: 11,
    color: Colors.error,
    marginLeft: 24,
    lineHeight: 14,
  },

  // Status chip
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  statusChipDone: { backgroundColor: 'rgba(34,197,94,0.1)' },
  statusChipPending: { backgroundColor: 'rgba(245,158,11,0.1)' },
  statusChipLabel: { fontSize: 10, fontWeight: '700', color: Colors.warning },

  // New pill
  newPill: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newPillLabel: { fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.4 },

  editLink: { paddingHorizontal: 8, paddingVertical: 4 },
  editLinkLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  settingsQuickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  settingsMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  settingsMiniPillLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  // Form fields (style profile)
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  fieldHint: { fontSize: 11, color: Colors.textMuted, marginBottom: 2 },
  input: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: FontSize.xs, color: Colors.textDark,
    minHeight: 36,
    outlineStyle: 'none' as any,
  },
  savePillBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 999,
    marginTop: 4,
  },
  savePillBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  styleActionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 4 },
  resetPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.primarySoft,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resetPillBtnLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  schedulerShell: { gap: Spacing.md },
  schedulerHeader: { gap: Spacing.md },
  schedulerTitleWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  schedulerHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  schedulerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  schedulerActionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  schedulerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgTint,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  schedulerToggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  schedulerToggleLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  schedulerSwitchTap: { padding: 0 },
  schedulerSummaryRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  schedulerMetric: {
    minWidth: 110,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgTint,
    gap: 3,
  },
  schedulerMetricWide: {
    flex: 1,
    minWidth: 220,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgTint,
    gap: 3,
  },
  schedulerMetricValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark },
  schedulerMetricLabel: { fontSize: 11, color: Colors.textLight, lineHeight: 15 },
  schedulerSection: {
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgTint,
  },
  schedulerSectionHead: { gap: 2 },
  schedulerSectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  schedulerSectionHint: { fontSize: 11, color: Colors.textLight, lineHeight: 15 },
  schedulerPreviewList: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
    overflow: 'hidden',
  },
  schedulerEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.sm },

  // Automation slots editor
  slotEditorEmbedded: { gap: Spacing.sm },
  slotEditorList: { gap: Spacing.sm, marginTop: Spacing.sm },
  slotEditorCard: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
    gap: Spacing.sm,
  },
  slotEditorHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  slotEditorLabelInput: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textDark,
    outlineStyle: 'none' as any,
  },
  miniToggle: {
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  miniToggleOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  miniToggleLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  slotDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  slotEditorGrid: { gap: Spacing.sm },
  slotEditorField: { gap: 4 },
  slotEditorFieldWide: { gap: 4 },
  slotEditorLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight },
  slotEditorInput: {
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: FontSize.xs,
    color: Colors.textDark,
    outlineStyle: 'none' as any,
  },
  slotChoiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotChoiceChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  slotChoiceChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  slotChoiceLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDark },

  // Scheduler slot rows
  slotRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
  },
  slotRowSkipped: { opacity: 0.65 },
  slotDateBox: {
    width: 40, alignItems: 'center', gap: 1,
  },
  slotDayName: { fontSize: 9, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  slotDate: { fontSize: 12, fontWeight: '700', color: Colors.textDark },
  slotTheme: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  slotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  slotChip: {
    fontSize: 10, fontWeight: '600', color: Colors.primary,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999,
  },
  slotChipSecondary: { color: Colors.textMuted, backgroundColor: Colors.bgTint },
  slotChipEvent: { color: Colors.primary, backgroundColor: Colors.primarySoft },
  slotChipOverride: { color: Colors.white, backgroundColor: Colors.primary },
  slotSkipBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.warning,
    minWidth: 54, alignItems: 'center',
  },
  slotSkipBtnActive: {
    backgroundColor: Colors.warning, borderColor: Colors.warning,
  },
  slotSkipLabel: { fontSize: 10, fontWeight: '700', color: Colors.warning },
});
