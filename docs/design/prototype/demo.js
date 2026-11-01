/* HomeTV demo mode: sample channels, guide, movies and series served in the browser.
   Loaded before app.js only in the cloud prototype. The real app talks to the HomeTV home helper instead. */
'use strict';
window.DEMO = true;
(function () {
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const escx = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const HUES = { 1: 205, 2: 145, 3: 350, 4: 45, 5: 95, 6: 280, 7: 20 };

  const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // artwork is pre-drawn (see tools/gen-art.js) so it looks like real channel logos and key art
  const logo = name => `art/l-${slug(name)}.svg`;
  const poster = (title, kind) => `art/${kind}-${slug(title)}.svg`;

  // ---------------------------------------------------------------- live TV
  const LIVE_CATS = [[1, 'News'], [2, 'Sports'], [3, 'Movies & Drama'], [4, 'Kids & Family'], [5, 'Documentary & Lifestyle'], [6, 'Music'], [7, 'India']];
  const CHANNELS = {
    1: ['Metro News 24', 'Global Report', 'Business Today', 'Weather Now', 'City Live'],
    2: ['Arena Sports 1', 'Arena Sports 2', 'Goal TV', 'Court Side', 'Motor Max', 'Cricket Plus'],
    3: ['Cinema One', 'Cinema Classics', 'Drama Plus', 'Thriller Zone', 'Laugh Track'],
    4: ['Kids Planet', 'Toon Time', 'Family Hub'],
    5: ['Nature & Wild', 'Science Now', 'History Vault', 'Travel Escape', 'Kitchen Live'],
    6: ['Hit Music TV', 'Retro Hits', 'Jazz Lounge'],
    7: ['India Gold', 'Desi News 24', 'Gujarati Plus', 'Filmy Masala', 'Bhakti Sagar'],
  };
  const SHOWS = {
    1: ['Morning Briefing', 'World Tonight', 'Market Watch', 'The Debate', 'Headlines at the Hour', 'Weather Outlook', 'Global Business', 'Press Conference Live'],
    2: ['Premier Football Live', 'Match of the Week', 'Tennis: Quarter-final', 'Cricket: 2nd Test, Day 3', 'Grand Prix Qualifying', 'Sports Centre', 'Fight Night Classics', 'Golf Highlights'],
    3: ['The Long Road Home', 'Midnight Express Line', 'A Summer in Lisbon', 'Cold Harbour', 'The Last Witness', 'Second Chances', 'Night Shift', 'The Grand Hotel'],
    4: ['Rocket Pups', 'The Treehouse Gang', 'Super Science Kids', 'Dino Valley', 'Bedtime Stories', 'Puzzle Island'],
    5: ['Planet Oceans', 'How It\'s Built', 'Lost Empires', 'Street Food Asia', 'Wild Africa', 'Space: The Next Frontier', 'Grand Designs at Home', 'Railway Journeys'],
    6: ['Top 40 Countdown', 'Non-Stop Hits', 'Unplugged Sessions', '80s Gold', 'Late Night Jazz'],
    7: ['Prime Time Samachar', 'Rasoi Show', 'Garba Nights', 'Superhit Cinema', 'Aarti Live', 'Comedy Nights', 'Family Drama Hour'],
  };
  const DESCS = ['The latest stories and analysis, with live reports.', 'Live coverage from the venue with expert commentary.', 'A gripping story of family, loyalty and second chances.', 'Fun and learning for younger viewers.', 'An eye-opening look at the world around us.', 'The biggest songs of the moment, back to back.', 'Popular entertainment for the whole family.'];

  const streams = []; let num = 1;
  for (const [cid] of LIVE_CATS) for (const name of CHANNELS[cid]) {
    const id = 1000 + num;
    streams.push({ num, name, stream_type: 'live', stream_id: id, stream_icon: logo(name), epg_channel_id: 'demo.' + id, category_id: String(cid),
      tv_archive: [1, 2, 7].includes(cid) ? 1 : 0, tv_archive_duration: [1, 2, 7].includes(cid) ? 3 : 0 });
    num++;
  }
  const byId = new Map(streams.map(s => [String(s.stream_id), s]));
  const now = Math.floor(Date.now() / 1000), dayStart = Math.floor(now / 1800) * 1800 - 30 * 3600;
  const epg = {};
  for (const s of streams) {
    const r = rng(hash(s.name)), cat = Number(s.category_id), list = []; let t = dayStart;
    while (t < now + 42 * 3600) {
      const dur = pick(r, cat === 1 ? [1800, 1800, 3600] : cat === 3 ? [5400, 7200, 6300] : cat === 2 ? [3600, 7200, 5400] : [1800, 3600]);
      const title = pick(r, SHOWS[cat]);
      list.push([t, t + dur, title, DESCS[cat - 1]]); t += dur;
    }
    epg[s.epg_channel_id] = list;
  }

  // ---------------------------------------------------------------- movies & series
  const VOD_CATS = [[10, 'New Releases'], [11, 'Action & Adventure'], [12, 'Comedy'], [13, 'Family'], [14, 'Bollywood']];
  const MOVIE_TITLES = {
    10: ['Northern Lights', 'The Glass Orchard', 'Signal Lost', 'Paper Kingdoms', 'Echoes of June', 'After the Storm'],
    11: ['Iron Horizon', 'Edge of Midnight', 'The Ninth Gate Run', 'Red Canyon', 'Deep Current', 'Skyfall Protocol'],
    12: ['Wedding Crashers Club', 'My Neighbour the Chef', 'Totally Fine', 'Road Trip Rules', 'Office Hours'],
    13: ['The Secret Garden Gate', 'Captain Biscuit', 'Snow Day Heroes', 'Dragon Lake'],
    14: ['Dil Se Dosti', 'Monsoon Melody', 'Rang Barse', 'Safar', 'Kismat Connection 2'],
  };
  const vods = []; let vn = 1;
  for (const [cid] of VOD_CATS) for (const title of MOVIE_TITLES[cid]) {
    const r = rng(hash(title)), year = 2018 + Math.floor(r() * 8);
    vods.push({ num: vn, name: `${title} (${year})`, stream_type: 'movie', stream_id: 5000 + vn, stream_icon: poster(title, 'm'), rating: (5.8 + r() * 3).toFixed(1), category_id: String(cid), container_extension: 'mp4', year: String(year), _t: title });
    vn++;
  }
  const SER_CATS = [[20, 'Drama'], [21, 'Comedy'], [22, 'Crime'], [23, 'Indian Series']];
  const SERIES_T = { 20: ['The Harbour', 'Kingsbridge', 'Summer House'], 21: ['Flat Share', 'The Night Desk'], 22: ['Cold Case Unit', 'Blackwater'], 23: ['Ghar Ki Baat', 'Mumbai Diaries Season'] };
  const series = []; let sn = 1;
  for (const [cid] of SER_CATS) for (const title of SERIES_T[cid]) {
    const r = rng(hash(title)), year = 2016 + Math.floor(r() * 9);
    series.push({ num: sn, name: title, series_id: 8000 + sn, cover: poster(title, 's'), plot: `A ${['gripping', 'warm', 'sharp', 'twisty'][sn % 4]} ${['drama', 'comedy', 'mystery', 'family saga'][cid - 20]} that follows one group of people through a life-changing year.`, releaseDate: `${year}-03-01`, rating: (6.5 + r() * 2.5).toFixed(1), category_id: String(cid), _seasons: 1 + Math.floor(r() * 3) });
    sn++;
  }

  // ---------------------------------------------------------------- user data (this browser only)
  const KEY = 'hometv-demo-user-v2';
  let user; try { user = JSON.parse(localStorage.getItem(KEY)); } catch { user = null; }
  const ago = m => Math.floor(Date.now() / 1000) - m * 60;
  const favIds = ['1001', '1006', '1012', '1028', '1030', '1017', '1020', '1008', '1025'];
  if (!user) user = {
    favorites: { live: favIds.map(id => ({ id, name: byId.get(id).name })), movie: [{ id: '5003', name: vods[2].name }], series: [{ id: '8001', name: 'The Harbour' }] },
    hidden: { live: [], movie: [], series: [] },
    progress: {
      'movie:5002': { name: vods[1].name, icon: vods[1].stream_icon, ext: 'mp4', pos: 3100, dur: 6840, t: ago(40) },
      'episode:800113': { name: 'The Harbour S1 E3', icon: series[0].cover, ext: 'mp4', series_id: '8001', series_name: 'The Harbour', pos: 1320, dur: 2580, t: ago(300) },
      'movie:5008': { name: vods[7].name, icon: vods[7].stream_icon, ext: 'mp4', pos: 5200, dur: 7400, t: ago(1500) },
    },
    recent: ['1006', '1001', '1028', '1012'],
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(user)); } catch { /* private mode */ } };

  // ---------------------------------------------------------------- provider login shown in Settings (the household uses a MAC portal)
  const LOGIN_KEY = 'hometv-demo-login';
  let login; try { login = JSON.parse(localStorage.getItem(LOGIN_KEY)); } catch { login = null; }
  if (!login) login = { provider_type: 'stalker', server: 'portal.example', mac_hint: '…:A1:B2' };

  // ---------------------------------------------------------------- fake API
  const ok = d => new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const b64 = s => btoa(unescape(encodeURIComponent(s)));
  const strip = o => { const c = { ...o }; delete c._t; delete c._seasons; return c; };
  function xApi(q) {
    const a = q.get('action'), c = q.get('category_id');
    switch (a) {
      case 'get_live_categories': return LIVE_CATS.map(([id, n]) => ({ category_id: String(id), category_name: n, parent_id: 0 }));
      case 'get_live_streams': return streams.filter(s => !c || s.category_id === c);
      case 'get_vod_categories': return VOD_CATS.map(([id, n]) => ({ category_id: String(id), category_name: n }));
      case 'get_vod_streams': return vods.filter(v => !c || v.category_id === c).map(strip);
      case 'get_series_categories': return SER_CATS.map(([id, n]) => ({ category_id: String(id), category_name: n }));
      case 'get_series': return series.filter(v => !c || v.category_id === c).map(strip);
      case 'get_vod_info': {
        const v = vods.find(x => String(x.stream_id) === q.get('vod_id')) || vods[0], r = rng(hash(v.name));
        return { info: { plot: `${v._t} is a ${pick(r, ['tense', 'heart-warming', 'funny', 'sweeping'])} story about ${pick(r, ['an unlikely friendship', 'a family secret', 'one last job', 'finding home again'])}. Sample data for the HomeTV prototype.`, genre: VOD_CATS.find(([id]) => String(id) === v.category_id)[1], releasedate: v.year + '-06-01', duration: `0${1 + Math.floor(r() * 2)}:${String(10 + Math.floor(r() * 49))}:00`, rating: v.rating, cast: 'Sample Cast, Demo Actor' }, movie_data: { stream_id: v.stream_id, container_extension: 'mp4' } };
      }
      case 'get_series_info': {
        const s = series.find(x => String(x.series_id) === q.get('series_id')) || series[0], eps = {};
        for (let n = 1; n <= s._seasons; n++) eps[n] = Array.from({ length: 6 }, (_, i) => ({ id: String(s.series_id * 100 + n * 10 + i + 1), episode_num: i + 1, title: i === 0 && n === 1 ? 'Pilot' : `Episode ${i + 1}`, container_extension: 'mp4', season: n, info: { duration: '00:4' + (i % 10) + ':00', plot: `Season ${n}, episode ${i + 1} of ${s.name}.` } }));
        return { seasons: [], info: { name: s.name, plot: s.plot, genre: SER_CATS.find(([id]) => String(id) === s.category_id)[1], releaseDate: s.releaseDate, rating: s.rating }, episodes: eps };
      }
      case 'get_short_epg': {
        const st = byId.get(q.get('stream_id')); const l = st ? epg[st.epg_channel_id].filter(p => p[1] > Date.now() / 1000).slice(0, 3) : [];
        return { epg_listings: l.map(p => ({ title: b64(p[2]), description: b64(p[3]), start_timestamp: String(p[0]), stop_timestamp: String(p[1]) })) };
      }
    }
    return [];
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    const m = url.pathname.match(/\/api\/(\w+)$/);
    if (!m) return realFetch(input, init);
    await new Promise(r => setTimeout(r, 60));
    const body = init.body ? JSON.parse(init.body) : {};
    switch (m[1]) {
      case 'status': return ok({ configured: true, version: '1.0 demo', tz_offset: 0, ...login,
        epg: { state: 'ready', updated: now - 3600, channels: streams.length, programmes: Object.values(epg).reduce((a, l) => a + l.length, 0), error: '' },
        account: login.provider_type === 'stalker' ? { status: 'Active', exp_date: String(now + 200 * 86400) }
          : { username: 'demo', status: 'Active', exp_date: String(now + 200 * 86400), active_cons: '1', max_connections: '2', allowed_output_formats: ['m3u8', 'ts'] } });
      case 'userdata': return ok(user);
      case 'x': return ok(xApi(url.searchParams));
      case 'epg': { const out = {}; for (const id of body.ids || []) if (epg[id]) out[id] = epg[id].filter(p => p[1] > body.from && p[0] < body.to); return ok({ state: 'ready', programmes: out }); }
      case 'favorite': {
        const k = body.type; user.favorites[k] = user.favorites[k].filter(f => String(f.id) !== String(body.item.id));
        if (body.on) user.favorites[k].push(body.item); save(); return ok(user.favorites);
      }
      case 'hidden': user.hidden[body.type] = body.ids || []; save(); return ok(user.hidden);
      case 'progress': {
        const pos = +body.pos || 0, dur = +body.dur || 0;
        if (body.remove || (dur && pos / dur > 0.95) || pos < 15) delete user.progress[body.key];
        else user.progress[body.key] = { name: body.name, icon: body.icon, ext: body.ext, series_id: body.series_id, series_name: body.series_name, pos, dur, t: Math.floor(Date.now() / 1000) };
        save(); return ok({ ok: true });
      }
      case 'recent': return ok({ ok: true });
      case 'refresh': return ok({ ok: true });
      case 'setup': {
        // demo of the helper's answers (F-036): 00:1A:79:00:00:00 plays an unregistered MAC
        const err = m => new Response(JSON.stringify({ error: m }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (body.type === 'stalker') {
          if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(body.mac || '')) return err('Enter a MAC address like 00:1A:79:12:34:56.');
          if (body.mac === '00:1A:79:00:00:00') return err('The portal didn\'t accept this MAC address. Check it with your provider. In the prototype, any other MAC works.');
          let host = ''; try { host = new URL(body.portal).hostname; } catch { return err('This doesn\'t look like a web address.'); }
          login = { provider_type: 'stalker', server: host, mac_hint: '…:' + body.mac.slice(-5) };
        } else {
          if (!body.server || !body.username || !body.password) return err('Fill in the server address, username and password.');
          let host = body.server; try { host = new URL(/^https?:/.test(body.server) ? body.server : 'http://' + body.server).hostname; } catch { /* keep */ }
          login = { provider_type: 'xtream', server: host, username: body.username };
        }
        try { localStorage.setItem(LOGIN_KEY, JSON.stringify(login)); } catch { /* private mode */ }
        return ok({ ok: true });
      }
    }
    return new Response('{"error":"not found"}', { status: 404 });
  };

  // demo video: decoded once into a blob URL so it plays inside the artifact frame
  const bin = atob(window.DEMO_VIDEO_B64 || ''); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  window.DEMO_VIDEO = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));

  document.addEventListener('DOMContentLoaded', () => {
    const c = document.querySelector('.rail .clock');
    if (c) c.insertAdjacentHTML('beforebegin', '<span class="demo-pill" title="Sample channels and a demo video. Your real channels appear when HomeTV runs with your login.">Sample<br>data</span>');
  });
})();
