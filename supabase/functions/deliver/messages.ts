import type { MessageFacts } from './facts.ts';
import type { TrailMapLinks } from './links.ts';
import { render as renderDe } from './messages.de.ts';
import { type Rendered, render as renderEn } from './messages.en.ts';

export type { Rendered };

export const render = (facts: MessageFacts, links: TrailMapLinks | null): Rendered =>
  (facts.language === 'de' ? renderDe : renderEn)(facts, links);
