// Template registry. Add new templates here so the renderer can dispatch
// them by name. The same name is used in marketing_drafts.assets[].template.

import { SatoriElement } from './h';
import { milestoneCard } from './milestoneCard';
import { quoteCard } from './quoteCard';
import { realStoryCard } from './realStoryCard';
import { tipCard } from './tipCard';
import {
  AnyTemplateProps,
  BrandSnapshot,
  MilestoneCardProps,
  QuoteCardProps,
  RealStoryCardProps,
  TemplateName,
  TipCardProps,
} from './types';

type TemplateFn<P> = (props: P, brand: BrandSnapshot) => SatoriElement;

const REGISTRY: { [K in TemplateName]: TemplateFn<any> } = {
  tipCard: tipCard as TemplateFn<TipCardProps>,
  quoteCard: quoteCard as TemplateFn<QuoteCardProps>,
  milestoneCard: milestoneCard as TemplateFn<MilestoneCardProps>,
  realStoryCard: realStoryCard as TemplateFn<RealStoryCardProps>,
};

export function getTemplate(name: string): TemplateFn<AnyTemplateProps> | null {
  return name in REGISTRY ? (REGISTRY[name as TemplateName] as TemplateFn<AnyTemplateProps>) : null;
}

export const TEMPLATE_NAMES: TemplateName[] = ['tipCard', 'quoteCard', 'milestoneCard', 'realStoryCard'];

export type {
  TemplateName,
  TipCardProps,
  QuoteCardProps,
  MilestoneCardProps,
  RealStoryCardProps,
  BrandSnapshot,
};
