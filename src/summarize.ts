export type SummaryData = {
  explanation: string;
  simplified: string;
  keyPoints: string[];
  terms: string[];
  example: string;
};

export type SummaryState = {
  status: "idle" | "loading" | "done" | "error";
  data?: SummaryData;
  error?: string;
};

export type SummaryRequest = {
  transcript: string;
  title: string;
  subject: string;
  sourceLanguage: string;
  outputLanguage: string;
};

export async function requestSummary(input: SummaryRequest): Promise<SummaryData> {
  const response = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json();
}

// Shown only when the user opens the Summary screen without processing a real lecture.
export const demoSummary: SummaryData = {
  explanation:
    "Dijkstra’s algorithm solves the single-source shortest-path problem by repeatedly selecting the unvisited vertex with the smallest known distance and relaxing its outgoing edges.",
  simplified:
    "Dijkstra works like choosing the closest place you can reach next. Each time it finds a shorter route, it updates the map until every destination has the best known distance.",
  keyPoints: [
    "Always selects the unvisited node with the smallest known distance.",
    "Uses edge relaxation to improve tentative distances.",
    "Requires non-negative edge weights for correct results.",
  ],
  terms: ["Relaxation", "Priority Queue", "Weighted Graph", "Greedy Strategy"],
  example: "If A→B costs 4 and A→C→B costs 2 + 1, relaxation updates the distance to B from 4 to 3.",
};

export const demoTranscript =
  "Today we’re looking at graph traversal, specifically how Dijkstra’s algorithm finds the shortest path between nodes. We maintain a set of unvisited vertices and select the smallest known distance.";
