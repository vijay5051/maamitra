import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

export const isAnthropicConfigured = (): boolean => !!apiKey;

export interface ChatContext {
  motherName: string;
  stage: string;
  state: string;
  diet: string;
  kidName?: string;
  kidAgeMonths?: number;
  kidDOB?: string;
  allergies?: string[] | null;
  healthConditions?: string[] | null;
}

export function buildSystemPrompt(ctx: ChatContext): string {
  return `You are MaaMitra, a warm and knowledgeable AI companion for Indian mothers. You are like a trusted, well-informed friend who genuinely cares.

ABOUT THIS MOTHER:
- Name: ${ctx.motherName}
- Stage: ${ctx.stage}
- Location: ${ctx.state}, India
- Diet: ${ctx.diet}
${ctx.kidName ? `- Baby's name: ${ctx.kidName}` : ''}
${ctx.kidAgeMonths !== undefined ? `- Baby's age: ${ctx.kidAgeMonths} months` : ''}
${ctx.allergies && ctx.allergies.length > 0 ? `- Known allergies: ${ctx.allergies.join(', ')}` : ''}
${ctx.healthConditions && ctx.healthConditions.length > 0 ? `- Health conditions: ${ctx.healthConditions.join(', ')}` : ''}

GUIDELINES:
- Speak warmly in simple English, like a knowledgeable friend — not a medical textbook
- Always be India-specific: suggest local foods (dal, ragi, khichdi, ghee), reference Indian seasons, festivals
- Follow IAP 2024 immunisation guidelines and FOGSI maternal health guidelines
- For medical emergencies, always say "Important — Act Now ⚠️" at the start and recommend calling doctor/108
- Keep responses concise (3-5 sentences usually enough), use emojis sparingly but warmly
- If asked about yoga/exercise, gently mention the Wellness tab
- Respect all dietary preferences (${ctx.diet})
- Never give diagnoses — always recommend consulting a doctor for medical concerns
- End with a warm note or emoji when appropriate
- Comply with India's DPDP Act 2023 — never store or request sensitive personal data beyond what's shared

EMERGENCY DETECTION: If user mentions: not breathing, unconscious, severe bleeding, fits/seizures, high fever >104°F, difficulty breathing — start response with "🚨 Important — Act Now ⚠️" and give first aid steps while calling for emergency help.`;
}

export function detectIsEmergency(text: string): boolean {
  const keywords = [
    'not breathing',
    'unconscious',
    'severe bleeding',
    'seizure',
    'fits',
    'convulsion',
    'not responding',
    'blue lips',
    '104',
    '105',
    '106',
    'high fever',
    'difficulty breathing',
    'stopped breathing',
    'choking',
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function detectIsFood(text: string): boolean {
  const keywords = [
    'food',
    'eat',
    'feed',
    'meal',
    'diet',
    'recipe',
    'nutrition',
    'solid',
    'fruit',
    'vegetable',
    'cereal',
    'porridge',
    'khichdi',
    'ragi',
    'dal',
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

export function detectIsYoga(text: string): boolean {
  const keywords = ['yoga', 'exercise', 'workout', 'stretch', 'fitness', 'pose', 'asana'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

// Non-streaming version for React Native compatibility
export async function sendMessage(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: ChatContext
): Promise<string> {
  if (!apiKey) {
    return "⚙️ AI chat isn't set up yet. Please add your Anthropic API key to the .env file to enable this feature.";
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildSystemPrompt(context),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const content = response.content[0];
    if (content.type === 'text') return content.text;
    return 'I had trouble understanding that. Could you try again?';
  } catch (error: any) {
    if (error?.status === 401)
      return '⚙️ Invalid API key. Please check your Anthropic API key in the .env file.';
    if (error?.status === 429)
      return "I'm getting a lot of requests right now. Please try again in a moment. 😊";
    console.error('Claude API error:', error);
    return "I'm having a little trouble right now. Please try again in a moment. 💙";
  }
}

export function getTopicTag(
  userMessage: string,
  botResponse: string
): { tag: string; color: string } {
  const text = (userMessage + ' ' + botResponse).toLowerCase();
  if (text.includes('vaccine') || text.includes('vaccination'))
    return { tag: '💉 Vaccines', color: '#3b82f6' };
  if (text.includes('food') || text.includes('eat') || text.includes('feed'))
    return { tag: '🥗 Nutrition', color: '#22c55e' };
  if (text.includes('sleep')) return { tag: '😴 Sleep', color: '#8b5cf6' };
  if (text.includes('yoga') || text.includes('exercise'))
    return { tag: '🧘 Wellness', color: '#f59e0b' };
  if (text.includes('fever') || text.includes('sick') || text.includes('doctor'))
    return { tag: '🏥 Health', color: '#ef4444' };
  if (text.includes('milestone') || text.includes('develop'))
    return { tag: '🌱 Development', color: '#10b981' };
  if (text.includes('anxiet') || text.includes('depress') || text.includes('overwhelm'))
    return { tag: '💙 Mental Health', color: '#6366f1' };
  return { tag: '💬 General', color: '#9ca3af' };
}
