export interface TransportFeedback {
  id: string;
  routeId: string; // e.g., "Tram 2", "Bus 15", "Metro M2"
  routeType: 'bus' | 'tram' | 'metro' | 'trolley';
  sentiment: 'positive' | 'neutral' | 'negative';
  reliability: number; // 1-5 scale
  comment?: string;
  timestamp: string;
  userId?: string; // Optional user identifier
  trustScore: number; // 0-1, based on user history
  verified: boolean;
}

export interface RouteConfidence {
  routeId: string;
  routeType: 'bus' | 'tram' | 'metro' | 'trolley';
  averageReliability: number; // 1-5 scale
  sentiment: 'positive' | 'neutral' | 'negative';
  feedbackCount: number;
  lastUpdated: string;
  confidenceLevel: 'high' | 'medium' | 'low'; // Based on feedback count and recency
}

export class CommunityService {
  private feedbackStore: Map<string, TransportFeedback[]> = new Map();
  private userTrustScores: Map<string, number> = new Map();
  private readonly MIN_FEEDBACK_FOR_CONFIDENCE = 3;
  private readonly TRUST_DECAY_HOURS = 24; // Trust score decays after 24 hours of inactivity

  // Submit feedback for a transport route
  submitFeedback(feedback: Omit<TransportFeedback, 'id' | 'timestamp' | 'trustScore' | 'verified'>): TransportFeedback {
    const userId = feedback.userId || 'anonymous';
    
    // Calculate trust score based on user history
    const trustScore = this.calculateTrustScore(userId);
    
    // Basic moderation: filter out obvious spam
    const isSpam = this.detectSpam(feedback);
    
    const newFeedback: TransportFeedback = {
      ...feedback,
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      trustScore,
      verified: !isSpam && trustScore > 0.3 // Only verify if not spam and has some trust
    };

    // Store feedback
    const routeKey = `${feedback.routeType}_${feedback.routeId}`;
    if (!this.feedbackStore.has(routeKey)) {
      this.feedbackStore.set(routeKey, []);
    }
    this.feedbackStore.get(routeKey)!.push(newFeedback);

    // Update user trust score (increase slightly for verified feedback)
    if (newFeedback.verified) {
      const currentTrust = this.userTrustScores.get(userId) || 0.5;
      this.userTrustScores.set(userId, Math.min(1.0, currentTrust + 0.05));
    }

    // Clean old feedback (keep only last 7 days)
    this.cleanOldFeedback(routeKey);

    return newFeedback;
  }

  // Get confidence signals for a route
  getRouteConfidence(routeId: string, routeType: 'bus' | 'tram' | 'metro' | 'trolley'): RouteConfidence | null {
    const routeKey = `${routeType}_${routeId}`;
    const feedbacks = this.feedbackStore.get(routeKey) || [];

    if (feedbacks.length === 0) {
      return null;
    }

    // Filter to recent feedback (last 24 hours) and verified feedback
    const recentFeedbacks = feedbacks.filter(f => {
      const feedbackTime = new Date(f.timestamp).getTime();
      const hoursAgo = (Date.now() - feedbackTime) / (1000 * 60 * 60);
      return hoursAgo <= 24 && f.verified;
    });

    if (recentFeedbacks.length === 0) {
      return null;
    }

    // Calculate average reliability
    const avgReliability = recentFeedbacks.reduce((sum, f) => sum + f.reliability, 0) / recentFeedbacks.length;

    // Determine sentiment
    const positiveCount = recentFeedbacks.filter(f => f.sentiment === 'positive').length;
    const negativeCount = recentFeedbacks.filter(f => f.sentiment === 'negative').length;
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount * 1.5) sentiment = 'positive';
    else if (negativeCount > positiveCount * 1.5) sentiment = 'negative';

    // Determine confidence level
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (recentFeedbacks.length >= 10) confidenceLevel = 'high';
    else if (recentFeedbacks.length >= 5) confidenceLevel = 'medium';

    const lastUpdated = recentFeedbacks[recentFeedbacks.length - 1].timestamp;

    return {
      routeId,
      routeType,
      averageReliability: Math.round(avgReliability * 10) / 10, // Round to 1 decimal
      sentiment,
      feedbackCount: recentFeedbacks.length,
      lastUpdated,
      confidenceLevel
    };
  }

  // Get confidence signals for multiple routes
  getMultipleRouteConfidences(routes: Array<{ routeId: string; routeType: 'bus' | 'tram' | 'metro' | 'trolley' }>): RouteConfidence[] {
    return routes
      .map(route => this.getRouteConfidence(route.routeId, route.routeType))
      .filter((conf): conf is RouteConfidence => conf !== null);
  }

  // Calculate trust score for a user
  private calculateTrustScore(userId: string): number {
    const existingTrust = this.userTrustScores.get(userId);
    if (existingTrust !== undefined) {
      return existingTrust;
    }
    // New users start with moderate trust
    return 0.5;
  }

  // Basic spam detection
  private detectSpam(feedback: Omit<TransportFeedback, 'id' | 'timestamp' | 'trustScore' | 'verified'>): boolean {
    // Check for suspicious patterns
    if (feedback.comment) {
      const comment = feedback.comment.toLowerCase();
      // Simple spam detection: repeated characters, excessive length, suspicious words
      if (comment.length > 500) return true;
      if (/(.)\1{10,}/.test(comment)) return true; // Repeated characters
      if (/spam|scam|click here|buy now/i.test(comment)) return true;
    }
    
    // Check for suspicious reliability scores (all 1s or all 5s from same user)
    const userId = feedback.userId || 'anonymous';
    const userFeedbacks = Array.from(this.feedbackStore.values())
      .flat()
      .filter(f => f.userId === userId);
    
    if (userFeedbacks.length > 5) {
      const allSame = userFeedbacks.every(f => f.reliability === feedback.reliability);
      if (allSame) return true; // Suspicious pattern
    }

    return false;
  }

  // Clean old feedback (keep only last 7 days)
  private cleanOldFeedback(routeKey: string): void {
    const feedbacks = this.feedbackStore.get(routeKey);
    if (!feedbacks) return;

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentFeedbacks = feedbacks.filter(f => {
      const feedbackTime = new Date(f.timestamp).getTime();
      return feedbackTime > sevenDaysAgo;
    });

    this.feedbackStore.set(routeKey, recentFeedbacks);
  }

  // Get all feedback for a route (for moderation/admin purposes)
  getRouteFeedback(routeId: string, routeType: 'bus' | 'tram' | 'metro' | 'trolley'): TransportFeedback[] {
    const routeKey = `${routeType}_${routeId}`;
    return this.feedbackStore.get(routeKey) || [];
  }
}

export const communityService = new CommunityService();

