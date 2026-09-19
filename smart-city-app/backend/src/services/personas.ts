export type PersonaKey = 'culture_curator' | 'evening_compass' | 'mobility_hacker' | 'local_concierge';

export interface PersonaDefinition {
  id: PersonaKey;
  label: string;
  keywords: string[];
  prefix: string;
  suggestions: string[];
  description: string;
  tone: string;
  recommendedPlaybookId?: string;
  fallbackMessage: string;
}

export interface PersonaPayload {
  id: PersonaKey;
  name: string;
  tagline: string;
  tone: string;
  recommendedPrompts: string[];
  suggestedPlaybookId?: string;
}

export const PERSONA_REGISTRY: Record<PersonaKey, PersonaDefinition> = {
  culture_curator: {
    id: 'culture_curator',
    label: 'Culture Curator',
    keywords: ['castle', 'museum', 'heritage', 'history', 'tour', 'bastion', 'parliament', 'gallery', 'market hall'],
    prefix: 'Culture Curator •',
    suggestions: [
      'Tell me a story about the place'
    ],
    description: 'Story-rich walks, heritage sites, and curated cafés.',
    tone: 'calm',
    recommendedPlaybookId: 'castle-district-heritage',
    fallbackMessage: 'Culture Curator ready. I can line up museums, castles, cafés, and narrated walks across Budapest.'
  },
  evening_compass: {
    id: 'evening_compass',
    label: 'Evening Compass',
    keywords: ['evening', 'night', 'sunset', 'drinks', 'date', 'dinner', 'bar', 'restaurant'],
    prefix: 'Evening Compass •',
    suggestions: [
      'Find riverside bars with music',
      'Plan a golden-hour walk',
      'List late-night food spots'
    ],
    description: 'Golden-hour strolls, skyline views, and night routes.',
    tone: 'vibrant',
    recommendedPlaybookId: 'danube-evening-loop',
    fallbackMessage: 'Evening Compass tuned in. Want riverside walks, bars, or late-night transit tips?'
  },
  mobility_hacker: {
    id: 'mobility_hacker',
    label: 'Mobility Hacker',
    keywords: ['bike', 'bicycle', 'multimodal', 'mode mix', 'wizard', 'bubi', 'scooter'],
    prefix: 'Mobility Hacker •',
    suggestions: [
      'Suggest a bike + tram combo',
      'Find nearby MOL Bubi docks',
      'Compare cycling vs walking time'
    ],
    description: 'Blends cycling, bikeshare, and transit for smart combos.',
    tone: 'energizing',
    fallbackMessage: 'Mobility Hacker here. Ask for bike plus tram combos, MOL Bubi docks, or ways to shave minutes off your ride.'
  },
  local_concierge: {
    id: 'local_concierge',
    label: 'Local Concierge',
    keywords: [],
    prefix: 'City Concierge •',
    suggestions: [
      'Find what’s near me',
      'Plan a scenic walk',
      'Show weather-friendly plans'
    ],
    description: 'Friendly default guidance when intent is broad.',
    tone: 'balanced',
    fallbackMessage: 'City Concierge at your service. Ask me for nearby finds, scenic walks, or live transit context anywhere in Budapest.'
  }
};

export const PERSONA_LIST = Object.values(PERSONA_REGISTRY);
