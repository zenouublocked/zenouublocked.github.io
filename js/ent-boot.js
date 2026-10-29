/* set catalogue kind from the page name, then run the shared boot */
'use strict';
(function () {
  const page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (page.startsWith('tv')) TMDB.kind = 'tv';
  bootEntPage();
})();
