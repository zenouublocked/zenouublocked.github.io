// A TMDB-shaped fixture server. It exists so the API layer can be proven
// end-to-end without a real key: routing, shaping, dedupe, caching, retry-after
// and the failure paths all run against this instead of the live service.
//
//   node scripts/mock-tmdb.mjs [port]
//
// Behaviour worth knowing:
//   /3/fail/429-once   answers 429 once, then 200 (exercises the retry path)
//   /3/fail/401        always 401 (exercises bad_credentials)
//   /3/fail/500        always 500 (exercises the upstream_error path)
//   any other path     answered from the fixtures below
import http from 'node:http';

const movie = (id, title, extra = {}) => ({
  id,
  media_type: 'movie',
  title,
  original_title: title,
  release_date: '2026-03-14',
  poster_path: `/p${id}.jpg`,
  backdrop_path: `/b${id}.jpg`,
  vote_average: 7.42,
  vote_count: 1234,
  overview: '  A test synopsis.  ',
  genre_ids: [28, 878],
  adult: false,
  ...extra,
});

const tv = (id, name, extra = {}) => ({
  id,
  media_type: 'tv',
  name,
  original_name: name,
  first_air_date: '2025-09-01',
  poster_path: `/p${id}.jpg`,
  backdrop_path: `/b${id}.jpg`,
  vote_average: 8.1,
  vote_count: 900,
  overview: 'A test series.',
  genre_ids: [18],
  ...extra,
});

const FEED_PAGE_1 = [
  movie(550, 'Fight Club'),
  tv(1399, 'Game of Thrones'),
  // duplicates and people must be collapsed by the shaping layer
  movie(550, 'Fight Club'),
  { id: 287, media_type: 'person', name: 'Brad Pitt' },
  movie(27205, 'Inception', { poster_path: null, overview: '' }),
];

const DETAIL_550 = {
  id: 550,
  title: 'Fight Club',
  original_title: 'Fight Club',
  tagline: 'Mischief. Mayhem. Soap.',
  overview: 'An insomniac office worker and a soap maker form an underground fight club.',
  release_date: '1999-10-15',
  poster_path: '/p550.jpg',
  backdrop_path: '/b550.jpg',
  vote_average: 8.438,
  vote_count: 26000,
  runtime: 139,
  status: 'Released',
  homepage: 'https://example.invalid',
  genres: [{ id: 18, name: 'Drama' }],
  production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
  spoken_languages: [{ english_name: 'English', name: 'English' }],
  credits: {
    cast: [
      { id: 287, name: 'Brad Pitt', character: 'Tyler Durden', profile_path: '/c287.jpg' },
      { id: 819, name: 'Edward Norton', character: 'The Narrator', profile_path: null },
    ],
    crew: [{ id: 7467, name: 'David Fincher', job: 'Director' }],
  },
  videos: {
    results: [
      { key: 'BdJKm16Co6M', site: 'YouTube', type: 'Trailer', official: true, name: 'Official Trailer' },
      { key: 'zzz', site: 'YouTube', type: 'Teaser', official: false, name: 'Teaser' },
    ],
  },
  release_dates: {
    results: [
      { iso_3166_1: 'GB', release_dates: [{ certification: '18' }] },
      { iso_3166_1: 'US', release_dates: [{ certification: 'R' }] },
    ],
  },
  recommendations: { results: [movie(13, 'Forrest Gump'), movie(13, 'Forrest Gump')] },
  similar: { results: [movie(807, 'Se7en')] },
};

let hits = 0;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Do not count the counter itself, or every assertion about cache hits drifts.
  if (url.pathname === '/__hits') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ hits }));
  }
  hits += 1;
  const send = (status, body, headers = {}) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json', 'x-mock-hits': String(hits), ...headers });
    res.end(payload);
  };

  if (url.pathname.startsWith('/3/fail/429-once')) {
    if (!server.rateLimited) {
      server.rateLimited = true;
      return send(429, { status_message: 'slow down' }, { 'retry-after': '1' });
    }
    return send(200, { page: 1, total_pages: 1, total_results: 1, results: [movie(603, 'The Matrix')] });
  }
  if (url.pathname.startsWith('/3/fail/401')) return send(401, { status_message: 'Invalid API key' });
  if (url.pathname.startsWith('/3/fail/500')) return send(500, { status_message: 'boom' });

  if (url.pathname === '/3/genre/movie/list') return send(200, { genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }] });
  if (url.pathname === '/3/genre/tv/list') return send(200, { genres: [{ id: 18, name: 'Drama' }] });

  const LIST = /^\/3\/(movie\/(popular|upcoming|now_playing|top_rated)|tv\/(popular|airing_today|on_the_air|top_rated)|trending\/(movie|tv|all)\/\w+)$/;
  if (LIST.test(url.pathname)) {
    return send(200, { page: 1, total_pages: 5, total_results: 100, results: FEED_PAGE_1 });
  }

  // Player fixtures: up / framed-blocked / gone.
  if (url.pathname.startsWith('/player/')) {
    if (url.pathname.includes('/dead/')) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('<h1>no copy</h1>');
    }
    if (url.pathname.includes('/blocked/')) {
      res.writeHead(200, { 'content-type': 'text/html', 'x-frame-options': 'SAMEORIGIN' });
      return res.end('<h1>player</h1>');
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<h1>player</h1>');
  }
  if (url.pathname === '/3/discover/movie' || url.pathname === '/3/discover/tv') {
    return send(200, {
      page: Number(url.searchParams.get('page') || 1),
      total_pages: 3,
      total_results: 60,
      results: [movie(120, 'The Lord of the Rings', { genre_ids: [Number(url.searchParams.get('with_genres') || 28)] })],
      echoGenre: url.searchParams.get('with_genres'),
    });
  }
  if (url.pathname === '/3/search/multi' || url.pathname === '/3/search/movie' || url.pathname === '/3/search/tv') {
    const q = url.searchParams.get('query') || '';
    if (!q) return send(200, { page: 1, total_pages: 0, total_results: 0, results: [] });
    return send(200, { page: 1, total_pages: 1, total_results: 2, results: FEED_PAGE_1.slice(0, 3) });
  }
  if (url.pathname === '/3/movie/550') return send(200, DETAIL_550);
  if (url.pathname.startsWith('/3/movie/')) {
    const id = Number(url.pathname.split('/')[3]);
    if (!Number.isFinite(id) || id === 0) return send(404, { status_message: 'Not found' });
    return send(200, { ...DETAIL_550, id, title: `Fixture ${id}`, videos: { results: [] }, release_dates: { results: [] } });
  }
  if (url.pathname.startsWith('/3/tv/')) {
    const id = Number(url.pathname.split('/')[3]);
    if (id === 999) return send(404, { status_message: 'Not found' });
    return send(200, {
      id,
      name: `Fixture Show ${id}`,
      first_air_date: '2020-01-01',
      overview: 'A fixture series.',
      poster_path: '/p.jpg',
      backdrop_path: '/b.jpg',
      vote_average: 7,
      vote_count: 10,
      number_of_seasons: 2,
      number_of_episodes: 16,
      genres: [{ id: 18, name: 'Drama' }],
      seasons: [{ season_number: 1, name: 'Season 1', episode_count: 8 }, { season_number: 0, name: 'Specials', episode_count: 1 }],
      content_ratings: { results: [{ iso_3166_1: 'US', rating: 'TV-MA' }] },
      videos: { results: [] },
      credits: { cast: [], crew: [] },
      similar: { results: [] },
      recommendations: { results: [] },
    });
  }

  return send(404, { status_message: `no fixture for ${url.pathname}` });
});

const port = Number(process.argv[2] || 8788);
server.listen(port, '127.0.0.1', () => console.log(`[mock-tmdb] http://127.0.0.1:${port}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
