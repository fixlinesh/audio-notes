import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon);

export const AUDIO_BUCKET = "audio";

export type RecordingRow = {
  id: string;
  user_id?: string | null;
  title: string | null;
  audio_path: string | null;
  transcript: string | null;
  summary: unknown;
  study: unknown;
  duration: number | null;
  created_at: string | null;
};

const GUEST_STORE_KEY = "leasy_guest_demo_recordings_v4";

const DEFAULT_GUEST_RECORDINGS: RecordingRow[] = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    user_id: "guest-demo",
    title: "CS101 · Graph Theory & Dijkstra Algorithm",
    audio_path: null,
    duration: 2850,
    created_at: "2026-10-28T10:15:00.000Z",
    transcript:
      "Today we analyze single-source shortest path algorithms in weighted graphs. Dijkstra's algorithm maintains a priority queue of unvisited vertices and iteratively selects the vertex with the smallest tentative distance. For each outgoing edge (u, v) with non-negative weight w(u, v), it performs edge relaxation: if d[u] + w(u, v) < d[v], we update d[v]. Using a binary min-heap priority queue, time complexity is O((V + E) log V). Crucially, Dijkstra fails on negative edge weights because its greedy invariant assumes once a vertex is extracted from the priority queue, its shortest path distance is final.",
    summary: {
      language: "Russian",
      data: {
        explanation:
          "Лекция посвящена алгоритму Дейкстры для поиска кратчайших путей из одной вершины во взвешенном графе с неотрицательными весами рёбер. Алгоритм использует жадную стратегию и очередь с приоритетом (Min-Heap), последовательно выполняя релаксацию рёбер за время O((V + E) log V).",
        simplified:
          "Алгоритм Дейкстры находит самый быстрый маршрут от стартовой точки до всех остальных узлов шаг за шагом, всегда выбирая ближайшую непроверенную вершину.",
        keyPoints: [
          "Жадная стратегия выбора вершины с минимальным текущим расстоянием d[u]",
          "Релаксация ребра: если d[u] + w(u,v) < d[v], обновляем кратчайший путь до v",
          "Сложность O((V + E) log V) при использовании бинарной кучи (Priority Queue)",
          "Неприменим при отрицательных весах рёбер (для них используется алгоритм Беллмана–Форда)",
        ],
        terms: [
          "Edge Relaxation (Релаксация ребра): Проверка и улучшение текущей оценки кратчайшего пути до соседней вершины через промежуточный узел.",
          "Priority Queue (Очередь с приоритетом): Структура данных (Min-Heap), извлекающая вершину с минимальной меткой расстояния за O(log V).",
          "Greedy Invariant (Жадный инвариант): Свойство, гарантирующее, что при неотрицательных рёбрах расстояние до извлечённой вершины уже оптимально.",
        ],
        example:
          "В навигационных системах (2ГИС, Google Maps) вершины — это перекрёстки Астаны, а веса рёбер — время проезда в секундах. Алгоритм Дейкстры за миллисекунды строит оптимальный маршрут до Astana IT University.",
      },
    },
    study: {
      language: "Russian",
      data: {
        quiz: [
          {
            question: "Почему алгоритм Дейкстры даёт неверный результат при наличии рёбер с отрицательным весом?",
            answers: [
              "Он зацикливается на каждом ребре",
              "Нарушается жадный инвариант: уже закрытая вершина может получить более короткий путь позже",
              "Очередь с приоритетом не умеет хранить отрицательные числа",
              "Матрица смежности переполняет память",
            ],
            correct: 1,
            explanation:
              "Жадное правило Дейкстры считает расстояние до извлечённой вершины окончательным, но отрицательное ребро может уменьшить путь задним числом.",
          },
          {
            question: "Какова временная сложность алгоритма Дейкстры со списком смежности и бинарной кучей (Min-Heap)?",
            answers: ["O(V^2)", "O((V + E) log V)", "O(V * E)", "O(log V)"],
            correct: 1,
            explanation:
              "Каждая из V вершин извлекается из кучи за O(log V), а для каждого из E рёбер выполняется уменьшение ключа за O(log V).",
          },
          {
            question: "В чём заключается операция релаксации ребра (u, v)?",
            answers: [
              "Удаление ребра из графа после посещения",
              "Обновление d[v] = d[u] + w(u,v), если новый путь короче текущего d[v]",
              "Сортировка всех вершин по алфавиту",
              "Инвертирование направления ребра",
            ],
            correct: 1,
            explanation:
              "Релаксация проверяет, выгодно ли пройти в вершину v через вершину u, и уменьшает оценку d[v].",
          },
        ],
        flashcards: [
          {
            term: "Edge Relaxation",
            definition: "Проверка условия d[u] + w(u,v) < d[v] и обновление кратчайшего расстояния до вершины v.",
          },
          {
            term: "Priority Queue (Min-Heap)",
            definition: "Абстрактная структура данных, возвращающая непосещённую вершину с минимальной оценкой расстояния.",
          },
          {
            term: "Time Complexity O((V+E) log V)",
            definition: "Асимптотическая оценка времени работы алгоритма Дейкстры на разреженных графах с бинарной кучей.",
          },
        ],
      },
    },
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
    user_id: "guest-demo",
    title: "AI202 · Attention Mechanism & Transformers",
    audio_path: null,
    duration: 3600,
    created_at: "2026-10-27T14:00:00.000Z",
    transcript:
      "Self-attention maps input embeddings into Query (Q), Key (K), and Value (V) matrices to compute contextual token representations dynamically across the entire sequence in parallel. Scaled dot-product attention computes softmax(Q * K^T / sqrt(d_k)) * V. Dividing by sqrt(d_k) prevents large dot products from pushing the softmax function into regions with vanishingly small gradients. Multi-head attention runs several attention layers in parallel so the model attends to information from different representation subspaces.",
    summary: {
      language: "Russian",
      data: {
        explanation:
          "Архитектура Transformer заменяет рекуррентную обработку (RNN) механизмом самовнимания (Self-Attention). Каждый токен проецируется в векторы Query, Key и Value, позволяя модели параллельно учитывать контекстные связи между любыми словами независимо от расстояния между ними.",
        simplified:
          "Механизм внимания позволяет нейросети понимать смысл слова, одновременно смотря на все остальные слова в предложении и определяя, какие из них самые важные по смыслу.",
        keyPoints: [
          "Формула Scaled Dot-Product Attention: Attention(Q,K,V) = softmax(QK^T / √d_k)V",
          "Масштабирование на √d_k защищает softmax от затухания градиентов при большой размерности",
          "Multi-Head Attention параллельно извлекает синтаксические и семантические связи в разных подпространствах",
          "Вычислительная сложность внимания по длине контекста N составляет O(N^2)",
        ],
        terms: [
          "Self-Attention (Самовнимание): Механизм взвешенного сопоставления всех пар токенов внутри одной последовательности.",
          "Query, Key, Value (Q, K, V): Три обучаемые линейные проекции входных эмбеддингов для расчёта весов внимания.",
          "Multi-Head Attention: Параллельное выполнение нескольких голов внимания с последующей конкатенацией результатов.",
        ],
        example:
          "В самом приложении L-easy модели трансформеров (Whisper и Gemini 2.5 Flash) используют механизм внимания, чтобы связать термины в начале 50-минутной лекции с выводами лектора в конце.",
      },
    },
    study: {
      language: "Russian",
      data: {
        quiz: [
          {
            question: "Зачем в формуле Scaled Dot-Product Attention скалярное произведение QK^T делится на √d_k?",
            answers: [
              "Чтобы уменьшить количество параметров модели",
              "Чтобы предотвратить слишком большие значения в softmax и затухание градиентов",
              "Для перевода текста на другой язык",
              "Для удаления стоп-слов из предложения",
            ],
            correct: 1,
            explanation:
              "При больших d_k дисперсия скалярного произведения растёт, из-за чего softmax насыщается и градиенты стремятся к нулю.",
          },
          {
            question: "Какова вычислительная сложность классического Self-Attention относительно длины последовательности N?",
            answers: ["O(N)", "O(N log N)", "O(N^2)", "O(1)"],
            correct: 2,
            explanation:
              "Матрица внимания вычисляет попарные веса для всех N × N пар токенов, что даёт квадратичную сложность O(N^2).",
          },
        ],
        flashcards: [
          {
            term: "Scaled Dot-Product Attention",
            definition: "Вычисление весов внимания по формуле softmax(QK^T / √d_k)V.",
          },
          {
            term: "Multi-Head Attention",
            definition: "Параллельное применение нескольких механизмов внимания для захвата разных типов связей между словами.",
          },
        ],
      },
    },
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    user_id: "guest-demo",
    title: "DB301 · Relational Database Normalization & RLS",
    audio_path: null,
    duration: 2900,
    created_at: "2026-10-26T11:30:00.000Z",
    transcript:
      "Relational normalization eliminates data redundancy and prevents insertion, update, and deletion anomalies. First Normal Form (1NF) requires atomic attribute values and no repeating groups. Second Normal Form (2NF) eliminates partial functional dependencies on composite primary keys. Third Normal Form (3NF) eliminates transitive dependencies where a non-key attribute depends on another non-key attribute. In cloud PostgreSQL systems like Supabase, Row-Level Security (RLS) enforces tenant isolation directly inside the database kernel.",
    summary: {
      language: "Russian",
      data: {
        explanation:
          "Нормализация реляционных баз данных устраняет избыточность хранения и аномалии обновления. Переход от 1NF к 3NF последовательно убирает повторяющиеся группы, частичные зависимости от составного ключа и транзитивные зависимости между неключевыми атрибутами.",
        simplified:
          "Нормализация — это правильное разделение данных по таблицам, чтобы одна и та же информация не дублировалась и не возникало ошибок при удалении или изменении.",
        keyPoints: [
          "1NF: атомарность всех значений в ячейках и отсутствие повторяющихся групп",
          "2NF: полная функциональная зависимость неключевых полей от всего первичного ключа",
          "3NF: отсутствие транзитивных зависимостей (неключевое поле зависит только от ключа)",
          "Row-Level Security (RLS) в PostgreSQL изолирует строки каждого студента на уровне ядра СУБД",
        ],
        terms: [
          "3rd Normal Form (3NF): Состояние таблицы в 2NF, где ни один неключевой атрибут не зависит транзитивно от первичного ключа.",
          "ON DELETE CASCADE: Правило внешнего ключа, автоматически удаляющее дочерние карточки и тесты при удалении лекции.",
          "Row-Level Security (RLS): Механизм безопасности PostgreSQL, проверяющий условие (select auth.uid()) = user_id для каждой строки.",
        ],
        example:
          "В базе данных L-easy лекции хранятся в таблице recordings, а карточки — в flashcards, а акустическая телеметрия — в smart_audio_telemetry со связью по recording_id.",
      },
    },
    study: {
      language: "Russian",
      data: {
        quiz: [
          {
            question: "Какое условие необходимо для третьей нормальной формы (3NF)?",
            answers: [
              "Наличие хотя бы десяти столбцов",
              "Нахождение в 2NF и отсутствие транзитивных функциональных зависимостей неключевых атрибутов",
              "Хранение всех данных в одной таблице",
              "Использование только текстовых типов данных",
            ],
            correct: 1,
            explanation:
              "3NF требует, чтобы таблица находилась в 2NF и каждый неключевой атрибут зависел напрямую только от первичного ключа.",
          },
        ],
        flashcards: [
          {
            term: "3rd Normal Form (3NF)",
            definition: "Отсутствие транзитивных зависимостей между неключевыми атрибутами таблицы.",
          },
          {
            term: "Row-Level Security (RLS)",
            definition: "Политика уровня ядра СУБД PostgreSQL, ограничивающая доступ пользователя только к его собственным строкам.",
          },
        ],
      },
    },
  },
];

function getGuestRecordings(): RecordingRow[] {
  try {
    const raw = sessionStorage.getItem(GUEST_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as RecordingRow[];
    }
  } catch {}
  return DEFAULT_GUEST_RECORDINGS;
}

function saveGuestRecordings(rows: RecordingRow[]) {
  try {
    sessionStorage.setItem(GUEST_STORE_KEY, JSON.stringify(rows));
  } catch {}
}

function extensionFor(mime: string, fileName?: string) {
  const fromName = fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Uploads a recording/file to Storage and creates its row in `recordings`. */
export async function saveMedia(
  blob: Blob,
  opts: { title: string; duration?: number; mimeType?: string; fileName?: string },
): Promise<{ row?: RecordingRow; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  const seconds = Number.isFinite(opts.duration) ? Math.max(0, Math.round(opts.duration as number)) : null;

  if (!uid) {
    const guestRow: RecordingRow = {
      id: `guest-${Date.now()}`,
      user_id: "guest-demo",
      title: opts.title,
      audio_path: null,
      transcript: null,
      summary: null,
      study: null,
      duration: seconds,
      created_at: new Date().toISOString(),
    };
    const existing = getGuestRecordings();
    saveGuestRecordings([guestRow, ...existing]);
    return { row: guestRow };
  }

  const contentType = (opts.mimeType || blob.type || "audio/webm").split(";")[0];
  const path = `${uid}/${Date.now()}.${extensionFor(contentType, opts.fileName)}`;

  const up = await supabase.storage.from(AUDIO_BUCKET).upload(path, blob, { contentType });
  if (up.error) {
    console.error("Upload failed", up.error);
    return { error: `Upload failed: ${up.error.message}` };
  }

  const ins = await supabase
    .from("recordings")
    .insert({ user_id: uid, title: opts.title, audio_path: path, duration: seconds })
    .select()
    .single();
  if (ins.error) {
    console.error("Insert failed", ins.error);
    await supabase.storage.from(AUDIO_BUCKET).remove([path]);
    return { error: `Could not save the recording: ${ins.error.message}` };
  }
  return { row: ins.data as RecordingRow };
}

export async function updateRecording(
  id: string,
  patch: Partial<Pick<RecordingRow, "title" | "transcript" | "summary" | "study">>,
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id || id.startsWith("guest-") || id.startsWith("11111111-")) {
    const existing = getGuestRecordings();
    const updated = existing.map((item) => (item.id === id ? { ...item, ...patch } : item));
    saveGuestRecordings(updated);
    return true;
  }
  const { error } = await supabase.from("recordings").update(patch).eq("id", id);
  if (error) console.error("Update failed", error);
  return !error;
}

export async function listRecordings(): Promise<RecordingRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) {
    return getGuestRecordings();
  }
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecordingRow[];
}

export async function getSignedAudioUrl(path: string) {
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function deleteRecording(row: RecordingRow) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id || row.id.startsWith("guest-") || row.id.startsWith("11111111-")) {
    const existing = getGuestRecordings();
    saveGuestRecordings(existing.filter((item) => item.id !== row.id));
    return;
  }
  if (row.audio_path) await supabase.storage.from(AUDIO_BUCKET).remove([row.audio_path]);
  const { error } = await supabase.from("recordings").delete().eq("id", row.id);
  if (error) throw new Error(error.message);
}

/** fetch() to our /api routes with the user's Supabase token (the API rejects anonymous calls). */
export async function authFetch(input: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(input, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : { "X-Guest-Demo": "true" }),
    },
    body: JSON.stringify(body),
  });
}

/** Row for a lecture that has no audio (e.g. a PDF or a typed transcript). */
export async function createLectureRow(opts: { title: string; transcript?: string }) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) {
    const guestRow: RecordingRow = {
      id: `guest-${Date.now()}`,
      user_id: "guest-demo",
      title: opts.title,
      audio_path: null,
      transcript: opts.transcript ?? null,
      summary: null,
      study: null,
      duration: 2700,
      created_at: new Date().toISOString(),
    };
    const existing = getGuestRecordings();
    saveGuestRecordings([guestRow, ...existing]);
    return { row: guestRow } as { row?: RecordingRow; error?: string };
  }

  const { data, error } = await supabase
    .from("recordings")
    .insert({ user_id: uid, title: opts.title, transcript: opts.transcript ?? null })
    .select()
    .single();
  if (error) {
    console.error("Insert failed", error);
    return { error: `Could not save the lecture: ${error.message}` } as { row?: RecordingRow; error?: string };
  }
  return { row: data as RecordingRow } as { row?: RecordingRow; error?: string };
}
