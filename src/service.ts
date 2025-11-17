const API_BASE_URL =
  (import.meta.env.VITE_CHAT_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://api.openai.com';
const API_KEY = (import.meta.env.VITE_CHAT_API_KEY as string | undefined) || '';
const DEFAULT_MODEL = (import.meta.env.VITE_CHAT_MODEL as string | undefined) || 'gpt-4o-mini';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, signal } = options;
  const url = `${API_BASE_URL}/${path.replace(/^\//, '')}`;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };
  if (API_KEY && !finalHeaders.Authorization) {
    finalHeaders.Authorization = `Bearer ${API_KEY}`;
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body == null ? undefined : JSON.stringify(body),
    signal
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const raw = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof raw === 'string'
        ? raw
        : raw?.error?.message || raw?.message || `请求失败（${response.status}）`;
    throw new Error(message);
  }

  return raw as T;
}

export type ChatResult = {
  text: string;
  raw: any;
};

export type ChatRequestOptions = {
  signal?: AbortSignal;
};

export async function createChatCompletion(
  input: string,
  options: ChatRequestOptions = {}
): Promise<ChatResult> {
  if (!input.trim()) {
    throw new Error('输入内容不能为空');
  }
  const payload = {
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: '你是有帮助的助手。' },
      { role: 'user', content: input }
    ]
  };

  const raw = await request<any>('v1/chat/completions', {
    method: 'POST',
    body: payload,
    signal: options.signal
  });
  const text =
    raw?.choices?.[0]?.message?.content ??
    (typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
  return { text, raw };
}

