/** Leitor de RSS/Atom sem dependências (os portais respondem direto no app nativo). */
export interface Article {
  title: string;
  link: string;
  date?: number;
  summary?: string;
  image?: string;
  source: string;
  topic: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const strip = (html: string) =>
  decode(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : undefined;
}

function attr(block: string, name: string, attribute: string): string | undefined {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${attribute}=["']([^"']+)["'][^>]*>`, 'i'));
  return m ? decode(m[1]) : undefined;
}

export function parseFeed(xml: string, source: string, topic: string): Article[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  return blocks
    .map((b) => {
      const title = strip(tag(b, 'title') ?? '');
      const link = decode((tag(b, 'link') ?? '').trim()) || attr(b, 'link', 'href') || '';
      const raw = tag(b, 'pubDate') ?? tag(b, 'updated') ?? tag(b, 'dc:date') ?? tag(b, 'published');
      const date = raw ? Date.parse(decode(raw).trim()) : NaN;
      const body = tag(b, 'description') ?? tag(b, 'summary') ?? tag(b, 'content:encoded') ?? tag(b, 'content') ?? '';
      const image =
        attr(b, 'media:content', 'url') ??
        attr(b, 'media:thumbnail', 'url') ??
        attr(b, 'enclosure', 'url') ??
        decode(body).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const summary = strip(body).slice(0, 220);
      return { title, link, date: isNaN(date) ? undefined : date, summary: summary || undefined, image, source, topic };
    })
    .filter((a) => a.title && /^https?:/.test(a.link));
}

export async function fetchFeed(url: string, source: string, topic: string, timeoutMs = 10000): Promise<Article[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(await res.text(), source, topic);
  } finally {
    clearTimeout(t);
  }
}

export function timeAgo(ts?: number) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
