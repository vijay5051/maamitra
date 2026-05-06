import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Colors, FontSize, Radius, Shadow, Spacing } from '../../../constants/theme';
import {
  fetchBrandKit,
  generateAheadDrafts,
  previewScheduledSlots,
  saveBrandKit,
  saveCronOverride,
  subscribeBrandKit,
  ScheduledSlotPreview,
} from '../../../services/marketing';
import { friendlyError } from '../../../services/marketingErrors';
import { AutomationSlot, BrandKit, CulturalEvent, ThemeForDay, WeekDay } from '../../../lib/marketingTypes';
import { useAuthStore } from '../../../store/useAuthStore';

const WEEKDAY_ORDER: WeekDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_LABELS: Record<WeekDay, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

export default function MarketingPlannerScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [upcomingSlots, setUpcomingSlots] = useState<ScheduledSlotPreview[]>([]);
  const [skipBusy, setSkipBusy] = useState<string | null>(null);
  const [aheadBusy, setAheadBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetchBrandKit().then((k) => { setBrand(k); setLoading(false); });
    const unsub = subscribeBrandKit((k) => {
      setBrand(k);
      if (!k) {
        setUpcomingSlots([]);
        return;
      }
      const slots: ScheduledSlotPreview[] = [];
      for (let i = 0; i < 7; i++) {
        slots.push(...previewScheduledSlots(k, new Date(Date.now() + i * 24 * 3600 * 1000)));
      }
      setUpcomingSlots(slots);
    });
    return unsub;
  }, []);

  const showBanner = useCallback((tone: 'ok' | 'err', text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 2600);
  }, []);

  async function update(label: string, patch: Partial<BrandKit>) {
    if (!user || !brand) return;
    setSaving(label);
    try {
      await saveBrandKit({ uid: user.uid, email: user.email }, patch);
      showBanner('ok', 'Saved');
    } catch (e: any) {
      showBanner('err', friendlyError('Save', e));
    } finally {
      setSaving(null);
    }
  }

  const nextEvents = useMemo(() => upcomingEvents(brand?.culturalCalendar ?? []), [brand?.culturalCalendar]);

  return (
    <>
      <Stack.Screen options={{ title: 'Content Planner' }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: Colors.bgLight }}
        contentContainerStyle={[styles.body, isWide && styles.bodyWide]}
        showsVerticalScrollIndicator={false}
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

        <View style={styles.heroCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.heroEyebrow}>Content Planner</Text>
            <Text style={styles.heroTitle}>Plan what goes out, when it goes out, and why.</Text>
            <Text style={styles.heroBody}>Automation, weekly rhythm, and cultural moments live together here so planning feels like one workflow, not four separate screens.</Text>
          </View>
          <Pressable onPress={() => router.push('/admin/marketing/create' as any)} style={styles.heroBtn}>
            <Ionicons name="add" size={16} color={Colors.white} />
            <Text style={styles.heroBtnLabel}>Create post</Text>
          </Pressable>
        </View>

        {brand ? (
          <PlannerSchedulerCard
            brand={brand}
            loading={loading}
            cronSaving={saving === 'cron'}
            slotsSaving={saving === 'slots'}
            crisisSaving={saving === 'crisis'}
            aheadBusy={aheadBusy}
            skipBusy={skipBusy}
            upcomingSlots={upcomingSlots}
            onToggleCron={(next) => update('cron', { cronEnabled: next })}
            onChangeSlots={(slots) => update('slots', { automationSlots: slots })}
            onToggleCrisis={(next) => update('crisis', { crisisPaused: next, crisisPauseReason: next ? (brand.crisisPauseReason ?? 'Paused from planner') : null })}
            onPreGenerate={async () => {
              if (aheadBusy) return;
              setAheadBusy(true);
              try {
                const r = await generateAheadDrafts(7);
                if (r.ok) {
                  showBanner('ok', r.generated > 0 ? `${r.generated} draft${r.generated === 1 ? '' : 's'} queued for review` : 'All upcoming dates already have drafts');
                } else {
                  showBanner('err', r.message);
                }
              } catch (e: any) {
                showBanner('err', friendlyError('Pre-generate', e));
              } finally {
                setAheadBusy(false);
              }
            }}
            onSkip={async (slot) => {
              if (!user) return;
              const key = `${slot.dateIso}:${slot.slotId}`;
              setSkipBusy(key);
              try {
                await saveCronOverride(
                  { uid: user.uid, email: user.email },
                  slot.dateIso,
                  slot.skipped ? null : { skip: true },
                  slot.slotId,
                );
                showBanner('ok', slot.skipped ? `${slot.slotLabel} un-skipped` : `${slot.slotLabel} skipped`);
              } catch (e: any) {
                showBanner('err', friendlyError('Skip', e));
              } finally {
                setSkipBusy(null);
              }
            }}
          />
        ) : null}

        {brand ? (
          <View style={[styles.grid, isWide && styles.gridWide]}>
            <View style={styles.gridCol}>
              <WeeklyRhythmEditor
                themeCalendar={brand.themeCalendar}
                slots={brand.automationSlots}
                saving={saving === 'themes'}
                onSave={(themeCalendar) => update('themes', { themeCalendar })}
              />
            </View>

            <View style={styles.gridCol}>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="sparkles-outline" size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.cardTitle}>Cultural calendar</Text>
                </View>
                <Text style={styles.cardHint}>Upcoming moments worth planning around. These can bias automation or shape manual content ideas.</Text>
                <View style={styles.eventList}>
                  {nextEvents.length > 0 ? nextEvents.map((event) => (
                    <View key={event.id} style={styles.eventRow}>
                      <View style={styles.eventDatePill}>
                        <Text style={styles.eventDateText}>{formatEventDate(event.date)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventLabel}>{event.label}</Text>
                        <Text style={styles.eventHint} numberOfLines={2}>{event.promptHint || 'No tone hint set yet.'}</Text>
                      </View>
                    </View>
                  )) : (
                    <Text style={styles.emptyText}>No upcoming events added yet.</Text>
                  )}
                </View>
                <Pressable onPress={() => router.push('/admin/marketing/strategy' as any)} style={styles.inlineLink}>
                  <Text style={styles.inlineLinkLabel}>Edit cultural calendar</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[styles.grid, isWide && styles.gridWide]}>
          <QuickNavCard
            icon="calendar-outline"
            title="Publishing calendar"
            body="Drag approved and scheduled posts across the week."
            onPress={() => router.push('/admin/marketing/calendar' as any)}
          />
          <QuickNavCard
            icon="document-text-outline"
            title="Posts queue"
            body="Review drafts, approvals, posted content, and UGC in one place."
            onPress={() => router.push('/admin/marketing/posts' as any)}
          />
          <QuickNavCard
            icon="settings-outline"
            title="Workspace settings"
            body="Brand kit, templates, cost, connected accounts, and visual style."
            onPress={() => router.push('/admin/marketing/settings' as any)}
          />
        </View>
      </ScrollView>
    </>
  );
}

function WeeklyRhythmEditor({
  themeCalendar,
  slots,
  saving,
  onSave,
}: {
  themeCalendar: Record<WeekDay, ThemeForDay>;
  slots: AutomationSlot[];
  saving: boolean;
  onSave: (themeCalendar: Record<WeekDay, ThemeForDay>) => void;
}) {
  const [draft, setDraft] = useState<Record<WeekDay, ThemeForDay>>(themeCalendar);

  useEffect(() => {
    setDraft(themeCalendar);
  }, [themeCalendar]);

  const dirty = WEEKDAY_ORDER.some((day) => {
    const current = draft[day];
    const original = themeCalendar[day];
    return current.label !== original.label || current.prompt !== original.prompt || current.enabled !== original.enabled;
  });

  const enabledSlots = slots.filter((slot) => slot.enabled);
  const deliverySummary = enabledSlots.length
    ? enabledSlots.map((slot) => `${slot.label} · ${slot.time} · ${slot.autoSchedule ? 'Auto schedule' : 'Needs review'}`)
    : ['No active slot timings'];

  const patch = (day: WeekDay, updater: (current: ThemeForDay) => ThemeForDay) => {
    setDraft((current) => ({ ...current, [day]: updater(current[day]) }));
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name="repeat-outline" size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Weekly rhythm</Text>
      </View>
      <Text style={styles.cardHint}>
        Edit the weekly content themes here. Turning a day off stops automation for that weekday. Time and auto-publish follow the active slot plan shown below.
      </Text>

      <View style={styles.deliveryNote}>
        <Ionicons name="time-outline" size={14} color={Colors.primary} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.deliveryNoteTitle}>Current delivery rules</Text>
          <View style={styles.deliveryTagRow}>
            {deliverySummary.map((item) => <Tag key={item} text={item} muted />)}
          </View>
        </View>
      </View>

      <View style={styles.themeEditorList}>
        {WEEKDAY_ORDER.map((day) => {
          const item = draft[day];
          return (
            <View key={day} style={[styles.themeEditorCard, item.enabled === false && styles.themeEditorCardMuted]}>
              <View style={styles.themeEditorHead}>
                <View style={styles.themeEditorDayWrap}>
                  <Text style={styles.themeDay}>{WEEKDAY_LABELS[day]}</Text>
                  <Text style={styles.themeEditorMeta}>{item.enabled ? 'Will generate when slots are active' : 'Stopped for this day'}</Text>
                </View>
                <Pressable
                  onPress={() => patch(day, (current) => ({ ...current, enabled: !current.enabled }))}
                  style={[styles.toggleMini, item.enabled && styles.toggleMiniActive]}
                >
                  <Text style={[styles.toggleMiniLabel, item.enabled && { color: Colors.white }]}>{item.enabled ? 'On' : 'Off'}</Text>
                </Pressable>
              </View>

              <View style={styles.themeField}>
                <Text style={styles.fieldLabel}>Theme name</Text>
                <TextInput
                  value={item.label}
                  onChangeText={(label) => patch(day, (current) => ({ ...current, label: label.slice(0, 40) }))}
                  placeholder="Tip Tuesday"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.slotInput}
                />
              </View>

              <View style={styles.themeField}>
                <Text style={styles.fieldLabel}>AI context</Text>
                <TextInput
                  value={item.prompt}
                  onChangeText={(prompt) => patch(day, (current) => ({ ...current, prompt: prompt.slice(0, 400) }))}
                  placeholder="What should this weekday usually talk about?"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  style={[styles.slotInput, styles.themePromptInput]}
                />
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.themeEditorActions}>
        <Pressable
          onPress={() => setDraft(themeCalendar)}
          disabled={!dirty || saving}
          style={[styles.secondaryPill, (!dirty || saving) && styles.pillDisabled]}
        >
          <Text style={styles.secondaryPillLabel}>Reset</Text>
        </Pressable>
        <Pressable
          onPress={() => onSave(draft)}
          disabled={!dirty || saving}
          style={[styles.primaryPill, (!dirty || saving) && styles.pillDisabled]}
        >
          {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="save-outline" size={14} color={Colors.white} />}
          <Text style={styles.primaryPillLabel}>{saving ? 'Saving…' : 'Save weekly rhythm'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PlannerSchedulerCard({
  brand,
  loading,
  cronSaving,
  slotsSaving,
  crisisSaving,
  aheadBusy,
  skipBusy,
  upcomingSlots,
  onToggleCron,
  onChangeSlots,
  onToggleCrisis,
  onPreGenerate,
  onSkip,
}: {
  brand: BrandKit;
  loading: boolean;
  cronSaving: boolean;
  slotsSaving: boolean;
  crisisSaving: boolean;
  aheadBusy: boolean;
  skipBusy: string | null;
  upcomingSlots: ScheduledSlotPreview[];
  onToggleCron: (next: boolean) => void;
  onChangeSlots: (slots: AutomationSlot[]) => void;
  onToggleCrisis: (next: boolean) => void;
  onPreGenerate: () => void;
  onSkip: (slot: ScheduledSlotPreview) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.schedulerHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Auto scheduler</Text>
          <Text style={styles.cardHint}>This is the planning engine: slot timings, template mix, review vs auto-schedule, and per-slot skip control.</Text>
        </View>
        <View style={styles.schedulerActionRow}>
          <Pressable onPress={aheadBusy ? undefined : onPreGenerate} disabled={aheadBusy} style={styles.primaryPill}>
            {aheadBusy ? <ActivityIndicator size="small" color={Colors.white} /> : <Ionicons name="flash-outline" size={14} color={Colors.white} />}
            <Text style={styles.primaryPillLabel}>Queue 7 days</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.schedulerSummary}>
        <ToggleChip
          label={brand.cronEnabled ? 'Automation on' : 'Automation off'}
          active={brand.cronEnabled}
          loading={cronSaving}
          onPress={() => !loading && !cronSaving && onToggleCron(!brand.cronEnabled)}
        />
        <ToggleChip
          label={brand.crisisPaused ? 'Crisis pause on' : 'Crisis pause off'}
          active={brand.crisisPaused}
          loading={crisisSaving}
          tone="warn"
          onPress={() => !loading && !crisisSaving && onToggleCrisis(!brand.crisisPaused)}
        />
        <MetricPill value={String(brand.automationSlots.filter((slot) => slot.enabled).length)} label="enabled slots" />
        <MetricPill value={String(upcomingSlots.filter((slot) => !slot.skipped).length)} label="preview items" />
      </View>

      <AutomationSlotsEditor slots={brand.automationSlots} saving={slotsSaving} onChange={onChangeSlots} />

      <View style={styles.subSection}>
        <View style={styles.subSectionHead}>
          <Text style={styles.subSectionTitle}>Upcoming automation</Text>
          <Text style={styles.subSectionHint}>Skip or restore individual slots for the next 7 days. Slot-level overrides do not mute the whole day.</Text>
        </View>
        <View style={styles.previewList}>
          {brand.cronEnabled && upcomingSlots.length > 0 ? upcomingSlots.map((slot) => (
            <View key={`${slot.dateIso}-${slot.slotId}`} style={styles.previewRow}>
              <View style={styles.previewDate}>
                <Text style={styles.previewDay}>{slot.weekdayName.slice(0, 3).toUpperCase()}</Text>
                <Text style={styles.previewDateText}>{slot.dateIso.slice(5).replace('-', '/')}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.previewTitle}>{slot.slotLabel} · {slot.themeLabel}</Text>
                <View style={styles.previewTags}>
                  <Tag text={slot.slotTime} />
                  <Tag text={slot.slotTemplate === 'auto' ? 'AI pick' : slot.slotTemplate} muted />
                  <Tag text={slot.slotPlatforms.join(' + ').toUpperCase()} />
                  <Tag text={slot.autoSchedule ? 'Auto schedule' : 'Needs review'} muted />
                </View>
              </View>
              <Pressable
                onPress={() => onSkip(slot)}
                disabled={skipBusy === `${slot.dateIso}:${slot.slotId}`}
                style={[styles.skipPill, slot.skipped && styles.skipPillActive]}
              >
                {skipBusy === `${slot.dateIso}:${slot.slotId}` ? (
                  <ActivityIndicator size="small" color={slot.skipped ? Colors.white : Colors.warning} />
                ) : (
                  <Text style={[styles.skipPillLabel, slot.skipped && { color: Colors.white }]}>
                    {slot.skipped ? 'Un-skip' : 'Skip'}
                  </Text>
                )}
              </Pressable>
            </View>
          )) : (
            <Text style={styles.emptyText}>Turn automation on to see upcoming slot previews.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function AutomationSlotsEditor({
  slots,
  saving,
  onChange,
}: {
  slots: AutomationSlot[];
  saving: boolean;
  onChange: (slots: AutomationSlot[]) => void;
}) {
  const patch = (id: string, updater: (slot: AutomationSlot) => AutomationSlot) => {
    onChange(slots.map((slot) => (slot.id === id ? updater(slot) : slot)));
  };
  const addSlot = () => {
    onChange([
      ...slots,
      {
        id: `slot_${Date.now()}`,
        label: `Slot ${slots.length + 1}`,
        time: '18:00',
        template: 'auto',
        platforms: ['instagram', 'facebook'],
        enabled: true,
        autoSchedule: false,
      },
    ]);
  };
  return (
    <View style={styles.subSection}>
      <View style={styles.subSectionHeadRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subSectionTitle}>Slot plan</Text>
          <Text style={styles.subSectionHint}>Keep this tight: a clear label, a time, a template direction, and delivery behavior.</Text>
        </View>
        <Pressable onPress={addSlot} disabled={saving || slots.length >= 8} style={styles.inlineAction}>
          <Ionicons name="add-circle-outline" size={14} color={Colors.primary} />
          <Text style={styles.inlineActionLabel}>{saving ? 'Saving…' : 'Add slot'}</Text>
        </Pressable>
      </View>

      <View style={styles.slotList}>
        {slots.map((slot) => (
          <View key={slot.id} style={styles.slotCard}>
            <View style={styles.slotHead}>
              <TextInput
                value={slot.label}
                onChangeText={(label) => patch(slot.id, (current) => ({ ...current, label: label.slice(0, 40) }))}
                placeholder="Slot name"
                placeholderTextColor={Colors.textMuted}
                style={styles.slotLabelInput}
              />
              <Pressable onPress={() => patch(slot.id, (current) => ({ ...current, enabled: !current.enabled }))} style={[styles.toggleMini, slot.enabled && styles.toggleMiniActive]}>
                <Text style={[styles.toggleMiniLabel, slot.enabled && { color: Colors.white }]}>{slot.enabled ? 'On' : 'Off'}</Text>
              </Pressable>
              {slots.length > 1 ? (
                <Pressable onPress={() => onChange(slots.filter((item) => item.id !== slot.id))} style={styles.deleteMini}>
                  <Ionicons name="trash-outline" size={14} color={Colors.error} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.slotFieldGrid}>
              <View style={styles.slotField}>
                <Text style={styles.fieldLabel}>Time</Text>
                <TextInput
                  value={slot.time}
                  onChangeText={(time) => patch(slot.id, (current) => ({ ...current, time: time.slice(0, 5) }))}
                  placeholder="09:00"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.slotInput}
                />
              </View>
              <View style={styles.slotFieldWide}>
                <Text style={styles.fieldLabel}>Template</Text>
                <View style={styles.choiceRow}>
                  {(['auto', 'tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'] as const).map((template) => {
                    const active = slot.template === template;
                    return (
                      <Pressable key={template} onPress={() => patch(slot.id, (current) => ({ ...current, template }))} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                        <Text style={[styles.choiceLabel, active && { color: Colors.primary }]}>{template === 'auto' ? 'AI pick' : template.replace('Card', '')}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.slotFieldWide}>
                <Text style={styles.fieldLabel}>Platforms</Text>
                <View style={styles.choiceRow}>
                  {(['instagram', 'facebook'] as const).map((platform) => {
                    const active = slot.platforms.includes(platform);
                    return (
                      <Pressable
                        key={platform}
                        onPress={() => patch(slot.id, (current) => {
                          const next = active ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform];
                          return { ...current, platforms: next.length ? next : current.platforms };
                        })}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                      >
                        <Text style={[styles.choiceLabel, active && { color: Colors.primary }]}>{platform === 'instagram' ? 'Instagram' : 'Facebook'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.slotFieldWide}>
                <Text style={styles.fieldLabel}>Delivery</Text>
                <View style={styles.choiceRow}>
                  {[
                    { label: 'Needs review', value: false },
                    { label: 'Auto schedule', value: true },
                  ].map((mode) => {
                    const active = slot.autoSchedule === mode.value;
                    return (
                      <Pressable key={mode.label} onPress={() => patch(slot.id, (current) => ({ ...current, autoSchedule: mode.value }))} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                        <Text style={[styles.choiceLabel, active && { color: Colors.primary }]}>{mode.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function QuickNavCard({ icon, title, body, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.card, styles.quickCard]}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={16} color={Colors.primary} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </View>
      <Text style={styles.cardBody}>{body}</Text>
    </Pressable>
  );
}

function ToggleChip({
  label,
  active,
  loading,
  onPress,
  tone = 'default',
}: {
  label: string;
  active: boolean;
  loading: boolean;
  onPress: () => void;
  tone?: 'default' | 'warn';
}) {
  const activeStyle = tone === 'warn' ? styles.toggleChipWarn : styles.toggleChipActive;
  return (
    <Pressable onPress={onPress} disabled={loading} style={[styles.toggleChip, active && activeStyle]}>
      {loading ? <ActivityIndicator size="small" color={active ? Colors.white : Colors.primary} /> : null}
      <Text style={[styles.toggleChipLabel, active && { color: Colors.white }]}>{label}</Text>
    </Pressable>
  );
}

function MetricPill({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Tag({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <View style={[styles.tag, muted && styles.tagMuted]}>
      <Text style={[styles.tagLabel, muted && { color: Colors.textMuted }]}>{text}</Text>
    </View>
  );
}

function upcomingEvents(events: CulturalEvent[]) {
  const today = new Date().toISOString().slice(0, 10);
  return [...events]
    .filter((event) => event.date >= today || event.date.slice(5) >= today.slice(5))
    .sort((a, b) => {
      const da = eventSortKey(a.date, today);
      const db = eventSortKey(b.date, today);
      return da.localeCompare(db);
    })
    .slice(0, 8);
}

function eventSortKey(date: string, today: string) {
  if (date >= today) return date;
  return `${String(Number(today.slice(0, 4)) + 1)}-${date.slice(5)}`;
}

function formatEventDate(date: string) {
  try {
    return new Date(`${date}T00:00:00+05:30`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch {
    return date;
  }
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 80 },
  bodyWide: { paddingHorizontal: Spacing.xxxl, paddingTop: Spacing.md },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.success,
  },
  bannerErr: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: Colors.error },
  bannerText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  heroCard: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.primary,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  heroEyebrow: { fontSize: 11, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textDark, letterSpacing: -0.3 },
  heroBody: { fontSize: FontSize.sm, color: Colors.textLight, lineHeight: 20 },
  heroBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  heroBtnLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.white },

  grid: { gap: Spacing.md },
  gridWide: { flexDirection: 'row', alignItems: 'stretch' },
  gridCol: { flex: 1, gap: Spacing.md },

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  quickCard: { flex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textDark, flex: 1 },
  cardBody: { fontSize: FontSize.xs, color: Colors.textLight, lineHeight: 18 },
  cardHint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },

  schedulerHeader: { gap: Spacing.sm },
  schedulerActionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  schedulerSummary: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  primaryPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primary,
  },
  primaryPillLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.white },
  toggleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  toggleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleChipWarn: { backgroundColor: Colors.error, borderColor: Colors.error },
  toggleChipLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  metricPill: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.bgTint,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  metricValue: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.textDark },
  metricLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  subSection: {
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgTint,
    borderWidth: 1, borderColor: Colors.borderSoft,
  },
  subSectionHead: { gap: 2 },
  subSectionHeadRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  subSectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  subSectionHint: { fontSize: 11, color: Colors.textLight, lineHeight: 15 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  inlineActionLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  inlineLinkLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  deliveryNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgTint,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  deliveryNoteTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  deliveryTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  slotList: { gap: Spacing.sm },
  slotCard: {
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  slotHead: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  slotLabelInput: {
    flex: 1,
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: FontSize.sm, color: Colors.textDark,
    outlineStyle: 'none' as any,
  },
  toggleMini: {
    minWidth: 44,
    alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  toggleMiniActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleMiniLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  deleteMini: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  slotFieldGrid: { gap: Spacing.sm },
  slotField: { gap: 4 },
  slotFieldWide: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight },
  slotInput: {
    backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: FontSize.xs, color: Colors.textDark,
    outlineStyle: 'none' as any,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choiceChip: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  choiceChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  choiceLabel: { fontSize: 11, fontWeight: '700', color: Colors.textDark },

  themeEditorList: { gap: Spacing.sm },
  themeEditorCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  themeEditorCardMuted: { opacity: 0.72 },
  themeEditorHead: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  themeEditorDayWrap: { flex: 1, gap: 2 },
  themeEditorMeta: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  themeField: { gap: 4 },
  themePromptInput: { minHeight: 76, textAlignVertical: 'top' as any },
  themeEditorActions: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  secondaryPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  secondaryPillLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  pillDisabled: { opacity: 0.5 },

  previewList: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.borderSoft,
    backgroundColor: Colors.cardBg,
  },
  previewRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    padding: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.borderSoft,
  },
  previewDate: {
    width: 46, alignItems: 'center', gap: 1,
  },
  previewDay: { fontSize: 9, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  previewDateText: { fontSize: 12, fontWeight: '700', color: Colors.textDark },
  previewTitle: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
  },
  tagMuted: { backgroundColor: Colors.bgTint },
  tagLabel: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  skipPill: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1, borderColor: Colors.warning,
    minWidth: 62, alignItems: 'center',
  },
  skipPillActive: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  skipPillLabel: { fontSize: 10, fontWeight: '700', color: Colors.warning },

  themeList: { gap: 8 },
  themeRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft,
  },
  themeRowMuted: { opacity: 0.6 },
  themeDay: { width: 34, fontSize: 11, fontWeight: '800', color: Colors.primary, textTransform: 'uppercase' },
  themeLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  themePrompt: { fontSize: 11, color: Colors.textLight, lineHeight: 15, marginTop: 2 },
  themeState: { fontSize: 11, fontWeight: '700', color: Colors.success },

  eventList: { gap: 8 },
  eventRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  eventDatePill: {
    paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primarySoft,
    minWidth: 64,
    alignItems: 'center',
  },
  eventDateText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  eventLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textDark },
  eventHint: { fontSize: 11, color: Colors.textLight, lineHeight: 15, marginTop: 2 },
  emptyText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
