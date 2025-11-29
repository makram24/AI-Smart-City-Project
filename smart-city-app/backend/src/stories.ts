export interface StoryCard {
  id: string;
  landmarkId: string;
  landmarkName: string;
  position: [number, number];
  title: string;
  narrative: string;
  audioUrl?: string;
  imageUrl?: string;
  duration: number; // seconds
  category: 'history' | 'architecture' | 'culture' | 'legend' | 'event';
  triggerDistance: number; // meters - when to show story
  tags: string[];
}

export interface StoryTrigger {
  storyId: string;
  landmarkName: string;
  position: [number, number];
  distance: number; // meters from route
  shouldShow: boolean;
}

export class StoryService {
  private stories: StoryCard[] = [
    {
      id: 'story_buda_castle',
      landmarkId: 'buda-castle',
      landmarkName: 'Buda Castle',
      position: [47.4969, 19.0399],
      title: 'The Royal Fortress',
      narrative: 'Buda Castle has stood on this hill for over 700 years. Originally built by King Béla IV in the 13th century after the Mongol invasion, it became the royal residence of Hungarian kings. The current Baroque palace dates from the 18th century, though it was heavily damaged in WWII and meticulously reconstructed. Today, it houses the Hungarian National Gallery and Budapest History Museum. The castle district is a UNESCO World Heritage Site, preserving medieval streets and Gothic architecture.',
      imageUrl: 'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?w=800&auto=format&fit=crop',
      duration: 120,
      category: 'history',
      triggerDistance: 200,
      tags: ['royal', 'medieval', 'unesco', 'museum']
    },
    {
      id: 'story_fishermans_bastion',
      landmarkId: 'fishermans-bastion',
      landmarkName: "Fisherman's Bastion",
      position: [47.5024, 19.034],
      title: 'The Fairytale Terraces',
      narrative: "Despite its name, Fisherman's Bastion was never used for defense. Built between 1895-1902 by architect Frigyes Schulek, it was designed as a viewing platform with seven towers representing the seven Magyar tribes that settled in Hungary in 896 AD. The Neo-Romanesque architecture creates a fairytale-like atmosphere, especially at sunset when the Parliament building across the river glows golden. The bastion offers one of Budapest's most iconic panoramic views.",
      imageUrl: 'https://images.unsplash.com/photo-1555993536-0e43fe0c4b95?w=800&auto=format&fit=crop',
      duration: 90,
      category: 'architecture',
      triggerDistance: 150,
      tags: ['viewpoint', 'sunset', 'romantic', 'photography']
    },
    {
      id: 'story_chain_bridge',
      landmarkId: 'chain-bridge',
      landmarkName: 'Chain Bridge',
      position: [47.4985, 19.0455],
      title: 'The First Bridge',
      narrative: 'The Chain Bridge was the first permanent bridge connecting Buda and Pest, completed in 1849. Designed by English engineer William Tierney Clark and built by Scottish engineer Adam Clark (no relation), it was a marvel of engineering. The bridge was destroyed by retreating German forces in 1945 but rebuilt identically. It\'s named after Count István Széchenyi, who initiated its construction. The bridge\'s stone lions are a symbol of Budapest, and legend says they will roar when a virgin walks across—though they remain silent to this day.',
      imageUrl: 'https://images.unsplash.com/photo-1555993536-0e43fe0c4b95?w=800&auto=format&fit=crop',
      duration: 100,
      category: 'legend',
      triggerDistance: 100,
      tags: ['bridge', 'engineering', 'symbol', 'legend']
    },
    {
      id: 'story_parliament',
      landmarkId: 'parliament',
      landmarkName: 'Hungarian Parliament',
      position: [47.507, 19.045],
      title: 'The Neo-Gothic Masterpiece',
      narrative: 'The Hungarian Parliament Building is one of the largest parliament buildings in the world and a symbol of Budapest. Completed in 1902 after 19 years of construction, it features 691 rooms, 20 kilometers of corridors, and stands 96 meters tall—a reference to Hungary\'s founding year of 896. Designed by Imre Steindl in Neo-Gothic style, it houses the Hungarian Crown Jewels, including the Holy Crown of Hungary. The building is particularly stunning when illuminated at night, reflecting in the Danube.',
      imageUrl: 'https://images.unsplash.com/photo-1505764706515-aa95265c5abc?w=800&auto=format&fit=crop',
      duration: 110,
      category: 'architecture',
      triggerDistance: 300,
      tags: ['government', 'gothic', 'crown jewels', 'iconic']
    },
    {
      id: 'story_matthias_church',
      landmarkId: 'matthias-church',
      landmarkName: 'Matthias Church',
      position: [47.5029, 19.0345],
      title: 'The Coronation Church',
      narrative: 'Matthias Church, originally built in the 13th century, has been the site of coronations for Hungarian kings, including Franz Joseph I and Charles IV. The church features colorful Zsolnay ceramic tiles on its roof, a distinctive feature of Hungarian architecture. It was restored by Frigyes Schulek in the late 19th century, who added the Neo-Gothic elements. The church\'s acoustics are world-class, hosting regular concerts. Inside, you\'ll find the Ecclesiastical Art Museum with medieval artifacts.',
      imageUrl: 'https://images.unsplash.com/photo-1555993536-0e43fe0c4b95?w=800&auto=format&fit=crop',
      duration: 95,
      category: 'culture',
      triggerDistance: 100,
      tags: ['church', 'coronation', 'gothic', 'music']
    },
    {
      id: 'story_liberty_bridge',
      landmarkId: 'liberty-bridge',
      landmarkName: 'Liberty Bridge',
      position: [47.4873, 19.058],
      title: 'The Green Bridge',
      narrative: 'Liberty Bridge, opened in 1896 for the Millennium celebrations, is one of Budapest\'s most beloved bridges. Its distinctive green color and Art Nouveau style make it instantly recognizable. The bridge features the Hungarian coat of arms and mythological bird Turul statues. On summer weekends, the bridge closes to car traffic, and locals picnic on the deck—a tradition that brings the community together. The bridge connects Gellért Hill with the Great Market Hall area.',
      imageUrl: 'https://images.unsplash.com/photo-1505764706515-aa95265c5abc?w=800&auto=format&fit=crop',
      duration: 85,
      category: 'culture',
      triggerDistance: 150,
      tags: ['bridge', 'art nouveau', 'community', 'summer']
    },
    {
      id: 'story_great_market',
      landmarkId: 'great-market',
      landmarkName: 'Great Market Hall',
      position: [47.489, 19.0581],
      title: 'The Culinary Heart',
      narrative: 'The Great Market Hall, opened in 1897, is Budapest\'s largest and oldest indoor market. Designed by Samu Pecz, it features beautiful ironwork and Zsolnay ceramic tiles. The ground floor sells fresh produce, meat, and Hungarian specialties like paprika and salami. The upper level has food stalls serving traditional dishes like lángos (fried dough) and goulash. The market is a living piece of Budapest\'s culinary culture, where locals shop daily and tourists discover authentic flavors.',
      imageUrl: 'https://images.unsplash.com/photo-1505764706515-aa95265c5abc?w=800&auto=format&fit=crop',
      duration: 75,
      category: 'culture',
      triggerDistance: 200,
      tags: ['market', 'food', 'local', 'culinary']
    },
    {
      id: 'story_heroes_square',
      landmarkId: 'heroes-square',
      landmarkName: "Heroes' Square",
      position: [47.515, 19.078],
      title: 'The Millennium Monument',
      narrative: "Heroes' Square was built in 1896 to commemorate the 1000th anniversary of the Magyar conquest of Hungary. The centerpiece is the Millennium Monument with the Archangel Gabriel on top, holding the Hungarian crown. The colonnades feature statues of Hungarian leaders throughout history. The square is flanked by the Museum of Fine Arts and the Palace of Art. It's a place where history, art, and national identity converge, and it's been the site of many important events in Hungarian history.",
      imageUrl: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&auto=format&fit=crop',
      duration: 105,
      category: 'history',
      triggerDistance: 250,
      tags: ['monument', 'millennium', 'history', 'art']
    }
  ];

  // Get all stories
  getAllStories(): StoryCard[] {
    return this.stories;
  }

  // Get story by ID
  getStoryById(id: string): StoryCard | null {
    return this.stories.find(s => s.id === id) || null;
  }

  // Get stories near a route
  getStoriesNearRoute(routePolyline: number[][], maxDistance: number = 500): StoryTrigger[] {
    const triggers: StoryTrigger[] = [];

    for (const story of this.stories) {
      const minDistance = this.calculateMinDistanceToRoute(
        story.position,
        routePolyline
      );

      if (minDistance <= maxDistance) {
        triggers.push({
          storyId: story.id,
          landmarkName: story.landmarkName,
          position: story.position,
          distance: minDistance,
          shouldShow: minDistance <= story.triggerDistance
        });
      }
    }

    return triggers.sort((a, b) => a.distance - b.distance);
  }

  // Calculate minimum distance from a point to a route polyline
  private calculateMinDistanceToRoute(
    point: [number, number],
    routePolyline: number[][]
  ): number {
    let minDistance = Infinity;

    for (let i = 0; i < routePolyline.length - 1; i++) {
      const segmentStart = routePolyline[i] as [number, number];
      const segmentEnd = routePolyline[i + 1] as [number, number];
      
      const distance = this.distanceToSegment(
        point,
        segmentStart,
        segmentEnd
      );

      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  // Calculate distance from point to line segment (Haversine formula)
  private distanceToSegment(
    point: [number, number],
    segmentStart: [number, number],
    segmentEnd: [number, number]
  ): number {
    // Use Haversine formula for accurate distance calculation
    const R = 6371000; // Earth radius in meters

    // Calculate distances to both endpoints
    const distToStart = this.haversineDistance(point, segmentStart);
    const distToEnd = this.haversineDistance(point, segmentEnd);

    // Calculate distance to the segment (simplified - using closest endpoint)
    // For more accuracy, could calculate perpendicular distance to line segment
    return Math.min(distToStart, distToEnd);
  }

  // Haversine distance formula
  private haversineDistance(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.deg2rad(point2[0] - point1[0]);
    const dLng = this.deg2rad(point2[1] - point1[1]);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(point1[0])) *
        Math.cos(this.deg2rad(point2[0])) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // Get stories by category
  getStoriesByCategory(category: StoryCard['category']): StoryCard[] {
    return this.stories.filter(s => s.category === category);
  }

  // Get stories near a point
  getStoriesNearPoint(
    point: [number, number],
    radius: number = 1000
  ): StoryCard[] {
    return this.stories.filter(story => {
      const distance = this.haversineDistance(point, story.position);
      return distance <= radius;
    });
  }
}

export const storyService = new StoryService();

