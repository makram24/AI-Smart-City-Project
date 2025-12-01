import { routingService } from './routing';

type RouteMode = 'walking' | 'cycling' | 'public_transport';

export interface PlaybookMarker {
  id: string;
  title: string;
  description: string;
  position: [number, number];
  type: string;
  tip?: string;
}

export interface PlaybookRoute {
  mode: RouteMode;
  summary: string;
  distance: string;
  duration: string;
  polyline: number[][];
  steps: Array<{ instruction: string; distance: string; type?: string; route?: string }>;
  start: [number, number];
  end: [number, number];
}

export interface PlaybookSummary {
  id: string;
  title: string;
  persona: string;
  tagline: string;
  durationLabel: string;
  distanceLabel: string;
  focusArea: string;
  heroImage: string;
  tags: string[];
  bestFor: string[];
}

export interface PlaybookDetail extends PlaybookSummary {
  narrative: string;
  mood: string;
  recommendedPrompts: string[];
  highlightStops: string[];
  insights: string[];
  markers: PlaybookMarker[];
  primaryRoute: PlaybookRoute;
}

const km = (value: number): string => `${value.toFixed(1)} km`;

const minutes = (value: number): string => `${Math.round(value)} min`;

const budapestPlaybooks: PlaybookDetail[] = [
  {
    id: 'castle-district-heritage',
    title: 'Castle District Heritage Loop',
    persona: 'Culture Curator',
    tagline: 'Medieval streets, panoramic terraces, and café rituals.',
    durationLabel: '45 min walk',
    distanceLabel: '3.2 km',
    focusArea: 'Buda Castle & Fisherman’s Bastion',
    heroImage: 'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?w=900&auto=format&fit=crop',
    tags: ['history', 'views', 'slow travel'],
    bestFor: ['Hosting guests', 'Weekend stroll', 'Photo walks'],
    mood: 'Unhurried historical deep-dive with layered stories at every stop.',
    highlightStops: [
      'Climb through the Castle Garden Bazaar to ease into the hill.',
      'Pause at Matthias Church for gothic details & bells.',
      'Sunset espresso at Ruszwurm Café, a 200-year-old confectionery.'
    ],
    insights: [
      'Weekday mornings are quieter—arrive before tour buses for space.',
      'Pair with tram 2 along the Pest bank for a complete Danube story.',
      'Most of the district is pedestrian-first; expect cobblestones.'
    ],
    recommendedPrompts: [
      'Tell me a story about Buda Castle’s royal past',
    ],
    markers: [
      {
        id: 'buda-castle',
        title: 'Buda Castle',
        description: 'UNESCO complex with museums and sweeping Danube views.',
        position: [47.4969, 19.0399],
        type: 'historical',
        tip: 'Arrive via Castle Hill Funicular for the classic approach.'
      },
      {
        id: 'matthias-church',
        title: 'Matthias Church',
        description: 'Gothic landmark known for its colorful Zsolnay tiles.',
        position: [47.5029, 19.0345],
        type: 'landmark',
        tip: 'Check the concert schedule—acoustics are world-class.'
      },
      {
        id: 'fishermans-bastion',
        title: 'Fisherman’s Bastion',
        description: 'Fairytale terraces framing the Pest skyline.',
        position: [47.5024, 19.034],
        type: 'viewpoint',
        tip: 'Blue hour light makes the parliament glow.'
      },
      {
        id: 'ruszwurm',
        title: 'Ruszwurm Café',
        description: '1827 confectionery serving krémes & dobos cake.',
        position: [47.5019, 19.0343],
        type: 'restaurant',
        tip: 'Carry cash—limited card acceptance.'
      }
    ],
    narrative: 'This loop layers royal history, cobbled laneways, and café rituals. Start at the Chain Bridge, climb toward the Castle Garden, and let the bastion terraces deliver the postcard view.',
    primaryRoute: {
      mode: 'walking',
      summary: 'Chain Bridge to Fisherman’s Bastion',
      distance: km(3.2),
      duration: minutes(45),
      start: [47.4985, 19.0455],
      end: [47.5024, 19.034],
      polyline: [
        [47.4985, 19.0455],
        [47.5002, 19.0412],
        [47.5012, 19.038],
        [47.5024, 19.034]
      ],
      steps: [
        { instruction: 'Cross the Chain Bridge toward Buda Castle', distance: '0.6 km', type: 'walking' },
        { instruction: 'Climb through Castle Garden Bazaar terraces', distance: '1.1 km', type: 'walking' },
        { instruction: 'Wind along Úri utca toward Matthias Church', distance: '0.8 km', type: 'walking' },
        { instruction: 'Finish atop Fisherman’s Bastion highlights', distance: '0.7 km', type: 'walking' }
      ]
    }
  },
  {
    id: 'danube-evening-loop',
    title: 'Danube Evening Loop',
    persona: 'Evening Compass',
    tagline: 'Golden-hour tram rides and riverside promenades.',
    durationLabel: '35 min walk',
    distanceLabel: '2.4 km',
    focusArea: 'Parliament to Great Market Hall',
    heroImage: 'https://images.unsplash.com/photo-1505764706515-aa95265c5abc?w=900&auto=format&fit=crop',
    tags: ['sunset', 'nightlife', 'river'],
    bestFor: ['After-work reset', 'Date nights', 'First-time visitors'],
    mood: 'Relaxed dusk energy with tram bells, street musicians, and warm façades.',
    highlightStops: [
      'Ride Tram 2 for a moving postcard of the skyline.',
      'Pause at Liberty Bridge lights for skyline photos.',
      'Wrap at Great Market Hall for late street food.'
    ],
    insights: [
      'Liberty Bridge closes to cars on summer weekends—grab a picnic.',
      'Pair with live arrival data from BKK to time tram connections.',
      'Carry a light jacket; the river breeze cools quickly after sunset.'
    ],
    recommendedPrompts: [
      'Plan a walking route from Parliament to Liberty Bridge'
    ],
    markers: [
      {
        id: 'tram-2-stop',
        title: 'Tram 2 • Kossuth Lajos tér',
        description: 'Scenic riverside tram hailed as Europe’s prettiest ride.',
        position: [47.507, 19.045],
        type: 'tram',
        tip: 'Sit on the river side for uninterrupted skyline shots.'
      },
      {
        id: 'liberty-bridge',
        title: 'Liberty Bridge',
        description: 'Art Nouveau span glowing green at night.',
        position: [47.4873, 19.058],
        type: 'landmark',
        tip: 'On summer weekends locals picnic on the deck.'
      },
      {
        id: 'great-market',
        title: 'Great Market Hall',
        description: 'Late-night lángos and paprika vendors.',
        position: [47.489, 19.0581],
        type: 'highlight',
        tip: 'Upper level has the best quick bites after 6 PM.'
      }
    ],
    narrative: 'Begin near Parliament, ride Tram 2 for a riverfront reel, then walk the embankment toward Liberty Bridge where street performers and sunset colors collide.',
    primaryRoute: {
      mode: 'walking',
      summary: 'Parliament to Great Market Hall',
      distance: km(2.4),
      duration: minutes(35),
      start: [47.5068, 19.0454],
      end: [47.489, 19.0581],
      polyline: [
        [47.5068, 19.0454],
        [47.5025, 19.0475],
        [47.497, 19.0508],
        [47.493, 19.054],
        [47.489, 19.0581]
      ],
      steps: [
        { instruction: 'Roll south along the Pest promenade past the Academy of Sciences', distance: '0.9 km', type: 'walking' },
        { instruction: 'Pass Vörösmarty Square and continue toward Vigadó', distance: '0.7 km', type: 'walking' },
        { instruction: 'Cut through Elizabeth Bridge plaza to reach Liberty Bridge', distance: '0.5 km', type: 'walking' },
        { instruction: 'Finish at Great Market Hall for night bites', distance: '0.3 km', type: 'walking' }
      ]
    }
  },
];

export class NeighborhoodPlaybookService {
  private playbooks = budapestPlaybooks;

  getSummaries(): PlaybookSummary[] {
    return this.playbooks.map(
      ({
        id,
        title,
        persona,
        tagline,
        durationLabel,
        distanceLabel,
        focusArea,
        heroImage,
        tags,
        bestFor
      }) => ({
        id,
        title,
        persona,
        tagline,
        durationLabel,
        distanceLabel,
        focusArea,
        heroImage,
        tags,
        bestFor
      })
    );
  }

  getPlaybookById(id: string): PlaybookDetail | null {
    return this.playbooks.find((pb) => pb.id === id) || null;
  }

  async personalizeRoute(
    playbook: PlaybookDetail,
    userLat?: number,
    userLng?: number
  ): Promise<PlaybookRoute> {
    if (
      typeof userLat !== 'number' ||
      typeof userLng !== 'number' ||
      Number.isNaN(userLat) ||
      Number.isNaN(userLng)
    ) {
      return playbook.primaryRoute;
    }

    try {
      const routeResult = await routingService.getWalkingRoute(
        [userLat, userLng],
        playbook.primaryRoute.end
      );

      if (!routeResult) {
        return playbook.primaryRoute;
      }

      const distance = routingService.formatDistance(routeResult.distance);
      const duration = routingService.formatDuration(routeResult.duration);

      return {
        ...playbook.primaryRoute,
        mode: 'walking',
        distance,
        duration,
        start: [userLat, userLng],
        polyline: routeResult.geometry,
        steps:
          routeResult.instructions.length > 0
            ? routeResult.instructions.map((instruction, index) => ({
                instruction,
                distance: index === routeResult.instructions.length - 1 ? distance : 'N/A',
                type: 'walking'
              }))
            : playbook.primaryRoute.steps
      };
    } catch (error) {
      console.warn('Playbook route personalization failed:', error);
      return playbook.primaryRoute;
    }
  }
}

export const neighborhoodPlaybookService = new NeighborhoodPlaybookService();

