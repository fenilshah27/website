/* fenilpshah.com — Cloudflare Worker in front of the static site in /site.
   Handles everything _redirects can't: www → apex, old subdomains, old page names, and /g/<code>. */
const APEX = 'fenilpshah.com';
const SUBDOMAINS = {            // old subdomain → new path ("g" = keep the greeting code)
  otlo: '/otlo/', amd: '/otlo/', iq: '/iq/', appointment: '/book/',
  sorry: 'g', birthday: 'g', greetings: 'g'
  // book: '/book/'   ← turn on once the Fenil Meet page has moved over
};
const OLD_PATHS = { '/home': '/', '/about-me': '/about/', '/phyilosophy': '/philosophy/', '/appointment': '/book/' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const go = (path, keepQuery) => Response.redirect('https://' + APEX + path + (keepQuery ? url.search : ''), 301);

    if (host === 'www.' + APEX) return go(url.pathname, true);
    if (host.endsWith('.' + APEX)) {
      const sub = host.slice(0, -(APEX.length + 1)).replace(/^www\./, '');
      const to = SUBDOMAINS[sub];
      if (to === 'g') {
        const code = url.pathname.replace(/^\/+|\/+$/g, '');
        return go(code ? '/g/' + encodeURIComponent(decodeURIComponent(code)) : '/greetings/', false);
      }
      if (to) return go(to, false);
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (OLD_PATHS[path.toLowerCase()]) return go(OLD_PATHS[path.toLowerCase()], true);

    if (/^\/g\/[^/]+\/?$/.test(url.pathname)) {           // every greeting link uses the same page
      const page = await env.ASSETS.fetch(new Request(new URL('/g/', url), request));
      return new Response(page.body, page);
    }
    return env.ASSETS.fetch(request);
  }
};
