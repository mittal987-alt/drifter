import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export interface Topic {
  id: number;
  label: string;
  event_count: number;
}

export interface Assignment {
  event_id: number;
  timestamp: string;
  source: string;
  title: string;
  artist?: string | null;
  cluster: number;
  topic: string;
}

export interface MonthlyProportions {
  [month: string]: {
    [topic: string]: number;
  };
}

export interface Momentum {
  [topic: string]: Record<string, number>;
}

export interface InterestChange {
  topic: string;
  change: number;
}

export interface EmergingInterest {
  topic: string;
  share: number;
}

export interface EvolutionData {
  monthly_proportions: MonthlyProportions;
  momentum: Momentum;
  rising: InterestChange[];
  fading: InterestChange[];
  emerging: EmergingInterest[];
  monthly_drift: {
    [month: string]: number;
  };
}

export interface InterestMapPoint {
  x: number;
  y: number;
  cluster: number;
  topic: string;
  event_id?: number;
  title?: string;
}

export interface InterestMapData {
  points: InterestMapPoint[];
  topic_centers: unknown[];
}

export interface InterestGraphNode {
  id: number | string;
  label: string;
  event_count?: number;
}

export interface InterestGraphEdge {
  source: number | string;
  target: number | string;
  similarity: number;
}

export interface InterestGraphData {
  nodes: InterestGraphNode[];
  edges: InterestGraphEdge[];
}

export interface RabbitHole {
  topic?: string;
  name?: string;
  [key: string]: unknown;
}

export interface TopicTransition {
  from?: string;
  to?: string;
  [key: string]: unknown;
}

export interface BehaviorData {
  rabbit_holes: RabbitHole[];
  topic_transitions: TopicTransition[];
  interest_concentration: Record<string, unknown>;
  time_of_day: Record<string, number>;
  [key: string]: unknown;
}

export interface DashboardOverview {
  events: number;
  topics: number;
  clusters: number;
  noise: number;
  dominant_topic: string | null;
  current_drift: number;
}

export interface DashboardData {
  overview: DashboardOverview;

  top_topics: {
    topic: string;
    count: number;
    share?: number;
  }[];

  evolution: EvolutionData;

  behavior: BehaviorData;

  visualizations: {
    interest_map: InterestMapData;
    interest_graph: InterestGraphData;
  };

  assignments: Assignment[];
  cached?: boolean;
}

export async function getDashboard(
  refresh = false,
): Promise<DashboardData> {
  const response = await axios.get<DashboardData>(
    `${API_URL}/api/analytics/dashboard`,
    {
      params: {
        refresh,
      },
      withCredentials: true,
    },
  );

  return response.data;
}

export async function getInterests(
  refresh = false,
) {
  const response = await axios.get(
    `${API_URL}/api/analytics/interests`,
    {
      params: {
        refresh,
      },
      withCredentials: true,
    },
  );

  return response.data;
}

export async function triggerAnalysis(
  source?: string,
) {
  const response = await axios.post(
    `${API_URL}/api/analytics/trigger`,
    null,
    {
      params: {
        source,
      },
      withCredentials: true,
    },
  );

  return response.data;
}

/* ==========================================================================
   FEATURE TYPES & API CALLS
   ========================================================================== */

export interface ChatResponse {
  reply: string;
  suggested_queries: string[];
  referenced_topics: string[];
}

export async function chatWithHistory(
  message: string,
  history?: { role: string; content: string }[],
  source?: string,
): Promise<ChatResponse> {
  const response = await axios.post<ChatResponse>(
    `${API_URL}/api/analytics/chat`,
    { message, history, source },
    { withCredentials: true },
  );
  return response.data;
}

export interface WrappedSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  metrics?: { label: string; value: string }[];
  top_topics?: { topic: string; count: number; share: number }[];
  sample_traces?: string[];
  nocturnal_share?: string;
  archetype?: WrappedArchetype;
}

export interface WrappedArchetype {
  title: string;
  tagline: string;
  gradient: string;
  accent_color: string;
  key_traits: string[];
}

export interface WrappedData {
  slides: WrappedSlide[];
  archetype: WrappedArchetype;
  summary: {
    total_events: number;
    active_days: number;
    dominant_topic: string;
    peak_drift_month: string;
    night_ratio: number;
    longest_streak?: number;
  };
}

export async function getYearInDrift(source?: string): Promise<WrappedData> {
  const response = await axios.get<WrappedData>(
    `${API_URL}/api/analytics/wrapped`,
    { params: { source }, withCredentials: true },
  );
  return response.data;
}

export interface PredictionItem {
  topic: string;
  confidence: number;
  horizon: string;
  rationale: string;
  transition_from: string;
  seed_keywords: string[];
}

export interface PredictionData {
  current_focus: string;
  predictions: PredictionItem[];
  transition_matrix: Record<string, Record<string, number>>;
  projection_horizon: string;
}

export async function getInterestPredictions(source?: string): Promise<PredictionData> {
  const response = await axios.get<PredictionData>(
    `${API_URL}/api/analytics/predictions`,
    { params: { source }, withCredentials: true },
  );
  return response.data;
}

export interface CorrelationPair {
  video_topic: string;
  audio_tag: string;
  co_occurrence_count: number;
  synergy_type: string;
}

export interface CorrelationMode {
  title: string;
  description: string;
  primary: string;
  status: string;
}

export interface HourlyDistribution {
  hour: number;
  youtube: number;
  spotify: number;
}

export interface CorrelationData {
  has_multisource: boolean;
  synergy_score: number;
  resonance_tier?: string;
  correlations: CorrelationPair[];
  platform_split: {
    youtube: number;
    spotify: number;
    youtube_pct: number;
    spotify_pct: number;
  };
  daypart_dominance: Record<string, { youtube: number; spotify: number }>;
  hourly_distribution?: HourlyDistribution[];
  modes?: CorrelationMode[];
  insight: string;
}

export async function getPlatformCorrelation(): Promise<CorrelationData> {
  const response = await axios.get<CorrelationData>(
    `${API_URL}/api/analytics/correlation`,
    { withCredentials: true },
  );
  return response.data;
}

export interface InterestDnaMetrics {
  curiosity_entropy: number;
  drift_velocity: number;
  deep_dive_index: number;
  nocturnal_quotient: number;
}

export interface ArchetypeTraits {
  superpower: string;
  vulnerability: string;
  peak_hours: string;
  complementary: string;
}

export interface InterestDnaData {
  dna_id: string;
  archetype: string;
  subtitle: string;
  total_events: number;
  metrics: InterestDnaMetrics;
  traits?: ArchetypeTraits;
  primary_markers: string[];
  palette: string[];
  generated_at: string;
}

export async function getInterestDna(source?: string): Promise<InterestDnaData> {
  const response = await axios.get<InterestDnaData>(
    `${API_URL}/api/analytics/dna`,
    { params: { source }, withCredentials: true },
  );
  return response.data;
}

