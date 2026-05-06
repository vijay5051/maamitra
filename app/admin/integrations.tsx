// Integration Hub — comprehensive API key management + platform playbook.
//
// Three goals in one screen:
//   1. Live status — at a glance, which services are connected and healthy.
//   2. Key management — view, copy, rotate credentials without touching Firebase.
//   3. Platform playbook — understand how every service fits into the app so a
//      non-techie admin can self-serve any outage or rotation.

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function copyToClipboard(text: string): void {
  if (Platform.OS === 'web' && typeof navigator?.clipboard?.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

import { AdminPage } from '../../components/admin/ui';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import {
  checkIntegrationHealth,
  fetchIntegrationConfig,
  HealthCheckResults,
  IntegrationConfig,
  saveIntegrationConfig,
  ServiceResult,
  subscribeIntegrationConfig,
} from '../../services/integrations';
import { useAuthStore } from '../../store/useAuthStore';

// ── Integration definitions ───────────────────────────────────────────────────

type Category = 'all' | 'ai' | 'social' | 'infra' | 'build';

interface FieldDef {
  path: string[];    // lodash-style path into IntegrationConfig, e.g. ['openai','apiKey']
  label: string;
  hint: string;
  sensitive: boolean;
  placeholder: string;
}

interface IntegrationDef {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  category: Exclude<Category, 'all'>;
  tagline: string;
  description: string;
  healthKey?: keyof HealthCheckResults['results'];
  fields: FieldDef[];
  setupSteps: string[];
  dashboardUrl?: string;
  docsUrl?: string;
  alwaysOn?: boolean; // Firebase / GCP — no key, always connected
}

const INTEGRATIONS: IntegrationDef[] = [
  // ── AI & Content ──────────────────────────────────────────────────────────
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    icon: 'sparkles-outline',
    iconBg: '#10a37f',
    category: 'ai',
    tagline: 'Caption writing, inbox AI, and branded image generation.',
    description:
      'The app uses OpenAI for marketing captions, inbox classification, reply suggestions, and branded post images. Studio "Best" uses gpt-image-1 with your Brand Kit style profile; the edit brush also uses gpt-image-1. The API key is a Bearer token starting with sk-.',
    healthKey: 'openai',
    fields: [
      { path: ['openai', 'apiKey'], label: 'API Key', hint: 'Starts with sk-', sensitive: true, placeholder: 'sk-...' },
      { path: ['openai', 'defaultModel'], label: 'Default model', hint: 'e.g. gpt-4o-mini', sensitive: false, placeholder: 'gpt-4o-mini' },
    ],
    setupSteps: [
      'Go to platform.openai.com → API keys.',
      'Click "Create new secret key". Give it a name like "MaaMitra prod".',
      'Copy the key (it is only shown once).',
      'Paste it in the API Key field here and tap Save.',
      'Click "Test" to confirm the key is accepted.',
      'Optional: set a usage limit in platform.openai.com → Usage → Limits.',
    ],
    dashboardUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
  },
  {
    id: 'gemini',
    name: 'Google Gemini (Imagen)',
    icon: 'color-wand-outline',
    iconBg: '#4285f4',
    category: 'ai',
    tagline: 'High-quality AI image generation for marketing posts.',
    description:
      'When you generate a marketing post with the "Imagen" source, the app calls the Vertex AI / Gemini API to produce a photorealistic image. Imagen produces higher quality images than FLUX but costs more per image (~₹3.30 vs ₹0.25). The key is a Google AI Studio API key.',
    healthKey: 'gemini',
    fields: [
      { path: ['gemini', 'apiKey'], label: 'API Key', hint: 'Google AI Studio key', sensitive: true, placeholder: 'AIza...' },
    ],
    setupSteps: [
      'Go to aistudio.google.com → Get API key → Create API key.',
      'Select an existing Google Cloud project or create a new one.',
      'Copy the key (starts with AIza).',
      'Paste it here and tap Save.',
      'Make sure the Generative Language API is enabled in the Google Cloud Console.',
    ],
    dashboardUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
  },
  {
    id: 'replicate',
    name: 'Replicate (FLUX)',
    icon: 'git-branch-outline',
    iconBg: '#6366f1',
    category: 'ai',
    tagline: 'Fast, cheap AI image generation via FLUX Schnell.',
    description:
      'The "FLUX" option in the Studio and content generator calls Replicate to run the black-forest-labs/flux-schnell model. It is the cheapest AI image source (~₹0.25 per image) and is used as the default when you want AI images without high cost. The API token is a Replicate user token.',
    healthKey: 'replicate',
    fields: [
      { path: ['replicate', 'apiToken'], label: 'API Token', hint: 'Replicate user token', sensitive: true, placeholder: 'r8_...' },
    ],
    setupSteps: [
      'Go to replicate.com → Sign in → Account settings → API tokens.',
      'Click "Create token". Give it a name.',
      'Copy the token (starts with r8_).',
      'Paste it here and tap Save.',
    ],
    dashboardUrl: 'https://replicate.com/account/api-tokens',
    docsUrl: 'https://replicate.com/docs',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude (Chat AI)',
    icon: 'chatbubble-ellipses-outline',
    iconBg: '#d97706',
    category: 'ai',
    tagline: 'The AI companion that powers every user chat conversation.',
    description:
      'Every "Chat" session in the app is handled by Claude (claude-sonnet model). The API key never touches the client — it lives in a Cloudflare Worker that acts as a secure proxy. The Worker URL is what the app calls; the Worker forwards requests to Anthropic with the key attached server-side.',
    healthKey: 'anthropicWorker',
    fields: [
      { path: ['anthropic', 'workerUrl'], label: 'Cloudflare Worker URL', hint: 'e.g. https://claude-proxy.your-domain.workers.dev', sensitive: false, placeholder: 'https://...' },
    ],
    setupSteps: [
      'The Cloudflare Worker is deployed at workers.cloudflare.com.',
      'If you need to rotate the Anthropic key: go to console.anthropic.com → API Keys → Create Key.',
      'In the Cloudflare dashboard → Workers → your proxy worker → Settings → Variables, update the ANTHROPIC_API_KEY secret.',
      'The Worker URL itself only changes if you rename or move the Worker — update it here when that happens.',
    ],
    dashboardUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'pexels',
    name: 'Pexels (Stock Photos)',
    icon: 'image-outline',
    iconBg: '#059669',
    category: 'ai',
    tagline: 'Free stock photos for marketing post backgrounds.',
    description:
      'When you choose "Stock photo" as the background source in the Studio or content generator, the app calls the Pexels API to search for a relevant image. Pexels is free for commercial use (unlimited calls, attribution encouraged). The API key is a simple string — no expiry, but tied to a Pexels account.',
    healthKey: 'pexels',
    fields: [
      { path: ['pexels', 'apiKey'], label: 'API Key', hint: 'Pexels API key', sensitive: true, placeholder: 'Pexels API key' },
    ],
    setupSteps: [
      'Go to pexels.com/api → Sign in → Your API key.',
      'Copy the key from the dashboard.',
      'Paste it here and tap Save.',
      'The key has no expiry but is tied to your Pexels account.',
    ],
    dashboardUrl: 'https://www.pexels.com/api/',
    docsUrl: 'https://www.pexels.com/api/documentation/',
  },
  // ── Social & Marketing ────────────────────────────────────────────────────
  {
    id: 'ig',
    name: 'Instagram (Meta)',
    icon: 'logo-instagram',
    iconBg: '#c13584',
    category: 'social',
    tagline: 'Publish posts, receive comments and DMs in the inbox.',
    description:
      'Instagram integration has two parts: (1) Publishing — when you schedule or manually publish a post, the app calls the Instagram Content Publishing API using your IG User ID and the access token. (2) Inbox — the Meta Webhook endpoint receives incoming comments and DMs in real time, stores them in the inbox, and lets you reply through the admin panel.',
    healthKey: 'ig',
    fields: [
      { path: ['meta', 'igUserId'], label: 'IG User ID', hint: 'Numeric ID of the Instagram Business account', sensitive: false, placeholder: '17841...' },
      { path: ['meta', 'igAccessToken'], label: 'Access Token', hint: 'Long-lived Page or System User token (EAA...)', sensitive: true, placeholder: 'EAA...' },
    ],
    setupSteps: [
      'In Meta Business Suite, connect your Instagram Business account to a Facebook Page.',
      'Create a System User in Business Manager → Users → System Users.',
      'Assign "Full Control" of the Instagram account and the Facebook Page to the System User.',
      'Generate a System User access token with instagram_basic, instagram_content_publish, pages_read_engagement, pages_manage_posts permissions.',
      'Copy the numeric Instagram User ID (visible in Graph API Explorer: GET /me?fields=id).',
      'Paste both the User ID and token here and tap Save.',
      'For the Webhook (inbox): set the Webhook URL in Meta App Dashboard → Webhooks to the metaWebhookReceiver Cloud Function URL, and set the Verify Token to match the value below.',
    ],
    dashboardUrl: 'https://business.facebook.com/settings',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
  },
  {
    id: 'fb',
    name: 'Facebook Page (Meta)',
    icon: 'logo-facebook',
    iconBg: '#1877f2',
    category: 'social',
    tagline: 'Publish to your Facebook Page and pull post insights.',
    description:
      'Facebook publishing uses the Graph API Page API. The app derives a Page Access Token from the System User token at runtime (getFbPagePat call), then posts to the Page using that token. Insights (likes, reach, impressions) are fetched every 6 hours by a background cron and displayed in the Insights tab.',
    healthKey: 'fb',
    fields: [
      { path: ['meta', 'fbPageId'], label: 'FB Page ID', hint: 'Numeric ID of the Facebook Page', sensitive: false, placeholder: '1234...' },
      { path: ['meta', 'fbPageAccessToken'], label: 'System User Token', hint: 'Used to derive a Page Access Token at runtime', sensitive: true, placeholder: 'EAA...' },
    ],
    setupSteps: [
      'Find your Page ID: go to facebook.com/your-page → About → Page transparency, or via Graph API: GET /me?fields=id.',
      'The System User token from the Instagram setup above usually also works here (same token).',
      'To verify: in Graph API Explorer, run GET /{page-id}?access_token=YOUR_TOKEN — it should return the page name.',
      'Paste the Page ID and token here and tap Save.',
    ],
    dashboardUrl: 'https://business.facebook.com/settings',
    docsUrl: 'https://developers.facebook.com/docs/pages-api',
  },
  {
    id: 'metaWebhook',
    name: 'Meta Webhook (Inbox)',
    icon: 'radio-outline',
    iconBg: '#0099ff',
    category: 'social',
    tagline: 'Receives real-time comments and DMs from Meta.',
    description:
      'The webhook is how Meta pushes events (new comments, DMs, mentions) to the app in real time. The App Secret is used to verify HMAC signatures on every incoming request so fake events are rejected. The Verify Token is a string you choose — Meta sends it back during the initial handshake to confirm you own the endpoint.',
    fields: [
      { path: ['meta', 'appSecret'], label: 'App Secret', hint: 'Meta App → Settings → Basic → App Secret', sensitive: true, placeholder: 'Meta App Secret' },
      { path: ['meta', 'webhookVerifyToken'], label: 'Webhook Verify Token', hint: 'Any string you choose (e.g. maamitra-webhook-2024)', sensitive: true, placeholder: 'custom-token' },
    ],
    setupSteps: [
      'App Secret: go to developers.facebook.com → Your App → Settings → Basic → App Secret → Show.',
      'Copy it and paste in the field above.',
      'Webhook Verify Token: choose any secret string (e.g. "maamitra-webhook-prod-2024"). Save it here first.',
      'In Meta App Dashboard → Webhooks → Instagram → Edit, set the Callback URL to the Cloud Function URL and the Verify Token to the same string you saved.',
      'Subscribe to: messages, comments, mentions fields.',
      'Click "Verify and Save" — Meta will hit your endpoint once to confirm.',
    ],
    dashboardUrl: 'https://developers.facebook.com/apps',
    docsUrl: 'https://developers.facebook.com/docs/graph-api/webhooks',
  },
  {
    id: 'metaAds',
    name: 'Meta Ads (Boost)',
    icon: 'trending-up-outline',
    iconBg: '#0264d4',
    category: 'social',
    tagline: 'Boost published posts with paid promotion via Marketing API.',
    description:
      'The "Boost this post" button in the Posts hub creates an ad campaign, ad set, creative, and ad in your Meta Ad Account — all through the Marketing API. This requires an Ad Account ID and a System User token with ads_management + ads_read permissions. Until these are configured, Boost is gracefully disabled.',
    fields: [
      { path: ['meta', 'adAccountId'], label: 'Ad Account ID', hint: 'From Business Manager → Ad Accounts (numeric, without act_ prefix)', sensitive: false, placeholder: '987654...' },
    ],
    setupSteps: [
      'In Meta Business Manager → Ad Accounts, find your Ad Account ID (the number shown, without "act_" prefix).',
      'Assign the System User to the Ad Account with "Analyst" or higher permissions.',
      'Make sure the System User token has ads_management and ads_read permissions (re-generate if needed).',
      'Paste the Ad Account ID here and tap Save.',
      'The System User token used for Instagram/Facebook is reused for ads — no separate token needed.',
    ],
    dashboardUrl: 'https://business.facebook.com/adsmanager',
    docsUrl: 'https://developers.facebook.com/docs/marketing-api',
  },
  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    id: 'firebase',
    name: 'Firebase (Google)',
    icon: 'flame-outline',
    iconBg: '#ff6d00',
    category: 'infra',
    tagline: 'Core infrastructure: database, auth, storage, functions, hosting.',
    description:
      'Firebase is the backbone of the entire platform. Firestore is the real-time database (every user, post, chat, draft, notification). Firebase Auth handles all sign-ins (phone OTP, Google, email). Firebase Storage holds every photo and generated image. Cloud Functions run all the backend logic. Firebase Hosting serves the web app.',
    alwaysOn: true,
    fields: [],
    setupSteps: [
      'Firebase is configured automatically through the google-services.json file on Android and GoogleService-Info.plist on iOS.',
      'Web configuration lives in services/firebase.ts via EXPO_PUBLIC_* env vars.',
      'To rotate: go to Firebase Console → Project settings → Service accounts → Generate new private key.',
      'For Security Rules changes: edit firestore.rules / storage.rules and run firebase deploy --only firestore:rules,storage.',
    ],
    dashboardUrl: 'https://console.firebase.google.com',
    docsUrl: 'https://firebase.google.com/docs',
  },
  {
    id: 'googleTts',
    name: 'Google Cloud Text-to-Speech',
    icon: 'volume-high-outline',
    iconBg: '#34a853',
    category: 'infra',
    tagline: 'Reads Claude\'s chat replies aloud in 11 Indian languages.',
    description:
      'When a user taps the speaker icon on a chat message, the synthesizeSpeech Cloud Function calls Google Cloud TTS to convert the text to MP3 audio in the user\'s preferred language (Hindi, Tamil, Bengali, etc.). The function uses the Firebase project\'s service account credentials — no separate API key needed. It is automatically enabled when the Cloud Text-to-Speech API is active in the Google Cloud project.',
    alwaysOn: true,
    fields: [],
    setupSteps: [
      'Go to Google Cloud Console → APIs & Services → Enable APIs → search "Cloud Text-to-Speech API" → Enable.',
      'No additional credentials are needed — the Cloud Functions service account already has access within the same GCP project.',
    ],
    dashboardUrl: 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com',
    docsUrl: 'https://cloud.google.com/text-to-speech/docs',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers',
    icon: 'cloud-outline',
    iconBg: '#f6821f',
    category: 'infra',
    tagline: 'Secure proxy for the Anthropic Claude API.',
    description:
      'A Cloudflare Worker sits between the mobile app and Anthropic\'s API. The app sends chat messages to the Worker URL; the Worker appends the Anthropic API key (stored as a Cloudflare Secret) and forwards to Claude. This keeps the API key server-side — it never reaches the user\'s device. The Worker URL is what you configure above in the Anthropic section.',
    alwaysOn: true,
    fields: [],
    setupSteps: [
      'The Worker is deployed at workers.cloudflare.com under your Cloudflare account.',
      'To rotate the Anthropic key: Cloudflare Dashboard → Workers → your proxy → Settings → Variables → Edit ANTHROPIC_API_KEY.',
      'To check Worker health: tap "Test" on the Anthropic section above.',
      'To view logs: Cloudflare Dashboard → Workers → your proxy → Logs.',
    ],
    dashboardUrl: 'https://dash.cloudflare.com',
    docsUrl: 'https://developers.cloudflare.com/workers/',
  },
  // ── Build & Deploy ────────────────────────────────────────────────────────
  {
    id: 'eas',
    name: 'EAS (Expo Application Services)',
    icon: 'phone-portrait-outline',
    iconBg: '#000020',
    category: 'build',
    tagline: 'Mobile builds (AAB/IPA) and OTA JavaScript updates.',
    description:
      'EAS Build produces the Android AAB (Play Store upload) and iOS IPA. EAS Update ships JavaScript-only changes to users who already have the app installed — no Play Store review, live within minutes. Both are triggered via GitHub Actions (push to main auto-triggers the OTA flow). AAB builds are done manually via "Run workflow" in GitHub Actions.',
    alwaysOn: true,
    fields: [],
    setupSteps: [
      'EAS is tied to the Expo account (rockingvsr). No key rotation needed.',
      'To trigger an OTA update: push code to main → GitHub Actions runs the "Deploy Web + OTA" workflow automatically.',
      'To build a new AAB: go to GitHub → Actions → "Build Mobile (Android / iOS)" → Run workflow.',
      'To download the AAB for Play Store upload: go to expo.dev/accounts/rockingvsr/projects/maamitra/builds.',
    ],
    dashboardUrl: 'https://expo.dev/accounts/rockingvsr/projects/maamitra/builds',
    docsUrl: 'https://docs.expo.dev/eas/',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'logo-github',
    iconBg: '#24292e',
    category: 'build',
    tagline: 'Source code hosting + CI/CD automation.',
    description:
      'All source code lives in the GitHub repository. GitHub Actions runs three workflows: (1) Deploy Web — builds the Expo web app and deploys to Firebase Hosting. (2) Deploy Functions — deploys Cloud Functions. (3) Build Mobile — triggers EAS Build for Android/iOS. Secrets (Firebase, EAS tokens) are stored in GitHub Actions Secrets.',
    alwaysOn: true,
    fields: [],
    setupSteps: [
      'To add or rotate a GitHub Actions secret: repo → Settings → Secrets and variables → Actions → New repository secret.',
      'Key secrets: FIREBASE_SERVICE_ACCOUNT (for firebase deploy), EXPO_TOKEN (for eas build/update).',
      'To re-run a failed workflow: GitHub Actions → click the failed run → Re-run jobs.',
    ],
    dashboardUrl: 'https://github.com/vijay5051/maamitra',
    docsUrl: 'https://docs.github.com/en/actions',
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  all: 'All',
  ai: 'AI & Content',
  social: 'Social & Marketing',
  infra: 'Infrastructure',
  build: 'Build & Deploy',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminIntegrations() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<IntegrationConfig | null>(null);
  const [health, setHealth] = useState<HealthCheckResults | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArch, setShowArch] = useState(false);

  // Draft edits — keyed by dotted path
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsub = subscribeIntegrationConfig(setConfig);
    return unsub;
  }, []);

  async function runHealthCheck(triggeringId?: string) {
    if (checking) return;
    setCheckingId(triggeringId ?? null);
    setChecking(true);
    try {
      const result = await checkIntegrationHealth();
      setHealth(result);
    } catch (e: any) {
      Alert.alert('Health check failed', e?.message ?? String(e));
    } finally {
      setChecking(false);
      setCheckingId(null);
    }
  }

  async function handleSave(integId: string) {
    if (!user || saving) return;
    setSaving(true);
    try {
      // Build nested patch from draft
      const patch: Record<string, any> = {};
      for (const [dotPath, val] of Object.entries(draft)) {
        const parts = dotPath.split('.');
        if (parts.length === 2) {
          patch[parts[0]] ??= {};
          patch[parts[0]][parts[1]] = val;
        }
      }
      if (Object.keys(patch).length === 0) {
        setEditingId(null);
        setDraft({});
        return;
      }
      await saveIntegrationConfig({ uid: user.uid, email: user.email ?? null }, patch as any);
      setEditingId(null);
      setDraft({});
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote(integId: string, note: string) {
    if (!user) return;
    await saveIntegrationConfig(
      { uid: user.uid, email: user.email ?? null },
      { notes: { [integId]: note } } as any,
    );
  }

  const visibleIntegrations = category === 'all'
    ? INTEGRATIONS
    : INTEGRATIONS.filter((i) => i.category === category);

  const connectedCount = health
    ? Object.values(health.results).filter((r) => r.ok).length
    : null;
  const totalTestable = INTEGRATIONS.filter((i) => !!i.healthKey).length;

  return (
    <>
      <Stack.Screen options={{ title: 'Integration Hub' }} />
      <AdminPage
        title="Integration Hub"
        description="Live status, API key management, and step-by-step setup guides for every external service MaaMitra uses."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Settings', href: '/admin/settings' }, { label: 'Integration Hub' }]}
      >

        {/* ── Health Summary ─────────────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <View style={[styles.summaryDot, {
              backgroundColor: connectedCount === null ? '#9ca3af'
                : connectedCount === totalTestable ? '#22c55e'
                  : connectedCount > 0 ? '#f59e0b' : '#ef4444'
            }]} />
            <View>
              {connectedCount !== null ? (
                <Text style={styles.summaryTitle}>{connectedCount} of {totalTestable} services reachable</Text>
              ) : (
                <Text style={styles.summaryTitle}>Run a health check to see live status</Text>
              )}
              {health ? (
                <Text style={styles.summarySub}>Last checked {formatTime(health.checkedAt)}</Text>
              ) : (
                <Text style={styles.summarySub}>Keys are stored in Firestore — editable below</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.testAllBtn, checking && { opacity: 0.6 }]}
            onPress={() => runHealthCheck()}
            disabled={checking}
            activeOpacity={0.8}
          >
            {checking
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="refresh-outline" size={15} color="#fff" />
            }
            <Text style={styles.testAllText}>{checking ? 'Testing…' : 'Test all'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Category Filter ────────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow} contentContainerStyle={styles.pillContent}>
          {(['all', 'ai', 'social', 'infra', 'build'] as Category[]).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.pill, category === c && styles.pillActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.pillText, category === c && styles.pillTextActive]}>
                {CATEGORY_LABELS[c]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Integration Cards ──────────────────────────────────────────────── */}
        {visibleIntegrations.map((integ) => {
          const serviceResult = integ.healthKey ? health?.results[integ.healthKey] : undefined;
          const isExpanded = expandedId === integ.id;
          const isEditing = editingId === integ.id;

          return (
            <IntegrationCard
              key={integ.id}
              integ={integ}
              config={config}
              result={serviceResult}
              expanded={isExpanded}
              editing={isEditing}
              saving={saving}
              draft={draft}
              testing={checking && checkingId === integ.id}
              noteValue={config?.notes?.[integ.id] ?? ''}
              onToggle={() => setExpandedId(isExpanded ? null : integ.id)}
              onEdit={() => {
                // Pre-populate draft with current config values
                const initial: Record<string, string> = {};
                for (const f of integ.fields) {
                  initial[f.path.join('.')] = getConfigValue(config, f.path);
                }
                setDraft(initial);
                setEditingId(integ.id);
              }}
              onCancelEdit={() => { setEditingId(null); setDraft({}); }}
              onSave={() => handleSave(integ.id)}
              onDraftChange={(path, val) => setDraft((d) => ({ ...d, [path]: val }))}
              onTest={integ.healthKey ? () => runHealthCheck(integ.id) : undefined}
              onSaveNote={(note) => handleSaveNote(integ.id, note)}
            />
          );
        })}

        {/* ── Platform Architecture Playbook ────────────────────────────────── */}
        <TouchableOpacity
          style={styles.archHeader}
          onPress={() => setShowArch((v) => !v)}
          activeOpacity={0.8}
        >
          <View style={styles.archHeaderLeft}>
            <Ionicons name="map-outline" size={18} color={Colors.primary} />
            <Text style={styles.archHeaderText}>Platform Architecture — How it all fits together</Text>
          </View>
          <Ionicons name={showArch ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textLight} />
        </TouchableOpacity>
        {showArch && <ArchitectureSection />}

        <View style={{ height: 40 }} />
      </AdminPage>
    </>
  );
}

// ── Integration Card ──────────────────────────────────────────────────────────

function IntegrationCard({
  integ, config, result, expanded, editing, saving, draft,
  testing, noteValue,
  onToggle, onEdit, onCancelEdit, onSave, onDraftChange, onTest, onSaveNote,
}: {
  integ: IntegrationDef;
  config: IntegrationConfig | null;
  result?: ServiceResult;
  expanded: boolean;
  editing: boolean;
  saving: boolean;
  draft: Record<string, string>;
  testing: boolean;
  noteValue: string;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDraftChange: (path: string, val: string) => void;
  onTest?: () => void;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const [showSetup, setShowSetup] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  return (
    <View style={styles.card}>
      {/* Card header — always visible */}
      <Pressable style={styles.cardHeader} onPress={onToggle}>
        <View style={[styles.cardIcon, { backgroundColor: integ.iconBg + '22' }]}>
          <Ionicons name={integ.icon} size={20} color={integ.iconBg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{integ.name}</Text>
            <CategoryBadge category={integ.category} />
          </View>
          <Text style={styles.cardTagline} numberOfLines={expanded ? undefined : 1}>{integ.tagline}</Text>
        </View>
        <View style={styles.cardRight}>
          {integ.alwaysOn
            ? <StatusBadge ok={true} label="Built-in" />
            : result
              ? <StatusBadge ok={result.ok} label={result.ok ? 'Connected' : 'Error'} latencyMs={result.latencyMs} />
              : integ.healthKey
                ? <StatusBadge ok={null} label="Not tested" />
                : <StatusBadge ok={null} label="Config only" />
          }
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textLight} style={{ marginTop: 2 }} />
        </View>
      </Pressable>

      {/* Expanded body */}
      {expanded && (
        <View style={styles.cardBody}>
          {/* Test result banners */}
          {result && !result.ok && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={14} color="#b91c1c" />
              <Text style={styles.errorText}>{result.error ?? 'Connection failed.'}</Text>
            </View>
          )}
          {result?.ok && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />
              <Text style={styles.successText}>{result.detail ?? 'Connected'}{result.latencyMs ? ` — ${result.latencyMs}ms` : ''}</Text>
            </View>
          )}

          {/* Description */}
          <Text style={styles.description}>{integ.description}</Text>

          {/* Credential fields */}
          {integ.fields.length > 0 && (
            <View style={styles.fieldsSection}>
              <View style={styles.fieldsSectionHeader}>
                <Text style={styles.fieldsSectionTitle}>Credentials</Text>
                {!editing && (
                  <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
                    <Ionicons name="pencil-outline" size={13} color={Colors.primary} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {integ.fields.map((field) => {
                const dotPath = field.path.join('.');
                const currentVal = editing ? (draft[dotPath] ?? '') : getConfigValue(config, field.path);
                return (
                  <CredentialField
                    key={dotPath}
                    field={field}
                    value={currentVal}
                    editing={editing}
                    onChange={(v) => onDraftChange(dotPath, v)}
                  />
                );
              })}

              {editing && (
                <View style={styles.saveRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onCancelEdit} disabled={saving}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                    onPress={onSave}
                    disabled={saving}
                  >
                    {saving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Save</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {onTest && !integ.alwaysOn && (
              <TouchableOpacity
                style={[styles.actionBtn, testing && { opacity: 0.7 }]}
                onPress={onTest}
                disabled={testing}
              >
                {testing
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Ionicons name="pulse-outline" size={14} color={Colors.primary} />
                }
                <Text style={styles.actionBtnText}>{testing ? 'Testing…' : 'Test connection'}</Text>
              </TouchableOpacity>
            )}
            {integ.dashboardUrl && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(integ.dashboardUrl!)}>
                <Ionicons name="open-outline" size={14} color={Colors.textLight} />
                <Text style={[styles.actionBtnText, { color: Colors.textLight }]}>Dashboard</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSetup((v) => !v)}>
              <Ionicons name="book-outline" size={14} color={Colors.textLight} />
              <Text style={[styles.actionBtnText, { color: Colors.textLight }]}>
                {showSetup ? 'Hide guide' : 'Setup guide'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Setup guide */}
          {showSetup && (
            <View style={styles.setupGuide}>
              <Text style={styles.setupGuideTitle}>How to set up / rotate {integ.name}</Text>
              {integ.setupSteps.map((step, i) => (
                <View key={i} style={styles.setupStep}>
                  <View style={styles.setupStepNum}>
                    <Text style={styles.setupStepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.setupStepText}>{step}</Text>
                </View>
              ))}
              {integ.docsUrl && (
                <TouchableOpacity style={styles.docsLink} onPress={() => Linking.openURL(integ.docsUrl!)}>
                  <Ionicons name="document-text-outline" size={13} color={Colors.primary} />
                  <Text style={styles.docsLinkText}>Official docs →</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Notes / Remarks */}
          <View style={styles.notesSection}>
            <View style={styles.notesSectionHeader}>
              <View style={styles.notesHeaderLeft}>
                <Ionicons name="document-text-outline" size={13} color={Colors.textLight} />
                <Text style={styles.fieldsSectionTitle}>Notes</Text>
              </View>
              {!editingNote && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => { setNoteDraft(noteValue); setEditingNote(true); }}
                >
                  <Ionicons name="pencil-outline" size={13} color={Colors.primary} />
                  <Text style={styles.editBtnText}>{noteValue ? 'Edit' : 'Add note'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {editingNote ? (
              <View style={styles.notesEditWrap}>
                <TextInput
                  style={styles.notesInput}
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="e.g. Rotated 2026-05-01 · Account: admin@yourorg.com · Rate limit: 5 req/min"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  autoFocus
                />
                <View style={styles.saveRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setEditingNote(false)}
                    disabled={savingNote}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, savingNote && { opacity: 0.6 }]}
                    disabled={savingNote}
                    onPress={async () => {
                      setSavingNote(true);
                      try {
                        await onSaveNote(noteDraft.trim());
                        setEditingNote(false);
                      } catch (e: any) {
                        Alert.alert('Save failed', e?.message ?? String(e));
                      } finally {
                        setSavingNote(false);
                      }
                    }}
                  >
                    {savingNote
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.saveBtnText}>Save</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : noteValue ? (
              <Text style={styles.notesText}>{noteValue}</Text>
            ) : (
              <Text style={styles.notesEmpty}>No notes yet — tap "Add note" to store rotation dates, account info, or any reminders.</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Credential Field ──────────────────────────────────────────────────────────

function CredentialField({ field, value, editing, onChange }: {
  field: FieldDef;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const isEmpty = !value;
  const display = field.sensitive && !revealed ? maskValue(value) : value;

  return (
    <View style={styles.credRow}>
      <Text style={styles.credLabel}>{field.label}</Text>
      {editing ? (
        <View style={styles.credInputWrap}>
          <TextInput
            style={styles.credInput}
            value={value}
            onChangeText={onChange}
            placeholder={field.placeholder}
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={field.sensitive && !revealed}
          />
          {field.sensitive && (
            <TouchableOpacity style={styles.revealBtn} onPress={() => setRevealed((v) => !v)}>
              <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={14} color={Colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.credValueRow}>
          <Text style={[styles.credValue, isEmpty && styles.credValueEmpty]} numberOfLines={1}>
            {isEmpty ? `Not set — ${field.hint}` : display}
          </Text>
          <View style={styles.credActions}>
            {field.sensitive && !isEmpty && (
              <TouchableOpacity onPress={() => setRevealed((v) => !v)}>
                <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={14} color={Colors.textLight} />
              </TouchableOpacity>
            )}
            {!isEmpty && (
              <TouchableOpacity onPress={() => copyToClipboard(value)}>
                <Ionicons name="copy-outline" size={14} color={Colors.textLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      <Text style={styles.credHint}>{field.hint}</Text>
    </View>
  );
}

// ── Architecture Section ──────────────────────────────────────────────────────

function ArchitectureSection() {
  const blocks: { title: string; color: string; icon: keyof typeof Ionicons.glyphMap; body: string }[] = [
    {
      title: 'App Core — Firebase',
      color: '#ff6d00',
      icon: 'flame-outline',
      body:
        'Firestore is the single source of truth. Every user profile, baby record, community post, chat thread, marketing draft, inbox message, and push notification flows through Firestore. Firebase Auth handles all sign-ins. Firebase Storage holds images. Cloud Functions (Node.js 20) execute all backend logic including publishing, AI calls, and health probes.',
    },
    {
      title: 'AI Chat — Claude via Cloudflare Worker',
      color: '#d97706',
      icon: 'chatbubble-ellipses-outline',
      body:
        'User taps Chat → app sends message to the Cloudflare Worker URL → Worker adds the Anthropic API key → Claude generates a response → Worker returns it to the app. The API key never reaches the user\'s device. The Worker also handles streaming. Google Cloud TTS converts Claude\'s text to MP3 for the voice playback button.',
    },
    {
      title: 'Marketing Content Generation',
      color: '#10a37f',
      icon: 'sparkles-outline',
      body:
        'Admin clicks "Generate" in Studio → Cloud Function generateMarketingDraft / generateStudioVariants → GPT-4o-mini writes caption JSON → Imagen/FLUX/DALL-E/Pexels provides the background image → Satori renders a branded 1080×1080 PNG → Firebase Storage stores it → Firestore marketing_drafts row created. Scheduled publishing runs every 5 minutes via a Cloud Scheduler job.',
    },
    {
      title: 'Social Publishing — Instagram + Facebook',
      color: '#c13584',
      icon: 'share-social-outline',
      body:
        'Admin approves & schedules → scheduledMarketingPublisher Cloud Function picks it up at the scheduled time → calls Instagram Content Publishing API (2-step: container + publish) → optionally mirrors to Facebook Page via Page Access Token → updates draft status to "posted". Post metrics (likes, reach, saves) are polled every 6 hours by pollMarketingInsights.',
    },
    {
      title: 'Inbox — Incoming Comments & DMs',
      color: '#0099ff',
      icon: 'radio-outline',
      body:
        'Meta fires a POST webhook to the metaWebhookReceiver Cloud Function on every new comment or DM → HMAC-SHA256 signature is verified with the App Secret → event is stored in marketing_inbox → Admin sees it in the Replies tab → classifyInboxThread tags sentiment/intent → generateInboxReplies suggests 3 reply drafts → Admin picks one → metaInboxReplyPublisher sends it via Graph API.',
    },
    {
      title: 'Push Notifications',
      color: '#7c3aed',
      icon: 'notifications-outline',
      body:
        'Any code writes a doc to push_queue → Firestore trigger fires the dispatchPush Cloud Function → it reads FCM tokens from the target user doc(s) → calls Firebase Cloud Messaging → delivers to device. Scheduled pushes sit in scheduled_pushes until processScheduledPushes (every 5 min) promotes them. Dead tokens are pruned automatically on first failure.',
    },
    {
      title: 'Mobile Builds & OTA Updates',
      color: '#000020',
      icon: 'phone-portrait-outline',
      body:
        'Push to main → GitHub Actions runs the deploy workflow → expo export builds the web bundle → firebase deploy ships it to Hosting → eas update ships a JavaScript OTA to existing app installs (live in ~1 min). A full native rebuild (new AAB for Play Store) is triggered manually via GitHub Actions → EAS Build → download from expo.dev → upload to Play Console.',
    },
  ];

  return (
    <View style={styles.archBody}>
      <Text style={styles.archIntro}>
        MaaMitra is built on a serverless architecture — no dedicated servers to maintain. Here is how every major
        user action maps to a specific service.
      </Text>
      {blocks.map((b, i) => (
        <View key={i} style={[styles.archBlock, { borderLeftColor: b.color }]}>
          <View style={styles.archBlockHeader}>
            <Ionicons name={b.icon} size={16} color={b.color} />
            <Text style={[styles.archBlockTitle, { color: b.color }]}>{b.title}</Text>
          </View>
          <Text style={styles.archBlockBody}>{b.body}</Text>
        </View>
      ))}
      <View style={styles.archNote}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.textLight} />
        <Text style={styles.archNoteText}>
          All API keys are stored in Firestore at app_settings/integrations (admin-only read). Cloud Functions read
          this doc with a 5-minute in-process cache and fall back to environment variables. Rotate any key here and
          it takes effect on the next function invocation — no redeploy needed.
        </Text>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ ok, label, latencyMs }: { ok: boolean | null; label: string; latencyMs?: number }) {
  const bg = ok === true ? '#dcfce7' : ok === false ? '#fee2e2' : '#f3f4f6';
  const fg = ok === true ? '#166534' : ok === false ? '#991b1b' : '#6b7280';
  const dot = ok === true ? '#22c55e' : ok === false ? '#ef4444' : '#9ca3af';
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: dot }]} />
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
      {latencyMs !== undefined && ok === true && (
        <Text style={[styles.badgeText, { color: fg, opacity: 0.7, marginLeft: 2 }]}>{latencyMs}ms</Text>
      )}
    </View>
  );
}

function CategoryBadge({ category }: { category: Exclude<Category, 'all'> }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    ai:     { bg: '#ede9fe', fg: '#6d28d9' },
    social: { bg: '#fce7f3', fg: '#9d174d' },
    infra:  { bg: '#fff7ed', fg: '#c2410c' },
    build:  { bg: '#f0fdf4', fg: '#166534' },
  };
  const c = colors[category] ?? { bg: '#f3f4f6', fg: '#374151' };
  return (
    <View style={[styles.catBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.catBadgeText, { color: c.fg }]}>{CATEGORY_LABELS[category]}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getConfigValue(config: IntegrationConfig | null, path: string[]): string {
  if (!config) return '';
  let cur: any = config;
  for (const k of path) { cur = cur?.[k]; }
  return typeof cur === 'string' ? cur : '';
}

function maskValue(val: string): string {
  if (!val) return '';
  if (val.length <= 8) return '••••••••';
  return val.slice(0, 4) + '••••••••' + val.slice(-4);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Summary banner
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  summaryTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  summarySub: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  testAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  testAllText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Category pills
  pillRow: { marginBottom: Spacing.md },
  pillContent: { gap: 6, paddingHorizontal: 0, paddingVertical: 2 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgLight,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  pillActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: Colors.textDark },
  pillTextActive: { color: Colors.primary },

  // Card
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark },
  cardTagline: { fontSize: 12, color: Colors.textLight, lineHeight: 16 },
  cardRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },

  // Card body
  cardBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm },
  description: { fontSize: 13, color: Colors.textMuted, lineHeight: 19 },

  // Status boxes
  errorBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  errorText: { fontSize: 12, color: '#7f1d1d', flex: 1, lineHeight: 17 },
  successBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  successText: { fontSize: 12, color: '#166534', flex: 1 },

  // Credentials section
  fieldsSection: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 8,
  },
  fieldsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  fieldsSectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  credRow: { gap: 3 },
  credLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  credValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  credValue: { fontSize: 13, color: Colors.textDark, flex: 1, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  credValueEmpty: { color: Colors.textLight, fontFamily: undefined, fontStyle: 'italic', fontSize: 12 },
  credActions: { flexDirection: 'row', gap: 8 },
  credHint: { fontSize: 10, color: Colors.textLight },
  credInputWrap: { flexDirection: 'row', alignItems: 'center' },
  credInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: Colors.textDark,
    backgroundColor: Colors.cardBg,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  revealBtn: { padding: 6, marginLeft: 4 },

  // Save row
  saveRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: Colors.textDark },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  saveBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Action row
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.bgLight,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Setup guide
  setupGuide: {
    backgroundColor: '#fffbeb',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: Spacing.sm,
    gap: 8,
  },
  setupGuideTitle: { fontSize: 12, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  setupStep: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  setupStepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  setupStepNumText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  setupStepText: { fontSize: 12, color: '#78350f', flex: 1, lineHeight: 18 },
  docsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  docsLinkText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Badges
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  catBadgeText: { fontSize: 10, fontWeight: '700' },

  // Architecture section
  archHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Shadow.sm,
  },
  archHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  archHeaderText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textDark, flex: 1 },
  archBody: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: 2,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: Spacing.sm,
  },
  archIntro: { fontSize: 13, color: Colors.textMuted, lineHeight: 19, marginBottom: 4 },
  archBlock: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    gap: 4,
  },
  archBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  archBlockTitle: { fontSize: 13, fontWeight: '700' },
  archBlockBody: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  archNote: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginTop: 4,
  },
  archNoteText: { fontSize: 11, color: Colors.textLight, flex: 1, lineHeight: 16 },

  // Notes section
  notesSection: {
    backgroundColor: Colors.bgLight,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notesHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  notesText: { fontSize: 13, color: Colors.textDark, lineHeight: 19 },
  notesEmpty: { fontSize: 12, color: Colors.textLight, fontStyle: 'italic', lineHeight: 17 },
  notesEditWrap: { gap: 8 },
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textDark,
    backgroundColor: Colors.cardBg,
    minHeight: 90,
    lineHeight: 19,
  },
});
