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

  return (
    <div className="interest-tooltip">

      <strong>
        {point.title}
      </strong>

      {point.artist && (
        <span>
          {point.artist}
        </span>
      )}

      <span>
        {point.topic}
      </span>

      <span>
        {point.source}
      </span>

      <small>
        {new Date(
          point.timestamp
        ).toLocaleDateString()}
      </small>

    </div>
  );
}


export default function InterestMap({
  data,
}: Props) {

  const points =
    data.points as InterestPoint[];


  if (!points.length) {

    return (
      <div className="empty-map">

        <div>
          Not enough data to create
          an interest map.
        </div>

        <small>
          Import more history events
          to generate the map.
        </small>

      </div>
    );
  }


  const grouped: Record<
    string,
    InterestPoint[]
  > = {};


  for (const point of points) {

    const topic =
      point.topic || "Unknown";

    if (!grouped[topic]) {
      grouped[topic] = [];
    }

    grouped[topic].push(point);
  }


  const topics =
    Object.keys(grouped);


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
                {topic}
              </span>

            </div>

          ))}

      </div>

    </div>
  );
}