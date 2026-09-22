import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardData } from "../services/analytics";


interface InterestPoint {
  event_id: number;
  title: string;
  artist: string | null;
  source: string;
  topic: string;
  cluster: number;
  x: number;
  y: number;
  timestamp: string;
}


interface Props {
  data: DashboardData["visualizations"]["interest_map"];
}

function topicColor(topic: string, index: number) {
  const palette = [
    "#f2b56b",
    "#75d6c2",
    "#a7b8ff",
    "#f28f9b",
    "#d4a7f5",
    "#c8d46b",
    "#78b9e8",
    "#f3d27a",
  ];
  let hash = 0;
  for (const character of topic) hash = character.charCodeAt(0) + ((hash << 5) - hash);
  return palette[Math.abs(hash + index) % palette.length];
}


function InterestTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: unknown;
  }>;
}) {

  if (
    !active ||
    !payload ||
    payload.length === 0
  ) {
    return null;
  }

  const point = payload[0].payload as InterestPoint;
  const title = String(point.title ?? "Untitled activity");
  const artist = point.artist == null ? null : String(point.artist);
  const topic = String(point.topic ?? "Unknown");
  const source = String(point.source ?? "Unknown source");

  return (
    <div className="interest-tooltip">

      <strong>
        {title}
      </strong>

      {artist && (
        <span>
          {artist}
        </span>
      )}

      <span>
        {topic}
      </span>

      <span>
        {source}
      </span>

      <small>
        {new Date(String(point.timestamp)).toLocaleDateString()}
      </small>

    </div>
  );
}


export default function InterestMap({
  data,
}: Props) {

  const points = (data?.points || []) as InterestPoint[];

  if (!points || !points.length) {
    return (
      <div className="empty-map flex flex-col items-center justify-center h-full text-center p-6 text-neutral-400">
        <div className="font-semibold text-neutral-200 mb-1">
          Not enough data to create an interest map.
        </div>
        <small className="text-xs text-neutral-500">
          Import history events or use the YouTube Extension to sync your watch history.
        </small>
      </div>
    );
  }

  const grouped: Record<
    string,
    InterestPoint[]
  > = {};

  for (const point of points) {
    const topic = point.topic || "Unknown";
    if (!grouped[topic]) {
      grouped[topic] = [];
    }
    grouped[topic].push(point);
  }

  const topics = Object.keys(grouped);


  return (
    <div className="interest-map-wrapper">

      <ResponsiveContainer
        width="100%"
        height="100%"
      >

        <ScatterChart
          margin={{
            top: 10,
            right: 10,
            bottom: 10,
            left: 10,
          }}
        >

          <XAxis
            type="number"
            dataKey="x"
            hide
          />

          <YAxis
            type="number"
            dataKey="y"
            hide
          />

          <Tooltip
            cursor={{
              strokeDasharray: "4 4",
            }}
            content={
              <InterestTooltip />
            }
          />

          {topics.map(
            (topic, index) => (

              <Scatter
                key={topic}
                name={topic}
                data={grouped[topic]}
                fill={topicColor(topic, index)}
                opacity={0.72}
              />

            )
          )}

        </ScatterChart>

      </ResponsiveContainer>


      <div className="map-legend">

        {topics
          .slice(0, 12)
          .map((topic) => (

            <div
              className="legend-item"
              key={topic}
            >

              <span className="legend-dot" />

              <span>
                {String(topic)}
              </span>

            </div>

          ))}

      </div>

    </div>
  );
}