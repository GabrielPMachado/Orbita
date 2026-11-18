/**
 * Filmes e séries pelo TMDB (themoviedb.org): capa, sinopse, ano, gêneros e onde assistir no Brasil
 * (os dados de "onde assistir" vêm do JustWatch, pelo próprio TMDB).
 *
 * A chave (token de leitura da API, gratuito) fica no Keychain, nunca no código.
 */
import { create } from 'zustand';
import { deleteSecret, getSecret, setSecret } from './secrets';

const K_TOKEN = 'tmdb.token';
const API = 'https://api.themoviedb.org/3';
export const TMDB_IMG = (path: string, size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342') => `https://image.tmdb.org/t/p/${size}${path}`;

export type Provider = { id: number; name: string; logo?: string };
export interface Providers {
  stream: Provider[];
  rent: Provider[];
  buy: Provider[];
  /** página do TMDB com os links para cada serviço */
  link?: string;
}
export interface TmdbHit {
  id: number;
  kind: 'filme' | 'serie';
  name: string;
  original?: string;
  year?: string;
  poster?: string;
  overview?: string;
}
export interface TmdbDetails extends TmdbHit {
  genres: string[];
  vote?: number;
  runtime?: number;
  seasons?: number;
  providers: Providers;
}

/* ---------- chave ---------- */

export const useTmdbKey = create<{ ready: boolean; has: boolean }>(() => ({ ready: false, has: false }));
let token: string | null | undefined;
async function key() {
  if (token === undefined) {
    token = await getSecret(K_TOKEN);
    useTmdbKey.setState({ ready: true, has: !!token });
  }
  return token;
}
export function loadTmdbKey() {
  key().catch(() => {});
}
export class TmdbError extends Error {}

/** Aceita o "Token de leitura da API" (longo) ou a "Chave da API" (32 caracteres). */
export async function saveTmdbKey(raw: string) {
  const k = raw.trim().replace(/^Bearer\s+/i, '');
  if (k.length < 20) throw new TmdbError('Isso não parece a chave do TMDB.');
  const prev = token;
  token = k;
  try {
    await get('/configuration');
  } catch (e) {
    token = prev;
    throw e instanceof TmdbError ? e : new TmdbError('Não consegui falar com o TMDB. Confira a internet.');
  }
  await setSecret(K_TOKEN, k);
  useTmdbKey.setState({ ready: true, has: true });
}
export async function removeTmdbKey() {
  token = null;
  await deleteSecret(K_TOKEN);
  useTmdbKey.setState({ ready: true, has: false });
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const k = await key();
  if (!k) throw new TmdbError('Falta a chave do TMDB.');
  const v4 = k.length > 40; // token de leitura (JWT) vai no cabeçalho; a chave curta vai na URL
  const qs = new URLSearchParams({ ...params, ...(v4 ? {} : { api_key: k }) }).toString();
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Accept: 'application/json', ...(v4 ? { Authorization: `Bearer ${k}` } : {}) },
  });
  if (res.status === 401) throw new TmdbError('O TMDB recusou a chave. Copie de novo o "Token de leitura da API".');
  if (!res.ok) throw new TmdbError(`O TMDB respondeu ${res.status}.`);
  return (await res.json()) as T;
}

/* ---------- busca e detalhes ---------- */

type RawHit = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  popularity?: number;
};
const hit = (r: RawHit, kind?: 'filme' | 'serie'): TmdbHit => {
  const k = kind ?? (r.media_type === 'tv' ? 'serie' : 'filme');
  const name = (k === 'filme' ? r.title : r.name) ?? r.title ?? r.name ?? '';
  const original = (k === 'filme' ? r.original_title : r.original_name) ?? undefined;
  const date = (k === 'filme' ? r.release_date : r.first_air_date) ?? '';
  return {
    id: r.id,
    kind: k,
    name,
    original: original && original !== name ? original : undefined,
    year: date.slice(0, 4) || undefined,
    poster: r.poster_path ?? undefined,
    overview: r.overview || undefined,
  };
};

export async function searchTitles(query: string): Promise<TmdbHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const j = await get<{ results: RawHit[] }>('/search/multi', { query: q, language: 'pt-BR', region: 'BR', include_adult: 'false' });
  return j.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 12).map((r) => hit(r));
}

type RawProv = { provider_id: number; provider_name: string; logo_path?: string };
function providersFrom(raw?: { results?: Record<string, { link?: string; flatrate?: RawProv[]; free?: RawProv[]; ads?: RawProv[]; rent?: RawProv[]; buy?: RawProv[] }> }): Providers {
  const br = raw?.results?.BR;
  const map = (l?: RawProv[]) => (l ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }));
  const uniq = (l: Provider[]) => l.filter((p, i) => l.findIndex((x) => x.id === p.id) === i);
  return {
    stream: uniq([...map(br?.flatrate), ...map(br?.free), ...map(br?.ads)]),
    rent: map(br?.rent),
    buy: map(br?.buy),
    link: br?.link,
  };
}

export async function titleDetails(id: number, kind: 'filme' | 'serie'): Promise<TmdbDetails> {
  type Raw = RawHit & {
    genres?: { name: string }[];
    vote_average?: number;
    runtime?: number;
    episode_run_time?: number[];
    number_of_seasons?: number;
    'watch/providers'?: Parameters<typeof providersFrom>[0];
  };
  const r = await get<Raw>(`/${kind === 'filme' ? 'movie' : 'tv'}/${id}`, { language: 'pt-BR', append_to_response: 'watch/providers' });
  return {
    ...hit(r, kind),
    genres: (r.genres ?? []).map((g) => g.name),
    vote: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
    runtime: r.runtime ?? r.episode_run_time?.[0],
    seasons: r.number_of_seasons,
    providers: providersFrom(r['watch/providers']),
  };
}

/** Nome curto do serviço para o chip ("Amazon Prime Video" → "Prime Video"). */
export function shortProvider(name: string) {
  return name
    .replace(/^Amazon Prime Video.*/i, 'Prime Video')
    .replace(/^Netflix.*/i, 'Netflix')
    .replace(/^(HBO )?Max.*/i, 'Max')
    .replace(/^Disney Plus|^Disney\+.*/i, 'Disney+')
    .replace(/^Apple TV Plus|^Apple TV\+.*/i, 'Apple TV+')
    .replace(/^Globoplay.*/i, 'Globoplay')
    .replace(/^Paramount Plus.*|^Paramount\+.*/i, 'Paramount+')
    .replace(/ Amazon Channel$/i, '');
}
