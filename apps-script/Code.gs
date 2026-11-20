/**********************************************************************
 *  fenilpshah.com — ONE backend for the whole website
 *  --------------------------------------------------------------------
 *  One Apps Script project, one web-app URL. Every service is a path:
 *
 *     <EXEC>/book     booking, feedback, Fenil Meet, booking admin + mail
 *     <EXEC>/iq       proctored IQ assessment
 *     <EXEC>/otlo     ઓટલો · Otlo content + contact form
 *     <EXEC>/greet    sorry / birthday / letter greeting links
 *     <EXEC>/admin    the single fenilpshah.com/admin dashboard
 *
 *  Your data stays in the four Google Sheets you already have. This
 *  script opens each one by its ID (fill them in just below). Each app
 *  keeps its own private settings, cache and triggers, so they can
 *  never mix even though they share one project.
 *
 *  SETUP (once) — see README for screenshots-level detail:
 *   1. Paste the 4 Sheet IDs in FPS.SHEETS below.
 *   2. Deploy → New deployment → Web app · Execute as: Me ·
 *      Who has access: Anyone. Copy the /exec URL into FPS.EXEC
 *      and into /config.js on the website. Save, Deploy → Manage
 *      deployments → edit → New version.
 *   3. Reload the Control sheet → 🌐 fenilpshah.com → Import settings
 *      from old scripts, then → Set up everything.
 **********************************************************************/
const FPS = {
  SITE: 'https://fenilpshah.com',          // the new website (no trailing slash)
  EXEC: 'PASTE_EXEC_URL_AFTER_FIRST_DEPLOY', // https://script.google.com/macros/s/…/exec
  SHEETS: {                                 // the ID is the long part of each Sheet's URL: /d/<ID>/edit
    book:  'PASTE_BOOKING_SHEET_ID',
    iq:    'PASTE_IQ_SHEET_ID',
    otlo:  'PASTE_OTLO_SHEET_ID',
    greet: 'PASTE_GREETINGS_SHEET_ID'
  }
};

/* Sheet-menu items that only worked with a selected row in the old
   bound sheets. They now live in fenilpshah.com/admin instead.       */
const SKIP_MENU_ = {
  BOOK:  ['confirmSelectedBooking', 'cancelSelectedBooking'],
  GREET: ['showStepsForRow', 'sendLinkByEmail'],
  OTLO:  ['makeCodes', 'pageHelp'],
  IQ:    []
};

/* ================================================================== *
 *  App sandboxes: each app sees "its own" spreadsheet, properties,
 *  cache and triggers, exactly like when it was a separate script.
 * ================================================================== */
function bind_(t, k) { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; }

function menu_(m, ns) {
  const skip = SKIP_MENU_[ns] || [];
  const w = {
    __real: m,
    addItem(label, fn) { if (skip.indexOf(fn) < 0) m.addItem(label, ns + '__' + fn); return w; },
    addSeparator() { m.addSeparator(); return w; },
    addSubMenu(sub) { m.addSubMenu(sub && sub.__real ? sub.__real : sub); return w; },
    addToUi() { m.addToUi(); }
  };
  return w;
}

function env_(ns, key) {
  let book = null;
  const open = () => {
    if (!book) {
      const id = FPS.SHEETS[key];
      if (!id || /^PASTE_/.test(id)) throw new Error('Add the "' + key + '" Sheet ID in FPS.SHEETS at the top of Code.gs.');
      book = SpreadsheetApp.openById(id);
    }
    return book;
  };
  const ui = () => {
    const real = SpreadsheetApp.getUi();
    return new Proxy(real, { get(t, k) { return k === 'createMenu' ? name => menu_(real.createMenu(name), ns) : bind_(t, k); } });
  };
  const SS = new Proxy(SpreadsheetApp, { get(t, k) {
    if (k === 'getActive' || k === 'getActiveSpreadsheet') return open;
    if (k === 'getActiveSheet') return () => open().getActiveSheet();
    if (k === 'getUi') return ui;
    return bind_(t, k);
  } });

  const P = ns + '.', rp = PropertiesService.getScriptProperties();
  const props = {
    getProperty: k => rp.getProperty(P + k),
    setProperty: (k, v) => { rp.setProperty(P + k, v); return props; },
    deleteProperty: k => { rp.deleteProperty(P + k); return props; },
    getProperties: () => { const a = rp.getProperties(), o = {}; Object.keys(a).forEach(k => { if (k.indexOf(P) === 0) o[k.slice(P.length)] = a[k]; }); return o; },
    setProperties: (m, del) => { if (del) props.deleteAllProperties(); const x = {}; Object.keys(m).forEach(k => { x[P + k] = m[k]; }); rp.setProperties(x); return props; },
    getKeys: () => Object.keys(props.getProperties()),
    deleteAllProperties: () => { props.getKeys().forEach(k => rp.deleteProperty(P + k)); return props; }
  };
  const PS = { getScriptProperties: () => props, getDocumentProperties: () => props, getUserProperties: () => PropertiesService.getUserProperties() };

  const rc = CacheService.getScriptCache();
  const cache = {
    get: k => rc.get(P + k),
    put: (k, v, t) => (t === undefined ? rc.put(P + k, v) : rc.put(P + k, v, t)),
    remove: k => rc.remove(P + k),
    getAll: ks => { const r = rc.getAll(ks.map(k => P + k)), o = {}; Object.keys(r).forEach(k => { o[k.slice(P.length)] = r[k]; }); return o; },
    putAll: (m, t) => { const x = {}; Object.keys(m).forEach(k => { x[P + k] = m[k]; }); return t === undefined ? rc.putAll(x) : rc.putAll(x, t); },
    removeAll: ks => rc.removeAll(ks.map(k => P + k))
  };
  const CS = { getScriptCache: () => cache, getDocumentCache: () => cache, getUserCache: () => CacheService.getUserCache() };

  const pre = ns + '__';
  const wrapT = tr => new Proxy(tr, { get(o, k) {
    if (k === '__real') return o;
    if (k === 'getHandlerFunction') return () => o.getHandlerFunction().slice(pre.length);
    return bind_(o, k);
  } });
  const SA = new Proxy(ScriptApp, { get(t, k) {
    if (k === 'newTrigger') return name => ScriptApp.newTrigger(pre + name);
    if (k === 'getProjectTriggers') return () => ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction().indexOf(pre) === 0).map(wrapT);
    if (k === 'deleteTrigger') return tr => ScriptApp.deleteTrigger(tr && tr.__real ? tr.__real : tr);
    return bind_(t, k);
  } });
  return [SS, PS, CS, SA];
}


/* ################################################################## *
 *  BOOK  —  original code, unchanged except where noted
 *  (opens FPS.SHEETS.book; settings/cache/triggers prefixed "BOOK.")
 * ################################################################## */
const BOOK = (function (SpreadsheetApp, PropertiesService, CacheService, ScriptApp) {
/**
 * ============================================================
 *  FENIL BOOK — backend for book.fenilpshah.com
 *  Google Sheet + Apps Script + Zoho Mail (India data centre)
 * ============================================================
 *
 *  Tabs this script creates and reads:
 *    Settings            – owner name, emails, booking rules
 *    Availability        – the hours you are open for appointments
 *    Classes             – recurring classes / commitments (blocked every week)
 *    Blocked             – one-off days or hours you are unavailable
 *    Appointment Types   – what people can book (name + duration)
 *    Bookings            – every booking (filled automatically)
 *    Emails              – which address + sender name each email is sent from (and on/off)
 *    Feedback            – feedback submitted after meetings
 *    Email Log           – every email sent, for troubleshooting
 *
 *  All times are India Standard Time (IST, UTC+05:30).
 *  Use the "Fenil Book" menu in the sheet for setup and admin actions.
 */

// ---------- Constants ----------
const TZ = 'Asia/Kolkata';
const IST_OFFSET_MIN = 330;                    // IST has no daylight saving
const ZOHO_ACCOUNTS = 'https://accounts.zoho.in';
const ZOHO_MAIL_API = 'https://mail.zoho.in/api';

const TAB = {
  SETTINGS: 'Settings',
  HOURS: 'Availability',
  CLASSES: 'Classes',
  BLOCKED: 'Blocked',
  TYPES: 'Appointment Types',
  BOOKINGS: 'Bookings',
  EMAILS: 'Emails',
  FEEDBACK: 'Feedback',
  LOG: 'Email Log',
  MEETS: 'Fenil Meet',
  SENT: 'Sent Mail'
};

const BOOKING_HEADERS = [
  'Booking ID', 'Created (IST)', 'Status', 'Appointment type', 'Date', 'Start', 'End',
  'Name', 'Email', 'Phone', 'Organisation', 'Purpose', 'Mode / location',
  'Cancelled by', 'Cancel reason', 'Cancelled at (IST)', 'Reminder sent', 'Feedback email sent', 'Booked by', 'Calendar event', 'Format', 'Meet link', 'Fenil Meet code'
];
const B = {
  ID: 0, CREATED: 1, STATUS: 2, TYPE: 3, DATE: 4, START: 5, END: 6, NAME: 7, EMAIL: 8,
  PHONE: 9, ORG: 10, PURPOSE: 11, MODE: 12, CBY: 13, CREASON: 14, CAT: 15, REMINDER: 16, FEEDBACK: 17, SOURCE: 18, CALID: 19, FORMAT: 20, MEET: 21, MCODE: 22
};

/** Every email the system sends. The key links each one to its row in the Emails tab. */
const EMAIL_TYPES = [
  ['confirmation',       'Booking confirmation (to client)'],
  ['owner_new',          'New booking alert (to you)'],
  ['cancellation',       'Cancellation (to client)'],
  ['owner_cancel',       'Cancellation alert (to you)'],
  ['reminder',           'Reminder (to client)'],
  ['owner_reminder',     'Reminder alert (to you)'],
  ['feedback_request',   'Feedback request (to client, after meeting)'],
  ['owner_feedback',     'Feedback received alert (to you)']
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];


// ============================================================
//  WEB API  (called by the booking page)
// ============================================================

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'availability';
    if (action === 'availability') return json_(availability_());
    if (action === 'schedule') return json_(schedule_(e.parameter.from, e.parameter.days));
    if (action === 'ics') return icsFeed_(e.parameter.key);
    if (action === 'open') return mailOpened_(e.parameter.m, e.parameter.k);
    return json_({ ok: false, error: 'Unknown request.' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong. Please try again in a moment.' });
  }
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (p.action === 'book') return json_(book_(p));
    if (p.action === 'lookup') return json_(lookup_(p));
    if (p.action === 'cancel') return json_(cancelByClient_(p));
    if (p.action === 'feedback') return json_(submitFeedback_(p));
    if (p.action === 'ownerSchedule') return json_(ownerSchedule_(p));
    if (p.action === 'ownerBook') return json_(ownerBook_(p));
    if (p.action === 'admin') return json_(admin_(p));
    if (p.action === 'meet') return json_(meet_(p));
    return json_({ ok: false, error: 'Unknown request.' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong. Please try again in a moment.' });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Available slots for every active appointment type, for the next N days. */
function availability_() {
  const cfg = loadConfig_();
  const s = cfg.settings;
  const result = {
    ok: true,
    owner: s.ownerName,
    open: s.open,
    timezone: 'IST',
    download: s.downloadOn,
    fenilMeet: s.fmOn,
    downloadMaxDays: s.downloadMaxDays,
    types: cfg.types.map(t => ({ name: t.name, duration: t.duration, mode: t.mode, description: t.description, format: t.format })),
    inPerson: s.inPersonLocation,
    availability: {}
  };
  if (!s.open) return result;

  const today = todayIST_();
  const now = Date.now();
  cfg.types.forEach(t => {
    const days = [];
    for (let i = 0; i <= s.daysAhead; i++) {
      const date = addDays_(today, i);
      days.push({ date: date, slots: slotsForDate_(cfg, date, t.duration, now) });
    }
    result.availability[t.name] = days;
  });
  return result;
}

/**
 * Free / not-free windows for the downloadable availability PDF.
 * Reveals only WHEN Fenil is free — never why a time is unavailable.
 */
function schedule_(fromParam, daysParam) {
  const cfg = loadConfig_();
  const s = cfg.settings;
  if (!s.downloadOn) return { ok: false, error: 'Availability downloads are turned off at the moment.' };
  const from = Math.max(0, Math.min(parseInt(fromParam, 10) || 0, s.daysAhead));
  const count = Math.max(1, Math.min(parseInt(daysParam, 10) || 7, s.downloadMaxDays));
  const today = todayIST_();
  const now = Date.now();
  const minLen = cfg.types.length ? Math.min.apply(null, cfg.types.map(t => t.duration)) : 15;

  const days = [];
  for (let i = from; i < from + count; i++) {
    const date = addDays_(today, i);
    days.push({ date: date, label: humanDate_(date), today: i === 0,
      free: s.open ? freeWindows_(cfg, date, now, minLen) : [] });
  }
  // Timeline range: the working hours across all days (fallback 9 am – 7 pm), rounded to the hour
  let lo = Infinity, hi = -Infinity;
  days.forEach(d => cfg.hours.forEach(h => {
    if (h.days.indexOf(dayOfWeek_(d.date)) > -1) { lo = Math.min(lo, h.start); hi = Math.max(hi, h.end); }
  }));
  if (!isFinite(lo)) { lo = 9 * 60; hi = 19 * 60; }
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;

  return {
    ok: true, owner: s.ownerName, pageUrl: s.pageUrl, open: s.open,
    generated: Utilities.formatDate(new Date(), TZ, "EEE d MMM yyyy, h:mm a").replace('AM', 'am').replace('PM', 'pm') + ' IST',
    range: [lo, hi],
    days: days.map(d => ({ date: d.date, label: d.label, today: d.today,
      free: d.free.map(iv => [fmtTime_(iv[0]), fmtTime_(iv[1])]) }))
  };
}

/** Bookable free windows on a date (working hours minus classes, blocks, bookings, buffer and notice). */
function freeWindows_(cfg, dateStr, nowMs, minLen) {
  const s = cfg.settings;
  const dow = dayOfWeek_(dateStr);
  const confirmed = cfg.bookings.filter(b => b.status === 'Confirmed' && b.date === dateStr);
  if (s.maxPerDay && confirmed.length >= s.maxPerDay) return [];

  const buffer = s.buffer || 0;
  const busy = [];
  cfg.classes.forEach(c => {
    if (!c.active || c.days.indexOf(dow) === -1) return;
    if (c.from && dateStr < c.from) return;
    if (c.until && dateStr > c.until) return;
    busy.push([c.start - buffer, c.end + buffer]);
  });
  cfg.blocked.forEach(bl => { if (bl.date === dateStr) busy.push([bl.start, bl.end]); });
  confirmed.forEach(b => busy.push([b.start - buffer, b.end + buffer]));

  // Anything before "now + minimum notice" is not bookable
  const dayStartMs = slotMs_(dateStr, 0);
  const earliest = Math.ceil((nowMs + (s.minNoticeHours || 0) * 3600000 - dayStartMs) / 60000);
  if (earliest > 0) busy.push([-1, Math.min(earliest, 24 * 60)]);

  let free = [];
  cfg.hours.forEach(h => { if (h.days.indexOf(dow) > -1) free.push([h.start, h.end]); });
  busy.forEach(bz => {
    const next = [];
    free.forEach(f => {
      if (bz[1] <= f[0] || bz[0] >= f[1]) { next.push(f); return; }
      if (bz[0] > f[0]) next.push([f[0], bz[0]]);
      if (bz[1] < f[1]) next.push([bz[1], f[1]]);
    });
    free = next;
  });
  // Merge overlapping windows, drop ones too short for any appointment
  free.sort((a, b) => a[0] - b[0]);
  const merged = [];
  free.forEach(f => {
    const last = merged[merged.length - 1];
    if (last && f[0] <= last[1]) last[1] = Math.max(last[1], f[1]); else merged.push([f[0], f[1]]);
  });
  return merged.filter(f => f[1] - f[0] >= (minLen || 15));
}

/** Create a booking. */
function book_(p) {
  // Honeypot: real people never fill the hidden "website" field
  if (p.website) return { ok: false, error: 'Could not complete the booking.' };

  const name = clean_(p.name, 100);
  const email = clean_(p.email, 150).toLowerCase();
  const phone = clean_(p.phone, 30);
  const org = clean_(p.organisation, 150);
  const purpose = clean_(p.purpose, 1000);
  const chosenFormat = clean_(p.format, 20);
  const typeName = clean_(p.type, 100);
  const date = clean_(p.date, 10);
  const start = clean_(p.start, 5);

  if (name.length < 2) return { ok: false, error: 'Please enter your name.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
  if (purpose.length < 3) return { ok: false, error: 'Please tell me briefly what you would like to discuss.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || parseTime_(start) === null) return { ok: false, error: 'Please choose a date and time.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let booking;
  try {
    const cfg = loadConfig_();
    const s = cfg.settings;
    if (!s.open) return { ok: false, error: 'Bookings are paused at the moment.' };

    const type = cfg.types.find(t => t.name === typeName);
    if (!type) return { ok: false, error: 'That appointment type is no longer available.' };

    const today = todayIST_();
    if (date < today || date > addDays_(today, s.daysAhead)) return { ok: false, error: 'That date is outside the booking window.' };

    const slots = slotsForDate_(cfg, date, type.duration, Date.now());
    if (slots.indexOf(start) === -1) {
      return { ok: false, taken: true, error: 'Sorry, that time was just taken or is no longer available. Please choose another.' };
    }

    // Limit open bookings per person
    const upcoming = cfg.bookings.filter(b => b.status === 'Confirmed' && b.email === email &&
      slotMs_(b.date, b.start) > Date.now());
    if (upcoming.length >= 3) {
      return { ok: false, error: 'You already have 3 upcoming bookings. Please cancel one before booking another.' };
    }

    const fmt = bookingFormat_(type, chosenFormat, s);
    if (fmt.error) return { ok: false, error: fmt.error };
    const startMin = parseTime_(start);
    booking = {
      format: fmt.format,
      id: newId_(cfg.bookings),
      created: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      status: 'Confirmed',
      type: type.name,
      date: date,
      start: startMin,
      end: startMin + type.duration,
      name: name, email: email, phone: phone, org: org, purpose: purpose,
      mode: fmt.mode
    };

    const sh = sheet_(TAB.BOOKINGS);
    const row = sh.getLastRow() + 1;
    booking.row = row;
    const values = [booking.id, booking.created, booking.status, booking.type, booking.date,
      fmtTime_(booking.start), fmtTime_(booking.end), booking.name, booking.email, booking.phone,
      booking.org, booking.purpose, booking.mode, '', '', '', '', '', 'Client', '', booking.format, ''];
    const range = sh.getRange(row, 1, 1, values.length);
    range.setNumberFormat('@');            // store everything as plain text (no auto-conversion)
    range.setValues([values]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // Emails are sent after the booking is safely saved
  const cfg2 = loadConfig_();
  try { attachMeet_(cfg2, booking); } catch (err) { console.error(err); booking.meetError = err.message; }
  try { attachFenilMeet_(cfg2, booking); } catch (err) { console.error(err); booking.meetError = err.message; }
  safeSend_(() => emailClientConfirmed_(cfg2, booking));
  safeSend_(() => emailOwnerNewBooking_(cfg2, booking));
  safeSend_(() => syncCalendar_());

  return { ok: true, booking: publicBooking_(booking, cfg2.settings) };
}

/** Look up a booking with ID + email (used by "Manage a booking"). */
function lookup_(p) {
  const cfg = loadConfig_();
  const b = findBooking_(cfg.bookings, p.id, p.email);
  if (!b) return { ok: false, error: 'No booking found with that ID and email. Please check both and try again.' };
  return { ok: true, booking: publicBooking_(b, cfg.settings) };
}

/** Client cancels their own booking. */
function cancelByClient_(p) {
  const reason = clean_(p.reason, 500);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let b, cfg;
  try {
    cfg = loadConfig_();
    b = findBooking_(cfg.bookings, p.id, p.email);
    if (!b) return { ok: false, error: 'No booking found with that ID and email.' };
    if (b.status !== 'Confirmed') return { ok: false, error: 'This booking is already ' + b.status.toLowerCase() + '.' };
    if (!canClientCancel_(b, cfg.settings)) {
      return { ok: false, error: 'This booking is too close to its start time to cancel online. Please email ' + cfg.settings.ownerEmail + '.' };
    }
    markCancelled_(b, 'Client', reason);
    b.status = 'Cancelled';
    b.cancelReason = reason;
  } finally {
    lock.releaseLock();
  }
  safeSend_(() => emailClientCancelled_(cfg, b, 'Client'));
  safeSend_(() => syncCalendar_());
  safeSend_(() => emailOwnerCancelled_(cfg, b, 'Client'));
  return { ok: true, booking: publicBooking_(b, cfg.settings) };
}

/** Client submits feedback after the meeting. */
function submitFeedback_(p) {
  if (p.website) return { ok: false, error: 'Could not submit feedback.' };
  const rating = parseInt(p.rating, 10);
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: 'Please choose a rating from 1 to 5.' };
  const liked = clean_(p.liked, 1500);
  const improve = clean_(p.improve, 1500);
  const followUp = clean_(p.followUp, 10) === 'Yes' ? 'Yes' : 'No';

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let b, cfg;
  try {
    cfg = loadConfig_();
    b = findBooking_(cfg.bookings, p.id, p.email);
    if (!b) return { ok: false, error: 'No booking found with that ID and email. Please check both and try again.' };
    if (b.status !== 'Confirmed') return { ok: false, error: 'Feedback is only open for meetings that took place.' };
    if (slotMs_(b.date, b.start) > Date.now()) return { ok: false, error: 'Feedback opens once the meeting has started.' };
    const already = rows_(TAB.FEEDBACK).some(r => String(r.d[1]).trim().toUpperCase() === b.id.toUpperCase());
    if (already) return { ok: false, error: 'Thank you — feedback for this booking has already been received.' };
    const sh = sheet_(TAB.FEEDBACK);
    const range = sh.getRange(sh.getLastRow() + 1, 1, 1, 10);
    range.setNumberFormat('@');
    range.setValues([[Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), b.id, b.name, b.email,
      b.type, b.date + ' ' + fmtTime_(b.start), String(rating), liked, improve, followUp]]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  const fb = { rating: rating, liked: liked, improve: improve, followUp: followUp };
  safeSend_(() => emailOwnerFeedback_(cfg, b, fb));
  return { ok: true, name: b.name };
}


// ============================================================
//  AVAILABILITY ENGINE  (pure functions — no Google services)
// ============================================================

/**
 * Returns start times ("HH:mm") that are free on dateStr for an appointment
 * of `duration` minutes. Removes classes, blocked time, other bookings
 * (with buffer), and anything inside the minimum-notice window.
 */
function slotsForDate_(cfg, dateStr, duration, nowMs) {
  const s = cfg.settings;
  const dow = dayOfWeek_(dateStr);

  const confirmed = cfg.bookings.filter(b => b.status === 'Confirmed' && b.date === dateStr);
  if (s.maxPerDay && confirmed.length >= s.maxPerDay) return [];

  const buffer = s.buffer || 0;
  const busy = [];
  cfg.classes.forEach(c => {
    if (!c.active || c.days.indexOf(dow) === -1) return;
    if (c.from && dateStr < c.from) return;
    if (c.until && dateStr > c.until) return;
    busy.push([c.start - buffer, c.end + buffer]);
  });
  cfg.blocked.forEach(bl => { if (bl.date === dateStr) busy.push([bl.start, bl.end]); });
  confirmed.forEach(b => busy.push([b.start - buffer, b.end + buffer]));

  const earliest = nowMs + (s.minNoticeHours || 0) * 3600000;
  const step = s.step > 0 ? s.step : 30;
  const found = {};
  cfg.hours.forEach(h => {
    if (h.days.indexOf(dow) === -1) return;
    for (let t = h.start; t + duration <= h.end; t += step) {
      const clash = busy.some(iv => t < iv[1] && t + duration > iv[0]);
      if (clash) continue;
      if (slotMs_(dateStr, t) < earliest) continue;
      found[t] = true;
    }
  });
  return Object.keys(found).map(Number).sort((a, b) => a - b).map(fmtTime_);
}

function parseTime_(v) {
  if (v === null || v === undefined) return null;
  const m = String(v).trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

function fmtTime_(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

/** "Mon", "Tuesday", "tue, thu", "Mon-Fri", "Daily", "Weekdays" -> [day indexes] */
function parseDays_(v) {
  const str = String(v || '').trim().toLowerCase();
  if (!str) return [];
  if (str === 'daily' || str === 'every day' || str === 'everyday') return [0, 1, 2, 3, 4, 5, 6];
  if (str === 'weekdays') return [1, 2, 3, 4, 5];
  if (str === 'weekends') return [0, 6];
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const out = [];
  str.split(/[,&/]| and /).forEach(part => {
    part = part.trim();
    const range = part.split(/\s*(?:-|–|to)\s*/);
    if (range.length === 2) {
      const a = keys.indexOf(range[0].slice(0, 3)), b = keys.indexOf(range[1].slice(0, 3));
      if (a > -1 && b > -1) { for (let i = a; ; i = (i + 1) % 7) { out.push(i); if (i === b) break; } }
      return;
    }
    const i = keys.indexOf(part.slice(0, 3));
    if (i > -1) out.push(i);
  });
  return out.filter((d, i) => out.indexOf(d) === i);
}

function dayOfWeek_(dateStr) {
  const p = dateStr.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
}

function slotMs_(dateStr, mins) {
  const p = dateStr.split('-').map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]) + (mins - IST_OFFSET_MIN) * 60000;
}

function todayIST_() {
  return new Date(Date.now() + IST_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}

function addDays_(dateStr, n) {
  const p = dateStr.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

function humanDate_(dateStr) {
  const p = dateStr.split('-').map(Number);
  return DAY_NAMES[dayOfWeek_(dateStr)] + ', ' + p[2] + ' ' + MONTH_NAMES[p[1] - 1] + ' ' + p[0];
}

function humanTime_(mins) {
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60, ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
}


// ============================================================
//  READING THE SHEET
// ============================================================

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run Fenil Book → Set up / update sheets.');
  return sh;
}

/** Rows below the header as {v: values, d: display values, row: sheet row number}. */
function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow(), cols = sh.getLastColumn();
  if (last < 2 || cols < 1) return [];
  const range = sh.getRange(2, 1, last - 1, cols);
  const v = range.getValues(), d = range.getDisplayValues();
  const out = [];
  for (let i = 0; i < v.length; i++) {
    if (d[i].join('').trim() === '') continue;
    out.push({ v: v[i], d: d[i], row: i + 2 });
  }
  return out;
}

function toDateStr_(value, display) {
  if (value instanceof Date && !isNaN(value)) return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  const s = String(display || value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);   // dd/mm/yyyy (Indian format)
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function yes_(v) {
  const s = String(v === undefined ? '' : v).trim().toLowerCase();
  return s === '' || s === 'yes' || s === 'y' || s === 'true' || s === 'active';
}

function num_(v, fallback) {
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function loadConfig_() {
  const raw = {};
  rows_(TAB.SETTINGS).forEach(r => { raw[String(r.d[0]).trim()] = r.v[1]; });
  const settings = {
    ownerName: String(raw['Owner name'] || 'Fenil Pritesh Shah'),
    ownerEmail: String(raw['Owner email'] || '').trim(),
    alsoNotify: String(raw['Also notify'] || '').trim(),
    fromAddress: String(raw['From address'] || raw['Owner email'] || '').trim(),
    pageUrl: String(raw['Booking page URL'] || FPS.SITE + '/book').trim(),
    daysAhead: num_(raw['Days ahead'], 21),
    minNoticeHours: num_(raw['Minimum notice (hours)'], 12),
    step: num_(raw['Slot step (minutes)'], 30),
    buffer: num_(raw['Buffer (minutes)'], 10),
    maxPerDay: num_(raw['Max bookings per day'], 0),
    cancelCutoffHours: num_(raw['Client cancel cutoff (hours)'], 6),
    reminderHours: num_(raw['Reminder (hours before)'], 0),
    feedbackHours: num_(raw['Feedback email (hours after meeting)'], 0),
    feedbackLink: String(raw['Feedback link (optional)'] || '').trim(),
    downloadOn: String(raw['Availability download'] || 'Yes').trim().toLowerCase() !== 'no',
    calSync: String(raw['Google Calendar sync'] || 'No').trim().toLowerCase() === 'yes',
    meetOn: String(raw['Google Meet for online meetings'] || 'Yes').trim().toLowerCase() !== 'no',
    inPersonLocation: String(raw['In-person location'] || 'In person, Ahmedabad — venue confirmed by email').trim(),
    fmOn: String(raw['Fenil Meet enabled'] || 'Yes').trim().toLowerCase() !== 'no',
    fmPage: String(raw['Fenil Meet page URL'] || 'https://www.book.fenilpshah.com/meet').trim(),
    fmWaiting: String(raw['Fenil Meet waiting room'] || 'Yes').trim().toLowerCase() !== 'no',
    turnUrl: String(raw['TURN server URL'] || '').trim(),
    turnUser: String(raw['TURN username'] || '').trim(),
    turnPass: String(raw['TURN password'] || '').trim(),
    calName: String(raw['Google Calendar name'] || 'Fenil Book').trim() || 'Fenil Book',
    feedAll: String(raw['Calendar feed includes classes & blocked time'] || 'No').trim().toLowerCase() === 'yes',
    downloadMaxDays: Math.max(1, Math.min(num_(raw['Availability download max days'], 7), 14)),
    open: String(raw['Bookings open'] || 'Yes').trim().toLowerCase() !== 'no'
  };

  const hours = rows_(TAB.HOURS).map(r => ({
    days: parseDays_(r.d[0]), start: parseTime_(r.d[1]), end: parseTime_(r.d[2])
  })).filter(h => h.days.length && h.start !== null && h.end !== null && h.end > h.start);

  const classes = rows_(TAB.CLASSES).map(r => ({
    title: r.d[0], days: parseDays_(r.d[1]), start: parseTime_(r.d[2]), end: parseTime_(r.d[3]),
    from: toDateStr_(r.v[4], r.d[4]), until: toDateStr_(r.v[5], r.d[5]), active: yes_(r.d[6]),
    location: String(r.d[7] || '').trim()
  })).filter(c => c.days.length && c.start !== null && c.end !== null);

  const blocked = rows_(TAB.BLOCKED).map(r => {
    const st = parseTime_(r.d[1]), en = parseTime_(r.d[2]);
    return {
      date: toDateStr_(r.v[0], r.d[0]),
      start: st === null ? 0 : st,
      end: en === null ? 24 * 60 : en,
      reason: String(r.d[3] || '').trim(),
      location: String(r.d[4] || '').trim()
    };
  }).filter(b => b.date);

  const types = rows_(TAB.TYPES).map(r => ({
    name: String(r.d[0]).trim(), duration: num_(r.v[1], 0), mode: String(r.d[2]).trim(),
    description: String(r.d[3]).trim(), active: yes_(r.d[4]), format: typeFormat_(r.d[5], r.d[2])
  })).filter(t => t.name && t.duration > 0 && t.active);

  const bookings = rows_(TAB.BOOKINGS).map(r => ({
    row: r.row,
    id: String(r.d[B.ID]).trim(),
    created: String(r.d[B.CREATED]).trim(),
    status: String(r.d[B.STATUS]).trim() || 'Confirmed',
    type: r.d[B.TYPE],
    date: toDateStr_(r.v[B.DATE], r.d[B.DATE]),
    start: parseTime_(r.d[B.START]),
    end: parseTime_(r.d[B.END]),
    name: r.d[B.NAME], email: String(r.d[B.EMAIL]).trim().toLowerCase(), phone: r.d[B.PHONE],
    org: r.d[B.ORG], purpose: r.d[B.PURPOSE], mode: r.d[B.MODE],
    cancelReason: r.d[B.CREASON], reminder: r.d[B.REMINDER], feedbackSent: r.d[B.FEEDBACK] || '',
    calId: String(r.d[B.CALID] || '').trim(),
    format: String(r.d[B.FORMAT] || '').trim(), meet: String(r.d[B.MEET] || '').trim(), meetCode: String(r.d[B.MCODE] || '').trim()
  })).filter(b => b.id && b.date && b.start !== null && b.end !== null);

  // Emails tab: per-email on/off, from address and sender name (blank = defaults from Settings)
  const emails = {};
  const byLabel = {};
  EMAIL_TYPES.forEach(t => { byLabel[t[1].toLowerCase()] = t[0]; });
  const emailSheet = ss_().getSheetByName(TAB.EMAILS);
  if (emailSheet) {
    rows_(TAB.EMAILS).forEach(r => {
      const key = byLabel[String(r.d[0]).trim().toLowerCase()];
      if (!key) return;
      emails[key] = {
        send: String(r.d[1]).trim().toLowerCase() !== 'no',
        from: String(r.d[2]).trim(),
        name: String(r.d[3]).trim(),
        to: String(r.d[4] || '').trim()
      };
    });
  }
  EMAIL_TYPES.forEach(t => {
    const e = emails[t[0]] || { send: true, from: '', name: '', to: '' };
    e.from = e.from || settings.fromAddress;
    e.name = e.name || settings.ownerName;
    emails[t[0]] = e;
  });

  return { settings, hours, classes, blocked, types, bookings, emails };
}

function findBooking_(bookings, id, email) {
  const i = String(id || '').trim().toUpperCase();
  const e = String(email || '').trim().toLowerCase();
  if (!i || !e) return null;
  return bookings.find(b => b.id.toUpperCase() === i && b.email === e) || null;
}

function canClientCancel_(b, s) {
  return b.status === 'Confirmed' && slotMs_(b.date, b.start) - Date.now() > s.cancelCutoffHours * 3600000;
}

function publicBooking_(b, s) {
  return {
    id: b.id, status: b.status, type: b.type, name: b.name,
    date: b.date, start: fmtTime_(b.start), end: fmtTime_(b.end),
    dateLabel: humanDate_(b.date),
    timeLabel: humanTime_(b.start) + ' – ' + humanTime_(b.end) + ' IST',
    mode: b.mode,
    format: b.format || '',
    meet: b.status === 'Confirmed' ? (b.meet || '') : '',
    meetCode: b.status === 'Confirmed' ? (b.meetCode || '') : '',
    meetPage: s.fmPage,
    canCancel: canClientCancel_(b, s),
    upcoming: slotMs_(b.date, b.start) > Date.now()
  };
}

function newId_(bookings) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const taken = {};
  bookings.forEach(b => { taken[b.id.toUpperCase()] = true; });
  let id;
  do {
    id = 'FB-';
    for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (taken[id]);
  return id;
}

function markCancelled_(b, by, reason) {
  const sh = sheet_(TAB.BOOKINGS);
  sh.getRange(b.row, B.STATUS + 1).setValue('Cancelled');
  const r = sh.getRange(b.row, B.CBY + 1, 1, 3);
  r.setNumberFormat('@');
  r.setValues([[by, reason || '', Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm')]]);
  SpreadsheetApp.flush();
}

function clean_(v, max) {
  return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}


// ============================================================
//  ZOHO MAIL  (India data centre: zoho.in)
// ============================================================

/**
 * Menu: connect Zoho Mail once. You need a Self Client from https://api-console.zoho.in
 * with scope:  ZohoMail.messages.CREATE,ZohoMail.accounts.READ
 */
function connectZoho() {
  const ui = SpreadsheetApp.getUi();
  const ask = (title, msg) => {
    const r = ui.prompt(title, msg, ui.ButtonSet.OK_CANCEL);
    return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null;
  };
  const clientId = ask('Connect Zoho Mail (1 of 3)', 'Paste the Client ID of your Self Client (api-console.zoho.in):');
  if (!clientId) return;
  const clientSecret = ask('Connect Zoho Mail (2 of 3)', 'Paste the Client Secret:');
  if (!clientSecret) return;
  const code = ask('Connect Zoho Mail (3 of 3)',
    'Generate a code in the Self Client → "Generate Code" tab with scope:\n\nZohoMail.messages.CREATE,ZohoMail.accounts.READ\n\nThen paste the code here (it expires in a few minutes):');
  if (!code) return;

  const res = UrlFetchApp.fetch(ZOHO_ACCOUNTS + '/oauth/v2/token', {
    method: 'post',
    payload: { grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code: code },
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText() || '{}');
  if (!data.refresh_token) {
    ui.alert('Zoho did not return a refresh token.\n\nResponse: ' + res.getContentText() +
      '\n\nTip: codes expire quickly — generate a fresh one and try again right away.');
    return;
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperties({ ZOHO_CLIENT_ID: clientId, ZOHO_CLIENT_SECRET: clientSecret, ZOHO_REFRESH_TOKEN: data.refresh_token });
  CacheService.getScriptCache().put('ZOHO_AT', data.access_token, 3000);

  const acc = UrlFetchApp.fetch(ZOHO_MAIL_API + '/accounts', {
    headers: { Authorization: 'Zoho-oauthtoken ' + data.access_token }, muteHttpExceptions: true
  });
  const accData = JSON.parse(acc.getContentText() || '{}');
  const account = accData.data && accData.data[0];
  if (!account) {
    ui.alert('Connected, but could not read your Zoho Mail account.\n\nResponse: ' + acc.getContentText());
    return;
  }
  props.setProperty('ZOHO_ACCOUNT_ID', String(account.accountId));
  const senders = (account.sendMailDetails || []).map(x => x.fromAddress).join('\n') || account.primaryEmailAddress;
  ui.alert('Zoho Mail connected ✓\n\nAccount: ' + (account.primaryEmailAddress || '') +
    '\n\nAddresses you can put in Settings → "From address":\n' + senders +
    '\n\nNext: Fenil Book → Send test emails.');
}

function zohoToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('ZOHO_AT');
  if (cached) return cached;
  const p = PropertiesService.getScriptProperties().getProperties();
  if (!p.ZOHO_REFRESH_TOKEN) throw new Error('Zoho Mail is not connected. Run Fenil Book → Connect Zoho Mail.');
  const res = UrlFetchApp.fetch(ZOHO_ACCOUNTS + '/oauth/v2/token', {
    method: 'post',
    payload: { grant_type: 'refresh_token', client_id: p.ZOHO_CLIENT_ID, client_secret: p.ZOHO_CLIENT_SECRET, refresh_token: p.ZOHO_REFRESH_TOKEN },
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText() || '{}');
  if (!data.access_token) throw new Error('Zoho token refresh failed: ' + res.getContentText());
  cache.put('ZOHO_AT', data.access_token, 3000);   // Zoho tokens last 1 hour
  return data.access_token;
}

/**
 * Sends one email through Zoho Mail. `key` picks the row in the Emails tab, which decides
 * whether it is sent at all, the From address and the sender name people see.
 */
function sendMail_(cfg, key, to, subject, html) {
  const e = cfg.emails[key];
  if (!e || !e.send) { logEmail_(to, subject, 'Skipped (turned off in Emails tab)', ''); return; }
  if (!to) return;
  const accountId = PropertiesService.getScriptProperties().getProperty('ZOHO_ACCOUNT_ID');
  if (!accountId) throw new Error('Zoho Mail is not connected.');

  const post = from => UrlFetchApp.fetch(ZOHO_MAIL_API + '/accounts/' + accountId + '/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Zoho-oauthtoken ' + zohoToken_(), Accept: 'application/json' },
    payload: JSON.stringify({ fromAddress: from, toAddress: to, subject: subject, content: html, mailFormat: 'html', askReceipt: 'no' }),
    muteHttpExceptions: true
  });

  const safeName = e.name.replace(/["<>\r\n]/g, '').trim();
  const fromLabel = safeName ? '"' + safeName + '" <' + e.from + '>' : e.from;
  let res = post(fromLabel);
  let note = '';
  if (res.getResponseCode() !== 200 && safeName) {
    // Zoho rejected the name format: send with the bare address so the email still goes out
    note = ' (sender name not accepted — sent with the address\'s Zoho display name)';
    res = post(e.from);
  }
  const code = res.getResponseCode();
  logEmail_(to, subject, code === 200 ? 'Sent' + note : 'Failed ' + code + ': ' + res.getContentText().slice(0, 300), fromLabel);
  if (code !== 200) throw new Error('Zoho send failed (' + code + ') from ' + e.from + ': ' + res.getContentText());
}

function safeSend_(fn) {
  try { fn(); } catch (err) { console.error(err); }
}

function logEmail_(to, subject, result, from) {
  try {
    const sh = ss_().getSheetByName(TAB.LOG);
    if (sh) sh.appendRow([Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'), to, subject, result, from || '']);
  } catch (e) { console.error(e); }
}

/** Who receives an alert: the row's "Send to" in the Emails tab, else Owner email + Also notify. */
function ownerRecipients_(cfg, key) {
  const s = cfg.settings;
  const custom = key && cfg.emails[key] && cfg.emails[key].to;
  const list = custom ? custom.split(',') : [s.ownerEmail].concat(s.alsoNotify.split(','));
  return list.map(x => x.trim()).filter(Boolean).join(',');
}


// ============================================================
//  EMAIL TEMPLATES
// ============================================================

function esc_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shell_(s, eyebrow, heading, bodyHtml) {
  return '' +
    '<div style="background:#f6f3ee;padding:32px 12px;font-family:Georgia,\'Times New Roman\',serif;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e0d6;">' +
    '<div style="padding:28px 32px 18px;border-bottom:1px solid #e6e0d6;">' +
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7a1f2b;">' + esc_(eyebrow) + '</div>' +
    '<div style="font-size:24px;color:#1b1a17;margin-top:8px;line-height:1.3;">' + esc_(heading) + '</div>' +
    '</div>' +
    '<div style="padding:24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.65;color:#2d2a25;">' + bodyHtml + '</div>' +
    '<div style="padding:16px 32px 24px;border-top:1px solid #e6e0d6;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8378;">' +
    esc_(s.ownerName) + ' &nbsp;·&nbsp; <a href="' + esc_(s.pageUrl) + '" style="color:#8a8378;">' + esc_(s.pageUrl.replace(/^https?:\/\//, '')) + '</a>' +
    '</div></div></div>';
}

function detailsTable_(rows) {
  return '<table style="width:100%;border-collapse:collapse;margin:16px 0;">' +
    rows.filter(r => r[1]).map(r =>
      '<tr><td style="padding:8px 0;border-bottom:1px solid #f0ebe3;color:#8a8378;width:38%;vertical-align:top;">' + esc_(r[0]) + '</td>' +
      '<td style="padding:8px 0;border-bottom:1px solid #f0ebe3;color:#1b1a17;vertical-align:top;">' + (r[2] ? r[1] : esc_(r[1])) + '</td></tr>'
    ).join('') + '</table>';
}

function when_(b) {
  return humanDate_(b.date) + ', ' + humanTime_(b.start) + ' – ' + humanTime_(b.end) + ' IST';
}

function shortWhen_(b) {
  const p = b.date.split('-').map(Number);
  return DAY_NAMES[dayOfWeek_(b.date)].slice(0, 3) + ' ' + p[2] + ' ' + MONTH_NAMES[p[1] - 1].slice(0, 3) + ', ' + humanTime_(b.start) + ' IST';
}

function calendarLink_(s, b) {
  const f = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(b.type + ' with ' + s.ownerName) +
    '&dates=' + f(slotMs_(b.date, b.start)) + '/' + f(slotMs_(b.date, b.end)) +
    '&details=' + encodeURIComponent('Booking ID: ' + b.id + '\n' + (b.meet ? 'Join with Google Meet: ' + b.meet : (b.mode || '')) + '\nManage: ' + s.pageUrl) +
    '&location=' + encodeURIComponent(b.meet || b.mode || '');
}

function buttonGhost_(href, label) {
  return '<a href="' + esc_(href) + '" style="display:inline-block;background:#ffffff;color:#1b1a17;border:1px solid #1b1a17;text-decoration:none;padding:10px 18px;font-size:13px;letter-spacing:.5px;">' + esc_(label) + '</a>';
}

function fenilMeetBlock_(s, b) {
  return '<div style="margin:20px 0;padding:16px 18px;border:1px solid #1b1a17;">' +
    '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#7a1f2b;">Join on Fenil Meet</div>' +
    '<div style="font-family:Georgia,serif;font-size:26px;letter-spacing:2px;margin:6px 0 10px;color:#1b1a17;">' + esc_(b.meetCode) + '</div>' +
    '<div style="font-size:13px;color:#5c564d;margin-bottom:12px;">At the meeting time, open <a href="' + esc_(s.fmPage) + '" style="color:#7a1f2b;">' +
    esc_(s.fmPage.replace(/^https?:\/\//, '')) + '</a> and enter this code. Use Chrome, Edge or Safari, and allow your camera and microphone when asked. The room opens 15 minutes before the start.</div>' +
    button_(s.fmPage, 'Open Fenil Meet') + '</div>';
}

function meetLinkHtml_(url) {
  return '<a href="' + esc_(url) + '" style="color:#7a1f2b;">' + esc_(url.replace(/^https?:\/\//, '')) + '</a>';
}

function button_(href, label) {
  return '<a href="' + esc_(href) + '" style="display:inline-block;background:#1b1a17;color:#ffffff;text-decoration:none;padding:11px 20px;font-size:13px;letter-spacing:.5px;">' + esc_(label) + '</a>';
}

function manageNote_(s, b) {
  return '<p style="color:#5c564d;font-size:13px;">Need to cancel? Visit <a href="' + esc_(s.pageUrl) + '" style="color:#7a1f2b;">' +
    esc_(s.pageUrl.replace(/^https?:\/\//, '')) + '</a>, open <b>Manage a booking</b>, and enter your booking ID <b>' + esc_(b.id) +
    '</b> with this email address.</p>';
}

function signature_(cfg, key) {
  return esc_(cfg.emails[key].name || cfg.settings.ownerName);
}

function emailClientConfirmed_(cfg, b) {
  const s = cfg.settings;
  const body =
    '<p>Dear ' + esc_(b.name) + ',</p>' +
    '<p>Your ' + esc_(b.type.toLowerCase()) + ' with ' + esc_(s.ownerName) + ' is confirmed. I look forward to speaking with you.</p>' +
    detailsTable_([
      ['Booking ID', b.id],
      ['Date', humanDate_(b.date)],
      ['Time', humanTime_(b.start) + ' – ' + humanTime_(b.end) + ' IST'],
      ['Appointment', b.type + ' (' + (b.end - b.start) + ' minutes)'],
      ['Mode / location', b.mode],
      b.meet ? ['Join online', meetLinkHtml_(b.meet), true] : ['', ''],
      b.meetCode ? ['Fenil Meet code', '<b style="font-size:16px;letter-spacing:1px;">' + esc_(b.meetCode) + '</b>', true] : ['', ''],
      ['Purpose', b.purpose]
    ]) +
    (b.meetCode ? fenilMeetBlock_(s, b) : '') +
    (b.meet ? '<p style="margin:20px 0 8px;">' + button_(b.meet, 'Join with Google Meet') + '</p>' +
      '<p style="color:#5c564d;font-size:13px;margin:0 0 4px;">Use this same link at the meeting time.</p>' : '') +
    '<p style="margin:20px 0;">' + buttonGhost_(calendarLink_(s, b), 'Add to Google Calendar') + '</p>' +
    manageNote_(s, b) +
    '<p>Warm regards,<br>' + signature_(cfg, 'confirmation') + '</p>';
  sendMail_(cfg, 'confirmation', b.email, 'Confirmed: ' + b.type + ' with ' + s.ownerName + ' — ' + shortWhen_(b),
    shell_(s, 'Booking confirmed', b.type + ' · ' + shortWhen_(b), body));
}

function emailOwnerNewBooking_(cfg, b) {
  const s = cfg.settings;
  const body =
    '<p>A new appointment has been booked.</p>' +
    detailsTable_([
      ['Booking ID', b.id],
      ['When', when_(b)],
      ['Appointment', b.type + ' (' + (b.end - b.start) + ' min)'],
      ['Name', b.name],
      ['Email', '<a href="mailto:' + esc_(b.email) + '">' + esc_(b.email) + '</a>', true],
      ['Phone', b.phone],
      ['Organisation', b.org],
      ['Purpose', b.purpose],
      ['Mode / location', b.mode],
      b.meet ? ['Google Meet', meetLinkHtml_(b.meet), true] : (b.meetError ? ['Online meeting', 'Could not be set up: ' + b.meetError] : ['', '']),
      b.meetCode ? ['Fenil Meet code', b.meetCode + ' — join as host at ' + s.fmPage.replace(/^https?:\/\//, '')] : ['', '']
    ]) +
    '<p style="color:#5c564d;font-size:13px;">To cancel, select the row in the Bookings tab and use <b>Fenil Book → Cancel selected booking</b>. The client is emailed automatically.</p>';
  sendMail_(cfg, 'owner_new', ownerRecipients_(cfg, 'owner_new'), 'New booking: ' + b.name + ' — ' + shortWhen_(b),
    shell_(s, 'New booking', b.name + ' · ' + shortWhen_(b), body));
}

function emailClientCancelled_(cfg, b, by) {
  const s = cfg.settings;
  const body =
    '<p>Dear ' + esc_(b.name) + ',</p>' +
    (by === 'Client'
      ? '<p>Your booking has been cancelled as requested.</p>'
      : '<p>I am sorry, but I have had to cancel our upcoming appointment.' +
        (b.cancelReason ? ' ' + esc_(b.cancelReason) : '') + ' My apologies for the inconvenience.</p>') +
    detailsTable_([
      ['Booking ID', b.id],
      ['Was scheduled for', when_(b)],
      ['Appointment', b.type]
    ]) +
    '<p>You are welcome to choose a new time whenever convenient.</p>' +
    '<p style="margin:20px 0;">' + button_(s.pageUrl, 'Book a new time') + '</p>' +
    '<p>Warm regards,<br>' + signature_(cfg, 'cancellation') + '</p>';
  sendMail_(cfg, 'cancellation', b.email, 'Cancelled: ' + b.type + ' with ' + s.ownerName + ' — ' + shortWhen_(b),
    shell_(s, 'Booking cancelled', b.type + ' · ' + shortWhen_(b), body));
}

function emailOwnerCancelled_(cfg, b, by) {
  const s = cfg.settings;
  const body =
    '<p>' + (by === 'Client' ? 'The client cancelled this booking.' : 'You cancelled this booking. The client has been notified.') + '</p>' +
    detailsTable_([
      ['Booking ID', b.id],
      ['Was scheduled for', when_(b)],
      ['Name', b.name],
      ['Email', b.email],
      ['Reason', b.cancelReason]
    ]);
  sendMail_(cfg, 'owner_cancel', ownerRecipients_(cfg, 'owner_cancel'),
    'Cancelled (' + (by === 'Client' ? 'by client' : 'by you') + '): ' + b.name + ' — ' + shortWhen_(b),
    shell_(s, 'Booking cancelled', b.name + ' · ' + shortWhen_(b), body));
}

function emailReminder_(cfg, b) {
  const s = cfg.settings;
  const body =
    '<p>Dear ' + esc_(b.name) + ',</p>' +
    '<p>A quick reminder of our upcoming ' + esc_(b.type.toLowerCase()) + '.</p>' +
    detailsTable_([
      ['Booking ID', b.id],
      ['When', when_(b)],
      ['Mode / location', b.mode],
      b.meet ? ['Join online', meetLinkHtml_(b.meet), true] : ['', ''],
      b.meetCode ? ['Fenil Meet code', '<b style="font-size:16px;letter-spacing:1px;">' + esc_(b.meetCode) + '</b>', true] : ['', '']
    ]) +
    (b.meet ? '<p style="margin:20px 0;">' + button_(b.meet, 'Join with Google Meet') + '</p>' : '') +
    (b.meetCode ? fenilMeetBlock_(s, b) : '') +
    manageNote_(s, b) +
    '<p>See you soon,<br>' + signature_(cfg, 'reminder') + '</p>';
  sendMail_(cfg, 'reminder', b.email, 'Reminder: ' + b.type + ' with ' + s.ownerName + ' — ' + shortWhen_(b),
    shell_(s, 'Reminder', b.type + ' · ' + shortWhen_(b), body));

  safeSend_(() => sendMail_(cfg, 'owner_reminder', ownerRecipients_(cfg, 'owner_reminder'), 'Reminder: ' + b.name + ' — ' + shortWhen_(b),
    shell_(s, 'Upcoming appointment', b.name + ' · ' + shortWhen_(b),
      detailsTable_([['When', when_(b)], ['Appointment', b.type], ['Email', b.email], ['Phone', b.phone], ['Purpose', b.purpose],
        b.meet ? ['Google Meet', meetLinkHtml_(b.meet), true] : ['', ''], b.meetCode ? ['Fenil Meet code', b.meetCode] : ['', '']]))));
}

function emailFeedbackRequest_(cfg, b) {
  const s = cfg.settings;
  const link = s.feedbackLink || s.pageUrl;
  const body =
    '<p>Dear ' + esc_(b.name) + ',</p>' +
    '<p>Thank you for taking the time to meet. I would value a minute of your feedback on our ' + esc_(b.type.toLowerCase()) +
    ' — it helps me make every conversation more useful.</p>' +
    detailsTable_([
      ['Booking ID', b.id],
      ['Met on', when_(b)]
    ]) +
    '<p style="margin:20px 0;">' + button_(link, 'Share your feedback') + '</p>' +
    '<p style="color:#5c564d;font-size:13px;">' +
    (s.feedbackLink ? '' : 'On the page, open the <b>Feedback</b> tab. ') +
    'Enter your booking ID <b>' + esc_(b.id) + '</b> with this email address. It takes less than a minute.</p>' +
    '<p>With gratitude,<br>' + signature_(cfg, 'feedback_request') + '</p>';
  sendMail_(cfg, 'feedback_request', b.email, 'How was our ' + b.type.toLowerCase() + '? — ' + s.ownerName,
    shell_(s, 'Your feedback', 'How was our ' + b.type.toLowerCase() + '?', body));
}

function emailOwnerFeedback_(cfg, b, fb) {
  const s = cfg.settings;
  const stars = '★★★★★'.slice(0, fb.rating) + '☆☆☆☆☆'.slice(0, 5 - fb.rating);
  const body =
    '<p>New feedback has arrived.</p>' +
    detailsTable_([
      ['Rating', '<span style="color:#7a1f2b;font-size:18px;letter-spacing:2px;">' + stars + '</span> &nbsp;' + fb.rating + ' / 5', true],
      ['From', b.name + ' (' + b.email + ')'],
      ['Meeting', b.type + ' · ' + when_(b)],
      ['What went well', fb.liked],
      ['What could be better', fb.improve],
      ['Wants a follow-up', fb.followUp]
    ]);
  sendMail_(cfg, 'owner_feedback', ownerRecipients_(cfg, 'owner_feedback'),
    'Feedback ' + fb.rating + '/5: ' + b.name + ' — ' + shortWhen_(b),
    shell_(s, 'Feedback received', b.name + ' · ' + fb.rating + ' / 5', body));
}


// ============================================================
//  ADMIN MENU
// ============================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Fenil Book')
    .addItem('1. Set up / update sheets', 'setupSheets')
    .addItem('2. Connect Zoho Mail', 'connectZoho')
    .addItem('3. Send test emails', 'sendTestEmail')
    .addItem('4. Turn on reminders & feedback emails', 'enableReminders')
    .addSeparator()
    .addItem('Confirm selected row (send email)', 'confirmSelectedBooking')
    .addItem('Cancel selected booking', 'cancelSelectedBooking')
    .addItem('Preview available slots', 'previewSlots')
    .addItem('Set owner PDF password', 'setOwnerPassword')
    .addSeparator()
    .addItem('Calendar: get subscribe link', 'showCalendarLink')
    .addItem('Calendar: sync now', 'syncCalendarNow')
    .addItem('Calendar: reset subscribe link', 'resetCalendarLink')
    .addToUi();
}

/** Safe to run again at any time: creates missing tabs, settings, columns and email rows — never erases anything. */
function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());

  const styleHeader = r => r.setFontWeight('bold').setBackground('#1b1a17').setFontColor('#ffffff');
  const make = (name, headers, sample, textCols) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      styleHeader(sh.getRange(1, 1, 1, headers.length).setValues([headers]));
      sh.setFrozenRows(1);
      (textCols || []).forEach(c => sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'));
      if (sample && sample.length) sh.getRange(2, 1, sample.length, sample[0].length).setValues(sample);
      sh.autoResizeColumns(1, headers.length);
    } else {
      // Existing tab: add any new columns at the end of the header row
      const have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0].map(x => String(x).trim());
      headers.forEach((h, i) => {
        if (have.indexOf(h) === -1 && !have[i]) {
          styleHeader(sh.getRange(1, i + 1).setValue(h));
          if ((textCols || []).indexOf(i + 1) > -1) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
        }
      });
    }
    return sh;
  };
  // Existing tab: append any rows (by first-column key) that are missing
  const addMissingRows = (sh, rows) => {
    const have = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(r => String(r[0]).trim().toLowerCase()) : [];
    const missing = rows.filter(r => have.indexOf(String(r[0]).trim().toLowerCase()) === -1);
    if (missing.length) sh.getRange(sh.getLastRow() + 1, 1, missing.length, missing[0].length).setValues(missing);
  };

  const settingsRows = [
    ['Owner name', 'Fenil Pritesh Shah', 'Shown on the page and in emails'],
    ['Owner email', 'fps@fenilpshah.com', 'Default recipient of alerts (new booking, cancellation, reminder, feedback)'],
    ['Also notify', '', 'Optional: extra emails for alerts, comma-separated'],
    ['From address', 'fps@fenilpshah.com', 'Default sender. Each email can use its own address in the Emails tab'],
    ['Booking page URL', FPS.SITE + '/book', 'Linked in emails'],
    ['Days ahead', 21, 'How far ahead people can book'],
    ['Minimum notice (hours)', 12, 'No bookings closer than this to now'],
    ['Slot step (minutes)', 30, 'Start times offered every N minutes'],
    ['Buffer (minutes)', 10, 'Gap kept around classes and other bookings'],
    ['Max bookings per day', 6, '0 = no limit'],
    ['Client cancel cutoff (hours)', 6, 'Clients cannot cancel online closer than this'],
    ['Reminder (hours before)', 24, '0 = no reminders'],
    ['Feedback email (hours after meeting)', 2, '0 = no feedback emails'],
    ['Feedback link (optional)', '', 'e.g. https://fenilpshah.com/book/feedback — a page where the embed opens on Feedback. Blank = booking page'],
    ['Availability download', 'Yes', 'Let visitors download a PDF of your free times (No = hide)'],
    ['Availability download max days', 7, 'Longest period a visitor can download (1–14)'],
    ['Web app URL (/exec)', FPS.EXEC + '/book', 'Your live web app address (Deploy → Manage deployments). Used for the calendar subscribe link'],
    ['Google Meet for online meetings', 'Yes', 'Yes = online bookings get a Google Meet link (needs the Google Calendar API service — see setup)'],
    ['In-person location', 'In person, Ahmedabad — venue confirmed by email', 'Shown when someone chooses to meet in person'],
    ['Fenil Meet enabled', 'Yes', 'Offer Fenil Meet (your own video call at /meet) as a way to meet'],
    ['Fenil Meet page URL', 'https://www.book.fenilpshah.com/meet', 'Where people enter their meeting code'],
    ['Fenil Meet waiting room', 'Yes', 'Yes = guests wait until you (the host) let them in'],
    ['TURN server URL', '', 'Optional but recommended: relay for difficult networks, e.g. turn:global.relay.metered.ca:443'],
    ['TURN username', '', 'From your TURN provider'],
    ['TURN password', '', 'From your TURN provider'],
    ['Google Calendar sync', 'No', 'Yes = add every booking to a Google Calendar instantly and remove it when cancelled'],
    ['Google Calendar name', 'Fenil Book', 'Calendar the sync writes to (created automatically in this Google account)'],
    ['Calendar feed includes classes & blocked time', 'No', 'For the subscribe link: Yes = also show classes and blocked time'],
    ['Bookings open', 'Yes', 'Set to No to pause all new bookings']
  ];
  const settings = make(TAB.SETTINGS, ['Setting', 'Value', 'Notes'], settingsRows, [2]);
  addMissingRows(settings, settingsRows);

  make(TAB.HOURS, ['Day', 'Start', 'End'], [
    ['Mon-Fri', '10:00', '19:00'],
    ['Saturday', '10:00', '14:00']
  ], [2, 3]);

  make(TAB.CLASSES, ['Class / commitment', 'Day', 'Start', 'End', 'From date (yyyy-mm-dd)', 'Until date (yyyy-mm-dd)', 'Active', 'Location (private)'], [
    ['Example class — replace with yours', 'Tuesday', '11:00', '12:30', '', '', 'Yes', 'Ahmedabad University'],
    ['Example: two days a week', 'Mon, Thu', '15:00', '16:30', '', '', 'Yes', '']
  ], [2, 3, 4, 5, 6]);

  make(TAB.BLOCKED, ['Date (yyyy-mm-dd)', 'Start (blank = all day)', 'End (blank = all day)', 'Reason (private)', 'Location (private)'], [], [1, 2, 3]);

  make(TAB.TYPES, ['Appointment type', 'Duration (minutes)', 'Mode / location', 'Description', 'Active', 'Format (Online / In person / Client chooses)'], [
    ['Quick call', 15, 'Online — details shared by email', 'A short conversation or a quick question.', 'Yes'],
    ['Meeting', 30, 'Online or in person — confirmed by email', 'Discuss a project, collaboration or idea.', 'Yes'],
    ['Extended discussion', 60, 'In person, Ahmedabad — venue confirmed by email', 'Detailed planning, mentoring or a deeper conversation.', 'Yes']
  ]);

  const emailRows = EMAIL_TYPES.map(t => {
    const alert = t[0].indexOf('owner_') === 0;
    return [t[1], 'Yes', '', alert ? 'Fenil Book' : 'Fenil Pritesh Shah', '',
      alert ? 'Alert to you. "Send to" blank = Owner email + Also notify' : 'Goes to the client'];
  });
  const emailsSheet = make(TAB.EMAILS,
    ['Email', 'Send? (Yes/No)', 'From address (blank = Settings default)', 'Sender name', 'Send to (alerts only)', 'Notes'],
    emailRows, [2, 3, 4, 5]);
  addMissingRows(emailsSheet, emailRows);

  make(TAB.BOOKINGS, BOOKING_HEADERS, [], [1, 2, 5, 6, 7, 10, 16, 17, 18, 19, 20, 21, 22, 23]);
  make(TAB.FEEDBACK, ['Received (IST)', 'Booking ID', 'Name', 'Email', 'Appointment', 'Meeting time', 'Rating (1-5)',
    'What went well', 'What could be better', 'Wants follow-up'], [], [1, 2, 6, 7]);
  make(TAB.LOG, ['Time (IST)', 'To', 'Subject', 'Result', 'From'], []);
  make(TAB.SENT, SENT_HEADERS, [], [1, 2, 12, 13]);
  make(TAB.MEETS, MEET_HEADERS, [], [1, 2, 3, 4, 5, 7, 9]);

  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  SpreadsheetApp.getUi().alert('Sheets are ready ✓\n\nNew: an "Emails" tab (sender address, sender name and on/off for every email) and a "Feedback" tab.\n' +
    'Nothing you already filled in was changed.\n\nNext: Fenil Book → Send test emails.');
}

/** Sends one test email from every distinct From address + sender name in the Emails tab, to the Owner email. */
function sendTestEmail() {
  const ui = SpreadsheetApp.getUi();
  const r = testEmails_();
  ui.alert('Test emails sent to ' + r.to + '\n\n' + (r.results.join('\n') || 'All emails are turned off in the Emails tab.') +
    '\n\nThe Email Log tab shows whether Zoho accepted each sender name.');
}

function testEmails_() {
  const cfg = loadConfig_();
  const s = cfg.settings;
  const seen = {}, results = [];
  EMAIL_TYPES.forEach(t => {
    const e = cfg.emails[t[0]];
    if (!e.send) return;
    const k = e.from + '|' + e.name;
    if (seen[k]) { seen[k].push(t[1]); return; }
    seen[k] = [t[1]];
    try {
      sendMail_(cfg, t[0], s.ownerEmail, 'Fenil Book — test from ' + e.from,
        shell_(s, 'Test', 'Sender check', '<p>This test was sent from <b>' + esc_(e.from) + '</b> with the sender name <b>' +
          esc_(e.name) + '</b>.</p><p>Check that the name you see in your inbox is right.</p>'));
      results.push('✓ ' + e.name + ' <' + e.from + '>');
    } catch (err) {
      results.push('✗ ' + e.name + ' <' + e.from + '>: ' + err.message);
    }
  });
  return { to: s.ownerEmail, results: results };
}

function enableReminders() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendReminders').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('Reminders and feedback emails are on ✓\n\nEvery hour, the script sends reminders before appointments ' +
    'and feedback requests after them, using the timings in Settings.');
}

/** Runs hourly (trigger): reminders before meetings, feedback requests after them. */
function sendReminders() {
  safeSend_(() => syncCalendar_());
  const cfg = loadConfig_();
  const s = cfg.settings;
  const now = Date.now();
  const sh = sheet_(TAB.BOOKINGS);
  const stamp = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');

  cfg.bookings.forEach(b => {
    if (b.status !== 'Confirmed') return;
    const startMs = slotMs_(b.date, b.start);
    const endMs = slotMs_(b.date, b.end);

    // --- Reminder ---
    if (s.reminderHours && !b.reminder && startMs > now && startMs - now <= s.reminderHours * 3600000) {
      const c = String(b.created || '').split(' ');
      if (c.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(c[0]) && parseTime_(c[1]) !== null &&
          startMs - slotMs_(c[0], parseTime_(c[1])) < s.reminderHours * 3600000) {
        sh.getRange(b.row, B.REMINDER + 1).setNumberFormat('@').setValue('Not needed');   // booked inside the window
      } else {
        try {
          emailReminder_(cfg, b);
          sh.getRange(b.row, B.REMINDER + 1).setNumberFormat('@').setValue(stamp());
        } catch (err) { console.error(err); }
      }
    }

    // --- Feedback request ---
    if (s.feedbackHours && !b.feedbackSent && now >= endMs + s.feedbackHours * 3600000) {
      if (now - endMs > 7 * 24 * 3600000) {
        sh.getRange(b.row, B.FEEDBACK + 1).setNumberFormat('@').setValue('Skipped (older than 7 days)');
        return;
      }
      try {
        emailFeedbackRequest_(cfg, b);
        sh.getRange(b.row, B.FEEDBACK + 1).setNumberFormat('@').setValue(stamp());
      } catch (err) { console.error(err); }
    }
  });
}

function cancelSelectedBooking() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== TAB.BOOKINGS) { ui.alert('Open the Bookings tab and click any cell in the booking\'s row first.'); return; }
  const row = sh.getActiveCell().getRow();
  if (row < 2) { ui.alert('Click a cell in a booking row (not the header).'); return; }

  const cfg = loadConfig_();
  const b = cfg.bookings.find(x => x.row === row);
  if (!b) { ui.alert('That row is not a valid booking.'); return; }
  if (b.status !== 'Confirmed') { ui.alert('This booking is already ' + b.status + '.'); return; }

  const r = ui.prompt('Cancel ' + b.id + ' — ' + b.name,
    when_(b) + '\n\nOptional: a short reason or note for ' + b.name + ' (included in their email):',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;

  b.cancelReason = r.getResponseText().trim();
  markCancelled_(b, 'Fenil', b.cancelReason);
  b.status = 'Cancelled';

  const errors = [];
  try { emailClientCancelled_(cfg, b, 'Fenil'); } catch (e) { errors.push(e.message); }
  safeSend_(() => syncCalendar_());
  try { emailOwnerCancelled_(cfg, b, 'Fenil'); } catch (e) { errors.push(e.message); }
  ui.alert(errors.length
    ? 'Booking cancelled, but an email failed:\n\n' + errors.join('\n')
    : 'Booking cancelled ✓  ' + b.name + ' has been emailed.');
}

function previewSlots() {
  const cfg = loadConfig_();
  const ui = SpreadsheetApp.getUi();
  if (!cfg.types.length) { ui.alert('Add at least one active row in Appointment Types.'); return; }
  const t = cfg.types[0];
  const today = todayIST_();
  const lines = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays_(today, i);
    const slots = slotsForDate_(cfg, d, t.duration, Date.now());
    lines.push(humanDate_(d) + ':  ' + (slots.length ? slots.map(x => humanTime_(parseTime_(x))).join(', ') : '— none —'));
  }
  ui.alert('Next 7 days for "' + t.name + '" (' + t.duration + ' min)\n\n' + lines.join('\n\n'));
}


// ============================================================
//  OWNER-ONLY DETAILED SCHEDULE  (password protected)
// ============================================================

/** Menu: set or change the password for the detailed (owner-only) PDF. Stored only as a salted hash. */
function setOwnerPassword() {
  const ui = SpreadsheetApp.getUi();
  const a = ui.prompt('Set owner PDF password', 'Choose a password (at least 8 characters).\nYou will type it on the booking page to download your detailed schedule.', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const pw = a.getResponseText();
  if (pw.length < 8) { ui.alert('Please use at least 8 characters.'); return; }
  const b = ui.prompt('Confirm password', 'Type the same password again:', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  if (b.getResponseText() !== pw) { ui.alert('The passwords did not match. Nothing was changed.'); return; }
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({ OWNER_PDF_SALT: salt, OWNER_PDF_HASH: sha256Hex_(salt + pw) });
  CacheService.getScriptCache().remove('OWNER_FAILS');
  ui.alert('Owner password saved ✓\n\nOn the booking page: Availability → Owner access.\nThe password itself is not stored anywhere — only a secure fingerprint of it.');
}

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function checkOwnerPassword_(pw) {
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('OWNER_PDF_SALT'), hash = props.getProperty('OWNER_PDF_HASH');
  if (!salt || !hash) return { ok: false, error: 'Owner access is not set up yet. In the sheet: Fenil Book → Set owner PDF password.' };
  const cache = CacheService.getScriptCache();
  const fails = parseInt(cache.get('OWNER_FAILS') || '0', 10);
  if (fails >= 8) return { ok: false, error: 'Too many wrong attempts. Please try again in 15 minutes.' };
  if (sha256Hex_(salt + String(pw || '')) !== hash) {
    cache.put('OWNER_FAILS', String(fails + 1), 900);
    Utilities.sleep(1200);
    return { ok: false, error: 'Incorrect password.' };
  }
  cache.remove('OWNER_FAILS');
  return { ok: true };
}

/** Detailed schedule: classes, bookings (with names), blocked time (with reasons) and free windows. */
function ownerSchedule_(p) {
  const auth = checkOwnerPassword_(p.password);
  if (!auth.ok) return auth;
  return ownerScheduleCore_(p);
}

function ownerScheduleCore_(p) {

  const cfg = loadConfig_();
  const s = cfg.settings;
  const from = Math.max(0, Math.min(parseInt(p.from, 10) || 0, 365));
  const count = Math.max(1, Math.min(parseInt(p.days, 10) || 7, 31));
  const today = todayIST_();
  const minLen = cfg.types.length ? Math.min.apply(null, cfg.types.map(t => t.duration)) : 15;

  const days = [];
  let lo = Infinity, hi = -Infinity;
  for (let i = from; i < from + count; i++) {
    const date = addDays_(today, i);
    const dow = dayOfWeek_(date);
    const ev = [];
    cfg.classes.forEach(c => {
      if (!c.active || c.days.indexOf(dow) === -1) return;
      if (c.from && date < c.from) return;
      if (c.until && date > c.until) return;
      ev.push({ kind: 'class', start: c.start, end: c.end, title: c.title || 'Class', location: c.location });
    });
    cfg.blocked.forEach(bl => {
      if (bl.date !== date) return;
      ev.push({ kind: 'blocked', start: bl.start, end: bl.end, title: bl.reason || 'Blocked', location: bl.location,
        allDay: bl.start === 0 && bl.end >= 24 * 60 });
    });
    cfg.bookings.forEach(b => {
      if (b.date !== date || (b.status !== 'Confirmed' && b.status !== 'Cancelled')) return;
      ev.push({ kind: b.status === 'Cancelled' ? 'cancelled' : 'booking', start: b.start, end: b.end, title: b.name,
        type: b.type, id: b.id, email: b.email, phone: b.phone, org: b.org, purpose: b.purpose, location: b.mode,
        meet: b.status === 'Confirmed' ? b.meet : '', meetCode: b.status === 'Confirmed' ? b.meetCode : '' });
    });
    ev.sort((a, b) => a.start - b.start || a.end - b.end);
    const free = freeWindows_(cfg, date, 0, minLen);    // free within working hours (ignores notice period)

    cfg.hours.forEach(h => { if (h.days.indexOf(dow) > -1) { lo = Math.min(lo, h.start); hi = Math.max(hi, h.end); } });
    ev.forEach(e => { if (!e.allDay && e.kind !== 'cancelled') { lo = Math.min(lo, e.start); hi = Math.max(hi, e.end); } });

    days.push({ date: date, today: i === 0, free: free, events: ev });
  }
  if (!isFinite(lo)) { lo = 9 * 60; hi = 19 * 60; }
  lo = Math.max(0, Math.floor(lo / 60) * 60);
  hi = Math.min(24 * 60, Math.ceil(hi / 60) * 60);

  const t = fmtTime_;
  return {
    ok: true, owner: s.ownerName, pageUrl: s.pageUrl,
    generated: Utilities.formatDate(new Date(), TZ, 'EEE d MMM yyyy, h:mm a').replace('AM', 'am').replace('PM', 'pm') + ' IST',
    range: [lo, hi],
    days: days.map(d => ({
      date: d.date, today: d.today,
      free: d.free.map(f => [t(f[0]), t(Math.min(f[1], 1439))]),
      events: d.events.map(e => Object.assign({}, e, { start: t(e.start), end: t(Math.min(e.end, 1439)) }))
    }))
  };
}


// ============================================================
//  OWNER AD-HOC BOOKINGS
// ============================================================

/** What already occupies [start,end) on a date — used to warn the owner about clashes. */
function clashes_(cfg, date, start, end) {
  const dow = dayOfWeek_(date), out = [];
  cfg.classes.forEach(c => {
    if (!c.active || c.days.indexOf(dow) === -1 || (c.from && date < c.from) || (c.until && date > c.until)) return;
    if (start < c.end && end > c.start) out.push('Class "' + c.title + '" ' + humanTime_(c.start) + '–' + humanTime_(c.end));
  });
  cfg.blocked.forEach(bl => {
    if (bl.date === date && start < bl.end && end > bl.start)
      out.push('Blocked' + (bl.reason ? ' "' + bl.reason + '"' : '') + ' ' + humanTime_(bl.start) + '–' + humanTime_(Math.min(bl.end, 1439)));
  });
  cfg.bookings.forEach(b => {
    if (b.status === 'Confirmed' && b.date === date && start < b.end && end > b.start)
      out.push('Booking with ' + b.name + ' ' + humanTime_(b.start) + '–' + humanTime_(b.end));
  });
  return out;
}

/** Owner adds a meeting directly (password protected). Ignores working hours and notice; warns on clashes. */
function ownerBook_(p) {
  const auth = checkOwnerPassword_(p.password);
  if (!auth.ok) return auth;
  return ownerBookCore_(p);
}

function ownerBookCore_(p) {

  const name = clean_(p.name, 100);
  const email = clean_(p.email, 150).toLowerCase();
  const date = clean_(p.date, 10);
  const startMin = parseTime_(clean_(p.start, 8));
  const duration = Math.round(num_(p.duration, 0));
  const sendEmail = p.sendEmail === true || p.sendEmail === 'true';

  if (name.length < 2) return { ok: false, error: 'Please enter their name.' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'That email address does not look right.' };
  if (sendEmail && !email) return { ok: false, error: 'Add their email to send a confirmation, or untick "Email them".' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Please choose a date.' };
  if (startMin === null) return { ok: false, error: 'Please choose a start time.' };
  if (!(duration >= 5 && duration <= 720)) return { ok: false, error: 'Duration must be between 5 and 720 minutes.' };
  if (startMin + duration > 24 * 60) return { ok: false, error: 'The meeting must end on the same day.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let booking, cfg;
  try {
    cfg = loadConfig_();
    const hits = clashes_(cfg, date, startMin, startMin + duration);
    if (hits.length && !p.force) return { ok: false, clash: true, error: 'This time overlaps: ' + hits.join('; ') + '.' };

    booking = {
      id: newId_(cfg.bookings),
      created: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'),
      status: 'Confirmed',
      type: clean_(p.type, 100) || 'Meeting',
      date: date, start: startMin, end: startMin + duration,
      name: name, email: email, phone: clean_(p.phone, 30), org: clean_(p.organisation, 150),
      purpose: clean_(p.purpose, 1000), mode: clean_(p.mode, 200),
      format: ['Online', 'Fenil Meet', 'In person'].indexOf(String(p.format)) > -1 ? String(p.format) : ''
    };
    if (!booking.format) booking.format = isOnline_(booking) ? 'Online' : 'In person';
    if (!booking.mode) booking.mode = booking.format === 'Online' ? 'Online — Google Meet' : booking.format === 'Fenil Meet' ? 'Online — Fenil Meet' : cfg.settings.inPersonLocation;
    const sh = sheet_(TAB.BOOKINGS);
    booking.row = sh.getLastRow() + 1;
    const values = [booking.id, booking.created, booking.status, booking.type, booking.date,
      fmtTime_(booking.start), fmtTime_(booking.end), booking.name, booking.email, booking.phone,
      booking.org, booking.purpose, booking.mode, '', '', '', '', '', 'Owner', '', booking.format, ''];
    const range = sh.getRange(booking.row, 1, 1, values.length);
    range.setNumberFormat('@');
    range.setValues([values]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  let emailed = false, emailError = '', meetError = '';
  try { attachMeet_(cfg, booking); } catch (err) { meetError = err.message; }
  try { attachFenilMeet_(cfg, booking); } catch (err) { meetError = err.message; }
  if (sendEmail) {
    try { emailClientConfirmed_(cfg, booking); emailed = cfg.emails.confirmation.send; }
    catch (err) { emailError = 'The meeting was saved, but the email failed: ' + err.message; }
  }
  safeSend_(() => syncCalendar_());
  return { ok: true, id: booking.id, emailed: emailed, emailError: emailError, meet: booking.meet || '', meetCode: booking.meetCode || '',
    meetError: meetError ? 'Google Meet link could not be created: ' + meetError : '',
    booking: publicBooking_(booking, cfg.settings) };
}

/** Menu: for a row you typed into Bookings yourself — fills in ID/status/created and emails the person. */
function confirmSelectedBooking() {
  const ui = SpreadsheetApp.getUi();
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== TAB.BOOKINGS) { ui.alert('Open the Bookings tab and click any cell in the row first.'); return; }
  const row = sh.getActiveCell().getRow();
  if (row < 2) { ui.alert('Click a cell in a booking row (not the header).'); return; }

  const r = sh.getRange(row, 1, 1, BOOKING_HEADERS.length);
  const v = r.getValues()[0], d = r.getDisplayValues()[0];
  const date = toDateStr_(v[B.DATE], d[B.DATE]);
  const start = parseTime_(d[B.START]), end = parseTime_(d[B.END]);
  const name = String(d[B.NAME]).trim(), email = String(d[B.EMAIL]).trim().toLowerCase();
  if (!date || start === null || end === null || end <= start || !name) {
    ui.alert('Fill in at least Date (yyyy-mm-dd), Start, End (e.g. 15:00) and Name in this row, then try again.'); return;
  }
  const cfg = loadConfig_();
  let id = String(d[B.ID]).trim();
  if (!id) id = newId_(cfg.bookings);
  const status = String(d[B.STATUS]).trim() || 'Confirmed';
  if (status !== 'Confirmed') { ui.alert('This row\'s status is "' + status + '". Only Confirmed rows can be confirmed.'); return; }

  const cells = sh.getRange(row, 1, 1, 3);
  cells.setNumberFormat('@');
  cells.setValues([[id, String(d[B.CREATED]).trim() || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), 'Confirmed']]);
  if (!String(d[B.TYPE]).trim()) sh.getRange(row, B.TYPE + 1).setValue('Meeting');
  sh.getRange(row, B.SOURCE + 1).setNumberFormat('@').setValue('Owner');
  SpreadsheetApp.flush();

  const b = { id: id, type: String(d[B.TYPE]).trim() || 'Meeting', date: date, start: start, end: end, name: name, email: email,
    purpose: d[B.PURPOSE], mode: d[B.MODE], format: String(d[B.FORMAT] || '').trim(), meet: String(d[B.MEET] || '').trim(),
    meetCode: String(d[B.MCODE] || '').trim(), row: row };
  let meetNote = '';
  try { if (attachFenilMeet_(cfg, b)) meetNote = '\nFenil Meet code ' + b.meetCode + ' created and included.'; }
  catch (err) { meetNote = '\nFenil Meet code could not be created: ' + err.message; }
  try { if (attachMeet_(cfg, b)) meetNote = '\nGoogle Meet link created and included.'; }
  catch (err) { meetNote = '\nGoogle Meet link could not be created: ' + err.message; }
  safeSend_(() => syncCalendar_());
  if (!email) { ui.alert('Saved as ' + id + ' ✓' + meetNote + '\n\nNo email address in this row, so no confirmation was sent. The time is now blocked.'); return; }
  try {
    emailClientConfirmed_(cfg, b);
    ui.alert('Confirmed ' + id + ' ✓  Confirmation emailed to ' + email + '.' + meetNote + '\nReminder and feedback emails will follow automatically.');
  } catch (err) {
    ui.alert('Saved as ' + id + ', but the email failed:\n\n' + err.message);
  }
}


// ============================================================
//  CALENDAR  — instant Google Calendar sync + subscribe (iCal) link
// ============================================================

function getSyncCalendar_(name) {
  const found = CalendarApp.getCalendarsByName(name);
  if (found.length) return found[0];
  return CalendarApp.createCalendar(name, { timeZone: TZ, summary: 'Bookings from ' + 'book.fenilpshah.com' });
}

function calTitle_(b) { return b.type + ' · ' + b.name; }
function calDescription_(b) {
  return ['Booking ID: ' + b.id, b.meet ? 'Google Meet: ' + b.meet : '', b.meetCode ? 'Fenil Meet code: ' + b.meetCode + ' (enter at book.fenilpshah.com/meet)' : '', b.org ? 'Organisation: ' + b.org : '', b.email ? 'Email: ' + b.email : '',
    b.phone ? 'Phone: ' + b.phone : '', b.purpose ? 'Purpose: ' + b.purpose : ''].filter(Boolean).join('\n');
}

/**
 * Makes the Google Calendar match the Bookings tab: adds confirmed bookings that are missing,
 * removes cancelled ones. Safe to run any time (runs after every booking/cancel and hourly).
 */
function syncCalendar_(force) {
  const cfg = loadConfig_();
  const s = cfg.settings;
  if (!s.calSync && !s.meetOn && !force) return { added: 0, removed: 0 };
  let cal = null;
  const getCal = () => cal || (cal = getSyncCalendar_(s.calName));
  const sh = sheet_(TAB.BOOKINGS);
  const now = Date.now();
  let added = 0, removed = 0;
  cfg.bookings.forEach(b => {
    try {
      const endMs = slotMs_(b.date, b.end);
      if (b.status === 'Confirmed' && !b.calId && endMs > now) {
        if (s.meetOn && b.format === 'Online') {           // new-style online booking: event + Meet link
          if (attachMeet_(cfg, b) !== null) added++;
        } else if (s.calSync || force) {
          const ev = getCal().createEvent(calTitle_(b), new Date(slotMs_(b.date, b.start)), new Date(endMs),
            { description: calDescription_(b), location: b.mode || '' });
          sh.getRange(b.row, B.CALID + 1).setNumberFormat('@').setValue(ev.getId());
          added++;
        }
      } else if (b.status === 'Cancelled' && b.calId && b.calId !== 'Removed') {
        removeCalendarEvent_(getCal, b.calId);
        sh.getRange(b.row, B.CALID + 1).setNumberFormat('@').setValue('Removed');
        removed++;
      }
    } catch (e) { console.error('Calendar sync ' + b.id + ': ' + e.message); }
  });
  return { added: added, removed: removed };
}

function removeCalendarEvent_(getCal, calId) {
  if (calId.indexOf('gcal:') === 0) {                       // created through the Calendar API (with Meet)
    const parts = calId.slice(5).split('|');
    try { Calendar.Events.remove(parts[0], parts[1], { sendUpdates: 'none' }); } catch (e) { console.error(e); }
    return;
  }
  try { const ev = getCal().getEventById(calId); if (ev) ev.deleteEvent(); } catch (e) { console.error(e); }
}

// ---------- Online meetings: format + Google Meet ----------

/** Type's format from the Format column, or worked out from its Mode / location text for older rows. */
function typeFormat_(raw, mode) {
  const f = String(raw || '').trim().toLowerCase();
  if (f.indexOf('choose') > -1 || f.indexOf('either') > -1 || f.indexOf('both') > -1) return 'Client chooses';
  if (f.indexOf('fenil') > -1) return 'Fenil Meet';
  if (f.indexOf('online') > -1 || f.indexOf('google') > -1) return 'Online';
  if (f.indexOf('person') > -1) return 'In person';
  const m = String(mode || '').toLowerCase();
  const online = /online|google meet|virtual|video|zoom/.test(m), person = /in person|in-person|venue|office/.test(m);
  if (online && person) return 'Client chooses';
  if (online) return 'Online';
  return 'In person';
}

/** Validates the client's choice and returns the booking's format + the Mode / location text to store. */
function bookingFormat_(type, chosen, s) {
  let f = type.format;
  if (f === 'Client chooses') {
    if (['Online', 'Fenil Meet', 'In person'].indexOf(chosen) === -1) return { error: 'Please choose how you would like to meet.' };
    f = chosen;
  }
  if (f === 'Fenil Meet' && !s.fmOn) f = 'Online';
  if (f === 'Online') return { format: 'Online', mode: 'Online — Google Meet' };
  if (f === 'Fenil Meet') return { format: 'Fenil Meet', mode: 'Online — Fenil Meet' };
  const typeMode = String(type.mode || '');
  const mode = type.format === 'In person' && typeMode ? typeMode : s.inPersonLocation;
  return { format: 'In person', mode: mode };
}

function isOnline_(b) {
  if (b.format) return b.format === 'Online';
  const m = String(b.mode || '').toLowerCase();
  return /online|google meet|virtual|video|zoom/.test(m) && !/in person|in-person/.test(m);
}

function meetLinkOf_(ev) {
  if (!ev) return '';
  if (ev.hangoutLink) return ev.hangoutLink;
  const eps = (ev.conferenceData && ev.conferenceData.entryPoints) || [];
  const v = eps.filter(e => e.entryPointType === 'video')[0];
  return v ? v.uri : '';
}

/** The calendar Meet events go into: the "Google Calendar name" calendar if it allows Meet, otherwise your main calendar. */
function meetCalendarId_(cfg) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('MEET_CAL_' + cfg.settings.calName);
  if (cached) return cached;
  let id = 'primary';
  try {
    const calId = getSyncCalendar_(cfg.settings.calName).getId();
    const c = Calendar.Calendars.get(calId);
    const allowed = (c.conferenceProperties && c.conferenceProperties.allowedConferenceSolutionTypes) || [];
    if (allowed.indexOf('hangoutsMeet') > -1) id = calId;
  } catch (e) { console.error(e); }
  cache.put('MEET_CAL_' + cfg.settings.calName, id, 21600);
  return id;
}

/**
 * For an online booking: creates the Google Calendar event with a Google Meet link (no guests are added,
 * so Google sends no emails — the link goes out in the Zoho emails). Saves the event and link in the sheet.
 * Returns the link, '' when not needed, or null when it already existed.
 */
function attachMeet_(cfg, b) {
  if (!cfg.settings.meetOn || !isOnline_(b)) return '';
  if (b.meet) return null;
  if (typeof Calendar === 'undefined' || !Calendar.Events) {
    throw new Error('The Google Calendar API service is not added. In Apps Script: Services (+) → Google Calendar API → Add.');
  }
  const calId = meetCalendarId_(cfg);
  const startIso = new Date(slotMs_(b.date, b.start)).toISOString();
  const endIso = new Date(slotMs_(b.date, b.end)).toISOString();
  let ev = Calendar.Events.insert({
    summary: calTitle_(b),
    description: calDescription_(b),
    start: { dateTime: startIso, timeZone: TZ },
    end: { dateTime: endIso, timeZone: TZ },
    conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
  }, calId, { conferenceDataVersion: 1, sendUpdates: 'none' });

  let link = meetLinkOf_(ev);
  for (let i = 0; i < 4 && !link; i++) {                    // Meet creation can take a moment
    Utilities.sleep(1500);
    ev = Calendar.Events.get(calId, ev.id);
    link = meetLinkOf_(ev);
  }
  const sh = sheet_(TAB.BOOKINGS);
  if (b.row) sh.getRange(b.row, B.CALID + 1).setNumberFormat('@').setValue('gcal:' + calId + '|' + ev.id);
  b.calId = 'gcal:' + calId + '|' + ev.id;
  if (!link) throw new Error('Google Calendar did not return a Meet link. The event was created without one.');
  b.meet = link;
  b.mode = b.mode || 'Online — Google Meet';
  try {                                                      // put the link in the event's location and notes too
    Calendar.Events.patch({ location: link, description: calDescription_(b) }, calId, ev.id, { sendUpdates: 'none' });
  } catch (e) { console.error(e); }
  if (b.row) sh.getRange(b.row, B.MEET + 1).setNumberFormat('@').setValue(link);
  SpreadsheetApp.flush();
  return link;
}

function syncCalendarNow() {
  const ui = SpreadsheetApp.getUi();
  const s = loadConfig_().settings;
  if (!s.calSync) { ui.alert('Instant sync is off.\n\nIn Settings, set "Google Calendar sync" to Yes, then run this again.'); return; }
  try {
    const r = syncCalendar_(true);
    ui.alert('Google Calendar synced ✓\n\nCalendar: "' + s.calName + '"\nAdded ' + r.added + ', removed ' + r.removed + '.\n\n' +
      'New bookings and cancellations now appear in that calendar instantly.');
  } catch (err) { ui.alert('Calendar sync failed:\n\n' + err.message); }
}

// ---------- Subscribe link (iCal feed) ----------

function calendarKey_(reset) {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('ICS_KEY');
  if (!key || reset) { key = Utilities.getUuid().replace(/-/g, ''); props.setProperty('ICS_KEY', key); }
  return key;
}

function calendarUrl_(reset) {
  // The live /exec address. Inside the sheet, Apps Script often reports the private /dev test address
  // instead, which phones and calendar apps cannot open — so the Settings value wins.
  const raw = {};
  rows_(TAB.SETTINGS).forEach(r => { raw[String(r.d[0]).trim()] = String(r.d[1]).trim(); });
  let base = raw['Web app URL (/exec)'] || '';
  if (!base) {
    base = ScriptApp.getService().getUrl() || '';
    if (/\/dev$/.test(base)) base = '';
  }
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(base)) {
    throw new Error('Paste your live web app URL (it ends in /exec) into Settings → "Web app URL (/exec)", then run this again.\n\n' +
      'Find it under Deploy → Manage deployments → Web app → URL.');
  }
  return base + '?action=ics&key=' + calendarKey_(reset);
}

function showCalendarLink() {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert('Your calendar subscribe link (keep it private — it shows names):\n\n' + calendarUrl_(false) +
      '\n\nGoogle Calendar: Other calendars → + → From URL → paste → Add calendar.\n' +
      'Note: Google refreshes subscribed calendars only every 12–24 hours. For instant updates, set "Google Calendar sync" to Yes in Settings.');
  } catch (err) { ui.alert(err.message); }
}

function resetCalendarLink() {
  const ui = SpreadsheetApp.getUi();
  const ok = ui.alert('Reset subscribe link?', 'The old link stops working immediately. You will need to subscribe again with the new one.', ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;
  try { ui.alert('New subscribe link:\n\n' + calendarUrl_(true)); } catch (err) { ui.alert(err.message); }
}

function icsEsc_(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFold_(line) {
  const out = [];
  while (line.length > 70) { out.push(line.slice(0, 70)); line = ' ' + line.slice(70); }
  out.push(line);
  return out.join('\r\n');
}
function icsTime_(ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

function icsFeed_(key) {
  const stored = PropertiesService.getScriptProperties().getProperty('ICS_KEY');
  if (!stored || !key || String(key) !== stored) {
    return ContentService.createTextOutput('Not found').setMimeType(ContentService.MimeType.TEXT);
  }
  const cfg = loadConfig_();
  const s = cfg.settings;
  const now = Date.now(), stamp = icsTime_(now);
  const host = (s.pageUrl || 'book.fenilpshah.com').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fenil Book//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + icsEsc_(s.calName || 'Fenil Book'), 'X-WR-TIMEZONE:' + TZ,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const ev = (uid, startMs, endMs, summary, desc, loc) => {
    lines.push('BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + stamp, 'DTSTART:' + icsTime_(startMs), 'DTEND:' + icsTime_(endMs),
      'SUMMARY:' + icsEsc_(summary));
    if (desc) lines.push('DESCRIPTION:' + icsEsc_(desc));
    if (loc) lines.push('LOCATION:' + icsEsc_(loc));
    lines.push('STATUS:CONFIRMED', 'TRANSP:OPAQUE', 'END:VEVENT');
  };
  const fromMs = now - 30 * 24 * 3600000;
  cfg.bookings.forEach(b => {
    if (b.status !== 'Confirmed' || slotMs_(b.date, b.end) < fromMs) return;
    ev(b.id + '@' + host, slotMs_(b.date, b.start), slotMs_(b.date, b.end), calTitle_(b), calDescription_(b), b.meet || b.mode);
  });
  if (s.feedAll) {
    const today = todayIST_();
    for (let i = -14; i <= 120; i++) {
      const date = addDays_(today, i), dow = dayOfWeek_(date);
      cfg.classes.forEach((c, ci) => {
        if (!c.active || c.days.indexOf(dow) === -1 || (c.from && date < c.from) || (c.until && date > c.until)) return;
        ev('class-' + ci + '-' + date + '@' + host, slotMs_(date, c.start), slotMs_(date, c.end), c.title || 'Class', '', c.location);
      });
      cfg.blocked.forEach((bl, bi) => {
        if (bl.date !== date) return;
        ev('blocked-' + bi + '-' + date + '@' + host, slotMs_(date, bl.start), slotMs_(date, bl.end), bl.reason || 'Blocked', '', bl.location);
      });
    }
  }
  lines.push('END:VCALENDAR');
  return ContentService.createTextOutput(lines.map(icsFold_).join('\r\n') + '\r\n').setMimeType(ContentService.MimeType.ICAL);
}


// ============================================================
//  ADMIN PAGE API  (book.fenilpshah.com/admin)
//  Every request except "login" needs a session token from login.
// ============================================================

/** Tabs the admin page may edit, and which of them allow adding / deleting rows. */
const ADMIN_TABS = {
  classes:  { tab: TAB.CLASSES,  add: true,  del: true },
  blocked:  { tab: TAB.BLOCKED,  add: true,  del: true },
  hours:    { tab: TAB.HOURS,    add: true,  del: true },
  types:    { tab: TAB.TYPES,    add: true,  del: true },
  emails:   { tab: TAB.EMAILS,   add: false, del: false },
  settings: { tab: TAB.SETTINGS, add: false, del: false }
};
const ADMIN_SESSION_SECONDS = 6 * 3600;

function admin_(p) {
  const op = String(p.op || '');
  if (op === 'login') {
    const auth = checkOwnerPassword_(p.password);
    if (!auth.ok) return auth;
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('ADM_' + token, '1', ADMIN_SESSION_SECONDS);
    return { ok: true, token: token, owner: loadConfig_().settings.ownerName };
  }
  const cache = CacheService.getScriptCache();
  const token = String(p.token || '');
  if (!/^[a-f0-9]{64}$/.test(token) || !cache.get('ADM_' + token)) {
    return { ok: false, signedOut: true, error: 'Your session has ended. Please sign in again.' };
  }
  cache.put('ADM_' + token, '1', ADMIN_SESSION_SECONDS);   // sliding expiry
  if (op === 'logout') { cache.remove('ADM_' + token); return { ok: true }; }

  switch (op) {
    case 'dashboard':   return adminDashboard_();
    case 'bookings':    return adminBookings_();
    case 'cancel':      return adminCancel_(p);
    case 'setStatus':   return adminSetStatus_(p);
    case 'resend':      return adminResend_(p);
    case 'addBooking':  return ownerBookCore_(p);
    case 'schedule':    return ownerScheduleCore_(p);
    case 'table':       return adminTable_(p.name);
    case 'saveRow':     return adminSaveRow_(p);
    case 'deleteRow':   return adminDeleteRow_(p);
    case 'feedback':    return adminSimpleTab_(TAB.FEEDBACK, 200);
    case 'log':         return adminSimpleTab_(TAB.LOG, 100);
    case 'testEmails':  return Object.assign({ ok: true }, testEmails_());
    case 'syncCalendar': {
      const s = loadConfig_().settings;
      if (!s.calSync) return { ok: false, error: 'Google Calendar sync is off. Turn it on in Settings first.' };
      return Object.assign({ ok: true, calendar: s.calName }, syncCalendar_(true));
    }
    case 'calendarLink': return { ok: true, url: calendarUrl_(false) };
    case 'changePassword': return adminChangePassword_(p);
    case 'mailSenders': return mailSenders_();
    case 'sendMail':    return composeSend_(p);
    case 'sentMail':    return sentMail_();
    case 'meetCodes':   return meetCodesList_();
    case 'newMeetCode': return adminNewMeetCode_(p);
    case 'cancelMeetCode': return adminCancelMeetCode_(p);
    default: return { ok: false, error: 'Unknown admin request.' };
  }
}

function bookingOut_(b) {
  return { row: b.row, id: b.id, status: b.status, type: b.type, date: b.date, start: fmtTime_(b.start), end: fmtTime_(b.end),
    name: b.name, email: b.email, phone: b.phone, org: b.org, purpose: b.purpose, mode: b.mode, created: b.created,
    cancelReason: b.cancelReason, reminder: b.reminder, feedbackSent: b.feedbackSent, source: b.source || '',
    format: b.format || '', meet: b.meet || '', meetCode: b.meetCode || '',
    startMs: slotMs_(b.date, b.start), endMs: slotMs_(b.date, b.end) };
}

function adminDashboard_() {
  const cfg = loadConfig_();
  const now = Date.now(), day = 24 * 3600000;
  const bk = cfg.bookings;
  const upcoming = bk.filter(b => b.status === 'Confirmed' && slotMs_(b.date, b.end) > now)
    .sort((a, b) => slotMs_(a.date, a.start) - slotMs_(b.date, b.start));
  const week = upcoming.filter(b => slotMs_(b.date, b.start) < now + 7 * day);
  const created30 = bk.filter(b => {
    const c = String(b.created || '').split(' ');
    return c.length === 2 && parseTime_(c[1]) !== null && /^\d{4}-\d{2}-\d{2}$/.test(c[0]) && slotMs_(c[0], parseTime_(c[1])) > now - 30 * day;
  });
  const fb = rows_(TAB.FEEDBACK).map(r => ({ when: r.d[0], id: r.d[1], name: r.d[2], type: r.d[4], meeting: r.d[5],
    rating: parseInt(r.d[6], 10) || 0, liked: r.d[7], improve: r.d[8], followUp: r.d[9] }));
  const rated = fb.filter(f => f.rating);
  const today = ownerScheduleCore_({ from: 0, days: 1 });
  return {
    ok: true, owner: cfg.settings.ownerName, open: cfg.settings.open, calSync: cfg.settings.calSync,
    sheetUrl: ss_().getUrl(),
    generated: today.generated,
    stats: {
      upcoming: upcoming.length,
      next7: week.length,
      new30: created30.length,
      cancelled30: created30.filter(b => b.status === 'Cancelled').length,
      rating: rated.length ? Math.round(rated.reduce((a, f) => a + f.rating, 0) / rated.length * 10) / 10 : null,
      ratings: rated.length,
      followUps: fb.filter(f => f.followUp === 'Yes').length
    },
    today: today.days[0],
    next: upcoming.slice(0, 8).map(bookingOut_),
    feedback: fb.slice(-5).reverse()
  };
}

function adminBookings_() {
  const cfg = loadConfig_();
  const src = sheet_(TAB.BOOKINGS);
  const last = src.getLastRow();
  const sources = last > 1 ? src.getRange(2, B.SOURCE + 1, last - 1, 1).getDisplayValues().map(r => r[0]) : [];
  return { ok: true, bookings: cfg.bookings.map(b => { b.source = sources[b.row - 2] || ''; return bookingOut_(b); }) };
}

function adminFind_(cfg, p) {
  const b = cfg.bookings.find(x => x.row === parseInt(p.row, 10));
  if (!b || b.id !== String(p.id || '')) return null;   // the row must still hold the same booking
  return b;
}

function adminCancel_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let b, cfg;
  try {
    cfg = loadConfig_();
    b = adminFind_(cfg, p);
    if (!b) return { ok: false, error: 'That booking changed in the sheet. Please refresh and try again.' };
    if (b.status !== 'Confirmed') return { ok: false, error: 'This booking is already ' + b.status + '.' };
    b.cancelReason = clean_(p.reason, 500);
    markCancelled_(b, 'Fenil', b.cancelReason);
    b.status = 'Cancelled';
  } finally { lock.releaseLock(); }
  const errors = [];
  if (p.notify !== false) {
    try { emailClientCancelled_(cfg, b, 'Fenil'); } catch (e) { errors.push(e.message); }
  }
  try { emailOwnerCancelled_(cfg, b, 'Fenil'); } catch (e) { errors.push(e.message); }
  safeSend_(() => syncCalendar_());
  return { ok: true, warning: errors.length ? 'Cancelled, but an email failed: ' + errors.join(' / ') : '' };
}

function adminSetStatus_(p) {
  const status = String(p.status || '');
  if (['Confirmed', 'No-show'].indexOf(status) === -1) return { ok: false, error: 'Unknown status.' };
  const cfg = loadConfig_();
  const b = adminFind_(cfg, p);
  if (!b) return { ok: false, error: 'That booking changed in the sheet. Please refresh and try again.' };
  sheet_(TAB.BOOKINGS).getRange(b.row, B.STATUS + 1).setValue(status);
  SpreadsheetApp.flush();
  safeSend_(() => syncCalendar_());
  return { ok: true };
}

function adminResend_(p) {
  const cfg = loadConfig_();
  const b = adminFind_(cfg, p);
  if (!b) return { ok: false, error: 'That booking changed in the sheet. Please refresh and try again.' };
  if (b.status !== 'Confirmed') return { ok: false, error: 'Only confirmed bookings can be re-sent.' };
  if (!b.email) return { ok: false, error: 'This booking has no email address.' };
  emailClientConfirmed_(cfg, b);
  return { ok: true };
}

function adminTable_(name) {
  const def = ADMIN_TABS[name];
  if (!def) return { ok: false, error: 'Unknown table.' };
  const sh = sheet_(def.tab);
  const cols = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, cols).getDisplayValues()[0];
  const rows = rows_(def.tab).map(r => ({ row: r.row, values: r.d.slice(0, cols) }));
  return { ok: true, name: name, headers: headers, rows: rows, add: def.add, del: def.del };
}

function adminSaveRow_(p) {
  const def = ADMIN_TABS[p.name];
  if (!def) return { ok: false, error: 'Unknown table.' };
  const sh = sheet_(def.tab);
  const cols = Math.max(sh.getLastColumn(), 1);
  const values = (Array.isArray(p.values) ? p.values : []).slice(0, cols).map(v => clean_(v, 2000));
  while (values.length < cols) values.push('');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let row = parseInt(p.row, 10);
    if (row) {
      if (row < 2 || row > sh.getLastRow()) return { ok: false, error: 'That row no longer exists. Please refresh.' };
      const current = sh.getRange(row, 1).getDisplayValue();
      if (String(current) !== String(p.key || '')) return { ok: false, error: 'That row changed in the sheet. Please refresh and try again.' };
      if (!def.add) values[0] = current;            // Settings / Emails: the name column is fixed
    } else {
      if (!def.add) return { ok: false, error: 'Rows cannot be added here.' };
      if (!values[0]) return { ok: false, error: 'The first field cannot be empty.' };
      row = sh.getLastRow() + 1;
    }
    const range = sh.getRange(row, 1, 1, cols);
    range.setNumberFormat('@');
    range.setValues([values]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function adminDeleteRow_(p) {
  const def = ADMIN_TABS[p.name];
  if (!def || !def.del) return { ok: false, error: 'Rows cannot be deleted here.' };
  const sh = sheet_(def.tab);
  const row = parseInt(p.row, 10);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!(row >= 2 && row <= sh.getLastRow())) return { ok: false, error: 'That row no longer exists. Please refresh.' };
    if (String(sh.getRange(row, 1).getDisplayValue()) !== String(p.key || '')) {
      return { ok: false, error: 'That row changed in the sheet. Please refresh and try again.' };
    }
    sh.deleteRow(row);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function adminSimpleTab_(tab, limit) {
  const sh = sheet_(tab);
  const cols = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, cols).getDisplayValues()[0];
  const rows = rows_(tab).map(r => r.d.slice(0, cols)).reverse().slice(0, limit);
  return { ok: true, headers: headers, rows: rows };
}

function adminChangePassword_(p) {
  const auth = checkOwnerPassword_(p.current);
  if (!auth.ok) return { ok: false, error: auth.error === 'Incorrect password.' ? 'Your current password is not right.' : auth.error };
  const pw = String(p.next || '');
  if (pw.length < 8) return { ok: false, error: 'The new password needs at least 8 characters.' };
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({ OWNER_PDF_SALT: salt, OWNER_PDF_HASH: sha256Hex_(salt + pw) });
  return { ok: true };
}


// ============================================================
//  COMPOSE & SEND MAIL  (book.fenilpshah.com/mail)
//  Sends through Zoho Mail from any address on your Zoho account.
// ============================================================

const SENT_HEADERS = ['Sent (IST)', 'Mail ID', 'From', 'To', 'Cc', 'Bcc', 'Subject', 'Attachments',
  'Read receipt requested', 'Open tracking', 'Opens', 'First opened (IST)', 'Last opened (IST)', 'Status'];
const S_COL = { SENT: 0, ID: 1, FROM: 2, TO: 3, CC: 4, BCC: 5, SUBJECT: 6, ATT: 7, RECEIPT: 8, TRACK: 9, OPENS: 10, FIRST: 11, LAST: 12, STATUS: 13 };
const MAIL_MAX_BYTES = 20 * 1024 * 1024;   // total attachment size

function sentSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(TAB.SENT);
  if (!sh) {
    sh = ss.insertSheet(TAB.SENT);
    sh.getRange(1, 1, 1, SENT_HEADERS.length).setValues([SENT_HEADERS])
      .setFontWeight('bold').setBackground('#1b1a17').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Addresses you can send from: every "Send mail as" address on the connected Zoho account. */
function mailSenders_() {
  const cache = CacheService.getScriptCache();
  let list = null;
  const hit = cache.get('MAIL_SENDERS');
  if (hit) list = JSON.parse(hit);
  if (!list) {
    list = [];
    const res = UrlFetchApp.fetch(ZOHO_MAIL_API + '/accounts', {
      headers: { Authorization: 'Zoho-oauthtoken ' + zohoToken_() }, muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText() || '{}');
    (data.data || []).forEach(acc => {
      const seen = {};
      const add = (addr, name) => {
        addr = String(addr || '').trim().toLowerCase();
        if (!addr || seen[addr]) return;
        seen[addr] = true;
        list.push({ address: addr, name: String(name || acc.displayName || '').trim() });
      };
      add(acc.primaryEmailAddress || acc.mailboxAddress, acc.displayName);
      (acc.sendMailDetails || []).forEach(d => add(d.fromAddress, d.displayName));
      (acc.emailAddress || []).forEach(e => add(e.mailId, acc.displayName));
    });
    if (list.length) cache.put('MAIL_SENDERS', JSON.stringify(list), 1800);
  }
  const cfg = loadConfig_();
  if (!list.length && cfg.settings.fromAddress) list.push({ address: cfg.settings.fromAddress, name: cfg.settings.ownerName });
  // Recently used recipients, for suggestions
  const recent = {};
  const sh = sentSheet_();
  const last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(Math.max(2, last - 199), S_COL.TO + 1, Math.min(200, last - 1), 3).getDisplayValues()
      .forEach(r => r.join(',').split(',').forEach(a => { a = a.trim().toLowerCase(); if (a) recent[a] = true; }));
  }
  return { ok: true, senders: list, defaultFrom: cfg.settings.fromAddress, defaultName: cfg.settings.ownerName,
    recent: Object.keys(recent).slice(0, 300), maxBytes: MAIL_MAX_BYTES };
}

function cleanList_(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[,;\s]+/);
  const out = [], seen = {};
  arr.forEach(a => {
    a = String(a || '').trim().toLowerCase();
    if (a && /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/.test(a) && !seen[a]) { seen[a] = true; out.push(a); }
  });
  return out;
}

function composeSend_(p) {
  const from = String(p.from || '').trim().toLowerCase();
  const fromName = clean_(p.fromName, 80).replace(/["<>\r\n]/g, '');
  const to = cleanList_(p.to), cc = cleanList_(p.cc), bcc = cleanList_(p.bcc);
  const subject = clean_(p.subject, 300);
  const html = String(p.html || '').slice(0, 500000);
  const askReceipt = p.readReceipt === true;
  const track = p.trackOpens === true;
  const files = Array.isArray(p.attachments) ? p.attachments.slice(0, 15) : [];

  const senders = mailSenders_().senders.map(x => x.address);
  if (senders.indexOf(from) === -1) return { ok: false, error: 'That From address is not on your Zoho account.' };
  if (!to.length) return { ok: false, error: 'Add at least one recipient in To.' };
  if (to.length + cc.length + bcc.length > 100) return { ok: false, error: 'Please keep it under 100 recipients in total.' };
  if (!subject) return { ok: false, error: 'Please add a subject.' };
  if (!html.replace(/<[^>]*>/g, '').trim() && !files.length) return { ok: false, error: 'The message is empty.' };

  // Upload attachments to Zoho first
  const accountId = PropertiesService.getScriptProperties().getProperty('ZOHO_ACCOUNT_ID');
  if (!accountId) return { ok: false, error: 'Zoho Mail is not connected. In the sheet: Fenil Book → Connect Zoho Mail.' };
  const token = zohoToken_();
  let total = 0;
  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = clean_(f.name, 150).replace(/[\\/:*?"<>|]/g, '_') || ('attachment-' + (i + 1));
    let bytes;
    try { bytes = Utilities.base64Decode(String(f.data || '')); } catch (e) { return { ok: false, error: 'Could not read the file "' + name + '".' }; }
    total += bytes.length;
    if (total > MAIL_MAX_BYTES) return { ok: false, error: 'Attachments are larger than 20 MB in total.' };
    const up = UrlFetchApp.fetch(ZOHO_MAIL_API + '/accounts/' + accountId + '/messages/attachments?fileName=' + encodeURIComponent(name), {
      method: 'post', contentType: 'application/octet-stream', payload: bytes,
      headers: { Authorization: 'Zoho-oauthtoken ' + token, Accept: 'application/json' }, muteHttpExceptions: true
    });
    const ud = JSON.parse(up.getContentText() || '{}');
    const d = Array.isArray(ud.data) ? ud.data[0] : ud.data;
    if (up.getResponseCode() !== 200 || !d || !d.storeName) {
      return { ok: false, error: 'Zoho could not accept the attachment "' + name + '". ' + up.getContentText().slice(0, 200) };
    }
    uploaded.push({ storeName: d.storeName, attachmentPath: d.attachmentPath, attachmentName: d.attachmentName || name });
  }

  const mailId = 'M-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
  let content = html;
  if (track) {
    const base = mailBaseUrl_();
    if (base) content += '<img src="' + base + '?action=open&m=' + mailId + '&k=' + mailKey_(mailId) +
      '" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0">';
  }

  const payload = { toAddress: to.join(','), subject: subject, content: content, mailFormat: 'html', askReceipt: askReceipt ? 'yes' : 'no' };
  if (cc.length) payload.ccAddress = cc.join(',');
  if (bcc.length) payload.bccAddress = bcc.join(',');
  if (uploaded.length) payload.attachments = uploaded;
  const post = fromValue => {
    payload.fromAddress = fromValue;
    return UrlFetchApp.fetch(ZOHO_MAIL_API + '/accounts/' + accountId + '/messages', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Zoho-oauthtoken ' + token, Accept: 'application/json' },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
  };
  let res = post(fromName ? '"' + fromName + '" <' + from + '>' : from);
  let note = '';
  if (res.getResponseCode() !== 200 && fromName) { res = post(from); note = ' (sender name not accepted by Zoho — used the address\'s Zoho name)'; }
  const ok = res.getResponseCode() === 200;
  const status = ok ? 'Sent' + note : 'Failed: ' + res.getContentText().slice(0, 200);

  const sh = sentSheet_();
  const row = [Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), mailId, (fromName ? fromName + ' <' + from + '>' : from),
    to.join(', '), cc.join(', '), bcc.join(', '), subject, uploaded.map(u => u.attachmentName).join(', '),
    askReceipt ? 'Yes' : 'No', track ? 'Yes' : 'No', '0', '', '', status];
  const range = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
  logEmail_(to.join(','), subject, ok ? 'Sent (compose)' + note : status, from);
  if (!ok) return { ok: false, error: 'Zoho did not send the email: ' + res.getContentText().slice(0, 300) };
  return { ok: true, id: mailId, note: note, tracked: track && !!mailBaseUrl_() };
}

function mailBaseUrl_() {
  try {
    const raw = {};
    rows_(TAB.SETTINGS).forEach(r => { raw[String(r.d[0]).trim()] = String(r.d[1]).trim(); });
    const u = raw['Web app URL (/exec)'] || '';
    return /^https:\/\/script\.google\.com\/.+\/exec$/.test(u) ? u : '';
  } catch (e) { return ''; }
}

function mailKey_(id) {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('MAIL_TRACK_SECRET');
  if (!secret) { secret = Utilities.getUuid(); props.setProperty('MAIL_TRACK_SECRET', secret); }
  return sha256Hex_(secret + '|' + id).slice(0, 16);
}

/** Tracking pixel hit: records the open. */
function mailOpened_(id, key) {
  id = String(id || ''); key = String(key || '');
  if (/^M-[A-F0-9]{12}$/.test(id) && key === mailKey_(id)) {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(5000)) {
      try {
        const sh = sentSheet_();
        const last = sh.getLastRow();
        if (last > 1) {
          const ids = sh.getRange(2, S_COL.ID + 1, last - 1, 1).getDisplayValues();
          for (let i = ids.length - 1; i >= 0; i--) {
            if (ids[i][0] !== id) continue;
            const row = i + 2;
            const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
            const cur = sh.getRange(row, S_COL.OPENS + 1, 1, 3).getDisplayValues()[0];
            sh.getRange(row, S_COL.OPENS + 1, 1, 3).setNumberFormat('@')
              .setValues([[String((parseInt(cur[0], 10) || 0) + 1), cur[1] || now, now]]);
            break;
          }
        }
      } finally { lock.releaseLock(); }
    }
  }
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function sentMail_() {
  const sh = sentSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, mails: [] };
  const n = Math.min(200, last - 1);
  const rows = sh.getRange(last - n + 1, 1, n, SENT_HEADERS.length).getDisplayValues().reverse();
  return { ok: true, mails: rows.map(r => ({ sent: r[0], id: r[1], from: r[2], to: r[3], cc: r[4], bcc: r[5], subject: r[6],
    attachments: r[7], receipt: r[8], track: r[9], opens: parseInt(r[10], 10) || 0, first: r[11], last: r[12], status: r[13] })) };
}


// ============================================================
//  FENIL MEET  — your own browser video calls at book.fenilpshah.com/meet
//  The sheet keeps the meeting codes; Apps Script introduces the browsers to
//  each other (signalling); the video itself flows directly between people.
// ============================================================

const MEET_HEADERS = ['Code', 'Title', 'Booking ID', 'Opens (IST)', 'Closes (IST)', 'Status', 'Created (IST)', 'Created by', 'Last joined (IST)', 'Joins'];
const MC = { CODE: 0, TITLE: 1, BOOKING: 2, OPENS: 3, CLOSES: 4, STATUS: 5, CREATED: 6, BY: 7, LAST: 8, JOINS: 9 };
const MEET_MAX_PEOPLE = 4;
const MEET_PEER_TIMEOUT_MS = 20000;

function meetsSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(TAB.MEETS);
  if (!sh) {
    sh = ss.insertSheet(TAB.MEETS);
    sh.getRange(1, 1, 1, MEET_HEADERS.length).setValues([MEET_HEADERS])
      .setFontWeight('bold').setBackground('#1b1a17').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function normCode_(c) {
  const s = String(c || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!/^fps[a-z0-9]{6}$/.test(s)) return '';
  return 'fps-' + s.slice(3, 6) + '-' + s.slice(6, 9);
}

function newMeetCode_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const sh = meetsSheet_();
  const last = sh.getLastRow();
  const taken = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getDisplayValues().forEach(r => { taken[r[0]] = true; });
  let code;
  do {
    let a = '';
    for (let i = 0; i < 6; i++) a += chars.charAt(Math.floor(Math.random() * chars.length));
    code = 'fps-' + a.slice(0, 3) + '-' + a.slice(3);
  } while (taken[code]);
  return code;
}

function istStamp_(ms) {
  return new Date(ms + IST_OFFSET_MIN * 60000).toISOString().slice(0, 16).replace('T', ' ');
}
function istParse_(str) {
  const m = String(str || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
  return m ? slotMs_(m[1], parseTime_(m[2])) : null;
}

function createMeetCode_(title, bookingId, opensMs, closesMs, by) {
  const code = newMeetCode_();
  const sh = meetsSheet_();
  const row = [code, title, bookingId || '', istStamp_(opensMs), istStamp_(closesMs), 'Active',
    Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), by || 'System', '', '0'];
  const r = sh.getRange(sh.getLastRow() + 1, 1, 1, row.length);
  r.setNumberFormat('@');
  r.setValues([row]);
  SpreadsheetApp.flush();
  return code;
}

/** For a Fenil Meet booking: creates its meeting code and saves it on the booking. Returns the code, or '' when not needed. */
function attachFenilMeet_(cfg, b) {
  if (b.format !== 'Fenil Meet' || b.meetCode) return '';
  const startMs = slotMs_(b.date, b.start), endMs = slotMs_(b.date, b.end);
  b.meetCode = createMeetCode_(b.type + ' · ' + b.name, b.id, startMs - 15 * 60000, endMs + 60 * 60000, 'Booking');
  if (b.row) sheet_(TAB.BOOKINGS).getRange(b.row, B.MCODE + 1).setNumberFormat('@').setValue(b.meetCode);
  SpreadsheetApp.flush();
  return b.meetCode;
}

function findMeetCode_(code) {
  const sh = meetsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, MEET_HEADERS.length).getDisplayValues();
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i][MC.CODE] === code) return { row: i + 2, v: vals[i] };
  }
  return null;
}

function iceServers_(s) {
  const list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (s.turnUrl) {
    const urls = s.turnUrl.split(',').map(x => x.trim()).filter(Boolean);
    list.push({ urls: urls, username: s.turnUser, credential: s.turnPass });
  }
  return list;
}

/** Checks a code can be used now. Returns {ok, title, ...} or {ok:false, error}. */
function meetCheck_(code, cfg) {
  const c = normCode_(code);
  if (!c) return { ok: false, error: 'Meeting codes look like fps-abc-123. Please check and try again.' };
  const m = findMeetCode_(c);
  if (!m) return { ok: false, error: 'No meeting found with that code.' };
  if (m.v[MC.STATUS] !== 'Active') return { ok: false, error: 'This meeting has been cancelled.' };
  if (m.v[MC.BOOKING]) {
    const b = cfg.bookings.find(x => x.id === m.v[MC.BOOKING]);
    if (b && b.status === 'Cancelled') return { ok: false, error: 'This meeting has been cancelled.' };
  }
  const now = Date.now(), opens = istParse_(m.v[MC.OPENS]), closes = istParse_(m.v[MC.CLOSES]);
  if (opens && now < opens) {
    const p = istStamp_(opens).split(' ');
    return { ok: false, notYet: true, error: 'This meeting room opens on ' + humanDate_(p[0]) + ' at ' + humanTime_(parseTime_(p[1])) + ' IST.' };
  }
  if (closes && now > closes) return { ok: false, error: 'This meeting has ended.' };
  return { ok: true, code: c, title: m.v[MC.TITLE], row: m.row };
}

// ---------- Signalling ----------

function roomKey_(c) { return 'FMR_' + c; }
function queueKey_(c, pid) { return 'FMQ_' + c + '_' + pid; }
function loadRoom_(c) { const v = CacheService.getScriptCache().get(roomKey_(c)); return v ? JSON.parse(v) : { peers: {}, denied: {}, ended: false }; }
function saveRoom_(c, room) { CacheService.getScriptCache().put(roomKey_(c), JSON.stringify(room), 21600); }
function pushMsg_(c, to, msg) {
  const cache = CacheService.getScriptCache();
  const k = queueKey_(c, to);
  const q = JSON.parse(cache.get(k) || '[]');
  q.push(msg);
  cache.put(k, JSON.stringify(q).length < 95000 ? JSON.stringify(q) : JSON.stringify([msg]), 3600);
}
function pruneRoom_(c, room) {
  const now = Date.now();
  Object.keys(room.peers).forEach(id => {
    if (now - room.peers[id].last > MEET_PEER_TIMEOUT_MS) {
      delete room.peers[id];
      Object.keys(room.peers).forEach(o => pushMsg_(c, o, { from: id, type: 'bye' }));
    }
  });
}
function peerList_(room, state) {
  return Object.keys(room.peers).filter(id => room.peers[id].state === state)
    .map(id => ({ pid: id, name: room.peers[id].name, host: !!room.peers[id].host }));
}
function isHostToken_(token) {
  token = String(token || '');
  return /^[a-f0-9]{64}$/.test(token) && !!CacheService.getScriptCache().get('ADM_' + token);
}

function meet_(p) {
  const op = String(p.op || '');
  const cfg = loadConfig_();
  if (!cfg.settings.fmOn) return { ok: false, error: 'Fenil Meet is not available right now.' };
  if (op === 'check') {
    const r = meetCheck_(p.code, cfg);
    return r.ok ? { ok: true, code: r.code, title: r.title } : r;
  }
  const c = normCode_(p.code);
  if (!c) return { ok: false, error: 'Invalid meeting code.' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { ok: false, busy: true, error: 'Busy, retrying…' };
  try {
    if (op === 'join') {
      const chk = meetCheck_(c, cfg);
      if (!chk.ok) return chk;
      const host = isHostToken_(p.token);
      const name = clean_(p.name, 60) || (host ? cfg.settings.ownerName : 'Guest');
      const room = loadRoom_(c);
      if (room.ended && !host) return { ok: false, error: 'The host has ended this meeting.' };
      if (host) room.ended = false;
      pruneRoom_(c, room);
      const inCount = peerList_(room, 'in').length;
      if (inCount >= MEET_MAX_PEOPLE) return { ok: false, error: 'This meeting is full (' + MEET_MAX_PEOPLE + ' people).' };
      const pid = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
      const waiting = !host && cfg.settings.fmWaiting;
      room.peers[pid] = { name: name, host: host, last: Date.now(), state: waiting ? 'waiting' : 'in' };
      saveRoom_(c, room);
      const sh = meetsSheet_();
      const cur = sh.getRange(chk.row, MC.LAST + 1, 1, 2).getDisplayValues()[0];
      sh.getRange(chk.row, MC.LAST + 1, 1, 2).setNumberFormat('@')
        .setValues([[Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), String((parseInt(cur[1], 10) || 0) + 1)]]);
      return { ok: true, pid: pid, host: host, state: room.peers[pid].state, title: chk.title, code: c, name: name,
        hostPresent: peerList_(room, 'in').some(x => x.host), peers: peerList_(room, 'in').filter(x => x.pid !== pid),
        ice: iceServers_(cfg.settings), max: MEET_MAX_PEOPLE };
    }

    const pid = String(p.pid || '');
    const room = loadRoom_(c);
    const me = room.peers[pid];
    if (op === 'poll') {
      if (room.denied[pid]) return { ok: true, state: 'denied' };
      if (!me) return { ok: true, state: room.ended ? 'ended' : 'gone' };
      me.last = Date.now();
      pruneRoom_(c, room);
      saveRoom_(c, room);
      const cache = CacheService.getScriptCache();
      const msgs = JSON.parse(cache.get(queueKey_(c, pid)) || '[]');
      if (msgs.length) cache.remove(queueKey_(c, pid));
      return { ok: true, state: me.state, peers: peerList_(room, 'in').filter(x => x.pid !== pid),
        waiting: me.host ? peerList_(room, 'waiting') : [], hostPresent: peerList_(room, 'in').some(x => x.host), msgs: msgs };
    }
    if (!me) return { ok: false, gone: true, error: 'You are no longer in this meeting.' };
    if (op === 'signal') {
      const to = String(p.to || '');
      if (me.state !== 'in' || !room.peers[to]) return { ok: false, error: 'That person has left.' };
      const type = String(p.type || '');
      if (['offer', 'answer', 'bye'].indexOf(type) === -1) return { ok: false, error: 'Bad signal.' };
      pushMsg_(c, to, { from: pid, name: me.name, host: !!me.host, type: type, data: String(p.data || '').slice(0, 60000) });
      return { ok: true };
    }
    if (op === 'admit') {
      if (!me.host) return { ok: false, error: 'Only the host can do that.' };
      const t = room.peers[String(p.target || '')];
      if (!t) return { ok: false, error: 'They have left.' };
      if (p.allow) {
        if (peerList_(room, 'in').length >= MEET_MAX_PEOPLE) return { ok: false, error: 'The meeting is full.' };
        t.state = 'in';
      } else { room.denied[String(p.target)] = true; delete room.peers[String(p.target)]; }
      saveRoom_(c, room);
      return { ok: true };
    }
    if (op === 'leave') {
      delete room.peers[pid];
      Object.keys(room.peers).forEach(o => pushMsg_(c, o, { from: pid, type: 'bye' }));
      saveRoom_(c, room);
      return { ok: true };
    }
    if (op === 'end') {
      if (!me.host) return { ok: false, error: 'Only the host can end the meeting.' };
      Object.keys(room.peers).forEach(o => { if (o !== pid) pushMsg_(c, o, { from: pid, type: 'ended' }); });
      saveRoom_(c, { peers: {}, denied: {}, ended: true });
      return { ok: true };
    }
    return { ok: false, error: 'Unknown request.' };
  } finally {
    lock.releaseLock();
  }
}

// ---------- Admin: codes ----------

function meetCodesList_() {
  const sh = meetsSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { ok: true, codes: [] };
  const n = Math.min(100, last - 1);
  const rows = sh.getRange(last - n + 1, 1, n, MEET_HEADERS.length).getDisplayValues().reverse();
  return { ok: true, page: loadConfig_().settings.fmPage,
    codes: rows.map(r => ({ code: r[0], title: r[1], booking: r[2], opens: r[3], closes: r[4], status: r[5], last: r[8], joins: r[9] })) };
}

function adminNewMeetCode_(p) {
  const title = clean_(p.title, 120) || 'Fenil Meet';
  const date = clean_(p.date, 10), start = parseTime_(clean_(p.start, 8));
  const hours = Math.max(1, Math.min(num_(p.hours, 2), 72));
  let opens;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && start !== null) opens = slotMs_(date, start) - 15 * 60000;
  else opens = Date.now();
  const code = createMeetCode_(title, '', opens, opens + hours * 3600000 + 15 * 60000, 'Owner');
  return { ok: true, code: code, page: loadConfig_().settings.fmPage, opens: istStamp_(opens), closes: istStamp_(opens + hours * 3600000 + 15 * 60000) };
}

function adminCancelMeetCode_(p) {
  const m = findMeetCode_(normCode_(p.code));
  if (!m) return { ok: false, error: 'Code not found.' };
  meetsSheet_().getRange(m.row, MC.STATUS + 1).setValue('Cancelled');
  saveRoom_(m.v[MC.CODE], { peers: {}, denied: {}, ended: true });
  return { ok: true };
}

  return {
    doGet: (typeof doGet === "function" ? doGet : undefined),
    doPost: (typeof doPost === "function" ? doPost : undefined),
    onOpen: (typeof onOpen === "function" ? onOpen : undefined),
    setupSheets: (typeof setupSheets === "function" ? setupSheets : undefined),
    connectZoho: (typeof connectZoho === "function" ? connectZoho : undefined),
    sendTestEmail: (typeof sendTestEmail === "function" ? sendTestEmail : undefined),
    enableReminders: (typeof enableReminders === "function" ? enableReminders : undefined),
    previewSlots: (typeof previewSlots === "function" ? previewSlots : undefined),
    setOwnerPassword: (typeof setOwnerPassword === "function" ? setOwnerPassword : undefined),
    showCalendarLink: (typeof showCalendarLink === "function" ? showCalendarLink : undefined),
    syncCalendarNow: (typeof syncCalendarNow === "function" ? syncCalendarNow : undefined),
    resetCalendarLink: (typeof resetCalendarLink === "function" ? resetCalendarLink : undefined),
    sendReminders: (typeof sendReminders === "function" ? sendReminders : undefined),
    admin_: (typeof admin_ === "function" ? admin_ : undefined)
  };
}).apply(null, env_('BOOK', 'book'));


/* ################################################################## *
 *  IQ  —  original code, unchanged except where noted
 *  (opens FPS.SHEETS.iq; settings/cache/triggers prefixed "IQ.")
 * ################################################################## */
const IQ = (function (SpreadsheetApp, PropertiesService, CacheService, ScriptApp) {
/***********************************************************************
 *  iq.fenilpshah.com — Proctored IQ Assessment · BACKEND (Apps Script)
 *  ---------------------------------------------------------------------
 *  Bind this script to a Google Sheet (Extensions → Apps Script).
 *  Run  setup()  once, then Deploy → Web app
 *      Execute as: Me   ·   Who has access: Anyone
 *  Paste the /exec URL into API_URL inside index.html.
 *
 *  Sheets created automatically:
 *    Students   – StudentID, Password, Name, Email, Status, Attempts, LastLogin
 *    Questions  – the item bank + answer key (NEVER sent to the browser)
 *    Sessions   – one row per test attempt (live state)
 *    Violations – every proctoring flag with timestamp
 *    Results    – final scores, PDF link, webcam-snapshot folder link
 ***********************************************************************/

const CONFIG = {
  TITLE: 'IQ Assessment',
  ADMIN_EMAIL: 'fenil@fenilpshah.com',     // receives every report (admin copy with answer review)
  REPLY_TO: 'office@fenilpshah.com',
  SENDER_NAME: 'IQ Assessment · fenilpshah.com',
  EMAIL_STUDENT: true,                      // also email the candidate their report
  TEST_MINUTES: 30,
  GRACE_SECONDS: 30,                        // network grace after the deadline
  MAX_VIOLATIONS: 5,                        // test auto-terminates at this many flags
  MAX_ATTEMPTS: 1,                          // attempts allowed per Student ID
  LOGIN_FAIL_LIMIT: 5,                      // wrong passwords before temporary lock
  LOGIN_LOCK_MIN: 15,
  SNAPSHOT_FOLDER: 'IQ Test - Proctor Snapshots',
  REPORT_FOLDER: 'IQ Test - Reports',
  TZ: 'Asia/Kolkata'
};

const SH = { STUDENTS: 'Students', QUESTIONS: 'Questions', SESSIONS: 'Sessions', VIOLATIONS: 'Violations', RESULTS: 'Results' };

const HEADERS = {
  Students:   ['StudentID', 'Password', 'Name', 'Email', 'Status', 'Attempts', 'LastLogin'],
  Questions:  ['QID', 'Category', 'Question', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'Answer', 'Difficulty'],
  Sessions:   ['Token', 'StudentID', 'StartedAt', 'Deadline', 'QuestionOrder', 'Answers', 'Violations', 'Status', 'UserAgent', 'LastSeen'],
  Violations: ['Time', 'StudentID', 'Token', 'Type', 'Detail'],
  Results:    ['SubmittedAt', 'StudentID', 'Name', 'Email', 'Correct', 'Total', 'Score %', 'IndicativeIQ', 'Band', 'Flags', 'DurationMin', 'Completion', 'ReportPDF', 'WebcamSnapshots']
};

const VLABEL = {
  tab_switch: 'Switched tab / minimised window',
  focus_lost: 'Focus moved to another window',
  fullscreen_exit: 'Exited fullscreen',
  clipboard: 'Copy / cut / paste attempt',
  blocked_shortcut: 'Restricted keyboard shortcut',
  screenshot_attempt: 'Screenshot attempt',
  devtools: 'Developer tools suspected',
  camera_off: 'Camera disconnected',
  camera_covered: 'Camera covered or too dark',
  second_display: 'Additional display connected',
  screen_share_stopped: 'Stopped screen sharing',
  session_resumed: 'Session re-entered (refresh / new device)',
  other: 'Other proctoring event'
};

const END_LABEL = {
  submitted: 'Submitted by candidate',
  time_up: 'Time limit reached',
  time_expired: 'Session expired (window closed)',
  terminated: 'Terminated: proctoring flag limit reached'
};

/* ------------------------------------------------------------------ *
 *  QUESTION BANK (seeded into the Questions sheet by setup)
 *  [QID, Category, Question, A, B, C, D, Answer, Difficulty 1-3]
 * ------------------------------------------------------------------ */
const QUESTION_BANK = [
  ['Q01', 'Numerical', 'What number comes next?  2, 6, 12, 20, 30, ?', '40', '42', '44', '36', 'B', 1],
  ['Q02', 'Numerical', 'What number comes next?  3, 5, 9, 17, 33, ?', '64', '65', '66', '63', 'B', 1],
  ['Q03', 'Numerical', 'What number comes next?  1, 1, 2, 3, 5, 8, 13, ?', '18', '20', '21', '26', 'C', 1],
  ['Q04', 'Numerical', 'What number comes next?  7, 10, 16, 25, 37, ?', '49', '50', '52', '54', 'C', 2],
  ['Q05', 'Numerical', 'What number comes next?  2, 3, 5, 7, 11, 13, ?', '15', '17', '19', '16', 'B', 1],
  ['Q06', 'Numerical', 'What number comes next?  4, 9, 25, 49, 121, ?', '144', '169', '196', '225', 'B', 2],
  ['Q07', 'Numerical', 'What number comes next?  1, 4, 27, 256, ?', '625', '1024', '3125', '3025', 'C', 3],
  ['Q08', 'Quantitative', 'A train covers 120 km in 1.5 hours. At the same speed, how far will it travel in 2 hours 15 minutes?', '160 km', '170 km', '180 km', '200 km', 'C', 1],
  ['Q09', 'Quantitative', 'If 5 machines make 5 widgets in 5 minutes, how long would 100 machines take to make 100 widgets?', '100 minutes', '20 minutes', '5 minutes', '1 minute', 'C', 2],
  ['Q10', 'Quantitative', 'A price is increased by 20% and then the new price is decreased by 20%. What is the overall change?', 'No change', '4% decrease', '4% increase', '2% decrease', 'B', 2],
  ['Q11', 'Quantitative', 'What is three-eighths of two-thirds of 96?', '18', '24', '32', '36', 'B', 1],
  ['Q12', 'Quantitative', 'A father and son have a combined age of 50. In 5 years the father will be three times as old as the son. How old is the son now?', '8', '10', '12', '15', 'B', 2],
  ['Q13', 'Logical', 'All bloops are razzies. All razzies are lazzies. Which statement must be true?', 'All lazzies are bloops', 'All bloops are lazzies', 'Some razzies are not bloops', 'No bloops are lazzies', 'B', 1],
  ['Q14', 'Logical', 'Some doctors are musicians. All musicians are artists. Which statement must be true?', 'Some doctors are artists', 'All artists are doctors', 'All doctors are artists', 'No musician is a doctor', 'A', 2],
  ['Q15', 'Logical', 'Ravi is taller than Meera. Meera is taller than Arjun. Arjun is taller than Kiran. Who is the second shortest?', 'Ravi', 'Meera', 'Arjun', 'Kiran', 'C', 1],
  ['Q16', 'Logical', 'If it rains, the match is cancelled. The match was not cancelled. What can be concluded?', 'It rained', 'It did not rain', 'The match was played indoors', 'Nothing can be concluded', 'B', 2],
  ['Q17', 'Logical', 'In a race, you overtake the runner in second place. What position are you in now?', 'First', 'Second', 'Third', 'Cannot be determined', 'B', 1],
  ['Q18', 'Logical', 'What is the smaller angle between the hour and minute hands of a clock at 3:15?', '0 degrees', '7.5 degrees', '15 degrees', '22.5 degrees', 'B', 3],
  ['Q19', 'Coding', 'In a certain code, CAT is written as DBU. How is DOG written in that code?', 'EPH', 'CNF', 'EPG', 'FQI', 'A', 1],
  ['Q20', 'Coding', 'If MONDAY is written as NPOEBZ, how is FRIDAY written?', 'GSJEBZ', 'GSKEBZ', 'ESHCZX', 'GTJEBZ', 'A', 2],
  ['Q21', 'Verbal', 'Book is to Reading as Fork is to:', 'Drawing', 'Writing', 'Eating', 'Stirring', 'C', 1],
  ['Q22', 'Verbal', 'Which word is most nearly OPPOSITE in meaning to ABUNDANT?', 'Plentiful', 'Scarce', 'Ample', 'Copious', 'B', 1],
  ['Q23', 'Verbal', 'Which word does not belong with the others?', 'Apple', 'Mango', 'Carrot', 'Banana', 'C', 1],
  ['Q24', 'Verbal', 'Ocean is to Drop as Desert is to:', 'Sand', 'Grain', 'Dune', 'Cactus', 'B', 2],
  ['Q25', 'Verbal', 'Which word is an exact anagram of TRIANGLE?', 'INTEGRAL', 'TANGIBLE', 'LEARNING', 'RECTANGLE', 'A', 2],
  ['Q26', 'Spatial', 'A cube painted red on every face is cut into 27 equal smaller cubes. How many small cubes have exactly two red faces?', '6', '8', '12', '24', 'C', 3],
  ['Q27', 'Pattern', 'What comes next?  AZ, BY, CX, DW, ?', 'EV', 'EW', 'FV', 'DV', 'A', 1],
  ['Q28', 'Pattern', 'What letter comes next?  B, E, I, N, ?', 'S', 'T', 'U', 'R', 'B', 2],
  ['Q29', 'Spatial', 'In a mirror, a wall clock appears to show 3:40. What is the actual time?', '8:20', '9:20', '8:40', '3:20', 'A', 3],
  ['Q30', 'Pattern', 'Which number is the odd one out?  27, 64, 125, 144', '27', '64', '125', '144', 'D', 1]
];

/* ================================================================== *
 *  WEB API
 * ================================================================== */
/** Opening the web-app link shows the test page (file "Exam" in this Apps Script project). */
function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return json_({ ok: true, service: 'IQ Assessment API', time: new Date().toISOString() });
  return HtmlService.createHtmlOutputFromFile('Exam')
    .setTitle('IQ Assessment · Fenil P. Shah')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }
  try {
    switch (req.action) {
      case 'login':     return json_(login_(req));
      case 'start':     return json_(start_(req));
      case 'answer':    return json_(answer_(req));
      case 'violation': return json_(violation_(req));
      case 'snapshot':  return json_(snapshot_(req));
      case 'heartbeat': return json_(heartbeat_(req));
      case 'submit':    return json_(submit_(req));
      default:          return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Server busy. Please try again.' });
  }
}

/* ---------- login: verify credentials, issue a short-lived auth key ---------- */
function login_(req) {
  const id = String(req.studentId || '').trim().toUpperCase();
  const pw = String(req.password || '');
  if (!id || !pw) return { ok: false, error: 'Enter your Student ID and password.' };

  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + id;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= CONFIG.LOGIN_FAIL_LIMIT) {
    return { ok: false, error: 'Too many failed attempts. Try again in ' + CONFIG.LOGIN_LOCK_MIN + ' minutes.' };
  }

  const st = student_(id);
  if (!st || st.password !== pw) {
    cache.put(failKey, String(fails + 1), CONFIG.LOGIN_LOCK_MIN * 60);
    return { ok: false, error: 'Invalid Student ID or password.' };
  }
  cache.remove(failKey);
  if (st.status === 'Blocked') return { ok: false, error: 'Your access has been disabled. Contact the administrator.' };

  const active = activeSession_(id);
  if (!active && st.attempts >= CONFIG.MAX_ATTEMPTS) {
    return { ok: false, error: 'You have already completed this assessment. Contact the administrator if this is an error.' };
  }

  const auth = Utilities.getUuid();
  cache.put('auth_' + auth, id, 1800);
  return {
    ok: true, auth: auth, studentId: id, name: st.name,
    minutes: CONFIG.TEST_MINUTES, total: Object.keys(questionsMap_()).length,
    maxViolations: CONFIG.MAX_VIOLATIONS, resumable: !!active
  };
}

/* ---------- start: create (or resume) the timed session ---------- */
function start_(req) {
  const id = CacheService.getScriptCache().get('auth_' + String(req.auth || ''));
  if (!id) return { ok: false, error: 'Your login has expired. Please sign in again.' };

  let expiredToken = null, termToken = null;
  const out = withLock_(() => {
    const active = activeSession_(id);
    if (active) {
      if (Date.now() < active.deadline) {
        const over = addViolation_(active, 'session_resumed', 'Re-entered an active session (refresh, crash or new device)');
        if (over) { termToken = active.token; return { ok: false, error: 'This session was ended: the proctoring flag limit was reached.' }; }
        return payload_(active, true);
      }
      expiredToken = active.token;
      return { ok: false, error: 'Your time for this assessment has ended. Your report is being prepared.' };
    }

    const st = student_(id);
    if (!st || st.status === 'Blocked') return { ok: false, error: 'Access denied.' };
    if (st.attempts >= CONFIG.MAX_ATTEMPTS) return { ok: false, error: 'You have already completed this assessment.' };

    const qmap = questionsMap_();
    const order = shuffle_(Object.keys(qmap));
    if (!order.length) return { ok: false, error: 'The assessment is not configured yet.' };

    sh_(SH.STUDENTS).getRange(st.row, 6, 1, 2).setValues([[st.attempts + 1, new Date()]]);
    const now = new Date();
    const deadline = new Date(now.getTime() + CONFIG.TEST_MINUTES * 60000);
    const token = Utilities.getUuid();
    sh_(SH.SESSIONS).appendRow([token, id, now, deadline, JSON.stringify(order), '{}', 0, 'InProgress', String(req.ua || '').slice(0, 300), now]);
    const fresh = getSession_(token);
    sessionFolder_(fresh, true);   // create the evidence folder once, up front
    return payload_(fresh, false, qmap);
  });

  if (expiredToken) finalize_(expiredToken, 'time_expired');
  if (termToken) finalize_(termToken, 'terminated');
  return out;
}

/* ---------- answer: save one response ---------- */
function answer_(req) {
  return withLock_(() => {
    const s = getSession_(req.token);
    const bad = live_(s); if (bad) return bad;
    const qid = String(req.qid || '');
    if (s.order.indexOf(qid) < 0) return { ok: false, error: 'Invalid question.' };
    const c = String(req.choice || '').toUpperCase();
    if (c && ['A', 'B', 'C', 'D'].indexOf(c) < 0) return { ok: false, error: 'Invalid option.' };
    if (c) s.answers[qid] = c; else delete s.answers[qid];
    const sh = sh_(SH.SESSIONS);
    sh.getRange(s.row, 6).setValue(JSON.stringify(s.answers));
    sh.getRange(s.row, 10).setValue(new Date());
    return { ok: true };
  });
}

/* ---------- violation: record a proctoring flag ---------- */
function violation_(req) {
  const type = VLABEL[req.type] ? req.type : 'other';
  let term = false;
  const out = withLock_(() => {
    const s = getSession_(req.token);
    const bad = live_(s); if (bad) return bad;
    term = addViolation_(s, type, req.detail);
    return { ok: true, count: s.violations, terminated: term };
  });
  if (term) finalize_(req.token, 'terminated');
  return out;
}

/* ---------- snapshot: store a webcam frame or a screen capture in Drive ---------- */
function snapshot_(req) {
  const s = getSession_(req.token);
  if (!s) return { ok: false };
  if (s.status !== 'InProgress' && req.tag !== 'final') return { ok: false, ended: true };
  const m = /^data:image\/jpeg;base64,(.+)$/.exec(String(req.image || ''));
  if (!m || m[1].length > 1500000) return { ok: false, error: 'Bad image' };
  const kind = req.kind === 'screen' ? 'screen' : 'cam';
  const tag = String(req.tag || 'periodic').replace(/[^a-z_]/gi, '').slice(0, 30);
  const name = Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyyMMdd-HHmmss') + '_' + kind + '_' + tag + '.jpg';
  sessionFolder_(s, true).createFile(Utilities.newBlob(Utilities.base64Decode(m[1]), 'image/jpeg', name));
  return { ok: true };
}

/* ---------- heartbeat: keep-alive + clock sync ---------- */
function heartbeat_(req) {
  return withLock_(() => {
    const s = getSession_(req.token);
    const bad = live_(s); if (bad) return bad;
    sh_(SH.SESSIONS).getRange(s.row, 10).setValue(new Date());
    return { ok: true, violations: s.violations, remaining: s.deadline - Date.now() };
  });
}

/* ---------- submit: merge final answers, then score + report ---------- */
function submit_(req) {
  const reason = ['submitted', 'time_up'].indexOf(req.reason) >= 0 ? req.reason : 'submitted';
  if (req.answers && typeof req.answers === 'object') {
    withLock_(() => {
      const s = getSession_(req.token);
      if (!s || s.status !== 'InProgress') return;
      if (Date.now() > s.deadline + CONFIG.GRACE_SECONDS * 1000) return;   // late answers ignored
      const clean = {};
      s.order.forEach(q => {
        const c = String(req.answers[q] || '').toUpperCase();
        if (['A', 'B', 'C', 'D'].indexOf(c) >= 0) clean[q] = c;
      });
      sh_(SH.SESSIONS).getRange(s.row, 6).setValue(JSON.stringify(clean));
    });
  }
  return finalize_(req.token, reason);
}

/* ================================================================== *
 *  SCORING, PDF REPORT & EMAIL
 * ================================================================== */
function finalize_(token, reason) {
  const claim = withLock_(() => {
    const s = getSession_(token);
    if (!s) return { err: { ok: false, error: 'Session not found.' } };
    if (s.status !== 'InProgress') return { err: { ok: true, already: true } };
    sh_(SH.SESSIONS).getRange(s.row, 8).setValue('Scoring');
    return { s: s };
  });
  if (claim.err) return claim.err;

  const s = claim.s;
  const st = student_(s.studentId) || { name: s.studentId, email: '' };
  const qmap = questionsMap_();
  const r = score_(s, qmap);
  const flags = violationsFor_(token);
  const endMs = reason === 'time_expired' ? s.deadline : Math.min(Date.now(), s.deadline);
  const mins = Math.round((endMs - s.started) / 6000) / 10;

  let pdfUrl = '', folderUrl = '', emailed = false;
  try {
    const ctx = { s: s, st: st, r: r, flags: flags, reason: reason, mins: mins, photo: firstPhoto_(s), screens: screenShots_(s, 4) };
    const integ = integrity_(reason, flags.length);

    const adminPdf = pdf_(reportHtml_(ctx, true), 'IQ Report - ' + s.studentId + ' - ' + st.name + ' (admin).pdf');
    pdfUrl = folder_('REPORT_FOLDER', CONFIG.REPORT_FOLDER).createFile(adminPdf).getUrl();
    const sf = sessionFolder_(s, false);
    if (sf) folderUrl = sf.getUrl();

    sendMail_({
      to: CONFIG.ADMIN_EMAIL,
      subject: '[IQ] ' + st.name + ' (' + s.studentId + ') · IQ ' + r.iq + ' · ' + flags.length + ' flag(s) · ' + integ[0],
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f1b2d">' +
        '<p><b>' + esc_(st.name) + '</b> (' + esc_(s.studentId) + ') has finished the IQ assessment.</p><ul>' +
        '<li>Indicative IQ: <b>' + r.iq + '</b> (' + r.band + ')</li>' +
        '<li>Correct: ' + r.correct + ' / ' + r.total + ' · attempted ' + r.answered + '</li>' +
        '<li>Proctoring flags: ' + flags.length + ' · <b style="color:' + integ[1] + '">' + integ[0] + '</b></li>' +
        '<li>Completion: ' + (END_LABEL[reason] || reason) + ' · ' + mins + ' min</li></ul>' +
        '<p><a href="' + pdfUrl + '">Report in Drive</a>' + (folderUrl ? ' · <a href="' + folderUrl + '">Webcam snapshots</a>' : '') + '</p></div>',
      attachments: [adminPdf], name: CONFIG.SENDER_NAME, replyTo: CONFIG.REPLY_TO
    });

    if (CONFIG.EMAIL_STUDENT && /@/.test(st.email || '')) {
      const studentPdf = pdf_(reportHtml_(ctx, false), 'IQ Assessment Report - ' + st.name + '.pdf');
      sendMail_({
        to: st.email,
        subject: 'Your ' + CONFIG.TITLE + ' Report',
        htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f1b2d;line-height:1.6">' +
          '<p>Dear ' + esc_(st.name) + ',</p><p>Thank you for completing the ' + CONFIG.TITLE + '. Your detailed report is attached.</p>' +
          '<p>Indicative IQ: <b>' + r.iq + '</b> · ' + r.band + '</p>' +
          '<p style="color:#667085;font-size:12px">This indicative score is for educational purposes and is not a clinical or diagnostic assessment. For any questions, simply reply to this email.</p>' +
          '<p>Regards,<br>fenilpshah.com</p></div>',
        attachments: [studentPdf], name: CONFIG.SENDER_NAME, replyTo: CONFIG.REPLY_TO
      });
      emailed = true;
    }
  } catch (err) {
    console.error('Report/email failed for ' + token + ': ' + err);
  }

  withLock_(() => {
    sh_(SH.RESULTS).appendRow([new Date(), s.studentId, st.name, st.email, r.correct, r.total,
      Math.round(r.pct * 1000) / 10, r.iq, r.band, flags.length, mins, END_LABEL[reason] || reason, pdfUrl, folderUrl]);
    sh_(SH.SESSIONS).getRange(s.row, 8).setValue(reason === 'terminated' ? 'Terminated' : 'Completed');
  });
  return { ok: true, emailed: emailed, reason: reason };
}

function score_(s, qmap) {
  let correct = 0, total = 0, w = 0, wMax = 0;
  const cats = {}, review = [];
  s.order.forEach((id, i) => {
    const q = qmap[id]; if (!q) return;
    total++; wMax += q.difficulty;
    const a = s.answers[id] || '';
    const ok = a === q.answer;
    if (ok) { correct++; w += q.difficulty; }
    const c = cats[q.category] = cats[q.category] || { c: 0, t: 0 };
    c.t++; if (ok) c.c++;
    review.push({ n: i + 1, id: id, cat: q.category, a: a, key: q.answer, ok: ok });
  });
  const pct = wMax ? w / wMax : 0;
  let iq = Math.round(100 + 15 * (pct - 0.5) / 0.17);
  iq = Math.max(70, Math.min(145, iq));
  return { correct: correct, total: total, pct: pct, iq: iq, band: band_(iq), percentile: percentile_(iq),
           cats: cats, review: review, answered: Object.keys(s.answers).length };
}

function band_(iq) {
  if (iq >= 130) return 'Exceptional';
  if (iq >= 120) return 'Superior';
  if (iq >= 110) return 'High average';
  if (iq >= 90)  return 'Average';
  if (iq >= 80)  return 'Low average';
  return 'Below average';
}

function percentile_(iq) {
  const z = (iq - 100) / 15, t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  p = z > 0 ? 1 - p : p;
  return Math.max(1, Math.min(99, Math.round(p * 100)));
}

function integrity_(reason, n) {
  if (reason === 'terminated') return ['Terminated', '#b42318'];
  if (n === 0) return ['Clean', '#1f7a4d'];
  if (n <= 2) return ['Minor flags', '#b54708'];
  return ['Review required', '#b42318'];
}

function ordinal_(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function reportHtml_(x, admin) {
  const s = x.s, st = x.st, r = x.r, flags = x.flags, reason = x.reason;
  const fmt = (v, p) => Utilities.formatDate(new Date(v), CONFIG.TZ, p || 'dd MMM yyyy, HH:mm');
  const integ = integrity_(reason, flags.length);

  const cats = Object.keys(r.cats).map(k => {
    const c = r.cats[k], p = Math.round(c.c / c.t * 100), fill = Math.max(p, 1);
    return '<tr><td>' + esc_(k) + '</td><td>' + c.c + ' / ' + c.t + '</td>' +
      '<td><table class="bar"><tr><td style="width:' + fill + '%;background:#b0812a"></td><td style="width:' + (100 - fill) + '%"></td></tr></table></td>' +
      '<td>' + p + '%</td></tr>';
  }).join('');

  const flagRows = flags.length
    ? flags.map(f => '<tr><td>' + fmt(f.time, 'HH:mm:ss') + '</td><td>' + esc_(VLABEL[f.type] || f.type) + '</td><td class="mut">' + esc_(f.detail) + '</td></tr>').join('')
    : '<tr><td colspan="3" class="mut">No proctoring flags were recorded.</td></tr>';

  const reviewRows = admin ? r.review.map(v =>
    '<tr><td>' + v.n + '</td><td>' + v.id + '</td><td>' + esc_(v.cat) + '</td><td>' + (v.a || '-') + '</td><td>' + v.key + '</td>' +
    '<td style="color:' + (v.ok ? '#1f7a4d' : '#b42318') + '">' + (v.ok ? 'Correct' : (v.a ? 'Incorrect' : 'Unanswered')) + '</td></tr>').join('') : '';

  const pct = r.percentile, ord = ordinal_(pct);
  return '<html><head><style>' +
    'body{font-family:Helvetica,Arial,sans-serif;color:#0f1b2d;font-size:11pt;margin:0}' +
    '.hd{background:#0f1b2d;color:#fff;padding:22px 28px}.hd .k{color:#d9b46a;font-size:8.5pt;letter-spacing:2px;text-transform:uppercase}' +
    '.hd h1{font-family:Georgia,serif;font-size:22pt;margin:6px 0 0;font-weight:normal}.wrap{padding:18px 28px}' +
    'h2{font-family:Georgia,serif;font-size:13pt;font-weight:normal;border-bottom:1px solid #e4dfd4;padding-bottom:5px;margin:20px 0 10px}' +
    'table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;font-size:10pt;text-align:left;vertical-align:top}' +
    'th{background:#f3f0e9;font-size:9pt}.grid td{border-bottom:1px solid #eeeae2}.mut{color:#667085}' +
    '.big{font-family:Georgia,serif;font-size:36pt;line-height:1.1}.box{border:1px solid #e4dfd4;padding:14px;text-align:center;vertical-align:middle}' +
    '.lbl{font-size:8pt;color:#667085;text-transform:uppercase;letter-spacing:1px}.bar td{height:9px;padding:0;background:#efece5}' +
    '.note{font-size:8.5pt;color:#667085;margin-top:22px;border-top:1px solid #e4dfd4;padding-top:10px}' +
    '</style></head><body>' +
    '<div class="hd"><div class="k">fenilpshah.com · ' + (admin ? 'Administrator copy · Confidential' : 'Candidate report') + '</div><h1>' + CONFIG.TITLE + ' Report</h1></div>' +
    '<div class="wrap"><table><tr><td style="width:74%;padding:0"><table class="grid">' +
    '<tr><td class="mut" style="width:32%">Candidate</td><td><b>' + esc_(st.name) + '</b></td></tr>' +
    '<tr><td class="mut">Student ID</td><td>' + esc_(s.studentId) + '</td></tr>' +
    '<tr><td class="mut">Date</td><td>' + fmt(s.started) + ' IST</td></tr>' +
    '<tr><td class="mut">Time taken</td><td>' + x.mins + ' of ' + CONFIG.TEST_MINUTES + ' minutes</td></tr>' +
    '<tr><td class="mut">Completion</td><td>' + esc_(END_LABEL[reason] || reason) + '</td></tr></table></td>' +
    '<td style="width:26%;text-align:right">' + (x.photo ? '<img src="' + x.photo + '" style="width:132px;height:99px;border:1px solid #e4dfd4"><div class="mut" style="font-size:7.5pt">Proctor capture</div>' : '') + '</td></tr></table>' +
    '<h2>Result</h2><table><tr>' +
    '<td class="box" style="width:32%"><div class="lbl">Indicative IQ</div><div class="big">' + r.iq + '</div><div>' + r.band + '</div></td><td style="width:2%"></td>' +
    '<td class="box" style="width:32%"><div class="lbl">Percentile (est.)</div><div class="big">' + ord + '</div><div class="mut">general population</div></td><td style="width:2%"></td>' +
    '<td class="box" style="width:32%"><div class="lbl">Correct answers</div><div class="big">' + r.correct + '/' + r.total + '</div><div class="mut">' + r.answered + ' attempted</div></td>' +
    '</tr></table>' +
    '<h2>Performance by reasoning area</h2><table class="grid"><tr><th>Area</th><th>Correct</th><th style="width:45%"></th><th>Accuracy</th></tr>' + cats + '</table>' +
    '<h2>Proctoring &amp; integrity</h2><table class="grid">' +
    '<tr><td class="mut" style="width:30%">Integrity status</td><td><b style="color:' + integ[1] + '">' + integ[0] + '</b></td></tr>' +
    '<tr><td class="mut">Proctoring flags</td><td>' + flags.length + ' (limit ' + CONFIG.MAX_VIOLATIONS + ')</td></tr>' +
    '<tr><td class="mut">Safeguards</td><td>Fullscreen lock, tab and focus monitoring, copy-paste and shortcut blocking, webcam snapshots, single attempt, server-side timing and scoring</td></tr></table>' +
    '<table class="grid" style="margin-top:8px"><tr><th style="width:16%">Time</th><th style="width:36%">Event</th><th>Detail</th></tr>' + flagRows + '</table>' +
    (admin && x.screens && x.screens.length ? '<h2>Screen captures at flagged moments</h2><table><tr>' +
      x.screens.map((im, i) => (i && i % 2 === 0 ? '</tr><tr>' : '') +
        '<td style="width:50%;text-align:center"><img src="' + im.src + '" style="width:300px;border:1px solid #e4dfd4"><div class="mut" style="font-size:7.5pt">' + esc_(im.name) + '</div></td>').join('') +
      '</tr></table>' : '') +
    (admin ? '<h2>Answer review</h2><table class="grid"><tr><th>#</th><th>QID</th><th>Area</th><th>Response</th><th>Key</th><th>Result</th></tr>' + reviewRows + '</table>' : '') +
    '<div class="note">The indicative IQ is estimated from performance on a ' + r.total + '-item timed reasoning assessment, weighted by item difficulty. ' +
    'It is intended for educational purposes only and is not a clinically normed or diagnostic IQ test. Report ID: ' + s.token + ' · Generated ' + fmt(new Date()) + ' IST.</div>' +
    '</div></body></html>';
}

function pdf_(html, name) {
  return Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf').setName(name);
}

function firstPhoto_(s) {
  try {
    const f = sessionFolder_(s, false); if (!f) return '';
    const files = f.getFiles(); let best = null;
    while (files.hasNext()) {
      const x = files.next();
      if (x.getName().indexOf('_cam_') < 0) continue;
      if (!best || x.getName() < best.getName()) best = x;
    }
    return best ? 'data:image/jpeg;base64,' + Utilities.base64Encode(best.getBlob().getBytes()) : '';
  } catch (e) { return ''; }
}

/** Up to `max` screen captures, preferring the ones taken at proctoring flags. */
function screenShots_(s, max) {
  try {
    const f = sessionFolder_(s, false); if (!f) return [];
    const files = f.getFiles(), list = [];
    while (files.hasNext()) { const x = files.next(); if (x.getName().indexOf('_screen_') > 0) list.push(x); }
    list.sort((a, b) => (a.getName() < b.getName() ? -1 : 1));
    const flagged = list.filter(x => !/_screen_(periodic|start|final)/.test(x.getName()));
    return (flagged.length ? flagged : list).slice(0, max)
      .map(x => ({ name: x.getName(), src: 'data:image/jpeg;base64,' + Utilities.base64Encode(x.getBlob().getBytes()) }));
  } catch (e) { return []; }
}

/* ================================================================== *
 *  DATA HELPERS
 * ================================================================== */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sh_(n) { return ss_().getSheetByName(n); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function shuffle_(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

function student_(id) {
  const sh = sh_(SH.STUDENTS), n = sh.getLastRow(); if (n < 2) return null;
  const v = sh.getRange(2, 1, n - 1, 7).getValues();
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toUpperCase() === id) {
      return { row: i + 2, id: id, password: String(v[i][1]), name: String(v[i][2] || id), email: String(v[i][3] || '').trim(),
               status: String(v[i][4] || 'Active'), attempts: Number(v[i][5] || 0) };
    }
  }
  return null;
}

function questionsMap_() {
  const sh = sh_(SH.QUESTIONS), n = sh.getLastRow(), map = {}; if (n < 2) return map;
  sh.getRange(2, 1, n - 1, 9).getValues().forEach(r => {
    const id = String(r[0]).trim(); if (!id || !r[2]) return;
    map[id] = { qid: id, category: String(r[1] || 'General'), question: String(r[2]),
                options: [r[3], r[4], r[5], r[6]].map(x => String(x)),
                answer: String(r[7]).trim().toUpperCase(), difficulty: Math.max(1, Number(r[8]) || 1) };
  });
  return map;
}

function getSession_(token) {
  if (!token) return null;
  const sh = sh_(SH.SESSIONS), n = sh.getLastRow(); if (n < 2) return null;
  const f = sh.getRange(2, 1, n - 1, 1).createTextFinder(String(token)).matchEntireCell(true).findNext();
  if (!f) return null;
  const r = f.getRow(), v = sh.getRange(r, 1, 1, 10).getValues()[0];
  return { row: r, token: String(v[0]), studentId: String(v[1]), started: new Date(v[2]).getTime(), deadline: new Date(v[3]).getTime(),
           order: JSON.parse(v[4] || '[]'), answers: JSON.parse(v[5] || '{}'), violations: Number(v[6] || 0), status: String(v[7]) };
}

function activeSession_(id) {
  const sh = sh_(SH.SESSIONS), n = sh.getLastRow(); if (n < 2) return null;
  const v = sh.getRange(2, 1, n - 1, 8).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (String(v[i][1]).toUpperCase() === id && v[i][7] === 'InProgress') return getSession_(v[i][0]);
  }
  return null;
}

function live_(s) {
  if (!s) return { ok: false, ended: true, error: 'Session not found.' };
  if (s.status !== 'InProgress') return { ok: false, ended: true, error: 'This session has ended.' };
  if (Date.now() > s.deadline + CONFIG.GRACE_SECONDS * 1000) return { ok: false, ended: true, expired: true, error: 'Time is up.' };
  return null;
}

function payload_(s, resumed, qmap) {
  qmap = qmap || questionsMap_();
  const st = student_(s.studentId);
  return {
    ok: true, token: s.token, resumed: resumed, name: st ? st.name : '', studentId: s.studentId,
    deadline: s.deadline, serverNow: Date.now(), violations: s.violations, maxViolations: CONFIG.MAX_VIOLATIONS, answers: s.answers,
    questions: s.order.filter(id => qmap[id]).map(id => ({ qid: id, category: qmap[id].category, question: qmap[id].question, options: qmap[id].options }))
  };
}

function addViolation_(s, type, detail) {
  s.violations++;
  sh_(SH.SESSIONS).getRange(s.row, 7).setValue(s.violations);
  sh_(SH.VIOLATIONS).appendRow([new Date(), s.studentId, s.token, type, String(detail || '').slice(0, 200)]);
  return s.violations >= CONFIG.MAX_VIOLATIONS;
}

function violationsFor_(token) {
  const sh = sh_(SH.VIOLATIONS), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 5).getValues().filter(r => r[2] === token).map(r => ({ time: r[0], type: r[3], detail: r[4] }));
}

function folder_(key, name) {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(name); p.setProperty(key, f.getId()); return f;
}

function sessionFolder_(s, create) {
  const root = folder_('SNAP_FOLDER', CONFIG.SNAPSHOT_FOLDER);
  const name = s.studentId + '_' + s.token.slice(0, 8);
  const it = root.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return create ? root.createFolder(name) : null;
}

function randPw_() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; let s = '';
  for (let i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

/* ================================================================== *
 *  ADMIN: setup, menu, maintenance
 * ================================================================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('IQ Test')
    .addItem('Set up / repair', 'setup')
    .addItem('Generate missing passwords', 'generatePasswords')
    .addItem('Reset a student attempt', 'resetStudent')
    .addItem('Finalise expired sessions now', 'sweepExpired')
    .addSeparator()
    .addItem('Email: connect Zoho Mail', 'menuZohoConnect')
    .addItem('Email: which account is sending?', 'menuMailStatus')
    .addToUi();
}

function setup() {
  const ss = ss_();
  Object.keys(HEADERS).forEach(name => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]])
        .setFontWeight('bold').setBackground('#0f1b2d').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });

  const students = sh_(SH.STUDENTS);
  students.getRange('A:B').setNumberFormat('@');
  students.getRange('E2:E').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Active', 'Blocked'], true).build());
  if (students.getLastRow() < 2) students.appendRow(['IQ001', randPw_(), 'Sample Student', CONFIG.ADMIN_EMAIL, 'Active', 0, '']);

  const q = sh_(SH.QUESTIONS);
  q.getRange('A:H').setNumberFormat('@');
  if (q.getLastRow() < 2) q.getRange(2, 1, QUESTION_BANK.length, 9).setValues(QUESTION_BANK);

  folder_('SNAP_FOLDER', CONFIG.SNAPSHOT_FOLDER);
  folder_('REPORT_FOLDER', CONFIG.REPORT_FOLDER);

  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sweepExpired').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sweepExpired').timeBased().everyMinutes(5).create();

  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1 && s1.getLastRow() === 0) ss.deleteSheet(s1);

  try { SpreadsheetApp.getUi().alert('IQ Test is set up. Add students in the Students sheet, then use IQ Test → Generate missing passwords.'); } catch (e) {}
}

function generatePasswords() {
  const sh = sh_(SH.STUDENTS), n = sh.getLastRow(); if (n < 2) return;
  const rg = sh.getRange(2, 1, n - 1, 6), v = rg.getValues(); let made = 0;
  v.forEach(r => {
    if (!String(r[0]).trim()) return;
    r[0] = String(r[0]).trim().toUpperCase();
    if (!String(r[1]).trim()) { r[1] = randPw_(); made++; }
    if (!r[4]) r[4] = 'Active';
    if (r[5] === '') r[5] = 0;
  });
  rg.setValues(v);
  try { SpreadsheetApp.getUi().alert(made + ' password(s) generated.'); } catch (e) {}
}

function resetStudent() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Reset attempt', 'Enter the Student ID to allow one more attempt:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const id = res.getResponseText().trim().toUpperCase();
  const st = student_(id);
  if (!st) { ui.alert('Student ID not found.'); return; }
  withLock_(() => {
    sh_(SH.STUDENTS).getRange(st.row, 5, 1, 2).setValues([['Active', 0]]);
    const sh = sh_(SH.SESSIONS), n = sh.getLastRow();
    if (n >= 2) sh.getRange(2, 1, n - 1, 8).getValues().forEach((r, i) => {
      if (String(r[1]).toUpperCase() === id && r[7] === 'InProgress') sh.getRange(i + 2, 8).setValue('Cancelled');
    });
  });
  ui.alert(id + ' can now take the assessment again.');
}

/** Runs every 5 minutes: finalises sessions whose candidate closed the window. */
function sweepExpired() {
  const sh = sh_(SH.SESSIONS), n = sh.getLastRow(); if (n < 2) return;
  const cutoff = Date.now() - (CONFIG.GRACE_SECONDS + 60) * 1000;
  sh.getRange(2, 1, n - 1, 8).getValues().forEach(v => {
    if (v[7] === 'InProgress' && new Date(v[3]).getTime() < cutoff) finalize_(String(v[0]), 'time_expired');
  });
}

/* ================================================================== *
 *  EMAIL ROUTING: Zoho Mail first (when connected), Gmail as backup
 *  ------------------------------------------------------------------
 *  Every email goes out through sendMail_(). When Zoho Mail is
 *  connected, it is sent from your fenilpshah.com address through the
 *  Zoho Mail API. If Zoho fails (or is not connected), Gmail sends it.
 *
 *  Connect from the Sheet menu: IQ Test → Email: connect Zoho Mail.
 *  The client ID, secret and refresh token are kept in this script's
 *  private Script Properties, never in the code.
 * ================================================================== */
var ZOHO_PROP = 'ZOHO_MAIL';
var ZOHO_SCOPE = 'ZohoMail.messages.CREATE,ZohoMail.accounts.READ';
var ZOHO_REGIONS = {
  'in':     { label: 'India (zoho.in)',         accounts: 'https://accounts.zoho.in',     mail: 'https://mail.zoho.in',     console: 'https://api-console.zoho.in' },
  'com':    { label: 'Global (zoho.com)',       accounts: 'https://accounts.zoho.com',    mail: 'https://mail.zoho.com',    console: 'https://api-console.zoho.com' },
  'eu':     { label: 'Europe (zoho.eu)',        accounts: 'https://accounts.zoho.eu',     mail: 'https://mail.zoho.eu',     console: 'https://api-console.zoho.eu' },
  'com.au': { label: 'Australia (zoho.com.au)', accounts: 'https://accounts.zoho.com.au', mail: 'https://mail.zoho.com.au', console: 'https://api-console.zoho.com.au' }
};

function zohoCfg_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ZOHO_PROP) || 'null'); } catch (err) { return null; }
}
function zohoReady_() { var c = zohoCfg_(); return !!(c && c.refreshToken && c.accountId && c.from); }

/** Drop-in replacement for MailApp.sendEmail(o). Returns 'zoho' or 'gmail'. */
function sendMail_(o) {
  var zohoErr = null;
  if (zohoReady_()) {
    try { zohoSend_(o); return 'zoho'; } catch (err) { zohoErr = err; console.error('Zoho send failed, using Gmail: ' + err.message); }
  }
  try { MailApp.sendEmail(o); return 'gmail'; }
  catch (err) { throw new Error((zohoErr ? 'Zoho Mail failed (' + zohoErr.message + ') and ' : '') + 'Gmail failed: ' + err.message); }
}

function menuMailStatus() {
  var q = -1; try { q = MailApp.getRemainingDailyQuota(); } catch (err) {}
  var c = zohoCfg_();
  SpreadsheetApp.getUi().alert('Email sending',
    (zohoReady_() ? 'Zoho Mail is CONNECTED. Emails are sent from ' + c.from + ' (connected ' + (c.connectedAt || '') + ').\n\nBackup: '
                  : 'Zoho Mail is NOT connected. Emails are sent from ') +
    'Gmail (' + Session.getEffectiveUser().getEmail() + '), ' + (q < 0 ? 'unknown' : q) + ' email(s) left today.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function zohoToken_(force) {
  var cache = CacheService.getScriptCache();
  if (!force) { var hit = cache.get('zoho_at'); if (hit) return hit; }
  var c = zohoCfg_(); if (!c) throw new Error('Zoho Mail is not connected');
  var r = ZOHO_REGIONS[c.region] || ZOHO_REGIONS['in'];
  var res = UrlFetchApp.fetch(r.accounts + '/oauth/v2/token', { method: 'post', muteHttpExceptions: true,
    payload: { refresh_token: c.refreshToken, client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'refresh_token' } });
  var j = zJson_(res);
  if (!j.access_token) throw new Error('Zoho sign-in failed (' + (j.error || res.getResponseCode()) + ') - reconnect Zoho Mail from the menu');
  cache.put('zoho_at', j.access_token, Math.max(60, Math.min(21600, Number(j.expires_in || 3600) - 300)));
  return j.access_token;
}

/** Keeps under Zoho's 30 API calls per minute. */
function zohoPace_() {
  var cache = CacheService.getScriptCache();
  for (var tries = 0; tries < 3; tries++) {
    var k = 'zrate_' + Math.floor(Date.now() / 60000), n = Number(cache.get(k) || 0);
    if (n < 26) { cache.put(k, String(n + 1), 120); return; }
    Utilities.sleep(61000 - (Date.now() % 60000));
  }
}

function zohoCall_(method, path, opts) {
  var c = zohoCfg_(), r = ZOHO_REGIONS[c.region] || ZOHO_REGIONS['in'];
  for (var attempt = 0; attempt < 2; attempt++) {
    zohoPace_();
    var p = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Zoho-oauthtoken ' + zohoToken_(attempt > 0) } };
    for (var k in (opts || {})) p[k] = opts[k];
    var res = UrlFetchApp.fetch(r.mail + path, p), code = res.getResponseCode(), j = zJson_(res);
    if (code === 401 && attempt === 0) continue;   // token expired early - refresh once
    var st = j.status || {};
    if (code >= 200 && code < 300 && (!st.code || st.code === 200)) return j;
    var why = (j.data && (j.data.moreInfo || j.data.errorCode)) || st.description || ('HTTP ' + code);
    throw new Error('Zoho: ' + why);
  }
}

/** Sends one MailApp-style message ({to, subject, htmlBody|body, attachments}) through Zoho Mail. */
function zohoSend_(o) {
  var c = zohoCfg_();
  if (!c) throw new Error('Zoho Mail is not connected');
  var html = o.htmlBody || ('<div style="font-family:Arial,sans-serif;white-space:pre-wrap">' + esc_(o.body || '') + '</div>');
  var att = (o.attachments || []).map(function (b) {
    var j = zohoCall_('post', '/api/accounts/' + c.accountId + '/messages/attachments?fileName=' + encodeURIComponent(b.getName() || 'file'),
      { contentType: 'application/octet-stream', payload: b.getBytes() });
    var d = Array.isArray(j.data) ? j.data[0] : j.data;
    return { storeName: d.storeName, attachmentPath: d.attachmentPath, attachmentName: d.attachmentName };
  });
  var msg = { fromAddress: c.from, toAddress: o.to, subject: o.subject || '', content: html, mailFormat: 'html', askReceipt: 'no' };
  if (att.length) msg.attachments = att;
  zohoCall_('post', '/api/accounts/' + c.accountId + '/messages', { contentType: 'application/json', payload: JSON.stringify(msg) });
}

function zJson_(res) { try { return JSON.parse(res.getContentText()); } catch (err) { return {}; } }

/* ---------------- connect dialog (IQ Test → Email: connect Zoho Mail) ---------------- */
function menuZohoConnect() {
  var c = zohoCfg_(), regions = Object.keys(ZOHO_REGIONS).map(function (k) {
    return '<option value="' + k + '"' + ((c ? c.region : 'in') === k ? ' selected' : '') + '>' + ZOHO_REGIONS[k].label + '</option>'; }).join('');
  var consoleLinks = JSON.stringify(Object.keys(ZOHO_REGIONS).reduce(function (m, k) { m[k] = ZOHO_REGIONS[k].console; return m; }, {}));
  var status = zohoReady_()
    ? '<div class="st ok"><b>Connected.</b> Emails are sent from <b>' + esc_(c.from) + '</b> (since ' + esc_(c.connectedAt || '') + '). To change the account or address, connect again below.</div>'
    : '<div class="st no"><b>Not connected.</b> Emails are currently sent from Gmail. Follow the steps below to send them through Zoho Mail.</div>';
  var html =
    '<!doctype html><html><head><base target="_blank"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#0f1b2d;margin:0;padding:16px 18px 18px;font-size:13.5px;line-height:1.5}' +
    'h2{font-family:Georgia,serif;margin:0 0 8px;font-size:20px}' +
    '.st{border-radius:10px;padding:10px 12px;margin-bottom:12px}.st.ok{background:#E9F6EF;color:#1E5E3F}.st.no{background:#FFF5E1;color:#7A4A00}' +
    'ol{margin:6px 0 12px;padding-left:20px}ol li{margin-bottom:7px}' +
    '.scope{display:flex;gap:6px;margin:5px 0 2px}.scope input{flex:1;font-family:Consolas,monospace;font-size:12.5px;padding:7px 8px;border:1.5px solid #d8d2c4;border-radius:7px;background:#f6f4ef}' +
    'label{display:block;font-weight:bold;margin:10px 0 4px;font-size:12.5px}' +
    '.f{width:100%;box-sizing:border-box;padding:9px 10px;border:1.5px solid #d8d2c4;border-radius:8px;font-size:13.5px;font-family:Consolas,monospace}' +
    'button{background:#0f1b2d;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:bold;font-size:13px;cursor:pointer}' +
    'button.g{background:#fff;color:#0f1b2d;border:1.5px solid #0f1b2d}button.r{background:#fff;color:#b42318;border:1.5px solid #b42318}button:disabled{opacity:.5}' +
    '.row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}#out.ok{background:#E9F6EF;color:#1E5E3F;padding:10px 12px;border-radius:9px;margin-top:12px}' +
    '#out.err{background:#FBEDED;color:#8A2E2E;padding:10px 12px;border-radius:9px;margin-top:12px}.note{color:#667085;font-size:12px;margin-top:10px}' +
    '</style></head><body>' +
    '<h2>Send emails through Zoho Mail</h2>' + status +
    '<div><b>Steps</b> (sign in to Zoho with the mailbox you want to send from first):</div><ol>' +
    '<li>Zoho region: <select id="region" class="f" style="width:auto;display:inline-block;padding:4px 6px">' + regions + '</select> then open the <a id="consoleLink" href="#">Zoho API Console</a>.</li>' +
    '<li>Click <b>Add Client</b> (or <b>Get Started</b>), choose <b>Self Client</b>, click <b>Create</b>, then <b>OK</b>.</li>' +
    '<li>Open the <b>Client Secret</b> tab. Copy the <b>Client ID</b> and <b>Client Secret</b> into the boxes below.</li>' +
    '<li>Open the <b>Generate Code</b> tab:<br>&bull; <b>Scope</b>: paste exactly this' +
    '<div class="scope"><input id="scope" readonly value="' + ZOHO_SCOPE + '"><button type="button" class="g" id="copy">Copy</button></div>' +
    '&bull; <b>Time Duration</b>: 10 minutes &nbsp;&bull; <b>Scope Description</b>: IQ test emails<br>Click <b>Create</b> and copy the code it shows.</li>' +
    '<li>Paste the code below and click <b>Connect</b> within 10 minutes. A test email is sent to you.</li></ol>' +
    '<label for="cid">Client ID</label><input id="cid" class="f" autocomplete="off" spellcheck="false" placeholder="1000.XXXXXXXXXXXXXXXX">' +
    '<label for="sec">Client Secret</label><input id="sec" class="f" type="password" autocomplete="off" spellcheck="false">' +
    '<label for="code">Generated code</label><input id="code" class="f" autocomplete="off" spellcheck="false" placeholder="1000.xxxxxxxx.xxxxxxxx">' +
    '<label for="from">Send from (optional)</label><input id="from" class="f" autocomplete="off" spellcheck="false" placeholder="e.g. contact@fenilpshah.com - blank uses the mailbox address" value="' + esc_(c && c.from || '') + '">' +
    '<div class="row"><button id="go">Connect</button>' + (zohoReady_() ? '<button class="g" id="test">Send test email</button><button class="r" id="dis">Disconnect</button>' : '') + '</div>' +
    '<div id="out"></div>' +
    '<div class="note">When connected, all IQ reports go out through Zoho Mail. If Zoho ever fails, Gmail sends the email instead so no report is lost.</div>' +
    '<script>' +
    'var L=' + consoleLinks + ',$=function(i){return document.getElementById(i)};' +
    'function link(){$("consoleLink").href=L[$("region").value];}link();$("region").onchange=link;' +
    '$("copy").onclick=function(){var s=$("scope");s.select();s.setSelectionRange(0,999);var ok=false;try{ok=document.execCommand("copy")}catch(e){}' +
    'if(!ok&&navigator.clipboard)navigator.clipboard.writeText(s.value);this.textContent="Copied";var b=this;setTimeout(function(){b.textContent="Copy"},1500)};' +
    'function show(ok,t){var o=$("out");o.className=ok?"ok":"err";o.textContent=t;}' +
    'function busy(b,on,t){b.disabled=on;b.textContent=t;}' +
    '$("go").onclick=function(){var b=this,v={region:$("region").value,clientId:$("cid").value.trim(),clientSecret:$("sec").value.trim(),code:$("code").value.trim(),from:$("from").value.trim()};' +
    'if(!v.clientId||!v.clientSecret||!v.code){show(false,"Please fill in Client ID, Client Secret and the generated code.");return;}' +
    'busy(b,true,"Connecting...");google.script.run.withSuccessHandler(function(r){busy(b,false,"Connect");show(r.ok,r.msg);if(r.ok){$("code").value="";$("sec").value="";}})' +
    '.withFailureHandler(function(e){busy(b,false,"Connect");show(false,e.message)}).zohoConnectFromDialog(v);};' +
    'if($("test"))$("test").onclick=function(){var b=this;busy(b,true,"Sending...");google.script.run.withSuccessHandler(function(r){busy(b,false,"Send test email");show(r.ok,r.msg)})' +
    '.withFailureHandler(function(e){busy(b,false,"Send test email");show(false,e.message)}).zohoTestFromDialog();};' +
    'if($("dis"))$("dis").onclick=function(){if(!confirm("Disconnect Zoho Mail? Emails will go through Gmail."))return;var b=this;busy(b,true,"...");' +
    'google.script.run.withSuccessHandler(function(r){show(r.ok,r.msg);b.style.display="none";if($("test"))$("test").style.display="none";}).zohoDisconnectFromDialog();};' +
    '</script></body></html>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(560).setHeight(760), 'Connect Zoho Mail');
}

/** Called by the dialog: swaps the one-time code for a refresh token, finds the mailbox, saves, sends a test. */
function zohoConnectFromDialog(v) {
  v = v || {};
  var region = ZOHO_REGIONS[v.region] ? v.region : 'in', r = ZOHO_REGIONS[region];
  var clientId = String(v.clientId || '').trim(), secret = String(v.clientSecret || '').trim(), code = String(v.code || '').trim();
  var wantFrom = String(v.from || '').trim().toLowerCase();
  if (!clientId || !secret || !code) return { ok: false, msg: 'Please fill in Client ID, Client Secret and the generated code.' };
  var res = UrlFetchApp.fetch(r.accounts + '/oauth/v2/token', { method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'authorization_code', client_id: clientId, client_secret: secret, code: code } });
  var j = zJson_(res);
  if (!j.refresh_token) {
    var e = String(j.error || ('HTTP ' + res.getResponseCode()));
    var help = {
      invalid_code: 'That code is wrong, already used, or expired. Generate a new code and try again.',
      invalid_client: 'The Client ID or Client Secret is wrong, or this Zoho account is in a different region. Check both, and the region at the top.',
      invalid_client_secret: 'The Client Secret is wrong. Copy it again from the Client Secret tab.'
    }[e];
    return { ok: false, msg: help || ('Zoho did not accept the code (' + e + '). Generate a new code with the exact scope shown, and try again.') };
  }
  var cfg = { region: region, clientId: clientId, clientSecret: secret, refreshToken: j.refresh_token }, acc;
  try {
    var a = UrlFetchApp.fetch(r.mail + '/api/accounts', { muteHttpExceptions: true, headers: { Authorization: 'Zoho-oauthtoken ' + j.access_token } });
    var aj = zJson_(a), list = aj.data || [];
    if (!list.length) {
      var why = (aj.data && aj.data.errorCode) || (aj.status && aj.status.description) || ('HTTP ' + a.getResponseCode());
      return { ok: false, msg: /SCOPE/i.test(why) ? 'The code was made without the right scope. Generate a new code and paste exactly: ' + ZOHO_SCOPE
                                                 : 'Connected to Zoho, but could not read the mailbox (' + why + ').' };
    }
    var addrs = function (x) {
      return [x.primaryEmailAddress, x.mailboxAddress].concat((x.sendMailDetails || []).map(function (s) { return s.fromAddress; }))
        .concat((x.emailAddress || []).map(function (s) { return s.mailId; })).filter(String).map(function (s) { return String(s).toLowerCase(); });
    };
    acc = (wantFrom && list.filter(function (x) { return addrs(x).indexOf(wantFrom) >= 0; })[0]) || list[0];
    cfg.accountId = String(acc.accountId);
    var allowed = addrs(acc);
    if (wantFrom && allowed.indexOf(wantFrom) < 0)
      return { ok: false, msg: wantFrom + ' is not a sending address of this Zoho mailbox. Allowed: ' + allowed.filter(function (s, i) { return allowed.indexOf(s) === i; }).join(', ') };
    cfg.from = wantFrom || acc.primaryEmailAddress || acc.mailboxAddress || allowed[0] || '';
  } catch (err) { return { ok: false, msg: 'Could not reach Zoho Mail: ' + err.message }; }
  if (!cfg.from) return { ok: false, msg: 'Connected, but Zoho did not report a sending address for this mailbox.' };
  cfg.connectedAt = Utilities.formatDate(new Date(), CONFIG.TZ, 'dd MMM yyyy, HH:mm');
  PropertiesService.getScriptProperties().setProperty(ZOHO_PROP, JSON.stringify(cfg));
  CacheService.getScriptCache().put('zoho_at', j.access_token, 3000);
  var t = zohoTestFromDialog();
  return { ok: t.ok, msg: 'Connected. Emails will be sent from ' + cfg.from + '. ' + t.msg };
}

function zohoTestFromDialog() {
  if (!zohoReady_()) return { ok: false, msg: 'Zoho Mail is not connected.' };
  var to = CONFIG.ADMIN_EMAIL;
  try {
    zohoSend_({ to: to, subject: CONFIG.TITLE + ' - test email through Zoho Mail',
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">' +
        '<p>This is a test from the IQ Assessment system.</p><p>If you can read this, IQ reports will be sent from <b>' + esc_(zohoCfg_().from) + '</b>.</p></div>' });
    return { ok: true, msg: 'Test email sent to ' + to + '. Check that inbox (and spam).' };
  } catch (err) { return { ok: false, msg: 'Test email failed: ' + err.message }; }
}

function zohoDisconnectFromDialog() {
  PropertiesService.getScriptProperties().deleteProperty(ZOHO_PROP);
  CacheService.getScriptCache().remove('zoho_at');
  return { ok: true, msg: 'Disconnected. Emails now go through Gmail.' };
}

/* ===== Added for the unified /admin (fenilpshah.com) ===== */
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v); }
function adminOp_(p) {
  switch (p.op) {
    case 'students': {
      const sh = sh_(SH.STUDENTS), n = sh.getLastRow();
      const v = n < 2 ? [] : sh.getRange(2, 1, n - 1, 7).getValues();
      return { ok: true, sheet: ss_().getUrl(), rows: v.filter(r => String(r[0]).trim()).map(r => ({
        id: String(r[0]).trim().toUpperCase(), password: String(r[1]), name: String(r[2]), email: String(r[3]),
        status: String(r[4] || 'Active'), attempts: Number(r[5] || 0), lastLogin: iso_(r[6]) })) };
    }
    case 'addStudent': {
      const id = String(p.id || '').trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,20}$/.test(id)) return { ok: false, error: 'Student ID: 2–20 letters or numbers.' };
      if (student_(id)) return { ok: false, error: id + ' already exists.' };
      const pw = randPw_();
      withLock_(() => sh_(SH.STUDENTS).appendRow([id, pw, String(p.name || id).trim(), String(p.email || '').trim(), 'Active', 0, '']));
      return { ok: true, id, password: pw };
    }
    case 'setStatus': {
      const st = student_(String(p.id || '').toUpperCase()); if (!st) return { ok: false, error: 'Student ID not found.' };
      sh_(SH.STUDENTS).getRange(st.row, 5).setValue(p.status === 'Blocked' ? 'Blocked' : 'Active');
      return { ok: true };
    }
    case 'newPassword': {
      const st = student_(String(p.id || '').toUpperCase()); if (!st) return { ok: false, error: 'Student ID not found.' };
      const pw = randPw_(); sh_(SH.STUDENTS).getRange(st.row, 2).setValue(pw);
      return { ok: true, password: pw };
    }
    case 'reset': {
      const id = String(p.id || '').trim().toUpperCase(), st = student_(id);
      if (!st) return { ok: false, error: 'Student ID not found.' };
      withLock_(() => {
        sh_(SH.STUDENTS).getRange(st.row, 5, 1, 2).setValues([['Active', 0]]);
        const sh = sh_(SH.SESSIONS), n = sh.getLastRow();
        if (n >= 2) sh.getRange(2, 1, n - 1, 8).getValues().forEach((r, i) => {
          if (String(r[1]).toUpperCase() === id && r[7] === 'InProgress') sh.getRange(i + 2, 8).setValue('Cancelled');
        });
      });
      return { ok: true };
    }
    case 'results': {
      const sh = sh_(SH.RESULTS), n = sh.getLastRow();
      const v = n < 2 ? [] : sh.getRange(2, 1, n - 1, HEADERS.Results.length).getValues();
      return { ok: true, rows: v.map(r => ({ at: iso_(r[0]), id: r[1], name: r[2], email: r[3], correct: r[4], total: r[5], pct: r[6],
        iq: r[7], band: r[8], flags: r[9], minutes: r[10], completion: r[11], pdf: String(r[12] || ''), snaps: String(r[13] || '') })).reverse() };
    }
    case 'live': {
      const sh = sh_(SH.SESSIONS), n = sh.getLastRow();
      const v = n < 2 ? [] : sh.getRange(2, 1, n - 1, 10).getValues();
      return { ok: true, rows: v.filter(r => r[7] === 'InProgress').map(r => ({ id: r[1], started: iso_(r[2]), deadline: iso_(r[3]),
        flags: Number(r[6] || 0), lastSeen: iso_(r[9]) })) };
    }
    case 'sweep': sweepExpired(); return { ok: true };
    default: return { ok: false, error: 'Unknown IQ request.' };
  }
}


  return {
    doGet: (typeof doGet === "function" ? doGet : undefined),
    doPost: (typeof doPost === "function" ? doPost : undefined),
    onOpen: (typeof onOpen === "function" ? onOpen : undefined),
    setup: (typeof setup === "function" ? setup : undefined),
    generatePasswords: (typeof generatePasswords === "function" ? generatePasswords : undefined),
    resetStudent: (typeof resetStudent === "function" ? resetStudent : undefined),
    sweepExpired: (typeof sweepExpired === "function" ? sweepExpired : undefined),
    menuZohoConnect: (typeof menuZohoConnect === "function" ? menuZohoConnect : undefined),
    menuMailStatus: (typeof menuMailStatus === "function" ? menuMailStatus : undefined),
    adminOp_: (typeof adminOp_ === "function" ? adminOp_ : undefined),
    zohoConnectFromDialog: (typeof zohoConnectFromDialog === "function" ? zohoConnectFromDialog : undefined),
    zohoTestFromDialog: (typeof zohoTestFromDialog === "function" ? zohoTestFromDialog : undefined),
    zohoDisconnectFromDialog: (typeof zohoDisconnectFromDialog === "function" ? zohoDisconnectFromDialog : undefined)
  };
}).apply(null, env_('IQ', 'iq'));


/* ################################################################## *
 *  OTLO  —  original code, unchanged except where noted
 *  (opens FPS.SHEETS.otlo; settings/cache/triggers prefixed "OTLO.")
 * ################################################################## */
const OTLO = (function (SpreadsheetApp, PropertiesService, CacheService, ScriptApp) {
/**
 * ઓટલો · Otlo — Google Sheet backend for otlo.fenilpshah.com
 *
 * Everything is in this ONE file (the website design is stored at the very bottom).
 * If you created an "App" file earlier, you can delete it.
 *
 * First time / after updating:
 *   1. Replace everything in Code.gs with this file, Save.
 *   2. Run "setup" once (safe on an existing Sheet: it only adds what's missing).
 *   3. Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.
 *      (Keeps the same /exec link.)
 *   4. In the Sheet: Otlo → Make page codes. Every page and article gets its embed code.
 *
 * Every Google Sites page is now just a 2-line embed:
 *   <div id="otlo" data-page="post" data-slug="why-an-otlo"></div>
 *   <script src="https://script.google.com/macros/s/…/exec?app=1"></script>
 */

const TABS = {
  Settings: ['key', 'value'],
  Clusters: ['id', 'name', 'gujarati', 'tagline', 'image', 'order', 'own_page', 'page_url', 'embed_code'],
  Posts:    ['slug', 'title', 'type', 'cluster', 'author', 'date', 'cover_image', 'excerpt', 'body', 'gallery', 'featured', 'published', 'own_page', 'page_url', 'embed_code'],
  Gallery:  ['image', 'caption', 'credit', 'cluster', 'published'],
  Calendar: ['date', 'end_date', 'when', 'title', 'place', 'note', 'link'],
  Pages:    ['page', 'google_sites_page_name', 'address', 'embed_code'],
  Messages: ['received', 'ref', 'email', 'subject', 'message', 'replied', 'auto_reply']
};
const MAIN_PAGES = [
  ['home', 'Home', ''], ['read', 'Read', 'read'], ['clusters', 'Clusters', 'clusters'],
  ['gallery', 'Gallery', 'gallery'], ['calendar', 'Calendar', 'calendar'], ['about', 'About', 'about']
];
const DEFAULT_SITE = FPS.SITE + '/otlo';
const DEFAULT_API = FPS.EXEC + '/otlo';
const DEFAULT_NOTIFY = 'fenil@fenilpshah.com';   // where contact messages are emailed (change in Settings → notify_email)
const DEFAULT_FROM = 'otlo@fenilpshah.com';       // auto-replies are sent from here, so replies come back here
const DEFAULT_FROM_NAME = 'ઓટલો by Fenil P. Shah';
const DEFAULT_DISCLAIMER = 'This is an automated acknowledgement of a message submitted through the contact form on otlo.fenilpshah.com. ' +
  'It confirms receipt only and does not constitute a commitment, offer or agreement of any kind. ' +
  'This email and its contents are intended solely for the person to whom it is addressed and may contain confidential information. ' +
  'If you received it in error, please tell us by replying and then delete it. Otlo is a personal, non-commercial initiative of Fenil P. Shah; ' +
  'views expressed are personal. Your details are used only to respond to your message and are never shared or sold.';
const CACHE_KEY = 'otlo_v2';
/** Text on the coming-soon page — edit these in the Settings tab. *word* makes it red italic. */
const PAGE_SETTINGS = [
  ['coming_soon_intro', 'Every pol house has an otlo, the raised step out front where neighbours sit in the evening, talk, and pass on the stories of the street. We are building that step for the whole city.'],
  ['vision', "An Amdavad that knows its own stories, where anyone can sit on the otlo and find the city's *heritage, art and culture* alive, shared and theirs to carry on."],
  ['mission_1_title', 'Document the city'],
  ['mission_1_text', "Record Amdavad's pols, stepwells, crafts, festivals and food through writing, photography and art, before they are forgotten."],
  ['mission_2_title', 'Keep it open'],
  ['mission_2_text', "Make the city's stories free and easy for everyone to read, share and build on."],
  ['mission_3_title', 'Bring people to the step'],
  ['mission_3_text', 'Invite writers, artists, residents and visitors to look at the same city from different directions, and to talk.'],
  ['mission_4_title', 'Connect past and present'],
  ['mission_4_text', "Show how the city's traditions live on in its streets, institutions and everyday life today."],
  ['contact_intro', 'Have a story about the city, a place we should visit, or want to write or create for Otlo? Sit on the otlo with us. We read every message.'],
  ['maintenance_title', "We're tidying up the otlo"],
  ['maintenance_message', 'Otlo is under maintenance for a little while. Please check back soon.']
];
const RED = '#B81D24';

/* ================= website ================= */
/* ================= contact form ================= */
/** Receives "Contact us" messages: saves them, emails you, and sends the visitor a designed auto-reply from Zoho Mail. */
function doPost(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    let d = {};
    try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { d = (e && e.parameter) || {}; }
    if (d.website) return out({ ok: true });                                   // hidden field: bots fill it, people don't
    const msgId = String(d.id || '').slice(0, 40);
    if (msgId && CacheService.getScriptCache().get('id_' + msgId)) return out({ ok: true });   // same message sent twice
    const email = String(d.email || '').trim().slice(0, 200);
    const subject = String(d.subject || '').trim().slice(0, 200);
    const message = String(d.message || '').trim().slice(0, 5000);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return out({ ok: false, error: 'Please enter a valid email.' });
    if (!subject || !message) return out({ ok: false, error: 'Please add a subject and a message.' });

    const cache = CacheService.getScriptCache(), key = 'msg_' + email.toLowerCase();
    const count = Number(cache.get(key) || 0);
    if (count >= 5) return out({ ok: false, error: 'Thanks! You have sent a few already, please try again later.' });
    cache.put(key, String(count + 1), 3600);

    const ref = 'OTLO-' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd') + '-' +
                Math.random().toString(36).slice(2, 6).toUpperCase();
    let row;
    const lock = LockService.getScriptLock(); lock.waitLock(10000);
    try {
      upgrade_messages_();
      const safe = s => /^[=+\-@]/.test(s) ? "'" + s : s;                       // keep text as text in the Sheet
      row = appendByHeader_('Messages', { received: new Date(), ref: ref, email: safe(email), subject: safe(subject), message: safe(message), replied: false, auto_reply: 'sending…' });
    } finally { lock.releaseLock(); }
    if (msgId) cache.put('id_' + msgId, '1', 3600);

    // 1. designed auto-reply to the visitor, from Zoho Mail
    let status;
    try { status = sendAutoReply_({ email: email, subject: subject, message: message, ref: ref }); }
    catch (err) { status = 'failed: ' + String(err.message || err).slice(0, 180); }
    setByHeader_('Messages', row, 'auto_reply', status);

    // 2. a note to you
    const to = String(settings_().notify_email || DEFAULT_NOTIFY).trim();
    if (to) {
      try {
        MailApp.sendEmail({
          to: to, replyTo: email, name: 'ઓટલો · Otlo',
          subject: 'Otlo message ' + ref + ': ' + subject,
          body: 'From: ' + email + '\nSubject: ' + subject + '\nReference: ' + ref + '\nAuto-reply: ' + status + '\n\n' + message +
                '\n\n— Sent from the contact form on otlo.fenilpshah.com. Reply to this email to answer them.'
        });
      } catch (err) { /* saved in the Sheet even if email fails */ }
    }
    return out({ ok: true, ref: ref });
  } catch (err) {
    return out({ ok: false, error: 'Something went wrong. Please email us directly.' });
  }
}
function upgrade_messages_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Messages');
  if (!sh) {
    sh = ss.insertSheet('Messages');
    styleHeader_(sh.getRange(1, 1, 1, TABS.Messages.length).setValues([TABS.Messages]));
    sh.setFrozenRows(1);
    return;
  }
  const have = headers_(sh);
  TABS.Messages.forEach(h => {
    if (have.indexOf(h) !== -1) return;
    const c = sh.getLastColumn() + 1;
    if (c > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
    styleHeader_(sh.getRange(1, c).setValue(h)); have.push(h);
  });
}
/** Adds a row matching values to column names, whatever order the columns are in. Returns the row number. */
function appendByHeader_(tab, obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tab), head = headers_(sh);
  sh.appendRow(head.map(h => obj[h] !== undefined ? obj[h] : ''));
  return sh.getLastRow();
}
function setByHeader_(tab, row, col, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tab), c = headers_(sh).indexOf(col) + 1;
  if (c && row) sh.getRange(row, c).setValue(value);
}

/* ================= Zoho Mail (India data centre) ================= */
function zohoHosts_() {
  const dc = String(settings_().zoho_dc || 'in').trim().replace(/^\./, '') || 'in';   // in, com, eu, com.au …
  return { accounts: 'https://accounts.zoho.' + dc, mail: 'https://mail.zoho.' + dc };
}
function zohoToken_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('zoho_token'); if (hit) return hit;
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('ZOHO_CLIENT_ID'), secret = p.getProperty('ZOHO_CLIENT_SECRET'), refresh = p.getProperty('ZOHO_REFRESH_TOKEN');
  if (!id || !secret || !refresh) throw new Error('Zoho Mail not connected (Otlo → Connect Zoho Mail)');
  const r = UrlFetchApp.fetch(zohoHosts_().accounts + '/oauth/v2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { refresh_token: refresh, client_id: id, client_secret: secret, grant_type: 'refresh_token' }
  });
  const j = JSON.parse(r.getContentText() || '{}');
  if (!j.access_token) throw new Error('Zoho login failed: ' + (j.error || r.getResponseCode()));
  cache.put('zoho_token', j.access_token, Math.min(3000, Number(j.expires_in || 3600) - 120));
  return j.access_token;
}
function zohoAccountId_(token) {
  const p = PropertiesService.getScriptProperties();
  const saved = p.getProperty('ZOHO_ACCOUNT_ID'); if (saved) return saved;
  const r = UrlFetchApp.fetch(zohoHosts_().mail + '/api/accounts', { headers: { Authorization: 'Zoho-oauthtoken ' + token }, muteHttpExceptions: true });
  const j = JSON.parse(r.getContentText() || '{}');
  const list = j.data || [];
  if (!list.length) throw new Error('No Zoho Mail account found (' + r.getResponseCode() + ')');
  const from = String(settings_().zoho_from || DEFAULT_FROM).toLowerCase();
  const match = list.find(a => JSON.stringify(a).toLowerCase().indexOf(from) !== -1) || list[0];
  p.setProperty('ZOHO_ACCOUNT_ID', String(match.accountId));
  return String(match.accountId);
}
/** Sends one email through Zoho Mail. Tries "Name <address>" first, then the plain address. */
function zohoSend_(to, subject, html) {
  const s = settings_();
  const from = String(s.zoho_from || DEFAULT_FROM).trim();
  const name = String(s.zoho_from_name || DEFAULT_FROM_NAME).trim();
  const token = zohoToken_(), account = zohoAccountId_(token);
  const url = zohoHosts_().mail + '/api/accounts/' + account + '/messages';
  const tries = name ? ['"' + name.replace(/"/g, '') + '" <' + from + '>', from] : [from];
  let last = '';
  for (let i = 0; i < tries.length; i++) {
    const r = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Zoho-oauthtoken ' + token, Accept: 'application/json' },
      payload: JSON.stringify({ fromAddress: tries[i], toAddress: to, subject: subject, content: html, mailFormat: 'html', encoding: 'UTF-8', askReceipt: 'no' })
    });
    const code = r.getResponseCode(), body = r.getContentText();
    if (code >= 200 && code < 300) return 'sent ' + Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM, HH:mm');
    last = code + ' ' + body.slice(0, 160);
  }
  throw new Error('Zoho send failed: ' + last);
}

function sendAutoReply_(m) {
  const s = settings_();
  if (String(s.auto_reply || 'on').toLowerCase() === 'off') return 'off';
  return zohoSend_(m.email, 'We received your message · ' + m.ref + ' · ઓટલો', autoReplyHtml_(m, s));
}

/** The auto-reply email. Built with tables + inline styles so it looks right in Gmail, Outlook and phone mail apps. */
function autoReplyHtml_(m, s) {
  const e = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const site = siteUrl_(s), from = String(s.zoho_from || DEFAULT_FROM).trim();
  const logo = img_(s.email_logo);
  const disclaimer = String(s.email_disclaimer || DEFAULT_DISCLAIMER);
  const msg = e(m.message).replace(/\r?\n/g, '<br>');
  const serif = "Georgia,'Times New Roman',serif", sans = "'Helvetica Neue',Helvetica,Arial,sans-serif", gu = "'Noto Serif Gujarati','Shruti','Nirmala UI',Georgia,serif";
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>ઓટલો</title></head>' +
  '<body style="margin:0;padding:0;background:#F6EFED;">' +
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Thank you for writing to ઓટલો. Your reference is ' + e(m.ref) + '.</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6EFED;"><tr><td align="center" style="padding:28px 12px;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;">' +
    // red band
    '<tr><td style="background:' + RED + ';height:6px;line-height:6px;font-size:0;">&nbsp;</td></tr>' +
    // logo
    '<tr><td align="center" style="padding:36px 32px 8px;">' +
      (logo ? '<img src="' + e(logo) + '" width="220" alt="ઓટલો · Otlo" style="display:block;width:220px;max-width:70%;height:auto;border:0;">'
            : '<div style="font-family:' + gu + ';font-size:52px;line-height:1.1;font-weight:700;color:' + RED + ';">ઓટલો</div>' +
              '<div style="font-family:' + sans + ';font-size:11px;letter-spacing:6px;color:' + RED + ';font-weight:700;padding-top:6px;">OTLO</div>') +
    '</td></tr>' +
    '<tr><td align="center" style="padding:0 32px 26px;font-family:' + serif + ';font-size:15px;color:#6B6460;font-style:italic;">Stories, art and culture from Amdavad</td></tr>' +
    '<tr><td style="padding:0 32px;"><div style="border-top:1px solid #EBDCD9;font-size:0;line-height:0;">&nbsp;</div></td></tr>' +
    // message
    '<tr><td style="padding:30px 36px 6px;font-family:' + serif + ';font-size:26px;line-height:1.25;color:#1D1A18;">Thank you for sitting on the otlo with us.</td></tr>' +
    '<tr><td style="padding:12px 36px 0;font-family:' + serif + ';font-size:17px;line-height:1.65;color:#3A3431;">' +
      'Your message has reached us. We read every note that comes in, and we will write back to you personally as soon as we can.' +
    '</td></tr>' +
    // reference chip
    '<tr><td style="padding:22px 36px 4px;">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#F8ECEA;border-radius:999px;padding:9px 16px;font-family:' + sans + ';font-size:13px;color:#8E1419;">' +
      'Your reference&nbsp;&nbsp;<b style="letter-spacing:1px;">' + e(m.ref) + '</b></td></tr></table>' +
    '</td></tr>' +
    // copy of their message
    '<tr><td style="padding:22px 36px 0;font-family:' + sans + ';font-size:11px;letter-spacing:2px;text-transform:uppercase;color:' + RED + ';font-weight:700;">What you wrote</td></tr>' +
    '<tr><td style="padding:10px 36px 0;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ' + RED + ';background:#FBF6F5;"><tr><td style="padding:16px 18px;">' +
        '<div style="font-family:' + serif + ';font-size:17px;font-weight:bold;color:#1D1A18;padding-bottom:6px;">' + e(m.subject) + '</div>' +
        '<div style="font-family:' + serif + ';font-size:15px;line-height:1.6;color:#4A4340;">' + msg + '</div>' +
      '</td></tr></table>' +
    '</td></tr>' +
    // reply note
    '<tr><td style="padding:24px 36px 0;font-family:' + serif + ';font-size:16px;line-height:1.6;color:#3A3431;">' +
      'Want to add something? Just reply to this email. It comes straight to <a href="mailto:' + e(from) + '" style="color:' + RED + ';text-decoration:none;font-weight:bold;">' + e(from) + '</a>.' +
    '</td></tr>' +
    // sign-off
    '<tr><td style="padding:26px 36px 34px;font-family:' + serif + ';font-size:16px;line-height:1.5;color:#1D1A18;">' +
      'Warmly,<br><span style="font-size:19px;">Fenil P. Shah</span><br>' +
      '<span style="font-family:' + gu + ';color:' + RED + ';font-size:17px;">ઓટલો</span>' +
      '<span style="font-family:' + sans + ';color:#6B6460;font-size:13px;">&nbsp;·&nbsp;otlo.fenilpshah.com</span>' +
    '</td></tr>' +
    // red footer
    '<tr><td align="center" style="background:' + RED + ';padding:22px 28px;font-family:' + sans + ';font-size:13px;line-height:1.8;color:#ffffff;">' +
      '<span style="font-family:' + gu + ';font-size:20px;font-weight:700;">ઓટલો</span><br>' +
      '<a href="' + e(site) + '" style="color:#ffffff;text-decoration:underline;">' + e(site.replace(/^https?:\/\//, '')) + '</a>' +
      '&nbsp;&nbsp;·&nbsp;&nbsp;<a href="https://www.fenilpshah.com" style="color:#ffffff;text-decoration:underline;">fenilpshah.com</a>' +
    '</td></tr>' +
  '</table>' +
  // disclaimer
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;"><tr><td style="padding:18px 20px 6px;font-family:' + sans + ';font-size:11px;line-height:1.6;color:#8A817D;">' +
    '<b style="color:#6B6460;">Disclaimer:</b> ' + e(disclaimer).replace(/\r?\n/g, '<br>') +
  '</td></tr></table>' +
  '</td></tr></table></body></html>';
}

/* ---------- menu actions for Zoho ---------- */
function connectZoho() {
  const ui = SpreadsheetApp.getUi(), p = PropertiesService.getScriptProperties();
  const ask = (title, text) => { const r = ui.prompt(title, text, ui.ButtonSet.OK_CANCEL); return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null; };
  const id = ask('Connect Zoho Mail (1 of 3)', 'Client ID from api-console.zoho.in → Self Client'); if (!id) return;
  const secret = ask('Connect Zoho Mail (2 of 3)', 'Client Secret'); if (!secret) return;
  const code = ask('Connect Zoho Mail (3 of 3)',
    'Paste the code you generated in Self Client → "Generate Code"\n' +
    'Scope: ZohoMail.messages.CREATE,ZohoMail.accounts.READ\n(or paste an existing refresh token)'); if (!code) return;
  let refresh = '';
  const r = UrlFetchApp.fetch(zohoHosts_().accounts + '/oauth/v2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { code: code, client_id: id, client_secret: secret, grant_type: 'authorization_code' }
  });
  const j = JSON.parse(r.getContentText() || '{}');
  refresh = j.refresh_token || code;                         // if it wasn't a fresh code, treat it as a refresh token
  p.setProperties({ ZOHO_CLIENT_ID: id, ZOHO_CLIENT_SECRET: secret, ZOHO_REFRESH_TOKEN: refresh });
  p.deleteProperty('ZOHO_ACCOUNT_ID');
  CacheService.getScriptCache().remove('zoho_token');
  try {
    zohoAccountId_(zohoToken_());
    ui.alert('Zoho Mail connected ✓', 'Next: Otlo → Send a test auto-reply.', ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Could not connect', String(err.message || err) + '\n\nCheck the scope and that the code is less than 10 minutes old.', ui.ButtonSet.OK);
  }
}
function testAutoReply() {
  const ui = SpreadsheetApp.getUi();
  const to = String(settings_().notify_email || DEFAULT_NOTIFY).trim();
  try {
    const st = sendAutoReply_({ email: to, subject: 'A story from my pol', message: 'This is a test message from the Otlo contact form.\nThe auto-reply should look exactly like what visitors receive.', ref: 'OTLO-TEST' });
    ui.alert('Test sent', 'An auto-reply was sent to ' + to + ' (' + st + ').', ui.ButtonSet.OK);
  } catch (err) { ui.alert('Test failed', String(err.message || err), ui.ButtonSet.OK); }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.settings) {                                   // used by the coming-soon page
    return ContentService.createTextOutput(JSON.stringify({ settings: publicSettings_(settings_()) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const json = feedJson_();
  if (p.app) {
    const engine = Utilities.newBlob(Utilities.base64Decode(OTLO_ENGINE)).getDataAsString('UTF-8');
    const ascii = json.replace(/[\u007f-￿]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
    return ContentService.createTextOutput('window.__OTLO_DATA=' + ascii + ';\n' + engine)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function feedJson_() {
  const cache = CacheService.getScriptCache();
  let json = cache.get(CACHE_KEY);
  if (!json) {
    json = JSON.stringify(buildFeed_());
    try { cache.put(CACHE_KEY, json, 300); } catch (err) { /* too large to cache, fine */ }
  }
  return json;
}

function buildFeed_() {
  const settings = settings_();
  const site = siteUrl_(settings);
  settings.site_url = site;
  settings.hero_image = img_(settings.hero_image);
  PRIVATE_SETTINGS.forEach(k => delete settings[k]);
  settings.maintenance = yes_(settings.maintenance, false);

  const clusters = rows_('Clusters')
    .filter(r => r.id && r.name)
    .sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999))
    .map(r => ({
      id: slug_(r.id), name: r.name, gujarati: r.gujarati, tagline: r.tagline, image: img_(r.image),
      page_url: yes_(r.own_page, false) ? site + '/clusters/' + slug_(r.id) : ''
    }));

  const posts = rows_('Posts')
    .filter(r => r.slug && r.title && yes_(r.published, true))
    .map(r => ({
      slug: slug_(r.slug), title: r.title, type: r.type || 'Article', cluster: slug_(r.cluster),
      author: r.author, date: r.date, cover_image: img_(r.cover_image), excerpt: r.excerpt,
      body: String(r.body || '').replace(/!\[(.*?)\]\((.+?)\)/g, (m, c, u) => '![' + c + '](' + img_(u) + ')'),
      gallery: String(r.gallery || '').split(/[\n,]+/).map(s => img_(s.trim())).filter(Boolean).join('\n'),
      featured: yes_(r.featured, false),
      page_url: yes_(r.own_page, false) ? site + '/read/' + slug_(r.slug) : ''
    }));

  const gallery = rows_('Gallery')
    .filter(r => (r.image || r.caption) && yes_(r.published, true))
    .map(r => ({ image: img_(r.image), caption: r.caption, credit: r.credit, cluster: slug_(r.cluster) }));

  const calendar = rows_('Calendar').filter(r => r.title);
  return { settings, clusters, posts, gallery, calendar, updated: new Date().toISOString() };
}

/* ================= automatic slugs, links and embed codes ================= */

/** Runs on every edit: fills the slug from the title, updates the link and embed code, refreshes the site. */
function onEdit(e) {
  try {
    const sh = e.range.getSheet(), name = sh.getName();
    if (name !== 'Posts' && name !== 'Clusters') { clearCache_(); return; }
    const head = headers_(sh);
    const r1 = e.range.getRow(), r2 = e.range.getLastRow();
    for (let r = Math.max(2, r1); r <= r2; r++) fillRow_(sh, head, r, name);
    clearCache_();
  } catch (err) { /* never block typing */ }
}

/** Menu: fills every row and the Pages tab. */
function makeCodes() {
  const ss = SpreadsheetApp.getActive();
  upgrade_();
  let api = apiUrl_();
  if (!api) {
    const ui = SpreadsheetApp.getUi();
    const res = ui.prompt('Your web app link', 'Paste the Deploy link that ends in /exec', ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    api = res.getResponseText().trim();
    setSetting_('api_url', api);
  }
  ['Posts', 'Clusters'].forEach(name => fillSheet_(ss.getSheetByName(name), name, api));
  const site = siteUrl_(settings_());
  const pages = ss.getSheetByName('Pages');
  const rows = MAIN_PAGES.map(([page, label, path]) => [page, label, site + (path ? '/' + path : ''), snippet_(page, '', api)]);
  pages.getRange(2, 1, pages.getMaxRows() - 1, 4).clearContent();
  pages.getRange(2, 1, rows.length, 4).setValues(rows);
  pages.getRange(rows.length + 3, 1, 4, 1).setValues([
    ['Article page: in Google Sites, add a subpage under "Read" named exactly like the slug, paste its embed_code, then tick own_page.'],
    ['Cluster page: same, as a subpage under "Clusters" named like the id.'],
    ['Pages without own_page ticked still open inside Read / Clusters, so nothing ever breaks.'],
    ['After changing App.html or Code.gs: Deploy → Manage deployments → Edit → New version.']
  ]);
  clearCache_();
  ss.toast('Embed codes are ready in Posts, Clusters and Pages.', 'ઓટલો', 6);
}

function fillRow_(sh, head, r, name) {
  const col = h => head.indexOf(h) + 1;
  const get = h => col(h) ? sh.getRange(r, col(h)).getValue() : '';
  const set = (h, v) => { if (col(h)) sh.getRange(r, col(h)).setValue(v); };
  const isPost = name === 'Posts';
  const keyCol = isPost ? 'slug' : 'id', titleCol = isPost ? 'title' : 'name';
  const title = String(get(titleCol) || '').trim();
  let key = String(get(keyCol) || '').trim();
  if (!title && !key) { set('page_url', ''); set('embed_code', ''); return; }
  if (!key && title) {
    key = uniqueSlug_(sh, col(keyCol), slug_(title) || (isPost ? 'post-' + r : 'cluster-' + r), r);
    set(keyCol, key);
  } else if (key && key !== slug_(key)) {
    key = slug_(key); set(keyCol, key);        // tidy hand-typed slugs: "My Post!" → "my-post"
  }
  const site = siteUrl_(settings_()), api = apiUrl_();
  set('page_url', site + (isPost ? '/read/' : '/clusters/') + key);
  set('embed_code', api ? snippet_(isPost ? 'post' : 'cluster', key, api) : 'Run Otlo → Make page codes');
}

/** Same as fillRow_, for a whole tab at once (fast). */
function fillSheet_(sh, name, api) {
  if (!sh || sh.getLastRow() < 2) return;
  const head = headers_(sh), n = sh.getLastRow() - 1;
  const isPost = name === 'Posts';
  const kc = head.indexOf(isPost ? 'slug' : 'id'), tc = head.indexOf(isPost ? 'title' : 'name');
  const uc = head.indexOf('page_url'), ec = head.indexOf('embed_code');
  const data = sh.getRange(2, 1, n, head.length).getValues();
  const site = siteUrl_(settings_()), used = {};
  data.forEach(row => { const k = slug_(row[kc]); if (k) used[k] = true; });
  const keys = [], urls = [], codes = [];
  data.forEach((row, i) => {
    const title = String(row[tc] || '').trim();
    let key = String(row[kc] || '').trim();
    if (!title && !key) { keys.push([row[kc]]); urls.push(['']); codes.push(['']); return; }
    if (!key) {
      const base = slug_(title) || (isPost ? 'post-' : 'cluster-') + (i + 2);
      key = base; let k = 2;
      while (used[key]) key = base + '-' + k++;
      used[key] = true;
    } else key = slug_(key);
    keys.push([key]);
    urls.push([site + (isPost ? '/read/' : '/clusters/') + key]);
    codes.push([snippet_(isPost ? 'post' : 'cluster', key, api)]);
  });
  sh.getRange(2, kc + 1, n, 1).setValues(keys);
  sh.getRange(2, uc + 1, n, 1).setValues(urls);
  sh.getRange(2, ec + 1, n, 1).setValues(codes);
}

function snippet_(page, slug, api) {
  return '<div id="otlo" data-page="' + page + '"' + (slug ? ' data-slug="' + slug + '"' : '') + '></div>\n' +
         '<script src="' + api + '?app=1"></script>';
}

function uniqueSlug_(sh, col, base, row) {
  const existing = sh.getRange(2, col, Math.max(1, sh.getLastRow() - 1), 1).getValues()
    .map((v, i) => i + 2 === row ? '' : String(v[0]).trim());
  let s = base, n = 2;
  while (existing.indexOf(s) !== -1) s = base + '-' + n++;
  return s;
}

/* ================= helpers ================= */
function rows_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  const values = sh.getDataRange().getValues();
  const head = values.shift().map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
  return values
    .filter(r => r.some(v => v !== '' && v !== null))
    .map(r => {
      const o = {};
      head.forEach((h, i) => {
        let v = r[i];
        if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
        o[h] = typeof v === 'string' ? v.trim() : v;
      });
      return o;
    });
}
function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '_'));
}
const PRIVATE_SETTINGS = ['api_url', 'notify_email', 'zoho_from', 'zoho_from_name', 'zoho_dc', 'auto_reply', 'email_logo', 'email_disclaimer'];
/** Settings safe to show on the website (no internal addresses or mail config). */
function publicSettings_(s) {
  const o = {};
  Object.keys(s).forEach(k => { if (PRIVATE_SETTINGS.indexOf(k) === -1) o[k] = s[k]; });
  o.maintenance = yes_(s.maintenance, false);
  o.site_url = siteUrl_(s);
  return o;
}
function settings_() {
  const s = {};
  rows_('Settings').forEach(r => { if (r.key) s[String(r.key).trim()] = r.value; });
  return s;
}
function setSetting_(key, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Settings');
  const keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(v => String(v[0]).trim());
  const i = keys.indexOf(key);
  if (i === -1) sh.appendRow([key, value]); else sh.getRange(i + 1, 2).setValue(value);
}
function siteUrl_(s) { return String((s && s.site_url) || DEFAULT_SITE).trim().replace(/\/+$/, ''); }
function apiUrl_() {
  let u = String(settings_().api_url || '').trim();
  if (!u) { try { u = ScriptApp.getService().getUrl() || ''; } catch (err) { u = ''; } }
  if (/\/dev$/.test(u)) u = '';                                  // test links don't work for visitors
  return u.replace(/\?.*$/, '');
}
function img_(u) {
  u = String(u || '').trim();
  if (!u) return '';
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{10,})/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1] + '=w1600';
  return /^https?:\/\//i.test(u) ? u : '';
}
function yes_(v, dflt) {
  if (v === '' || v === null || v === undefined) return dflt;
  return v === true || /^(true|yes|y|1)$/i.test(String(v).trim());
}
/** "Light through stone: the Sidi Saiyyed jaali" → "light-through-stone-the-sidi-saiyyed-jaali" */
function slug_(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function clearCache_() { CacheService.getScriptCache().remove(CACHE_KEY); }

/* ================= menu ================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Otlo')
    .addItem('Refresh website', 'refresh')
    .addItem('Make page codes', 'makeCodes')
    .addItem('How to add an article page', 'pageHelp')
    .addItem('How to add images', 'imageHelp')
    .addSeparator()
    .addItem('Connect Zoho Mail', 'connectZoho')
    .addItem('Send a test auto-reply', 'testAutoReply')
    .addSeparator()
    .addItem('Set up / update tabs', 'setup')
    .addToUi();
}
function refresh() {
  clearCache_();
  SpreadsheetApp.getActive().toast('Done. Reload the website to see your changes.', 'ઓટલો', 5);
}
function pageHelp() {
  SpreadsheetApp.getUi().alert('Giving an article its own link',
    '1. Write the post in the Posts tab. The slug fills in automatically from the title.\n' +
    '2. In Google Sites, add a subpage under "Read". Name it exactly the slug (e.g. why-an-otlo).\n' +
    '3. On that page: Insert → Embed → Embed code → paste the embed_code from the Sheet.\n' +
    '4. Publish the site, then tick own_page for that post.\n\n' +
    'The link is in page_url, e.g. otlo.fenilpshah.com/read/why-an-otlo\n' +
    'Clusters work the same way, as subpages under "Clusters".\n\n' +
    'Until own_page is ticked, the article still opens inside the Read page.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
function imageHelp() {
  SpreadsheetApp.getUi().alert('Adding images',
    '1. Upload the photo to a Google Drive folder (e.g. "Otlo Images").\n' +
    '2. Share the folder: General access → "Anyone with the link" → Viewer.\n' +
    '3. Right-click the photo → Share → Copy link.\n' +
    '4. Paste that link into any image column (cover_image, image, hero_image).\n\n' +
    'Inside a post body, add a picture on its own line:\n![Caption](paste-link-here)\n\n' +
    'For several photos under a post, paste links into "gallery", one per line.\n' +
    'Links from other sites (Wikimedia, Unsplash) also work.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/* ================= setup (safe to run again) ================= */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach((name, idx) => {
    let sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) return;              // existing content is handled by upgrade_()
    if (!sh) sh = ss.insertSheet(name, idx);
    const head = TABS[name];
    sh.clear();
    styleHeader_(sh.getRange(1, 1, 1, head.length).setValues([head]));
    sh.setFrozenRows(1);
    const sample = (SAMPLE_[name] || []).map(r => head.map((h, i) => r[i] === undefined ? '' : r[i]));
    if (sample.length) sh.getRange(2, 1, sample.length, head.length).setValues(sample);
    sh.autoResizeColumns(1, head.length);
  });
  upgrade_();

  const posts = ss.getSheetByName('Posts'), ph = headers_(posts);
  posts.getRange(2, ph.indexOf('type') + 1, 499, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Article', 'Blog', 'Art'], true).build());
  posts.setColumnWidth(ph.indexOf('body') + 1, 420);
  posts.getRange(2, ph.indexOf('body') + 1, 499, 1).setWrap(true);
  posts.getRange(2, ph.indexOf('date') + 1, 499, 1).setNumberFormat('yyyy-mm-dd');
  ss.getSheetByName('Calendar').getRange('A2:B').setNumberFormat('yyyy-mm-dd');

  const blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  onOpen();
  ss.toast('Tabs are ready. Next: Otlo → Make page codes.', 'ઓટલો', 8);
}

/** Adds any missing columns / settings to an existing Sheet without touching your content. */
function upgrade_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); styleHeader_(sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]])); sh.setFrozenRows(1); return; }
    const have = headers_(sh);
    TABS[name].forEach(h => {
      if (have.indexOf(h) !== -1) return;
      const c = sh.getLastColumn() + 1;
      if (c > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
      styleHeader_(sh.getRange(1, c).setValue(h));
      have.push(h);
    });
  });
  // checkboxes
  [['Posts', ['featured', 'published', 'own_page']], ['Clusters', ['own_page']], ['Gallery', ['published']]].forEach(([name, cols]) => {
    const sh = ss.getSheetByName(name), head = headers_(sh);
    cols.forEach(h => {
      const range = sh.getRange(2, head.indexOf(h) + 1, 499, 1);
      const vals = range.getValues();
      const rule = range.getDataValidation();
      if (rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.CHECKBOX) return;
      range.insertCheckboxes();
      range.setValues(vals.map(v => [yes_(v[0], false)]));
    });
  });
  // embed codes are read-only output
  ['Posts', 'Clusters', 'Pages'].forEach(name => {
    const sh = ss.getSheetByName(name), head = headers_(sh), c = head.indexOf('embed_code') + 1;
    if (c) { sh.setColumnWidth(c, 360); sh.getRange(2, c, 499, 1).setFontFamily('Roboto Mono').setFontSize(9).setBackground('#FBF3F1'); }
  });
  // settings keys
  const s = settings_();
  if (!s.site_url) setSetting_('site_url', DEFAULT_SITE);
  if (!s.api_url) setSetting_('api_url', DEFAULT_API);
  if (!s.notify_email) setSetting_('notify_email', DEFAULT_NOTIFY);
  if (!s.zoho_from) setSetting_('zoho_from', DEFAULT_FROM);
  if (!s.zoho_from_name) setSetting_('zoho_from_name', DEFAULT_FROM_NAME);
  if (!s.zoho_dc) setSetting_('zoho_dc', 'in');
  if (!s.auto_reply) setSetting_('auto_reply', 'on');
  if (!s.email_logo) setSetting_('email_logo', '');
  if (!s.email_disclaimer) setSetting_('email_disclaimer', DEFAULT_DISCLAIMER);
  PAGE_SETTINGS.forEach(([k, v]) => { if (!(k in s)) setSetting_(k, v); });
  if (!('maintenance' in s)) setSetting_('maintenance', false);
  const st = ss.getSheetByName('Settings');
  const keys = st.getRange(1, 1, st.getLastRow(), 1).getValues().map(v => String(v[0]).trim());
  const mRow = keys.indexOf('maintenance') + 1;
  if (mRow) {
    const cell = st.getRange(mRow, 2), r0 = cell.getDataValidation();
    if (!r0 || r0.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) {
      const v = yes_(cell.getValue(), false); cell.insertCheckboxes(); cell.setValue(v);
    }
    st.getRange(mRow, 1, 1, 2).setBackground('#F8ECEA').setFontWeight('bold');
  }
  st.setColumnWidth(2, 460); st.getRange(1, 2, st.getLastRow(), 1).setWrap(true);
  upgrade_messages_();
  const msgs = ss.getSheetByName('Messages');
  const mh = headers_(msgs), mc = h => mh.indexOf(h) + 1;
  msgs.getRange(2, mc('received'), 499, 1).setNumberFormat('dd mmm yyyy, hh:mm');
  msgs.setColumnWidth(mc('message'), 420); msgs.getRange(2, mc('message'), 499, 1).setWrap(true);
  const rep = msgs.getRange(2, mc('replied'), 499, 1), rule = rep.getDataValidation();
  if (!rule || rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.CHECKBOX) rep.insertCheckboxes();
  // a quick test so Google asks for email permission now, not when the first visitor writes in
  MailApp.getRemainingDailyQuota();
}
function styleHeader_(range) { return range.setFontWeight('bold').setFontColor('#ffffff').setBackground(RED); }

const SAMPLE_ = {
  Settings: [
    ['site_title', 'ઓટલો'],
    ['site_subtitle', 'Otlo'],
    ['tagline', 'Stories, art and culture from Amdavad'],
    ['hero_text', 'Every pol house has an otlo, the raised step out front where neighbours sit in the evening, talk, and pass on the stories of the street. This is that step, for the whole city.'],
    ['hero_image', ''],
    ['about', 'Otlo is a corner of fenilpshah.com for writing, art and photography about Amdavad: its pols and stepwells, its crafts and festivals, its food, its river, and the institutions that shaped it.\n\nThe name comes from the otlo (ઓટલો), the raised platform at the front of a pol house. It is where the city has always sat down to talk.'],
    ['email', 'fenil@fenilpshah.com'],
    ['instagram', ''],
    ['footer_note', 'A corner of fenilpshah.com'],
    ['site_url', DEFAULT_SITE],
    ['api_url', DEFAULT_API]
  ],
  Clusters: [
    ['heritage', 'Heritage & Architecture', 'વારસો', 'Pols, stepwells, jaalis and the walled city.', '', 1],
    ['craft', 'Art & Craft', 'કલા', 'Textiles, block prints, kites and the hands behind them.', '', 2],
    ['festivals', 'Festivals & Rituals', 'તહેવાર', 'Uttarayan rooftops, Navratri nights, Rath Yatra mornings.', '', 3],
    ['food', 'Food', 'સ્વાદ', 'From Manek Chowk after dark to the pol kitchens.', '', 4],
    ['institutions', 'Institutions', 'સંસ્થાઓ', 'The mills, the ashram and the campuses that shaped a city.', '', 5],
    ['river', 'The River', 'સાબરમતી', 'The Sabarmati and the life along its banks.', '', 6],
    ['walks', 'Walks', 'સફર', 'Routes through the old city, one gate at a time.', '', 7]
  ],
  Posts: [
    ['why-an-otlo', 'Why an otlo?', 'Article', 'heritage', 'Fenil P. Shah', '2026-10-09', '', 'On the raised step at the front of a pol house, and why this corner of the internet is named after it.',
      'Walk into any pol in the old city in the evening and you will find people sitting on the otlo, the raised platform at the front of the house. It is not quite inside and not quite the street. It is the place in between, where a city talks to itself.\n\n## A step, not a stage\n\nThe otlo is not built for performance. Nobody is in charge of it. It is simply there, and over generations it has held gossip, arguments, advice, wedding plans and grief.\n\n> A city keeps its stories in the places where people sit down together.\n\nThis site tries to be that step for Amdavad.', '', true, true, false],
    ['sidi-saiyyed-jaali', 'Light through stone: the Sidi Saiyyed jaali', 'Article', 'heritage', 'Fenil P. Shah', '2026-10-05', '', "A carved tree of intertwined branches in a sixteenth-century mosque has quietly become the city's emblem.", 'Replace this sample with your own piece.', '', false, true, false],
    ['uttarayan-rooftops', 'Uttarayan from the rooftops', 'Blog', 'festivals', 'Fenil P. Shah', '2026-09-28', '', "Kites, manja, undhiyu and the sound of a whole city shouting 'kaipo che' at once.", 'Replace this sample with your own Uttarayan memories.', '', false, true, false],
    ['manek-chowk-after-dark', 'Manek Chowk after dark', 'Blog', 'food', 'Fenil P. Shah', '2026-09-20', '', "By day a jewellery market, by night one of the city's most famous food streets.", 'Replace this sample with your own night at Manek Chowk.', '', false, true, false],
    ['sketches-from-adalaj', 'Sketches from Adalaj', 'Art', 'heritage', 'Fenil P. Shah', '2026-09-12', '', 'Five levels down into a late fifteenth-century stepwell, one drawing at a time.', 'Use Art posts for drawings, paintings and photo essays.\n\n![Caption for your image](paste-a-drive-link-here)', '', false, true, false],
    ['calico-museum-morning', 'A morning at the Calico Museum', 'Article', 'craft', 'Fenil P. Shah', '2026-09-02', '', 'Centuries of Indian textiles, seen slowly, in a house in Shahibaug.', 'Replace this sample with your own visit.', '', false, true, false]
  ],
  Gallery: [
    ['', 'Pol doorway, Khadia', '', 'heritage', true],
    ['', 'Kites drying before Uttarayan', '', 'festivals', true],
    ['', 'Block-printing table', '', 'craft', true],
    ['', 'Evening on the Sabarmati', '', 'river', true],
    ['', 'Chabutro in an old pol', '', 'heritage', true],
    ['', 'Late-night stall, Manek Chowk', '', 'food', true]
  ],
  Calendar: [
    ['', '', 'Every morning', 'Old City Heritage Walk', 'Swaminarayan Temple, Kalupur', 'Morning walk through the pols of the walled city.', ''],
    ['2026-11-08', '', '', 'Diwali', 'Across the city', 'Rangoli on every otlo.', ''],
    ['2026-11-19', '2026-11-25', '', 'World Heritage Week', 'Walled city', "A week to walk India's first UNESCO World Heritage City.", ''],
    ['2027-01-14', '', '', 'Uttarayan', 'Every rooftop', 'Kites, undhiyu and chikki.', ''],
    ['2027-01-29', '2027-01-31', '', 'The Stepwell', 'Ahmedabad University', 'Interdisciplinary festival of curiosity.', '']
  ]
};

/* ================= website design (generated — do not edit by hand) =================
   This is the site's HTML/CSS/JS, packed so it fits in this one file.
   ============================================================================ */
const OTLO_ENGINE = 'LyogXHUwYTkzXHUwYTlmXHUwYWIyXHUwYWNiIFx1MDBiNyBPdGxvIHNpdGUgZW5naW5lIFx1MjAxNCBzZXJ2ZWQgYnkgQXBwcyBTY3JpcHQuIEVkaXQgaGVyZSwgdGhlbiBEZXBsb3kgXHUyMTkyIE1hbmFnZSBkZXBsb3ltZW50cyBcdTIxOTIgTmV3IHZlcnNpb24uICovCihmdW5jdGlvbigpewoidXNlIHN0cmljdCI7CmNvbnN0IFNDUklQVF9TUkMgPSBkb2N1bWVudC5jdXJyZW50U2NyaXB0ID8gZG9jdW1lbnQuY3VycmVudFNjcmlwdC5zcmMgOiAiIjsKY29uc3QgT1RMT19DU1MgPSAiXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIFx1MGE5M1x1MGE5Zlx1MGFiMlx1MGFjYiBcdTAwYjcgT3RsbyBcdTIwMTQgb3Rsby5mZW5pbHBzaGFoLmNvbVxuICAgQ29udGVudCBjb21lcyBmcm9tIHRoZSBHb29nbGUgU2hlZXQgKHNlZSBPVExPX0FQSSBiZWxvdykuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cbjpyb290e1xuICAtLXJlZDojQjgxRDI0O1xuICAtLXJlZC1kZWVwOiM4RTE0MTk7XG4gIC0tcmVkLXNvZnQ6I0Y4RUNFQTtcbiAgLS1pbms6IzFEMUExODtcbiAgLS1tdXRlZDojNkI2NDYwO1xuICAtLWxpbmU6I0VCRENEOTtcbiAgLS1wYXBlcjojRkZGRkZGO1xuICAtLW1heDoxMTIwcHg7XG4gIC0tZ3U6XCJOb3RvIFNlcmlmIEd1amFyYXRpXCIsc2VyaWY7XG4gIC0tZGlzcGxheTpcIkZyYXVuY2VzXCIsR2VvcmdpYSxzZXJpZjtcbiAgLS1ib2R5OlwiU291cmNlIFNlcmlmIDRcIixHZW9yZ2lhLHNlcmlmO1xuICAtLXVpOlwiRE0gU2Fuc1wiLHN5c3RlbS11aSxzYW5zLXNlcmlmO1xufVxuKntib3gtc2l6aW5nOmJvcmRlci1ib3g7bWFyZ2luOjA7cGFkZGluZzowfVxuaHRtbHtzY3JvbGwtYmVoYXZpb3I6c21vb3RofVxuYm9keXtiYWNrZ3JvdW5kOnZhcigtLXBhcGVyKTtjb2xvcjp2YXIoLS1pbmspO2ZvbnQtZmFtaWx5OnZhcigtLWJvZHkpO2ZvbnQtc2l6ZToxOHB4O2xpbmUtaGVpZ2h0OjEuNjstd2Via2l0LWZvbnQtc21vb3RoaW5nOmFudGlhbGlhc2VkO292ZXJmbG93LXg6aGlkZGVufVxuYXtjb2xvcjppbmhlcml0O3RleHQtZGVjb3JhdGlvbjpub25lfVxuaW1ne2Rpc3BsYXk6YmxvY2s7bWF4LXdpZHRoOjEwMCV9XG4ud3JhcHttYXgtd2lkdGg6dmFyKC0tbWF4KTttYXJnaW46MCBhdXRvO3BhZGRpbmc6MCAxNnB4fVxuQG1lZGlhKG1pbi13aWR0aDo3MjBweCl7LndyYXB7cGFkZGluZzowIDMycHh9fVxuXG4vKiAtLS0tLS0tLS0tIGhlYWRlciAtLS0tLS0tLS0tICovXG5oZWFkZXIudG9we3Bvc2l0aW9uOnN0aWNreTt0b3A6MDt6LWluZGV4OjIwO2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuOTQpO2JhY2tkcm9wLWZpbHRlcjpibHVyKDhweCk7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSl9XG4udG9wIC53cmFwe2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Z2FwOjE2cHg7bWluLWhlaWdodDo2OHB4O2ZsZXgtd3JhcDp3cmFwfVxuLmJyYW5ke2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHh9XG4uYnJhbmQgLmxvZ297aGVpZ2h0OjQ2cHg7d2lkdGg6YXV0bztkaXNwbGF5OmJsb2NrfVxuLmhlcm8gaDEgLndte3dpZHRoOm1pbigxMDAlLDU2MHB4KTtoZWlnaHQ6YXV0bztkaXNwbGF5OmJsb2NrfVxuLnNye3Bvc2l0aW9uOmFic29sdXRlO3dpZHRoOjFweDtoZWlnaHQ6MXB4O292ZXJmbG93OmhpZGRlbjtjbGlwOnJlY3QoMCAwIDAgMCl9XG4uYnJhbmQgLmd1e2ZvbnQtZmFtaWx5OnZhcigtLWd1KTtmb250LXdlaWdodDo3MDA7Y29sb3I6dmFyKC0tcmVkKTtmb250LXNpemU6MzBweDtsaW5lLWhlaWdodDoxfVxuLmJyYW5kIC5lbntmb250LWZhbWlseTp2YXIoLS11aSk7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6LjMyZW07Y29sb3I6dmFyKC0tcmVkKTtmb250LXdlaWdodDo2MDA7bWFyZ2luLXRvcDo0cHh9XG5uYXYubWFpbntkaXNwbGF5OmZsZXg7Z2FwOjRweDtvdmVyZmxvdy14OmF1dG87c2Nyb2xsYmFyLXdpZHRoOm5vbmU7bWF4LXdpZHRoOjEwMCV9XG5uYXYubWFpbjo6LXdlYmtpdC1zY3JvbGxiYXJ7ZGlzcGxheTpub25lfVxubmF2Lm1haW4gYXtmb250LWZhbWlseTp2YXIoLS11aSk7Zm9udC1zaXplOjE0cHg7Zm9udC13ZWlnaHQ6NTAwO3BhZGRpbmc6OHB4IDEycHg7Ym9yZGVyLXJhZGl1czo5OTlweDt3aGl0ZS1zcGFjZTpub3dyYXA7Y29sb3I6dmFyKC0taW5rKX1cbm5hdi5tYWluIGE6aG92ZXJ7YmFja2dyb3VuZDp2YXIoLS1yZWQtc29mdCl9XG5uYXYubWFpbiBhLm9ue2JhY2tncm91bmQ6dmFyKC0tcmVkKTtjb2xvcjojZmZmfVxuQG1lZGlhKG1heC13aWR0aDo3MTlweCl7LnRvcCAud3JhcHtwYWRkaW5nLXRvcDoxMHB4O3BhZGRpbmctYm90dG9tOjZweH1uYXYubWFpbnt3aWR0aDoxMDAlO21hcmdpbjowIC0xMnB4fX1cblxuLyogLS0tLS0tLS0tLSBwYXR0ZXJucyAmIG1lZGlhIC0tLS0tLS0tLS0gKi9cbi5tZWRpYXtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW47YmFja2dyb3VuZDp2YXIoLS1yZWQtc29mdCl9XG4ubWVkaWE6OmJlZm9yZXtjb250ZW50OlwiXCI7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtiYWNrZ3JvdW5kLXNpemU6NDRweCA0NHB4O2JhY2tncm91bmQtcG9zaXRpb246Y2VudGVyfVxuLmdhbCAubWVkaWEubm9pbWd7YXNwZWN0LXJhdGlvOjQvNX1cbi5nYWwgZmlndXJlOm50aC1jaGlsZCgzbisyKSAubWVkaWEubm9pbWd7YXNwZWN0LXJhdGlvOjEvMX1cbi5nYWwgZmlndXJlOm50aC1jaGlsZCgzbikgLm1lZGlhLm5vaW1ne2FzcGVjdC1yYXRpbzozLzR9XG4ucHJvc2UgLmZpZyAubWVkaWEubm9pbWd7YXNwZWN0LXJhdGlvOjE2Lzl9XG4ubWVkaWEgaW1ne3Bvc2l0aW9uOnJlbGF0aXZlO3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7b2JqZWN0LWZpdDpjb3Zlcn1cbi5tZWRpYSAucGh7cG9zaXRpb246YWJzb2x1dGU7bGVmdDowO3JpZ2h0OjA7Ym90dG9tOjA7cGFkZGluZzoxNHB4IDE2cHg7Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxMnB4O2xldHRlci1zcGFjaW5nOi4wOGVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtjb2xvcjp2YXIoLS1yZWQtZGVlcCl9XG4uYXJjaHtib3JkZXItcmFkaXVzOjk5OXB4IDk5OXB4IDZweCA2cHh9XG5cbi8qIC0tLS0tLS0tLS0gaGVybyAtLS0tLS0tLS0tICovXG4uaGVyb3twYWRkaW5nOjQ4cHggMCA0MHB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpfVxuLmhlcm8gLndyYXB7ZGlzcGxheTpncmlkO2dhcDozNnB4O2FsaWduLWl0ZW1zOmNlbnRlcn1cbkBtZWRpYShtaW4td2lkdGg6ODgwcHgpey5oZXJvIC53cmFwe2dyaWQtdGVtcGxhdGUtY29sdW1uczoxLjE1ZnIgLjg1ZnI7Z2FwOjY0cHh9Lmhlcm97cGFkZGluZzo4MHB4IDAgNzJweH19XG4ua2lja2Vye2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTJweDtsZXR0ZXItc3BhY2luZzouMjRlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Y29sb3I6dmFyKC0tcmVkKTtmb250LXdlaWdodDo2MDB9XG4uaGVybyBoMXtmb250LWZhbWlseTp2YXIoLS1ndSk7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLXJlZCk7Zm9udC1zaXplOmNsYW1wKDcycHgsMTR2dywxNDhweCk7bGluZS1oZWlnaHQ6MS4wNTttYXJnaW46MTBweCAwIDB9XG4uaGVybyAuc3Vie2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtc2l6ZTpjbGFtcCgyNHB4LDMuMnZ3LDM0cHgpO2xpbmUtaGVpZ2h0OjEuMjttYXJnaW4tdG9wOjhweH1cbi5oZXJvIHAubGVhZHtjb2xvcjp2YXIoLS1tdXRlZCk7bWFyZ2luLXRvcDoyMHB4O21heC13aWR0aDozNGVtfVxuLmJ0bnN7ZGlzcGxheTpmbGV4O2ZsZXgtd3JhcDp3cmFwO2dhcDoxMHB4O21hcmdpbi10b3A6MjhweH1cbi5idG57Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxNXB4O2ZvbnQtd2VpZ2h0OjUwMDtwYWRkaW5nOjEycHggMjBweDtib3JkZXItcmFkaXVzOjk5OXB4O2JvcmRlcjoxLjVweCBzb2xpZCB2YXIoLS1yZWQpO2NvbG9yOnZhcigtLXJlZCk7dHJhbnNpdGlvbjouMnN9XG4uYnRuLnNvbGlke2JhY2tncm91bmQ6dmFyKC0tcmVkKTtjb2xvcjojZmZmfVxuLmJ0bjpob3ZlcntiYWNrZ3JvdW5kOnZhcigtLXJlZC1kZWVwKTtib3JkZXItY29sb3I6dmFyKC0tcmVkLWRlZXApO2NvbG9yOiNmZmZ9XG4uaGVybyAubWVkaWF7YXNwZWN0LXJhdGlvOjQvNTttYXgtd2lkdGg6NDIwcHg7d2lkdGg6MTAwJTtqdXN0aWZ5LXNlbGY6Y2VudGVyfVxuLnN0ZXBze2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6ZmxleC1zdGFydDtnYXA6MDttYXJnaW4tdG9wOi0xcHh9XG5cbi8qIC0tLS0tLS0tLS0gc2VjdGlvbnMgLS0tLS0tLS0tLSAqL1xuc2VjdGlvbi5ibG9ja3twYWRkaW5nOjU2cHggMH1cbnNlY3Rpb24uYmxvY2src2VjdGlvbi5ibG9ja3tib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1saW5lKX1cbi5oZWFke2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LWVuZDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtnYXA6MTZweDttYXJnaW4tYm90dG9tOjI4cHg7ZmxleC13cmFwOndyYXB9XG4uaGVhZCBoMntmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOmNsYW1wKDI4cHgsMy40dncsMzhweCk7bGluZS1oZWlnaHQ6MS4xNX1cbi5oZWFkIGgyIC5ndXtmb250LWZhbWlseTp2YXIoLS1ndSk7Y29sb3I6dmFyKC0tcmVkKTtmb250LXNpemU6LjdlbTttYXJnaW4tbGVmdDoxMHB4O2ZvbnQtd2VpZ2h0OjUwMH1cbi5tb3Jle2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTRweDtjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtd2VpZ2h0OjUwMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCBjdXJyZW50Q29sb3J9XG5cbi8qIGZlYXR1cmVkICovXG4uZmVhdHVyZXtkaXNwbGF5OmdyaWQ7Z2FwOjI4cHg7YWxpZ24taXRlbXM6Y2VudGVyfVxuQG1lZGlhKG1pbi13aWR0aDo4ODBweCl7LmZlYXR1cmV7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjEuMmZyIDFmcjtnYXA6NDhweH19XG4uZmVhdHVyZSAubWVkaWF7YXNwZWN0LXJhdGlvOjE2LzExO2JvcmRlci1yYWRpdXM6NnB4fVxuLmZlYXR1cmUgaDN7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Zm9udC1zaXplOmNsYW1wKDI4cHgsMy42dncsNDJweCk7bGluZS1oZWlnaHQ6MS4xMjtmb250LXdlaWdodDo2MDA7bWFyZ2luOjEwcHggMCAxNHB4fVxuLmZlYXR1cmUgcHtjb2xvcjp2YXIoLS1tdXRlZCl9XG4udGFne2Rpc3BsYXk6aW5saW5lLWZsZXg7Z2FwOjhweDthbGlnbi1pdGVtczpjZW50ZXI7Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxMnB4O2xldHRlci1zcGFjaW5nOi4xNGVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtd2VpZ2h0OjYwMH1cbi50YWcgaXt3aWR0aDo1cHg7aGVpZ2h0OjVweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOmN1cnJlbnRDb2xvcjtvcGFjaXR5Oi42fVxuXG4vKiBjbHVzdGVycyAqL1xuLmNsdXN0ZXJze2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsMWZyKTtnYXA6MTZweH1cbkBtZWRpYShtaW4td2lkdGg6NzIwcHgpey5jbHVzdGVyc3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsMWZyKTtnYXA6MjBweH19XG4uY2x7ZGlzcGxheTpibG9jaztncm91cDoxfVxuLmNsIC5tZWRpYXthc3BlY3QtcmF0aW86My80O3RyYW5zaXRpb246dHJhbnNmb3JtIC4zNXN9XG4uY2w6aG92ZXIgLm1lZGlhe3RyYW5zZm9ybTp0cmFuc2xhdGVZKC00cHgpfVxuLmNsIC5ndXtmb250LWZhbWlseTp2YXIoLS1ndSk7Y29sb3I6dmFyKC0tcmVkKTtmb250LXNpemU6MjBweDttYXJnaW4tdG9wOjEycHg7bGluZS1oZWlnaHQ6MS4zfVxuLmNsIGg0e2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6MTlweDtsaW5lLWhlaWdodDoxLjI1fVxuLmNsIHB7Zm9udC1zaXplOjE1cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2xpbmUtaGVpZ2h0OjEuNDU7bWFyZ2luLXRvcDo0cHh9XG5cbi8qIHBvc3QgY2FyZHMgKi9cbi5jaGlwc3tkaXNwbGF5OmZsZXg7Z2FwOjhweDtmbGV4LXdyYXA6d3JhcH1cbi5jaGlwe2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTNweDtwYWRkaW5nOjdweCAxNHB4O2JvcmRlci1yYWRpdXM6OTk5cHg7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtiYWNrZ3JvdW5kOiNmZmY7Y3Vyc29yOnBvaW50ZXI7Y29sb3I6dmFyKC0taW5rKX1cbi5jaGlwLm9ue2JhY2tncm91bmQ6dmFyKC0tcmVkKTtib3JkZXItY29sb3I6dmFyKC0tcmVkKTtjb2xvcjojZmZmfVxuLnBvc3Rze2Rpc3BsYXk6Z3JpZDtnYXA6MzZweCAyOHB4fVxuQG1lZGlhKG1pbi13aWR0aDo3MjBweCl7LnBvc3Rze2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMiwxZnIpfX1cbkBtZWRpYShtaW4td2lkdGg6MTAwMHB4KXsucG9zdHN7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgzLDFmcil9fVxuLmNhcmQgLm1lZGlhe2FzcGVjdC1yYXRpbzozLzI7Ym9yZGVyLXJhZGl1czo2cHg7bWFyZ2luLWJvdHRvbToxNnB4fVxuLmNhcmQgaDN7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Zm9udC13ZWlnaHQ6NjAwO2ZvbnQtc2l6ZToyM3B4O2xpbmUtaGVpZ2h0OjEuMjttYXJnaW46OHB4IDB9XG4uY2FyZDpob3ZlciBoM3tjb2xvcjp2YXIoLS1yZWQpfVxuLmNhcmQgcHtmb250LXNpemU6MTZweDtjb2xvcjp2YXIoLS1tdXRlZCk7bGluZS1oZWlnaHQ6MS41fVxuLm1ldGF7Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tdG9wOjEwcHh9XG5cbi8qIGdhbGxlcnkgKi9cbi5nYWx7Y29sdW1uczoyO2NvbHVtbi1nYXA6MTJweH1cbkBtZWRpYShtaW4td2lkdGg6NzIwcHgpey5nYWx7Y29sdW1uczozO2NvbHVtbi1nYXA6MTZweH19XG4uZ2FsIGZpZ3VyZXticmVhay1pbnNpZGU6YXZvaWQ7bWFyZ2luLWJvdHRvbToxMnB4O2N1cnNvcjp6b29tLWlufVxuLmdhbCAubWVkaWF7Ym9yZGVyLXJhZGl1czo0cHh9XG4uZ2FsIGZpZ2NhcHRpb257Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLW11dGVkKTtwYWRkaW5nOjZweCAycHggNHB4fVxuXG4vKiBjYWxlbmRhciAqL1xuLmNhbHtkaXNwbGF5OmdyaWQ7Z2FwOjA7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tbGluZSl9XG4uZXYgLmQgYi5ybmd7Zm9udC1zaXplOjI4cHg7d2hpdGUtc3BhY2U6bm93cmFwfVxuLmV2e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6OTZweCAxZnI7Z2FwOjIwcHg7cGFkZGluZzoyMHB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tbGluZSk7YWxpZ24taXRlbXM6c3RhcnR9XG4uZXYgLmR7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Y29sb3I6dmFyKC0tcmVkKTtsaW5lLWhlaWdodDoxfVxuLmV2IC5kIGJ7ZGlzcGxheTpibG9jaztmb250LXNpemU6NDBweDtmb250LXdlaWdodDo2MDB9XG4uZXYgLmQgc3Bhbntmb250LWZhbWlseTp2YXIoLS11aSk7Zm9udC1zaXplOjEycHg7bGV0dGVyLXNwYWNpbmc6LjE0ZW07dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlfVxuLmV2IC5kLmV2ZXJ5e2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTNweDtsZXR0ZXItc3BhY2luZzouMWVtO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtmb250LXdlaWdodDo2MDA7cGFkZGluZy10b3A6NnB4fVxuLmV2IGg0e2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtc2l6ZToyMXB4O2ZvbnQtd2VpZ2h0OjYwMDtsaW5lLWhlaWdodDoxLjI1fVxuLmV2IHB7Zm9udC1zaXplOjE2cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi10b3A6NHB4fVxuLmV2IGEubG5re2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTNweDtjb2xvcjp2YXIoLS1yZWQpO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIGN1cnJlbnRDb2xvcjtkaXNwbGF5OmlubGluZS1ibG9jazttYXJnaW4tdG9wOjZweH1cblxuLyogcGFnZSBoZWFkZXIgKi9cbi5waGVhZHtwYWRkaW5nOjU2cHggMCAzNnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWxpbmUpfVxuLnBoZWFkIC5ndXtmb250LWZhbWlseTp2YXIoLS1ndSk7Y29sb3I6dmFyKC0tcmVkKTtmb250LXNpemU6Y2xhbXAoNDBweCw3dncsNzJweCk7bGluZS1oZWlnaHQ6MS4yO2ZvbnQtd2VpZ2h0OjcwMH1cbi5waGVhZCBoMXtmb250LWZhbWlseTp2YXIoLS1kaXNwbGF5KTtmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOmNsYW1wKDMycHgsNXZ3LDUycHgpO2xpbmUtaGVpZ2h0OjEuMTttYXJnaW4tdG9wOjZweH1cbi5waGVhZCBwe2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW4tdG9wOjEycHg7bWF4LXdpZHRoOjM2ZW19XG5cbi8qIGFydGljbGUgKi9cbi5hcnQtaGVhZHtwYWRkaW5nOjQ4cHggMCAyOHB4O21heC13aWR0aDo3NjBweDttYXJnaW46MCBhdXRvfVxuLmFydC1oZWFkIGgxe2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6Y2xhbXAoMzRweCw1LjR2dyw1OHB4KTtsaW5lLWhlaWdodDoxLjA4O21hcmdpbjoxNHB4IDAgMTZweH1cbi5hcnQtaGVhZCAuZGVre2ZvbnQtc2l6ZToyMXB4O2NvbG9yOnZhcigtLW11dGVkKTtsaW5lLWhlaWdodDoxLjV9XG4uYXJ0LWNvdmVye21heC13aWR0aDoxMDAwcHg7bWFyZ2luOjAgYXV0b31cbi5hcnQtY292ZXIgLm1lZGlhe2FzcGVjdC1yYXRpbzoxNi85O2JvcmRlci1yYWRpdXM6NnB4fVxuLnByb3Nle21heC13aWR0aDo2ODBweDttYXJnaW46NDBweCBhdXRvIDA7Zm9udC1zaXplOjIwcHg7bGluZS1oZWlnaHQ6MS43NX1cbi5wcm9zZSBwe21hcmdpbjowIDAgMS4xNWVtfVxuLnByb3NlIGgye2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6MjhweDtsaW5lLWhlaWdodDoxLjI7bWFyZ2luOjEuNmVtIDAgLjZlbX1cbi5wcm9zZSBibG9ja3F1b3Rle2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS1yZWQpO3BhZGRpbmc6NHB4IDAgNHB4IDIycHg7bWFyZ2luOjEuNmVtIDA7Zm9udC1mYW1pbHk6dmFyKC0tZGlzcGxheSk7Zm9udC1zdHlsZTppdGFsaWM7Zm9udC1zaXplOjI0cHg7bGluZS1oZWlnaHQ6MS40O2NvbG9yOnZhcigtLXJlZC1kZWVwKX1cbi5wcm9zZSBhe2NvbG9yOnZhcigtLXJlZCk7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgY3VycmVudENvbG9yfVxuLnByb3NlIC5maWd7bWFyZ2luOjEuOGVtIDB9XG4ucHJvc2UgLmZpZyAubWVkaWF7Ym9yZGVyLXJhZGl1czo0cHh9XG4ucHJvc2UgZmlnY2FwdGlvbntmb250LWZhbWlseTp2YXIoLS11aSk7Zm9udC1zaXplOjE0cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi10b3A6OHB4fVxuLnByb3NlID4gcDpmaXJzdC1jaGlsZDo6Zmlyc3QtbGV0dGVye2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2Zsb2F0OmxlZnQ7Zm9udC1zaXplOjMuNmVtO2xpbmUtaGVpZ2h0Oi44NTtwYWRkaW5nOjZweCAxMHB4IDAgMDtjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtd2VpZ2h0OjYwMH1cbi5iYWNre2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTRweDtjb2xvcjp2YXIoLS1yZWQpO2Rpc3BsYXk6aW5saW5lLWZsZXg7Z2FwOjZweH1cblxuLyogYWJvdXQgKi9cbi5hYm91dHttYXgtd2lkdGg6NjgwcHh9XG4uYWJvdXQgcHtmb250LXNpemU6MjBweDtsaW5lLWhlaWdodDoxLjc7bWFyZ2luLWJvdHRvbToxZW19XG5cbi8qIGZvb3RlciAqL1xuZm9vdGVye2JhY2tncm91bmQ6dmFyKC0tcmVkKTtjb2xvcjojZmZmO21hcmdpbi10b3A6NzJweDtwYWRkaW5nOjU2cHggMCA0MHB4fVxuZm9vdGVyIC53cmFwe2Rpc3BsYXk6Z3JpZDtnYXA6MjhweH1cbkBtZWRpYShtaW4td2lkdGg6NzIwcHgpe2Zvb3RlciAud3JhcHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MS40ZnIgMWZyIDFmcn19XG5mb290ZXIgLmd1e2ZvbnQtZmFtaWx5OnZhcigtLWd1KTtmb250LXNpemU6NDRweDtmb250LXdlaWdodDo3MDA7bGluZS1oZWlnaHQ6MS4xfVxuZm9vdGVyIHAsZm9vdGVyIGF7Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxNHB4O29wYWNpdHk6Ljk7bGluZS1oZWlnaHQ6MS43fVxuZm9vdGVyIGF7ZGlzcGxheTpibG9ja31cbmZvb3RlciBhOmhvdmVye29wYWNpdHk6MTt0ZXh0LWRlY29yYXRpb246dW5kZXJsaW5lfVxuZm9vdGVyIGg1e2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtmb250LXNpemU6MTFweDtsZXR0ZXItc3BhY2luZzouMjRlbTt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLWJvdHRvbToxMHB4O29wYWNpdHk6Ljc1fVxuZm9vdGVyIC5maW5le2dyaWQtY29sdW1uOjEvLTE7Ym9yZGVyLXRvcDoxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwuMjUpO3BhZGRpbmctdG9wOjE4cHg7Zm9udC1zaXplOjEycHg7b3BhY2l0eTouNzV9XG5cbi8qIHN0YXRlcyAqL1xuLm5vdGV7Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxM3B4O2JhY2tncm91bmQ6dmFyKC0tcmVkLXNvZnQpO2NvbG9yOnZhcigtLXJlZC1kZWVwKTt0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjhweCAxNnB4fVxuLmVtcHR5e2ZvbnQtZmFtaWx5OnZhcigtLXVpKTtjb2xvcjp2YXIoLS1tdXRlZCk7cGFkZGluZzoyNHB4IDB9XG4ubG9hZGluZ3ttaW4taGVpZ2h0OjYwdmg7ZGlzcGxheTpncmlkO3BsYWNlLWl0ZW1zOmNlbnRlcn1cbi5sb2FkaW5nIC5ndXtmb250LWZhbWlseTp2YXIoLS1ndSk7Y29sb3I6dmFyKC0tcmVkKTtmb250LXNpemU6NTZweDtmb250LXdlaWdodDo3MDA7YW5pbWF0aW9uOnB1bHNlIDEuNHMgZWFzZS1pbi1vdXQgaW5maW5pdGV9XG5Aa2V5ZnJhbWVzIHB1bHNlezUwJXtvcGFjaXR5Oi4zNX19XG4ucmV2ZWFse29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWSgxOHB4KTt0cmFuc2l0aW9uOm9wYWNpdHkgLjdzIGVhc2UsdHJhbnNmb3JtIC43cyBlYXNlfVxuLnJldmVhbC5pbntvcGFjaXR5OjE7dHJhbnNmb3JtOm5vbmV9XG5AbWVkaWEocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjpyZWR1Y2Upey5yZXZlYWx7b3BhY2l0eToxO3RyYW5zZm9ybTpub25lO3RyYW5zaXRpb246bm9uZX1odG1se3Njcm9sbC1iZWhhdmlvcjphdXRvfX1cblxuLyogbGlnaHRib3ggKi9cbi5sYntwb3NpdGlvbjpmaXhlZDtpbnNldDowO2JhY2tncm91bmQ6cmdiYSgyMCwxMCwxMCwuOTIpO3otaW5kZXg6NTA7ZGlzcGxheTpub25lO2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3BhZGRpbmc6MjRweDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjEycHg7Y3Vyc29yOnpvb20tb3V0fVxuLmxiLm9wZW57ZGlzcGxheTpmbGV4fVxuLmxiIGltZ3ttYXgtaGVpZ2h0Ojgydmg7bWF4LXdpZHRoOjEwMCU7b2JqZWN0LWZpdDpjb250YWluO2JvcmRlci1yYWRpdXM6NHB4fVxuLmxiIHB7Y29sb3I6I2ZmZjtmb250LWZhbWlseTp2YXIoLS11aSk7Zm9udC1zaXplOjE0cHg7dGV4dC1hbGlnbjpjZW50ZXI7bWF4LXdpZHRoOjQwZW19XG5cbiNvdGxve2Rpc3BsYXk6YmxvY2t9XG4uc2hhcmV7Zm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjUwMDtjb2xvcjp2YXIoLS1yZWQpO2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MS41cHggc29saWQgdmFyKC0tcmVkKTtib3JkZXItcmFkaXVzOjk5OXB4O3BhZGRpbmc6N3B4IDE2cHg7bWFyZ2luLXRvcDoxNnB4O2N1cnNvcjpwb2ludGVyfVxuLnNoYXJlOmhvdmVye2JhY2tncm91bmQ6dmFyKC0tcmVkKTtjb2xvcjojZmZmfVxuIjsKLyogQ29uZmlnIGNvbWVzIGZyb20gdGhlIGVtYmVkIHNuaXBwZXQ6CiAgIDxkaXYgaWQ9Im90bG8iIGRhdGEtcGFnZT0icG9zdCIgZGF0YS1zbHVnPSJ3aHktYW4tb3RsbyI+PC9kaXY+CiAgIDxzY3JpcHQgc3JjPSJodHRwczovL3NjcmlwdC5nb29nbGUuY29tL21hY3Jvcy9zL1x1MjAyNi9leGVjP2FwcD0xIj48L3NjcmlwdD4gICAgICAgICAgKi8KY29uc3QgUk9PVCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJvdGxvIikgfHwgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChPYmplY3QuYXNzaWduKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImRpdiIpLCB7aWQ6Im90bG8ifSkpOwpjb25zdCBQQUdFID0gU3RyaW5nKFJPT1QuZGF0YXNldC5wYWdlIHx8ICJob21lIikudG9Mb3dlckNhc2UoKTsgICAvLyBob21lIHwgcmVhZCB8IGNsdXN0ZXJzIHwgZ2FsbGVyeSB8IGNhbGVuZGFyIHwgYWJvdXQgfCBwb3N0IHwgY2x1c3Rlcgpjb25zdCBTTFVHID0gU3RyaW5nKFJPT1QuZGF0YXNldC5zbHVnIHx8ICIiKS50cmltKCk7CmNvbnN0IE9UTE9fQVBJID0gUk9PVC5kYXRhc2V0LmFwaSB8fCAoU0NSSVBUX1NSQyA/IFNDUklQVF9TUkMuc3BsaXQoIj8iKVswXSA6ICIiKTsKbGV0IFNJVEUgPSAiaHR0cHM6Ly9vdGxvLmZlbmlscHNoYWguY29tIjsKY29uc3QgU0lURV9QQUdFUyA9IHtob21lOiIiLCByZWFkOiJyZWFkIiwgY2x1c3RlcnM6ImNsdXN0ZXJzIiwgZ2FsbGVyeToiZ2FsbGVyeSIsIGNhbGVuZGFyOiJjYWxlbmRhciIsIGFib3V0OiJhYm91dCJ9Owpjb25zdCBMSU5LX1RBUkdFVCA9ICJfdG9wIjsKY29uc3QgcGFnZVVybCA9IG5hbWUgPT4gU0lURSArIChTSVRFX1BBR0VTW25hbWVdID8gIi8iICsgU0lURV9QQUdFU1tuYW1lXSA6ICIiKTsKY29uc3QgcGFnZUxpbmsgPSAobmFtZSwgbGFiZWwsIGNscykgPT4gYDxhIGNsYXNzPSIke2Nsc30iIGhyZWY9IiR7cGFnZVVybChuYW1lKX0iIHRhcmdldD0iJHtMSU5LX1RBUkdFVH0iPiR7bGFiZWx9PC9hPmA7CmNvbnN0IHRvcEF0dHIgPSB1cmwgPT4gYGhyZWY9IiR7ZXNjKHVybCl9IiB0YXJnZXQ9IiR7TElOS19UQVJHRVR9ImA7CmNvbnN0IHBvc3RMaW5rID0gcCA9PiBwLnBhZ2VfdXJsID8gdG9wQXR0cihwLnBhZ2VfdXJsKSA6IGBocmVmPSIjL3AvJHtlbmNvZGVVUklDb21wb25lbnQocC5zbHVnKX0iYDsKY29uc3QgY2x1c3RlckxpbmsgPSBjID0+IGMucGFnZV91cmwgPyB0b3BBdHRyKGMucGFnZV91cmwpIDogYGhyZWY9IiMvYy8ke2VuY29kZVVSSUNvbXBvbmVudChjLmlkKX0iYDsKCi8qIFBhZ2Ugc2hlbGw6IGZvbnRzLCBzdHlsZXMsIGFuZCB0aGUgY29udGFpbmVycyB0aGUgcGFnZXMgcmVuZGVyIGludG8gKi8KKCgpID0+IHsKICBjb25zdCBoZWFkID0gZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7CiAgaWYoIWRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ21ldGFbbmFtZT12aWV3cG9ydF0nKSkgaGVhZC5pbnNlcnRBZGphY2VudEhUTUwoImJlZm9yZWVuZCIsICc8bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLCBpbml0aWFsLXNjYWxlPTEiPicpOwogIGhlYWQuaW5zZXJ0QWRqYWNlbnRIVE1MKCJiZWZvcmVlbmQiLAogICAgJzxsaW5rIHJlbD0icHJlY29ubmVjdCIgaHJlZj0iaHR0cHM6Ly9mb250cy5nc3RhdGljLmNvbSIgY3Jvc3NvcmlnaW4+JyArCiAgICAnPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tL2NzczI/ZmFtaWx5PU5vdG8rU2VyaWYrR3VqYXJhdGk6d2dodEA1MDA7NzAwJmZhbWlseT1GcmF1bmNlczppdGFsLG9wc3osd2dodEAwLDkuLjE0NCw0MDA7MCw5Li4xNDQsNjAwOzEsOS4uMTQ0LDQwMCZmYW1pbHk9U291cmNlK1NlcmlmKzQ6aXRhbCx3Z2h0QDAsNDAwOzAsNjAwOzEsNDAwJmZhbWlseT1ETStTYW5zOndnaHRANDAwOzUwMDs2MDAmZGlzcGxheT1zd2FwIj4nKTsKICBjb25zdCBzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInN0eWxlIik7IHN0LnRleHRDb250ZW50ID0gT1RMT19DU1M7IGhlYWQuYXBwZW5kQ2hpbGQoc3QpOwogIFJPT1QuaW5uZXJIVE1MID0gJzxkaXYgaWQ9InNhbXBsZU5vdGUiPjwvZGl2PjxtYWluIGlkPSJhcHAiPjxkaXYgY2xhc3M9ImxvYWRpbmciPjxkaXYgY2xhc3M9Imd1Ij5cdTBhOTNcdTBhOWZcdTBhYjJcdTBhY2I8L2Rpdj48L2Rpdj48L21haW4+PGRpdiBjbGFzcz0ibGIiIGlkPSJsYiI+PGltZyBhbHQ9IiI+PHA+PC9wPjwvZGl2Pic7Cn0pKCk7CgovKiAtLS0tLS0tLS0tLS0tLS0tIHNhbXBsZSBjb250ZW50ICh1c2VkIHVudGlsIHRoZSBTaGVldCBpcyBjb25uZWN0ZWQpIC0tLS0tLS0tLS0tLS0tLS0gKi8KY29uc3QgU0FNUExFID0gewogIHNldHRpbmdzOnsKICAgIHNpdGVfdGl0bGU6Ilx1MGE5M1x1MGE5Zlx1MGFiMlx1MGFjYiIsIHNpdGVfc3VidGl0bGU6Ik90bG8iLAogICAgdGFnbGluZToiU3RvcmllcywgYXJ0IGFuZCBjdWx0dXJlIGZyb20gQW1kYXZhZCIsCiAgICBoZXJvX3RleHQ6IkV2ZXJ5IHBvbCBob3VzZSBoYXMgYW4gb3RsbywgdGhlIHJhaXNlZCBzdGVwIG91dCBmcm9udCB3aGVyZSBuZWlnaGJvdXJzIHNpdCBpbiB0aGUgZXZlbmluZywgdGFsaywgYW5kIHBhc3Mgb24gdGhlIHN0b3JpZXMgb2YgdGhlIHN0cmVldC4gVGhpcyBpcyB0aGF0IHN0ZXAsIGZvciB0aGUgd2hvbGUgY2l0eS4iLAogICAgaGVyb19pbWFnZToiIiwKICAgIGFib3V0OiJPdGxvIGlzIGEgY29ybmVyIG9mIGZlbmlscHNoYWguY29tIGZvciB3cml0aW5nLCBhcnQgYW5kIHBob3RvZ3JhcGh5IGFib3V0IEFtZGF2YWQ6IGl0cyBwb2xzIGFuZCBzdGVwd2VsbHMsIGl0cyBjcmFmdHMgYW5kIGZlc3RpdmFscywgaXRzIGZvb2QsIGl0cyByaXZlciwgYW5kIHRoZSBpbnN0aXR1dGlvbnMgdGhhdCBzaGFwZWQgaXQuXG5cblRoZSBuYW1lIGNvbWVzIGZyb20gdGhlIG90bG8gKFx1MGE5M1x1MGE5Zlx1MGFiMlx1MGFjYiksIHRoZSByYWlzZWQgcGxhdGZvcm0gYXQgdGhlIGZyb250IG9mIGEgcG9sIGhvdXNlLiBJdCBpcyB3aGVyZSB0aGUgY2l0eSBoYXMgYWx3YXlzIHNhdCBkb3duIHRvIHRhbGsuIiwKICAgIGVtYWlsOiJmZW5pbEBmZW5pbHBzaGFoLmNvbSIsIGluc3RhZ3JhbToiIiwgZm9vdGVyX25vdGU6IkEgY29ybmVyIG9mIGZlbmlscHNoYWguY29tIgogIH0sCiAgY2x1c3RlcnM6WwogICAge2lkOiJoZXJpdGFnZSIsbmFtZToiSGVyaXRhZ2UgJiBBcmNoaXRlY3R1cmUiLGd1amFyYXRpOiJcdTBhYjVcdTBhYmVcdTBhYjBcdTBhYjhcdTBhY2IiLHRhZ2xpbmU6IlBvbHMsIHN0ZXB3ZWxscywgamFhbGlzIGFuZCB0aGUgd2FsbGVkIGNpdHkuIixpbWFnZToiIn0sCiAgICB7aWQ6ImNyYWZ0IixuYW1lOiJBcnQgJiBDcmFmdCIsZ3VqYXJhdGk6Ilx1MGE5NVx1MGFiMlx1MGFiZSIsdGFnbGluZToiVGV4dGlsZXMsIGJsb2NrIHByaW50cywga2l0ZXMgYW5kIHRoZSBoYW5kcyBiZWhpbmQgdGhlbS4iLGltYWdlOiIifSwKICAgIHtpZDoiZmVzdGl2YWxzIixuYW1lOiJGZXN0aXZhbHMgJiBSaXR1YWxzIixndWphcmF0aToiXHUwYWE0XHUwYWI5XHUwYWM3XHUwYWI1XHUwYWJlXHUwYWIwIix0YWdsaW5lOiJVdHRhcmF5YW4gcm9vZnRvcHMsIE5hdnJhdHJpIG5pZ2h0cywgUmF0aCBZYXRyYSBtb3JuaW5ncy4iLGltYWdlOiIifSwKICAgIHtpZDoiZm9vZCIsbmFtZToiRm9vZCIsZ3VqYXJhdGk6Ilx1MGFiOFx1MGFjZFx1MGFiNVx1MGFiZVx1MGFhNiIsdGFnbGluZToiRnJvbSBNYW5layBDaG93ayBhZnRlciBkYXJrIHRvIHRoZSBwb2wga2l0Y2hlbnMuIixpbWFnZToiIn0sCiAgICB7aWQ6Imluc3RpdHV0aW9ucyIsbmFtZToiSW5zdGl0dXRpb25zIixndWphcmF0aToiXHUwYWI4XHUwYTgyXHUwYWI4XHUwYWNkXHUwYWE1XHUwYWJlXHUwYTkzIix0YWdsaW5lOiJUaGUgbWlsbHMsIHRoZSBhc2hyYW0gYW5kIHRoZSBjYW1wdXNlcyB0aGF0IHNoYXBlZCBhIGNpdHkuIixpbWFnZToiIn0sCiAgICB7aWQ6InJpdmVyIixuYW1lOiJUaGUgUml2ZXIiLGd1amFyYXRpOiJcdTBhYjhcdTBhYmVcdTBhYWNcdTBhYjBcdTBhYWVcdTBhYTRcdTBhYzAiLHRhZ2xpbmU6IlRoZSBTYWJhcm1hdGkgYW5kIHRoZSBsaWZlIGFsb25nIGl0cyBiYW5rcy4iLGltYWdlOiIifSwKICAgIHtpZDoid2Fsa3MiLG5hbWU6IldhbGtzIixndWphcmF0aToiXHUwYWI4XHUwYWFiXHUwYWIwIix0YWdsaW5lOiJSb3V0ZXMgdGhyb3VnaCB0aGUgb2xkIGNpdHksIG9uZSBnYXRlIGF0IGEgdGltZS4iLGltYWdlOiIifQogIF0sCiAgcG9zdHM6WwogICAge3NsdWc6IndoeS1hbi1vdGxvIix0aXRsZToiV2h5IGFuIG90bG8/Iix0eXBlOiJBcnRpY2xlIixjbHVzdGVyOiJoZXJpdGFnZSIsYXV0aG9yOiJGZW5pbCBQLiBTaGFoIixkYXRlOiIyMDI2LTEwLTA5Iixjb3Zlcl9pbWFnZToiIixmZWF0dXJlZDp0cnVlLAogICAgIGV4Y2VycHQ6Ik9uIHRoZSByYWlzZWQgc3RlcCBhdCB0aGUgZnJvbnQgb2YgYSBwb2wgaG91c2UsIGFuZCB3aHkgdGhpcyBjb3JuZXIgb2YgdGhlIGludGVybmV0IGlzIG5hbWVkIGFmdGVyIGl0LiIsCiAgICAgYm9keToiV2FsayBpbnRvIGFueSBwb2wgaW4gdGhlIG9sZCBjaXR5IGluIHRoZSBldmVuaW5nIGFuZCB5b3Ugd2lsbCBmaW5kIHBlb3BsZSBzaXR0aW5nIG9uIHRoZSBvdGxvLCB0aGUgcmFpc2VkIHBsYXRmb3JtIGF0IHRoZSBmcm9udCBvZiB0aGUgaG91c2UuIEl0IGlzIG5vdCBxdWl0ZSBpbnNpZGUgYW5kIG5vdCBxdWl0ZSB0aGUgc3RyZWV0LiBJdCBpcyB0aGUgcGxhY2UgaW4gYmV0d2Vlbiwgd2hlcmUgYSBjaXR5IHRhbGtzIHRvIGl0c2VsZi5cblxuIyMgQSBzdGVwLCBub3QgYSBzdGFnZVxuXG5UaGUgb3RsbyBpcyBub3QgYnVpbHQgZm9yIHBlcmZvcm1hbmNlLiBOb2JvZHkgaXMgaW4gY2hhcmdlIG9mIGl0LiBJdCBpcyBzaW1wbHkgdGhlcmUsIGFuZCBvdmVyIGdlbmVyYXRpb25zIGl0IGhhcyBoZWxkIGdvc3NpcCwgYXJndW1lbnRzLCBhZHZpY2UsIHdlZGRpbmcgcGxhbnMgYW5kIGdyaWVmLlxuXG4+IEEgY2l0eSBrZWVwcyBpdHMgc3RvcmllcyBpbiB0aGUgcGxhY2VzIHdoZXJlIHBlb3BsZSBzaXQgZG93biB0b2dldGhlci5cblxuVGhpcyBzaXRlIHRyaWVzIHRvIGJlIHRoYXQgc3RlcCBmb3IgQW1kYXZhZDogYSBwbGFjZSB0byBzbG93IGRvd24gYW5kIGxvb2sgYWdhaW4gYXQgdGhlIHBvbHMsIHRoZSBzdGVwd2VsbHMsIHRoZSBjcmFmdHMsIHRoZSBmZXN0aXZhbHMgYW5kIHRoZSBmb29kIHRoYXQgbWFrZSB0aGUgY2l0eSB3aGF0IGl0IGlzLiJ9LAogICAge3NsdWc6InNpZGktc2FpeXllZC1qYWFsaSIsdGl0bGU6IkxpZ2h0IHRocm91Z2ggc3RvbmU6IHRoZSBTaWRpIFNhaXl5ZWQgamFhbGkiLHR5cGU6IkFydGljbGUiLGNsdXN0ZXI6Imhlcml0YWdlIixhdXRob3I6IkZlbmlsIFAuIFNoYWgiLGRhdGU6IjIwMjYtMTAtMDUiLGNvdmVyX2ltYWdlOiIiLAogICAgIGV4Y2VycHQ6IkEgY2FydmVkIHRyZWUgb2YgaW50ZXJ0d2luZWQgYnJhbmNoZXMgaW4gYSBzaXh0ZWVudGgtY2VudHVyeSBtb3NxdWUgaGFzIHF1aWV0bHkgYmVjb21lIHRoZSBjaXR5J3MgZW1ibGVtLiIsCiAgICAgYm9keToiVGhlIFNpZGkgU2FpeXllZCBtb3NxdWUgaXMgc21hbGwsIGJ1dCBpdHMgY2FydmVkIHN0b25lIGxhdHRpY2V3b3JrIG9mIGludGVydHdpbmVkIGJyYW5jaGVzIGlzIG9uZSBvZiB0aGUgbW9zdCByZWNvZ25pc2VkIGltYWdlcyBvZiBBbWRhdmFkLlxuXG5SZXBsYWNlIHRoaXMgc2FtcGxlIHdpdGggeW91ciBvd24gcGllY2U6IHdoYXQgaXQgaXMgbGlrZSB0byBzdGFuZCBpbiBmcm9udCBvZiBpdCBpbiB0aGUgbW9ybmluZyBsaWdodCwgYW5kIHdoeSBhIHdpbmRvdyBoYXMgYmVjb21lIGEgc3ltYm9sIGZvciBhbiBlbnRpcmUgY2l0eS4ifSwKICAgIHtzbHVnOiJ1dHRhcmF5YW4tcm9vZnRvcHMiLHRpdGxlOiJVdHRhcmF5YW4gZnJvbSB0aGUgcm9vZnRvcHMiLHR5cGU6IkJsb2ciLGNsdXN0ZXI6ImZlc3RpdmFscyIsYXV0aG9yOiJGZW5pbCBQLiBTaGFoIixkYXRlOiIyMDI2LTA5LTI4Iixjb3Zlcl9pbWFnZToiIiwKICAgICBleGNlcnB0OiJLaXRlcywgbWFuamEsIHVuZGhpeXUgYW5kIHRoZSBzb3VuZCBvZiBhIHdob2xlIGNpdHkgc2hvdXRpbmcgJ2thaXBvIGNoZScgYXQgb25jZS4iLAogICAgIGJvZHk6Ik9uIDE0IEphbnVhcnkgdGhlIGNpdHkgbW92ZXMgdXBzdGFpcnMuIFJlcGxhY2UgdGhpcyBzYW1wbGUgd2l0aCB5b3VyIG93biBVdHRhcmF5YW4gbWVtb3JpZXMuIn0sCiAgICB7c2x1ZzoibWFuZWstY2hvd2stYWZ0ZXItZGFyayIsdGl0bGU6Ik1hbmVrIENob3drIGFmdGVyIGRhcmsiLHR5cGU6IkJsb2ciLGNsdXN0ZXI6ImZvb2QiLGF1dGhvcjoiRmVuaWwgUC4gU2hhaCIsZGF0ZToiMjAyNi0wOS0yMCIsY292ZXJfaW1hZ2U6IiIsCiAgICAgZXhjZXJwdDoiQnkgZGF5IGEgamV3ZWxsZXJ5IG1hcmtldCwgYnkgbmlnaHQgb25lIG9mIHRoZSBjaXR5J3MgbW9zdCBmYW1vdXMgZm9vZCBzdHJlZXRzLiIsCiAgICAgYm9keToiQXMgdGhlIGpld2VsbGVyeSBzaG9wcyBjbG9zZSwgdGhlIGZvb2Qgc3RhbGxzIG9wZW4uIFJlcGxhY2UgdGhpcyBzYW1wbGUgd2l0aCB5b3VyIG93biBuaWdodCBhdCBNYW5layBDaG93ay4ifSwKICAgIHtzbHVnOiJza2V0Y2hlcy1mcm9tLWFkYWxhaiIsdGl0bGU6IlNrZXRjaGVzIGZyb20gQWRhbGFqIix0eXBlOiJBcnQiLGNsdXN0ZXI6Imhlcml0YWdlIixhdXRob3I6IkZlbmlsIFAuIFNoYWgiLGRhdGU6IjIwMjYtMDktMTIiLGNvdmVyX2ltYWdlOiIiLAogICAgIGV4Y2VycHQ6IkZpdmUgbGV2ZWxzIGRvd24gaW50byBhIGxhdGUgZmlmdGVlbnRoLWNlbnR1cnkgc3RlcHdlbGwsIG9uZSBkcmF3aW5nIGF0IGEgdGltZS4iLAogICAgIGJvZHk6IlVzZSBBcnQgcG9zdHMgZm9yIGRyYXdpbmdzLCBwYWludGluZ3MgYW5kIHBob3RvIGVzc2F5cy4gQWRkIGltYWdlcyBpbiB0aGUgYm9keSBsaWtlIHRoaXM6XG5cbiFbQ2FwdGlvbiBmb3IgeW91ciBpbWFnZV0oaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL2ZpbGUvZC9ZT1VSX0ZJTEVfSUQvdmlldykifSwKICAgIHtzbHVnOiJjYWxpY28tbXVzZXVtLW1vcm5pbmciLHRpdGxlOiJBIG1vcm5pbmcgYXQgdGhlIENhbGljbyBNdXNldW0iLHR5cGU6IkFydGljbGUiLGNsdXN0ZXI6ImNyYWZ0IixhdXRob3I6IkZlbmlsIFAuIFNoYWgiLGRhdGU6IjIwMjYtMDktMDIiLGNvdmVyX2ltYWdlOiIiLAogICAgIGV4Y2VycHQ6IkNlbnR1cmllcyBvZiBJbmRpYW4gdGV4dGlsZXMsIHNlZW4gc2xvd2x5LCBpbiBhIGhvdXNlIGluIFNoYWhpYmF1Zy4iLAogICAgIGJvZHk6IlJlcGxhY2UgdGhpcyBzYW1wbGUgd2l0aCB5b3VyIG93biB2aXNpdC4ifQogIF0sCiAgZ2FsbGVyeTpbCiAgICB7aW1hZ2U6IiIsY2FwdGlvbjoiUG9sIGRvb3J3YXksIEtoYWRpYSIsY3JlZGl0OiIiLGNsdXN0ZXI6Imhlcml0YWdlIn0sCiAgICB7aW1hZ2U6IiIsY2FwdGlvbjoiS2l0ZXMgZHJ5aW5nIGJlZm9yZSBVdHRhcmF5YW4iLGNyZWRpdDoiIixjbHVzdGVyOiJmZXN0aXZhbHMifSwKICAgIHtpbWFnZToiIixjYXB0aW9uOiJCbG9jay1wcmludGluZyB0YWJsZSIsY3JlZGl0OiIiLGNsdXN0ZXI6ImNyYWZ0In0sCiAgICB7aW1hZ2U6IiIsY2FwdGlvbjoiRXZlbmluZyBvbiB0aGUgU2FiYXJtYXRpIixjcmVkaXQ6IiIsY2x1c3Rlcjoicml2ZXIifSwKICAgIHtpbWFnZToiIixjYXB0aW9uOiJDaGFidXRybyBpbiBhbiBvbGQgcG9sIixjcmVkaXQ6IiIsY2x1c3RlcjoiaGVyaXRhZ2UifSwKICAgIHtpbWFnZToiIixjYXB0aW9uOiJMYXRlLW5pZ2h0IHN0YWxsLCBNYW5layBDaG93ayIsY3JlZGl0OiIiLGNsdXN0ZXI6ImZvb2QifQogIF0sCiAgY2FsZW5kYXI6WwogICAge2RhdGU6IiIsdGl0bGU6Ik9sZCBDaXR5IEhlcml0YWdlIFdhbGsiLHBsYWNlOiJTd2FtaW5hcmF5YW4gVGVtcGxlLCBLYWx1cHVyIixub3RlOiJNb3JuaW5nIHdhbGsgdGhyb3VnaCB0aGUgcG9scyBvZiB0aGUgd2FsbGVkIGNpdHkuIixsaW5rOiIifSwKICAgIHtkYXRlOiIyMDI2LTExLTA4Iix0aXRsZToiRGl3YWxpIixwbGFjZToiQWNyb3NzIHRoZSBjaXR5Iixub3RlOiJSYW5nb2xpIG9uIGV2ZXJ5IG90bG8uIixsaW5rOiIifSwKICAgIHtkYXRlOiIyMDI2LTExLTE5IixlbmRfZGF0ZToiMjAyNi0xMS0yNSIsdGl0bGU6IldvcmxkIEhlcml0YWdlIFdlZWsiLHBsYWNlOiJXYWxsZWQgY2l0eSIsbm90ZToiQSB3ZWVrIHRvIHdhbGsgdGhlIGNpdHkgdGhhdCBiZWNhbWUgSW5kaWEncyBmaXJzdCBVTkVTQ08gV29ybGQgSGVyaXRhZ2UgQ2l0eS4iLGxpbms6IiJ9LAogICAge2RhdGU6IjIwMjctMDEtMTQiLHRpdGxlOiJVdHRhcmF5YW4iLHBsYWNlOiJFdmVyeSByb29mdG9wIixub3RlOiJLaXRlcywgdW5kaGl5dSBhbmQgY2hpa2tpLiIsbGluazoiIn0sCiAgICB7ZGF0ZToiMjAyNy0wMS0yOSIsZW5kX2RhdGU6IjIwMjctMDEtMzEiLHRpdGxlOiJUaGUgU3RlcHdlbGwiLHBsYWNlOiJBaG1lZGFiYWQgVW5pdmVyc2l0eSIsbm90ZToiSW50ZXJkaXNjaXBsaW5hcnkgZmVzdGl2YWwgb2YgY3VyaW9zaXR5LiIsbGluazoiIn0KICBdCn07CgovKiAtLS0tLS0tLS0tLS0tLS0tIGhlbHBlcnMgLS0tLS0tLS0tLS0tLS0tLSAqLwpjb25zdCAkID0gcyA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHMpOwpjb25zdCBlc2MgPSBzID0+IFN0cmluZyhzID8/ICIiKS5yZXBsYWNlKC9bJjw+IiddL2csIGMgPT4gKHsiJiI6IiZhbXA7IiwiPCI6IiZsdDsiLCI+IjoiJmd0OyIsJyInOiImcXVvdDsiLCInIjoiJiMzOTsifVtjXSkpOwpjb25zdCBNT05USFMgPSBbIkphbiIsIkZlYiIsIk1hciIsIkFwciIsIk1heSIsIkp1biIsIkp1bCIsIkF1ZyIsIlNlcCIsIk9jdCIsIk5vdiIsIkRlYyJdOwpmdW5jdGlvbiBwYXJzZURhdGUocyl7IGNvbnN0IG0gPSBTdHJpbmcoc3x8IiIpLm1hdGNoKC9eKFxkezR9KS0oXGR7Mn0pLShcZHsyfSkvKTsgcmV0dXJuIG0gPyB7eTorbVsxXSxtOittWzJdLTEsZDorbVszXX0gOiBudWxsOyB9CmZ1bmN0aW9uIGZtdERhdGUocyl7IGNvbnN0IHAgPSBwYXJzZURhdGUocyk7IHJldHVybiBwID8gYCR7cC5kfSAke01PTlRIU1twLm1dfSAke3AueX1gIDogIiI7IH0KZnVuY3Rpb24gdHJ1dGh5KHYpeyByZXR1cm4gdiA9PT0gdHJ1ZSB8fCAvXih0cnVlfHllc3x5fDEpJC9pLnRlc3QoU3RyaW5nKHYpLnRyaW0oKSk7IH0KCi8vIEdvb2dsZSBEcml2ZSBzaGFyZSBsaW5rcyAtPiBkaXJlY3QgaW1hZ2UgbGlua3MKZnVuY3Rpb24gaW1nVXJsKHUpewogIHUgPSBTdHJpbmcodXx8IiIpLnRyaW0oKTsgaWYoIXUpIHJldHVybiAiIjsKICBjb25zdCBtID0gdS5tYXRjaCgvZHJpdmVcLmdvb2dsZVwuY29tXC8oPzpmaWxlXC9kXC98b3Blblw/aWQ9fHVjXD8oPzpleHBvcnQ9XHcrJik/aWQ9fHRodW1ibmFpbFw/aWQ9KShbXHctXXsxMCx9KS8pOwogIGlmKG0pIHJldHVybiAiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2QvIiArIG1bMV0gKyAiPXcxNjAwIjsKICByZXR1cm4gL15odHRwcz86XC9cLy9pLnRlc3QodSkgPyB1IDogIiI7Cn0KCi8vIEphYWxpIHBhdHRlcm5zIGRyYXduIGluIGNvZGUgKHVzZWQgYmVoaW5kIGV2ZXJ5IGltYWdlLCBhbmQgYXMgdGhlIHBsYWNlaG9sZGVyIHdoZW4gdGhlcmUgaXMgbm9uZSkKY29uc3QgUEFUUyA9IFsKICBgPHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0NCcgaGVpZ2h0PSc0NCc+PGcgZmlsbD0nbm9uZScgc3Ryb2tlPSclMjNCODFEMjQnIHN0cm9rZS1vcGFjaXR5PScuMzInIHN0cm9rZS13aWR0aD0nMS4yJz48Y2lyY2xlIGN4PScwJyBjeT0nMCcgcj0nMjInLz48Y2lyY2xlIGN4PSc0NCcgY3k9JzAnIHI9JzIyJy8+PGNpcmNsZSBjeD0nMCcgY3k9JzQ0JyByPScyMicvPjxjaXJjbGUgY3g9JzQ0JyBjeT0nNDQnIHI9JzIyJy8+PGNpcmNsZSBjeD0nMjInIGN5PScyMicgcj0nMjInLz48L2c+PC9zdmc+YCwKICBgPHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0NCcgaGVpZ2h0PSc0NCc+PGcgZmlsbD0nbm9uZScgc3Ryb2tlPSclMjNCODFEMjQnIHN0cm9rZS1vcGFjaXR5PScuMzInIHN0cm9rZS13aWR0aD0nMS4yJz48cGF0aCBkPSdNMjIgMiBMNDIgMjIgTDIyIDQyIEwyIDIyIFonLz48cGF0aCBkPSdNMjIgMTIgTDMyIDIyIEwyMiAzMiBMMTIgMjIgWicvPjxjaXJjbGUgY3g9JzIyJyBjeT0nMjInIHI9JzIuNScgZmlsbD0nJTIzQjgxRDI0JyBmaWxsLW9wYWNpdHk9Jy4zJy8+PC9nPjwvc3ZnPmAsCiAgYDxzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB3aWR0aD0nNDQnIGhlaWdodD0nNDQnPjxnIGZpbGw9J25vbmUnIHN0cm9rZT0nJTIzQjgxRDI0JyBzdHJva2Utb3BhY2l0eT0nLjMyJyBzdHJva2Utd2lkdGg9JzEuMic+PHBhdGggZD0nTTIyIDQgTDI3IDE3IEw0MCAyMiBMMjcgMjcgTDIyIDQwIEwxNyAyNyBMNCAyMiBMMTcgMTcgWicvPjxwYXRoIGQ9J00wIDAgTDggOCBNNDQgMCBMMzYgOCBNMCA0NCBMOCAzNiBNNDQgNDQgTDM2IDM2Jy8+PC9nPjwvc3ZnPmAKXTsKKCgpID0+IHsKICBjb25zdCBzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoInN0eWxlIik7CiAgc3QudGV4dENvbnRlbnQgPSBQQVRTLm1hcCgocyxpKSA9PiBgLnBhdCR7aX06OmJlZm9yZXtiYWNrZ3JvdW5kLWltYWdlOnVybCgiZGF0YTppbWFnZS9zdmcreG1sLCR7ZW5jb2RlVVJJQ29tcG9uZW50KHMucmVwbGFjZSgvJTIzL2csIiMiKSl9Iil9YCkuam9pbigiIik7CiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdCk7Cn0pKCk7CmZ1bmN0aW9uIG1lZGlhKHVybCwgYWx0LCBpLCBjbHM9IiIsIGxhYmVsPSIiKXsKICBjb25zdCB1ID0gaW1nVXJsKHVybCk7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJtZWRpYSBwYXQkeyhpfHwwKSAlIFBBVFMubGVuZ3RofSAke2Nsc30ke3UgPyAiIiA6ICIgbm9pbWcifSI+JHt1CiAgICA/IGA8aW1nIHNyYz0iJHtlc2ModSl9IiBhbHQ9IiR7ZXNjKGFsdCl9IiBsb2FkaW5nPSJsYXp5IiBvbmVycm9yPSJ0aGlzLnJlbW92ZSgpIj5gCiAgICA6IChsYWJlbCA/IGA8c3BhbiBjbGFzcz0icGgiPiR7ZXNjKGxhYmVsKX08L3NwYW4+YCA6ICIiKX08L2Rpdj5gOwp9CgovLyBTaW1wbGUgZm9ybWF0dGluZyBmb3IgcG9zdCBib2RpZXMgd3JpdHRlbiBpbiB0aGUgU2hlZXQKZnVuY3Rpb24gaW5saW5lKHMpewogIHJldHVybiBlc2MocykKICAgIC5yZXBsYWNlKC9cKlwqKC4rPylcKlwqL2csIjxzdHJvbmc+JDE8L3N0cm9uZz4iKQogICAgLnJlcGxhY2UoL1wqKC4rPylcKi9nLCI8ZW0+JDE8L2VtPiIpCiAgICAucmVwbGFjZSgvXFsoW15cXV0rKVxdXCgoaHR0cHM/OlwvXC9bXilcc10rKVwpL2csJzxhIGhyZWY9IiQyIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+JDE8L2E+Jyk7Cn0KZnVuY3Rpb24gcmVuZGVyQm9keSh0KXsKICByZXR1cm4gU3RyaW5nKHR8fCIiKS5yZXBsYWNlKC9cci9nLCIiKS5zcGxpdCgvXG5ccypcbi8pLm1hcCgoYixpKSA9PiB7CiAgICBiID0gYi50cmltKCk7IGlmKCFiKSByZXR1cm4gIiI7CiAgICBsZXQgbSA9IGIubWF0Y2goL14hXFsoLio/KVxdXCgoLis/KVwpJC8pOwogICAgaWYobSkgcmV0dXJuIGA8ZmlndXJlIGNsYXNzPSJmaWciPiR7bWVkaWEobVsyXSwgbVsxXSwgaSl9JHttWzFdID8gYDxmaWdjYXB0aW9uPiR7ZXNjKG1bMV0pfTwvZmlnY2FwdGlvbj5gIDogIiJ9PC9maWd1cmU+YDsKICAgIGlmKGIuc3RhcnRzV2l0aCgiIyMgIikpIHJldHVybiBgPGgyPiR7aW5saW5lKGIuc2xpY2UoMykpfTwvaDI+YDsKICAgIGlmKGIuc3RhcnRzV2l0aCgiPiIpKSByZXR1cm4gYDxibG9ja3F1b3RlPiR7aW5saW5lKGIucmVwbGFjZSgvXj5ccz8vZ20sIiIpKX08L2Jsb2NrcXVvdGU+YDsKICAgIHJldHVybiBgPHA+JHtpbmxpbmUoYikucmVwbGFjZSgvXG4vZywiPGJyPiIpfTwvcD5gOwogIH0pLmpvaW4oIiIpOwp9CgovKiAtLS0tLS0tLS0tLS0tLS0tIGRhdGEgLS0tLS0tLS0tLS0tLS0tLSAqLwpsZXQgRCA9IG51bGw7CmZ1bmN0aW9uIG5vcm1hbGlzZShkKXsKICBjb25zdCBzID0gZC5zZXR0aW5ncyB8fCB7fTsKICBjb25zdCBjbHVzdGVycyA9IChkLmNsdXN0ZXJzfHxbXSkuZmlsdGVyKGMgPT4gYy5pZCAmJiBjLm5hbWUpOwogIGNvbnN0IHBvc3RzID0gKGQucG9zdHN8fFtdKS5maWx0ZXIocCA9PiBwLnNsdWcgJiYgcC50aXRsZSAmJiAocC5wdWJsaXNoZWQgPT09IHVuZGVmaW5lZCB8fCBwLnB1Ymxpc2hlZCA9PT0gIiIgfHwgdHJ1dGh5KHAucHVibGlzaGVkKSkpCiAgICAuc29ydCgoYSxiKSA9PiBTdHJpbmcoYi5kYXRlfHwiIikubG9jYWxlQ29tcGFyZShTdHJpbmcoYS5kYXRlfHwiIikpKTsKICByZXR1cm4ge3NldHRpbmdzOnMsIGNsdXN0ZXJzLCBwb3N0cywgZ2FsbGVyeTooZC5nYWxsZXJ5fHxbXSkuZmlsdGVyKGcgPT4gZy5pbWFnZSB8fCBnLmNhcHRpb24pLCBjYWxlbmRhcjooZC5jYWxlbmRhcnx8W10pLmZpbHRlcihlID0+IGUudGl0bGUpfTsKfQphc3luYyBmdW5jdGlvbiBsb2FkKCl7CiAgaWYod2luZG93Ll9fT1RMT19EQVRBKSByZXR1cm4gbm9ybWFsaXNlKHdpbmRvdy5fX09UTE9fREFUQSk7CiAgaWYoIU9UTE9fQVBJKXsgJCgiI3NhbXBsZU5vdGUiKS5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz0ibm90ZSI+UHJldmlldyB3aXRoIHNhbXBsZSBjb250ZW50LiBDb25uZWN0IHRoZSBHb29nbGUgU2hlZXQgdG8gc2hvdyB5b3VyIG93bi48L2Rpdj5gOyByZXR1cm4gbm9ybWFsaXNlKFNBTVBMRSk7IH0KICB0cnl7CiAgICBjb25zdCBjdHJsID0gbmV3IEFib3J0Q29udHJvbGxlcigpOyBzZXRUaW1lb3V0KCgpID0+IGN0cmwuYWJvcnQoKSwgMTUwMDApOwogICAgY29uc3QgciA9IGF3YWl0IGZldGNoKE9UTE9fQVBJLCB7c2lnbmFsOmN0cmwuc2lnbmFsfSk7CiAgICBpZighci5vaykgdGhyb3cgbmV3IEVycm9yKHIuc3RhdHVzKTsKICAgIHJldHVybiBub3JtYWxpc2UoYXdhaXQgci5qc29uKCkpOwogIH1jYXRjaChlKXsKICAgIGNvbnNvbGUuZXJyb3IoIk90bG86IGNvdWxkIG5vdCBsb2FkIHRoZSBTaGVldCIsIGUpOwogICAgJCgiI3NhbXBsZU5vdGUiKS5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz0ibm90ZSI+Q291bGRuJ3QgcmVhY2ggdGhlIFNoZWV0IHJpZ2h0IG5vdywgc2hvd2luZyBzYW1wbGUgY29udGVudC48L2Rpdj5gOwogICAgcmV0dXJuIG5vcm1hbGlzZShTQU1QTEUpOwogIH0KfQpjb25zdCBjbHVzdGVyID0gaWQgPT4gRC5jbHVzdGVycy5maW5kKGMgPT4gYy5pZCA9PT0gaWQpOwpjb25zdCBjbHVzdGVySW5kZXggPSBpZCA9PiBNYXRoLm1heCgwLCBELmNsdXN0ZXJzLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGlkKSk7CgovKiAtLS0tLS0tLS0tLS0tLS0tIHBpZWNlcyAtLS0tLS0tLS0tLS0tLS0tICovCmZ1bmN0aW9uIHRhZyhwKXsKICBjb25zdCBjID0gY2x1c3RlcihwLmNsdXN0ZXIpOwogIHJldHVybiBgPHNwYW4gY2xhc3M9InRhZyI+JHtlc2MocC50eXBlIHx8ICJBcnRpY2xlIil9JHtjID8gYDxpPjwvaT4ke2VzYyhjLm5hbWUpfWAgOiAiIn08L3NwYW4+YDsKfQpmdW5jdGlvbiBjYXJkKHAsIGkpewogIHJldHVybiBgPGEgY2xhc3M9ImNhcmQgcmV2ZWFsIiAke3Bvc3RMaW5rKHApfT4KICAgICR7bWVkaWEocC5jb3Zlcl9pbWFnZSwgcC50aXRsZSwgY2x1c3RlckluZGV4KHAuY2x1c3RlcikgKyBpLCAiIiwgIiIpfQogICAgJHt0YWcocCl9PGgzPiR7ZXNjKHAudGl0bGUpfTwvaDM+PHA+JHtlc2MocC5leGNlcnB0KX08L3A+CiAgICA8ZGl2IGNsYXNzPSJtZXRhIj4ke1twLmF1dGhvciwgZm10RGF0ZShwLmRhdGUpXS5maWx0ZXIoQm9vbGVhbikubWFwKGVzYykuam9pbigiIFx1MDBiNyAiKX08L2Rpdj48L2E+YDsKfQpmdW5jdGlvbiBjbHVzdGVyVGlsZShjLCBpKXsKICByZXR1cm4gYDxhIGNsYXNzPSJjbCByZXZlYWwiICR7Y2x1c3RlckxpbmsoYyl9PgogICAgJHttZWRpYShjLmltYWdlLCBjLm5hbWUsIGksICJhcmNoIil9CiAgICA8ZGl2IGNsYXNzPSJndSI+JHtlc2MoYy5ndWphcmF0aSl9PC9kaXY+PGg0PiR7ZXNjKGMubmFtZSl9PC9oND48cD4ke2VzYyhjLnRhZ2xpbmUpfTwvcD48L2E+YDsKfQpmdW5jdGlvbiBldmVudFJvdyhlKXsKICBjb25zdCBhID0gcGFyc2VEYXRlKGUuZGF0ZSksIGIgPSBwYXJzZURhdGUoZS5lbmRfZGF0ZSk7CiAgbGV0IGQ7CiAgaWYoIWEpIGQgPSBgPGRpdiBjbGFzcz0iZCBldmVyeSI+JHtlc2MoZS53aGVuIHx8ICJPbmdvaW5nIil9PC9kaXY+YDsKICBlbHNlIGlmKGIgJiYgKGIuZCAhPT0gYS5kIHx8IGIubSAhPT0gYS5tKSkgZCA9IGA8ZGl2IGNsYXNzPSJkIj48YiBjbGFzcz0icm5nIj4ke2EuZH1cdTIwMTMke2IuZH08L2I+PHNwYW4+JHtNT05USFNbYS5tXX0ke2IubSAhPT0gYS5tID8gIlx1MjAxMyIgKyBNT05USFNbYi5tXSA6ICIifSAke2EueX08L3NwYW4+PC9kaXY+YDsKICBlbHNlIGQgPSBgPGRpdiBjbGFzcz0iZCI+PGI+JHthLmR9PC9iPjxzcGFuPiR7TU9OVEhTW2EubV19ICR7YS55fTwvc3Bhbj48L2Rpdj5gOwogIGNvbnN0IGxpbmsgPSBpbWdVcmwoZS5saW5rKSA/IGA8YSBjbGFzcz0ibG5rIiBocmVmPSIke2VzYyhlLmxpbmspfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPk1vcmU8L2E+YCA6ICIiOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZXYgcmV2ZWFsIj4ke2R9PGRpdj48aDQ+JHtlc2MoZS50aXRsZSl9PC9oND48cD4ke1tlLnBsYWNlLCBlLm5vdGVdLmZpbHRlcihCb29sZWFuKS5tYXAoZXNjKS5qb2luKCIgXHUwMGI3ICIpfTwvcD4ke2xpbmt9PC9kaXY+PC9kaXY+YDsKfQpmdW5jdGlvbiB1cGNvbWluZyhsaXN0KXsKICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLCB0b2RheSA9IGAke25vdy5nZXRGdWxsWWVhcigpfS0ke1N0cmluZyhub3cuZ2V0TW9udGgoKSsxKS5wYWRTdGFydCgyLCIwIil9LSR7U3RyaW5nKG5vdy5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIjAiKX1gOwogIGNvbnN0IGRhdGVkID0gbGlzdC5maWx0ZXIoZSA9PiBwYXJzZURhdGUoZS5kYXRlKSAmJiAoZS5lbmRfZGF0ZSB8fCBlLmRhdGUpID49IHRvZGF5KS5zb3J0KChhLGIpID0+IGEuZGF0ZS5sb2NhbGVDb21wYXJlKGIuZGF0ZSkpOwogIGNvbnN0IG9uZ29pbmcgPSBsaXN0LmZpbHRlcihlID0+ICFwYXJzZURhdGUoZS5kYXRlKSk7CiAgcmV0dXJuIFsuLi5vbmdvaW5nLCAuLi5kYXRlZF07Cn0KZnVuY3Rpb24gZ2FsbGVyeUdyaWQoaXRlbXMpewogIGlmKCFpdGVtcy5sZW5ndGgpIHJldHVybiBgPGRpdiBjbGFzcz0iZW1wdHkiPk5vIHBob3RvcyB5ZXQuPC9kaXY+YDsKICByZXR1cm4gYDxkaXYgY2xhc3M9ImdhbCI+JHtpdGVtcy5tYXAoKGcsaSkgPT4gYDxmaWd1cmUgY2xhc3M9InJldmVhbCIgZGF0YS1pPSIke2l9Ij4KICAgICR7bWVkaWEoZy5pbWFnZSwgZy5jYXB0aW9uLCBjbHVzdGVySW5kZXgoZy5jbHVzdGVyKSArIGksICIiLCBnLmltYWdlID8gIiIgOiAiQWRkIGEgcGhvdG8iKX0KICAgICR7Zy5jYXB0aW9uIHx8IGcuY3JlZGl0ID8gYDxmaWdjYXB0aW9uPiR7ZXNjKGcuY2FwdGlvbil9JHtnLmNyZWRpdCA/IGAgXHUwMGI3ICR7ZXNjKGcuY3JlZGl0KX1gIDogIiJ9PC9maWdjYXB0aW9uPmAgOiAiIn08L2ZpZ3VyZT5gKS5qb2luKCIiKX08L2Rpdj5gOwp9CgovKiAtLS0tLS0tLS0tLS0tLS0tIHBhZ2VzIC0tLS0tLS0tLS0tLS0tLS0gKi8KZnVuY3Rpb24gaG9tZSgpewogIGNvbnN0IHMgPSBELnNldHRpbmdzLCBmZWF0ID0gRC5wb3N0cy5maW5kKHAgPT4gdHJ1dGh5KHAuZmVhdHVyZWQpKSB8fCBELnBvc3RzWzBdOwogIGNvbnN0IHJlc3QgPSBELnBvc3RzLmZpbHRlcihwID0+IHAgIT09IGZlYXQpLnNsaWNlKDAsIDYpOwogIGNvbnN0IGV2ID0gdXBjb21pbmcoRC5jYWxlbmRhcikuc2xpY2UoMCwgNCk7CiAgcmV0dXJuIGAKICA8c2VjdGlvbiBjbGFzcz0iaGVybyI+PGRpdiBjbGFzcz0id3JhcCI+CiAgICA8ZGl2IGNsYXNzPSJyZXZlYWwiPgogICAgICA8ZGl2IGNsYXNzPSJraWNrZXIiPkFtZGF2YWQgXHUwMGI3IFx1MGE4NVx1MGFhZVx1MGFhNlx1MGFiZVx1MGFiNVx1MGFiZVx1MGFhNjwvZGl2PgogICAgICA8aDE+PHNwYW4gY2xhc3M9InNyIj4ke2VzYyhzLnNpdGVfdGl0bGUgfHwgIlx1MGE5M1x1MGE5Zlx1MGFiMlx1MGFjYiIpfTwvc3Bhbj48c3ZnIGNsYXNzPSJ3bSIgYXJpYS1oaWRkZW49InRydWUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMzggMjggNjEyIDI5MiI+PHBhdGggdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNTUuMCwyMzUuMCkiIGQ9Ik0yMjguNCAwLjBRMjE0LjQgMC4wIDIxNC40IC0xOC4yVi0xMDkuNjAwMDAwMDAwMDAwMDFRMjE0LjQgLTExNS4yIDIyMS44IC0xMTcuNjAwMDAwMDAwMDAwMDFRMjI0LjYwMDAwMDAwMDAwMDAyIC0xMTguNjAwMDAwMDAwMDAwMDEgMjI1LjcwMDAwMDAwMDAwMDAyIC0xMTkuMFEyMjYuOCAtMTE5LjQgMjI4LjIwMDAwMDAwMDAwMDAyIC0xMjAuMzAwMDAwMDAwMDAwMDFRMjI5LjYwMDAwMDAwMDAwMDAyIC0xMjEuMiAyMzAuOCAtMTIyLjgwMDAwMDAwMDAwMDAxVi0yMS4wUTIzMC44IC0xMy40IDIzNy4yMDAwMDAwMDAwMDAwMiAtMTMuNFEyNDIuNCAtMTMuNCAyNDYuNCAtMjEuMFEyNDYuNCAtMTEuNCAyNDEuOCAtNS43UTIzNy4yMDAwMDAwMDAwMDAwMiAwLjAgMjI4LjQgMC4wWk05NS40IC05Mi4wUTk1LjQgLTg0LjQgOTEuNyAtNzguNFE4OC4wIC03Mi40IDgxLjIgLTY4LjRRNzQuNCAtNjQuNCA2OS4yIC02Mi4zMDAwMDAwMDAwMDAwMDRRNjQuMCAtNjAuMiA1Ni42IC01OC4wUTYxLjgwMDAwMDAwMDAwMDAwNCAtNTAuODAwMDAwMDAwMDAwMDA0IDcyLjkgLTQzLjVRODQuMCAtMzYuMiA5NC44MDAwMDAwMDAwMDAwMSAtMzYuMlExMDUuMCAtMzYuNCAxMTQuMSAtNDEuNVExMjMuMiAtNDYuNiAxMjguMCAtNTYuMlExMjEuMCAtNTguNiAxMTYuODAwMDAwMDAwMDAwMDEgLTY2LjRRMTEyLjYwMDAwMDAwMDAwMDAxIC03NC4yIDExMi42MDAwMDAwMDAwMDAwMSAtODMuMlExMTIuNjAwMDAwMDAwMDAwMDEgLTk1LjAgMTE2LjYwMDAwMDAwMDAwMDAxIC0xMDIuMzAwMDAwMDAwMDAwMDFRMTIwLjYwMDAwMDAwMDAwMDAxIC0xMDkuNjAwMDAwMDAwMDAwMDEgMTI3LjQgLTEwOS42MDAwMDAwMDAwMDAwMVExMzQuNiAtMTA5LjYwMDAwMDAwMDAwMDAxIDEzOC40IC0xMDEuODAwMDAwMDAwMDAwMDFRMTQyLjIwMDAwMDAwMDAwMDAyIC05NC4wIDE0Mi4yMDAwMDAwMDAwMDAwMiAtODMuMlExNDIuMjAwMDAwMDAwMDAwMDIgLTcyLjQgMTQwLjQgLTYzLjBRMTQyLjggLTYyLjQwMDAwMDAwMDAwMDAwNiAxNDQuNiAtNjIuNDAwMDAwMDAwMDAwMDA2UTE1Mi42IC02Mi40MDAwMDAwMDAwMDAwMDYgMTU5LjggLTY2LjRRMTY3LjAgLTcwLjQgMTcxLjIwMDAwMDAwMDAwMDAyIC03Ni4yVi0xMTAuMFExNzEuMjAwMDAwMDAwMDAwMDIgLTExNS42MDAwMDAwMDAwMDAwMSAxNzcuNCAtMTE3LjRRMTgwLjggLTExOC40IDE4NS40IC0xMjAuNFExODcuMCAtMTIyLjAgMTg3LjQgLTEyMi44MDAwMDAwMDAwMDAwMVYtMjEuMFExODcuNCAtMTMuNCAxOTQuMjAwMDAwMDAwMDAwMDIgLTEzLjRRMTk5LjQgLTEzLjQgMjAyLjggLTIxLjBRMjAzLjAgLTIwLjAgMjAzLjAgLTE3LjZRMjAzLjAgLTkuOCAxOTcuOCAtNC45UTE5Mi42MDAwMDAwMDAwMDAwMiAwLjAgMTg0LjYwMDAwMDAwMDAwMDAyIDAuMFExNzEuMjAwMDAwMDAwMDAwMDIgMC4wIDE3MS4yMDAwMDAwMDAwMDAwMiAtMTguMlYtNjEuNlExNjguMjAwMDAwMDAwMDAwMDIgLTU4LjIgMTYyLjAgLTU1LjZRMTU1LjggLTUzLjAgMTUwLjYgLTUzLjBRMTQyLjggLTUzLjAgMTM4LjggLTU0LjJRMTMzLjQgLTM4LjgwMDAwMDAwMDAwMDAwNCAxMjAuNyAtMjkuNlExMDguMCAtMjAuNDAwMDAwMDAwMDAwMDAyIDk0LjgwMDAwMDAwMDAwMDAxIC0yMC40MDAwMDAwMDAwMDAwMDJRODIuMiAtMjAuNDAwMDAwMDAwMDAwMDAyIDY3LjEgLTMwLjgwMDAwMDAwMDAwMDAwNFE1Mi4wIC00MS4yIDQ1LjIgLTU0LjQwMDAwMDAwMDAwMDAwNlExNi4yIC01NS4wIDE2LjIgLTcwLjYwMDAwMDAwMDAwMDAxUTE2LjIgLTc1LjAgMjAuNSAtNzguMFEyNC44IC04MS4wIDMwLjYgLTgxLjBRNDIuNiAtODEuMCA1Mi42IC02Ni4yUTYzLjIgLTY4LjggNjkuNyAtNzUuMlE3Ni4yIC04MS42MDAwMDAwMDAwMDAwMSA3Ni40IC04Ny4yUTc2LjQgLTk5LjAgNjguMTAwMDAwMDAwMDAwMDEgLTEwNi4wUTU5LjgwMDAwMDAwMDAwMDAwNCAtMTEzLjAgNDkuODAwMDAwMDAwMDAwMDA0IC0xMTMuMFE0Mi4wIC0xMTMuMCAzNS40IC0xMTEuMzAwMDAwMDAwMDAwMDFRMjguOCAtMTA5LjYwMDAwMDAwMDAwMDAxIDI1LjggLTEwOC4yMDAwMDAwMDAwMDAwMlEyMi44IC0xMDYuODAwMDAwMDAwMDAwMDEgMTQuNCAtMTAyLjRRNy44MDAwMDAwMDAwMDAwMDEgLTk5LjAgNi42MDAwMDAwMDAwMDAwMDA1IC05OS4wUTYuMCAtOTkuMCA2LjAgLTk5LjZRNi4wIC0xMDAuMiA4LjAgLTEwMi4yUTE2LjAgLTExMS4yIDI5LjQwMDAwMDAwMDAwMDAwMiAtMTE3LjBRNDIuODAwMDAwMDAwMDAwMDA0IC0xMjIuODAwMDAwMDAwMDAwMDEgNTguNDAwMDAwMDAwMDAwMDA2IC0xMjIuODAwMDAwMDAwMDAwMDFRNzQuMCAtMTIyLjgwMDAwMDAwMDAwMDAxIDg0LjcgLTExNC4zMDAwMDAwMDAwMDAwMVE5NS40IC0xMDUuODAwMDAwMDAwMDAwMDEgOTUuNCAtOTIuMFpNMTI2LjYwMDAwMDAwMDAwMDAxIC05MS40UTEyMi40IC05MS40IDEyMi40IC04Mi42MDAwMDAwMDAwMDAwMVExMjIuNCAtNjkuMCAxMzAuMjAwMDAwMDAwMDAwMDIgLTY1LjRRMTMxLjQgLTcyLjYwMDAwMDAwMDAwMDAxIDEzMS40IC04MS42MDAwMDAwMDAwMDAwMVExMzEuNCAtOTEuNCAxMjYuNjAwMDAwMDAwMDAwMDEgLTkxLjRaTTMxLjIwMDAwMDAwMDAwMDAwMyAtNzIuOFEyNi40MDAwMDAwMDAwMDAwMDIgLTcyLjggMjYuNDAwMDAwMDAwMDAwMDAyIC02OS42MDAwMDAwMDAwMDAwMVEyNi40MDAwMDAwMDAwMDAwMDIgLTY2LjYwMDAwMDAwMDAwMDAxIDMwLjYgLTY1LjBRMzQuODAwMDAwMDAwMDAwMDA0IC02My40MDAwMDAwMDAwMDAwMDYgNDAuMiAtNjMuNDAwMDAwMDAwMDAwMDA2UTM2LjgwMDAwMDAwMDAwMDAwNCAtNzIuOCAzMS4yMDAwMDAwMDAwMDAwMDMgLTcyLjhaTTIxNC40IC0xMjUuNjAwMDAwMDAwMDAwMDFRMjA2LjQgLTEzMS44IDE5Ni4yMDAwMDAwMDAwMDAwMiAtMTQ5LjIwMDAwMDAwMDAwMDAyUTE4My4yIC0xNzEuMjAwMDAwMDAwMDAwMDIgMTc0LjYwMDAwMDAwMDAwMDAyIC0xNzEuMjAwMDAwMDAwMDAwMDJRMTcyLjggLTE3MS4yMDAwMDAwMDAwMDAwMiAxNzEuNSAtMTcwLjkwMDAwMDAwMDAwMDAzUTE3MC4yIC0xNzAuNjAwMDAwMDAwMDAwMDIgMTY4LjcgLTE3MC4wUTE2Ny4yIC0xNjkuNCAxNjYuMCAtMTY5LjIwMDAwMDAwMDAwMDAyUTE2NS4yIC0xNjkuMCAxNjQuOCAtMTY5LjBRMTY0LjIgLTE2OS4wIDE2NC4yIC0xNjkuNjAwMDAwMDAwMDAwMDJRMTY0LjIgLTE3MC4wIDE2NS4yIC0xNzEuMFExNjguMiAtMTc0LjAgMTczLjUgLTE3Ny4wUTE3OC44IC0xODAuMCAxODMuNjAwMDAwMDAwMDAwMDIgLTE4MC4wUTE5MC4wIC0xODAuMCAxOTYuMTAwMDAwMDAwMDAwMDIgLTE3My40UTIwMi4yMDAwMDAwMDAwMDAwMiAtMTY2LjggMjA2LjIwMDAwMDAwMDAwMDAyIC0xNTYuNFEyMTMuMCAtMTQxLjYgMjE3LjkgLTEzNS42UTIyMi44IC0xMjkuNiAyMzAuOCAtMTI3LjRRMjI3LjggLTEyMy4yIDIyMy44IC0xMjMuMlEyMTcuNCAtMTIzLjIgMjE0LjQgLTEyNS42MDAwMDAwMDAwMDAwMVogTTMwNy42IDAuMFEyODcuMCAwLjAgMjc0LjcgLTExLjIwMDAwMDAwMDAwMDAwMVEyNjIuNCAtMjIuNDAwMDAwMDAwMDAwMDAyIDI2Mi40IC00MS4yUTI2Mi40IC01Ni44MDAwMDAwMDAwMDAwMDQgMjczLjYgLTY1LjRRMjg0LjggLTc0LjAgMzA3LjggLTgxLjJRMzE4LjYgLTg0LjYwMDAwMDAwMDAwMDAxIDMyNC40IC04OS4yMDAwMDAwMDAwMDAwMlEzMzAuMiAtOTMuODAwMDAwMDAwMDAwMDEgMzMwLjIgLTEwMi40UTMzMC4yIC0xMTUuMiAzMTMuOCAtMTE1LjJRMzA5LjQgLTExNS4yIDMwMi40IC0xMTMuMFEyOTUuNCAtMTEwLjgwMDAwMDAwMDAwMDAxIDI5My40IC0xMTAuODAwMDAwMDAwMDAwMDFRMjkxLjQgLTExMC44MDAwMDAwMDAwMDAwMSAyOTEuNCAtMTExLjgwMDAwMDAwMDAwMDAxUTI5MS40IC0xMTQuNjAwMDAwMDAwMDAwMDEgMjk4LjggLTExOC42MDAwMDAwMDAwMDAwMVEzMDcuNCAtMTIyLjIgMzE3LjQgLTEyMi4yUTMyOS44IC0xMjIuMiAzMzguNiAtMTE2LjlRMzQ3LjQgLTExMS42MDAwMDAwMDAwMDAwMSAzNDcuNCAtMTAyLjBRMzQ3LjQgLTk3LjAgMzQ1LjIgLTkyLjlRMzQzLjAgLTg4LjgwMDAwMDAwMDAwMDAxIDM0MC41IC04Ni4zMDAwMDAwMDAwMDAwMVEzMzguMCAtODMuODAwMDAwMDAwMDAwMDEgMzMyLjIgLTgxLjBRMzI2LjQgLTc4LjIgMzIzLjEgLTc3LjBRMzE5LjggLTc1LjggMzEyLjIgLTczLjRRMzEwLjIgLTcyLjggMzA5LjIgLTcyLjRRMjk0LjYgLTY3LjIgMjg3LjYgLTU5LjZRMjgwLjYgLTUyLjAgMjgwLjYgLTM5LjgwMDAwMDAwMDAwMDAwNFEyODAuNiAtMjYuOCAyOTEuMCAtMTkuMjAwMDAwMDAwMDAwMDAzUTMwMS40IC0xMS42MDAwMDAwMDAwMDAwMDEgMzE2LjggLTExLjYwMDAwMDAwMDAwMDAwMVEzMjUuNCAtMTEuNjAwMDAwMDAwMDAwMDAxIDMzNS40IC0xNi4zUTM0NS40IC0yMS4wIDM1My4xIC0yNS43MDAwMDAwMDAwMDAwMDNRMzYwLjggLTMwLjQwMDAwMDAwMDAwMDAwMiAzNjQuMCAtMzAuNDAwMDAwMDAwMDAwMDAyUTM2NC44IC0zMC40MDAwMDAwMDAwMDAwMDIgMzY0LjggLTI5LjZRMzY0LjggLTI4LjYgMzYyLjkgLTI1LjVRMzYxLjAgLTIyLjQwMDAwMDAwMDAwMDAwMiAzNTYuNSAtMTguMFEzNTIuMCAtMTMuNjAwMDAwMDAwMDAwMDAxIDM0NS43IC05LjYwMDAwMDAwMDAwMDAwMVEzMzkuNCAtNS42MDAwMDAwMDAwMDAwMDA1IDMyOS4yOTk5OTk5OTk5OTk5NSAtMi44MDAwMDAwMDAwMDAwMDAzUTMxOS4yIDAuMCAzMDcuNiAwLjBaIE00MjYuNDAwMDAwMDAwMDAwMDMgLTEyMy42MDAwMDAwMDAwMDAwMVE0NDEuNDAwMDAwMDAwMDAwMDMgLTEyMy42MDAwMDAwMDAwMDAwMSA0NTIuMjAwMDAwMDAwMDAwMDUgLTExNy4wUTQ1OC4yMDAwMDAwMDAwMDAwNSAtMTEzLjQgNDU4LjIwMDAwMDAwMDAwMDA1IC0xMTAuMlE0NTguMjAwMDAwMDAwMDAwMDUgLTEwOC42MDAwMDAwMDAwMDAwMSA0NTUuMjAwMDAwMDAwMDAwMDUgLTEwNy42MDAwMDAwMDAwMDAwMVE0NDYuNiAtMTEyLjgwMDAwMDAwMDAwMDAxIDQzNy40MDAwMDAwMDAwMDAwMyAtMTEyLjgwMDAwMDAwMDAwMDAxUTQxOS4yMDAwMDAwMDAwMDAwNSAtMTEyLjgwMDAwMDAwMDAwMDAxIDQwNy42IC0xMDEuNVEzOTYuMCAtOTAuMiAzOTYuMCAtNzQuMlEzOTYuMCAtNTcuMCA0MTMuMyAtNDMuOVE0MzAuNiAtMzAuOCA0NTEuMCAtMjguOFE0NjEuMCAtMjcuOCA0NjEuMjAwMDAwMDAwMDAwMDUgLTI2LjQwMDAwMDAwMDAwMDAwMlE0NjEuMjAwMDAwMDAwMDAwMDUgLTI1LjIwMDAwMDAwMDAwMDAwMyA0NTUuNiAtMjMuNlE0NDcuOCAtMjEuNDAwMDAwMDAwMDAwMDAyIDQ0MC40MDAwMDAwMDAwMDAwMyAtMjEuNDAwMDAwMDAwMDAwMDAyUTQxNS42IC0yMS40MDAwMDAwMDAwMDAwMDIgMzk3LjIwMDAwMDAwMDAwMDA1IC0zNy4zMDAwMDAwMDAwMDAwMDRRMzc4LjggLTUzLjIgMzc4LjggLTc2LjRRMzc4LjggLTk2LjAgMzkzLjIwMDAwMDAwMDAwMDA1IC0xMDkuODAwMDAwMDAwMDAwMDFRNDA3LjYgLTEyMy42MDAwMDAwMDAwMDAwMSA0MjYuNDAwMDAwMDAwMDAwMDMgLTEyMy42MDAwMDAwMDAwMDAwMVpNNDk2LjAgMC4wUTQ4Mi4wIDAuMCA0ODIuMCAtMTguMlYtNzUuNjAwMDAwMDAwMDAwMDFRNDc4LjQwMDAwMDAwMDAwMDAzIC03Ni4yIDQ3NC42IC03Ni4yUTQ1NS42IC03Ni4yIDQ0NS4yMDAwMDAwMDAwMDAwNSAtNjguMlE0MzkuOCAtNjQuMCA0MzYuOCAtNjQuMFE0MzUuMjAwMDAwMDAwMDAwMDUgLTY0LjAgNDM0LjEgLTY1LjRRNDMzLjAgLTY2LjggNDMzLjAgLTY4LjRRNDMzLjAgLTcxLjQgNDM0LjEgLTczLjBRNDM1LjIwMDAwMDAwMDAwMDA1IC03NC42MDAwMDAwMDAwMDAwMSA0MzguNDAwMDAwMDAwMDAwMDMgLTc3LjJRNDU3LjQwMDAwMDAwMDAwMDAzIC05Mi44MDAwMDAwMDAwMDAwMSA0ODIuMCAtOTMuNjAwMDAwMDAwMDAwMDFWLTEwOS42MDAwMDAwMDAwMDAwMVE0ODIuMCAtMTE1LjIgNDg5LjQwMDAwMDAwMDAwMDAzIC0xMTcuNjAwMDAwMDAwMDAwMDFRNDkyLjIwMDAwMDAwMDAwMDA1IC0xMTguNjAwMDAwMDAwMDAwMDEgNDkzLjMwMDAwMDAwMDAwMDA3IC0xMTkuMFE0OTQuNDAwMDAwMDAwMDAwMDMgLTExOS40IDQ5NS44MDAwMDAwMDAwMDAwNyAtMTIwLjMwMDAwMDAwMDAwMDAxUTQ5Ny4yMDAwMDAwMDAwMDAwNSAtMTIxLjIgNDk4LjQwMDAwMDAwMDAwMDAzIC0xMjIuODAwMDAwMDAwMDAwMDFWLTIxLjBRNDk4LjQwMDAwMDAwMDAwMDAzIC0xMy40IDUwNC44IC0xMy40UTUxMC4wIC0xMy40IDUxNC4wIC0yMS4wUTUxNC4wIC0xMS40IDUwOS40IC01LjdRNTA0LjggMC4wIDQ5Ni4wIDAuMFogTTUzMC40IC0xMjUuNjAwMDAwMDAwMDAwMDFRNTIyLjQgLTEzMS44IDUxMi4xOTk5OTk5OTk5OTk5IC0xNDkuMjAwMDAwMDAwMDAwMDJRNDk5LjE5OTk5OTk5OTk5OTkzIC0xNzEuMjAwMDAwMDAwMDAwMDIgNDkwLjU5OTk5OTk5OTk5OTk3IC0xNzEuMjAwMDAwMDAwMDAwMDJRNDg4Ljc5OTk5OTk5OTk5OTk1IC0xNzEuMjAwMDAwMDAwMDAwMDIgNDg3LjQ5OTk5OTk5OTk5OTk0IC0xNzAuOTAwMDAwMDAwMDAwMDNRNDg2LjE5OTk5OTk5OTk5OTkzIC0xNzAuNjAwMDAwMDAwMDAwMDIgNDg0LjY5OTk5OTk5OTk5OTkzIC0xNzAuMFE0ODMuMTk5OTk5OTk5OTk5OTMgLTE2OS40IDQ4MS45OTk5OTk5OTk5OTk5NCAtMTY5LjIwMDAwMDAwMDAwMDAyUTQ4MS4xOTk5OTk5OTk5OTk5MyAtMTY5LjAgNDgwLjc5OTk5OTk5OTk5OTk1IC0xNjkuMFE0ODAuMTk5OTk5OTk5OTk5OTMgLTE2OS4wIDQ4MC4xOTk5OTk5OTk5OTk5MyAtMTY5LjYwMDAwMDAwMDAwMDAyUTQ4MC4xOTk5OTk5OTk5OTk5MyAtMTcwLjAgNDgxLjE5OTk5OTk5OTk5OTkzIC0xNzEuMFE0ODQuMTk5OTk5OTk5OTk5OTMgLTE3NC4wIDQ4OS40OTk5OTk5OTk5OTk5NCAtMTc3LjBRNDk0Ljc5OTk5OTk5OTk5OTk1IC0xODAuMCA0OTkuNTk5OTk5OTk5OTk5OTcgLTE4MC4wUTUwNS45OTk5OTk5OTk5OTk5NCAtMTgwLjAgNTEyLjA5OTk5OTk5OTk5OTkgLTE3My40UTUxOC4xOTk5OTk5OTk5OTk5IC0xNjYuOCA1MjIuMTk5OTk5OTk5OTk5OSAtMTU2LjRRNTI5LjAgLTE0MS42IDUzMy45IC0xMzUuNlE1MzguOCAtMTI5LjYgNTQ2LjggLTEyNy40UTU0My44IC0xMjMuMiA1MzkuOCAtMTIzLjJRNTMzLjQgLTEyMy4yIDUzMC40IC0xMjUuNjAwMDAwMDAwMDAwMDFaTTU0Ni4wIDAuMFE1MzIuMCAwLjAgNTMyLjAgLTE4LjJWLTEwOS42MDAwMDAwMDAwMDAwMVE1MzIuMCAtMTE1LjIgNTM5LjQgLTExNy42MDAwMDAwMDAwMDAwMVE1NDIuMiAtMTE4LjYwMDAwMDAwMDAwMDAxIDU0My4zIC0xMTkuMFE1NDQuNCAtMTE5LjQgNTQ1LjggLTEyMC4zMDAwMDAwMDAwMDAwMVE1NDcuMiAtMTIxLjIgNTQ4LjQgLTEyMi44MDAwMDAwMDAwMDAwMVYtMjEuMFE1NDguNCAtMTMuNCA1NTQuOCAtMTMuNFE1NjAuMCAtMTMuNCA1NjQuMCAtMjEuMFE1NjQuMCAtMTEuNCA1NTkuNCAtNS43UTU1NC44IDAuMCA1NDYuMCAwLjBaIiBmaWxsPSIjQjgxRDI0IiBzdHJva2U9IiNCODFEMjQiIHN0cm9rZS13aWR0aD0iOSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI2Ny40LDI5NS4wKSBzY2FsZSgxKSIgZD0iTTEzLjI2MDAwMDAwMDAwMDAwMiAtMjUuMTk0MDAwMDAwMDAwMDAzUTE4LjYzMiAtMjUuMTk0MDAwMDAwMDAwMDAzIDIxLjkzIC0yMS41NzNRMjUuMjI4IC0xNy45NTIgMjUuMjI4IC0xMi4wMzYwMDAwMDAwMDAwMDFRMjUuMjI4IC02LjUyODAwMDAwMDAwMDAwMDUgMjEuOTgxIC0yLjg3M1ExOC43MzQgMC43ODIgMTMuMjk0IDAuNzgyUTcuODg4MDAwMDAwMDAwMDAxIDAuNzgyIDQuNjI0MDAwMDAwMDAwMDAwNiAtMi44NTYwMDAwMDAwMDAwMDAzUTEuMzYgLTYuNDk0MDAwMDAwMDAwMDAxIDEuMzYgLTEyLjIwNjAwMDAwMDAwMDAwMVExLjM2IC0xNy45MTgwMDAwMDAwMDAwMDMgNC42NDEgLTIxLjU1NjAwMDAwMDAwMDAwNFE3LjkyMjAwMDAwMDAwMDAwMSAtMjUuMTk0MDAwMDAwMDAwMDAzIDEzLjI2MDAwMDAwMDAwMDAwMiAtMjUuMTk0MDAwMDAwMDAwMDAzWk0xMy4yOTQgLTIwLjg0MjAwMDAwMDAwMDAwMlExMC4yMDAwMDAwMDAwMDAwMDEgLTIwLjg0MjAwMDAwMDAwMDAwMiA4LjMzMDAwMDAwMDAwMDAwMiAtMTguNDc5UTYuNDYwMDAwMDAwMDAwMDAxIC0xNi4xMTYgNi40NjAwMDAwMDAwMDAwMDEgLTEyLjIwNlE2LjQ2MDAwMDAwMDAwMDAwMSAtOC4yOTYwMDAwMDAwMDAwMDEgOC4zMzAwMDAwMDAwMDAwMDIgLTUuOTMzMDAwMDAwMDAwMDAxUTEwLjIwMDAwMDAwMDAwMDAwMSAtMy41NzAwMDAwMDAwMDAwMDAzIDEzLjI5NCAtMy41NzAwMDAwMDAwMDAwMDAzUTE2LjM1NDAwMDAwMDAwMDAwMyAtMy41NzAwMDAwMDAwMDAwMDAzIDE4LjI0MSAtNS45MTZRMjAuMTI4IC04LjI2MiAyMC4xMjggLTEyLjA3UTIwLjEyOCAtMTYuMDgyIDE4LjI3NSAtMTguNDYyMDAwMDAwMDAwMDAzUTE2LjQyMiAtMjAuODQyMDAwMDAwMDAwMDAyIDEzLjI5NCAtMjAuODQyMDAwMDAwMDAwMDAyWiBNNTcuMjIyIC0yMC41MzZWMC4wSDUyLjEyMlYtMjAuNTM2SDQ0LjYwODAwMDAwMDAwMDAwNFYtMjQuNzg2SDY0LjQ2NFYtMjAuNTM2WiBNOTAuMzA0IC0yNC43ODZWLTQuMjVIMTAyLjE3MDAwMDAwMDAwMDAyVjAuMEg4NS4yMDQwMDAwMDAwMDAwMVYtMjQuNzg2WiBNMTMzLjc5MDAwMDAwMDAwMDAyIC0yNS4xOTQwMDAwMDAwMDAwMDNRMTM5LjE2MiAtMjUuMTk0MDAwMDAwMDAwMDAzIDE0Mi40NiAtMjEuNTczUTE0NS43NTggLTE3Ljk1MiAxNDUuNzU4IC0xMi4wMzYwMDAwMDAwMDAwMDFRMTQ1Ljc1OCAtNi41MjgwMDAwMDAwMDAwMDA1IDE0Mi41MTEwMDAwMDAwMDAwMiAtMi44NzNRMTM5LjI2NCAwLjc4MiAxMzMuODI0IDAuNzgyUTEyOC40MTggMC43ODIgMTI1LjE1NDAwMDAwMDAwMDAxIC0yLjg1NjAwMDAwMDAwMDAwMDNRMTIxLjg5MDAwMDAwMDAwMDAxIC02LjQ5NDAwMDAwMDAwMDAwMSAxMjEuODkwMDAwMDAwMDAwMDEgLTEyLjIwNjAwMDAwMDAwMDAwMVExMjEuODkwMDAwMDAwMDAwMDEgLTE3LjkxODAwMDAwMDAwMDAwMyAxMjUuMTcxMDAwMDAwMDAwMDIgLTIxLjU1NjAwMDAwMDAwMDAwNFExMjguNDUyMDAwMDAwMDAwMDMgLTI1LjE5NDAwMDAwMDAwMDAwMyAxMzMuNzkwMDAwMDAwMDAwMDIgLTI1LjE5NDAwMDAwMDAwMDAwM1pNMTMzLjgyNCAtMjAuODQyMDAwMDAwMDAwMDAyUTEzMC43MzAwMDAwMDAwMDAwMiAtMjAuODQyMDAwMDAwMDAwMDAyIDEyOC44NiAtMTguNDc5UTEyNi45OTAwMDAwMDAwMDAwMSAtMTYuMTE2IDEyNi45OTAwMDAwMDAwMDAwMSAtMTIuMjA2UTEyNi45OTAwMDAwMDAwMDAwMSAtOC4yOTYwMDAwMDAwMDAwMDEgMTI4Ljg2IC01LjkzMzAwMDAwMDAwMDAwMVExMzAuNzMwMDAwMDAwMDAwMDIgLTMuNTcwMDAwMDAwMDAwMDAwMyAxMzMuODI0IC0zLjU3MDAwMDAwMDAwMDAwMDNRMTM2Ljg4NDAwMDAwMDAwMDAxIC0zLjU3MDAwMDAwMDAwMDAwMDMgMTM4Ljc3MTAwMDAwMDAwMDAyIC01LjkxNlExNDAuNjU4MDAwMDAwMDAwMDIgLTguMjYyIDE0MC42NTgwMDAwMDAwMDAwMiAtMTIuMDdRMTQwLjY1ODAwMDAwMDAwMDAyIC0xNi4wODIgMTM4LjgwNSAtMTguNDYyMDAwMDAwMDAwMDAzUTEzNi45NTIwMDAwMDAwMDAwMyAtMjAuODQyMDAwMDAwMDAwMDAyIDEzMy44MjQgLTIwLjg0MjAwMDAwMDAwMDAwMloiIGZpbGw9IiNCODFEMjQiLz48L3N2Zz48L2gxPgogICAgICA8ZGl2IGNsYXNzPSJzdWIiPiR7ZXNjKHMudGFnbGluZSl9PC9kaXY+CiAgICAgIDxwIGNsYXNzPSJsZWFkIj4ke2VzYyhzLmhlcm9fdGV4dCl9PC9wPgogICAgICA8ZGl2IGNsYXNzPSJidG5zIj4ke3BhZ2VMaW5rKCJyZWFkIiwiU3RhcnQgcmVhZGluZyIsImJ0biBzb2xpZCIpfSR7cGFnZUxpbmsoImNsdXN0ZXJzIiwiRXhwbG9yZSB0aGUgY2l0eSIsImJ0biIpfTwvZGl2PgogICAgPC9kaXY+CiAgICAke21lZGlhKHMuaGVyb19pbWFnZSwgcy5zaXRlX3RpdGxlLCAwLCAiYXJjaCByZXZlYWwiKX0KICA8L2Rpdj48L3NlY3Rpb24+CgogICR7ZmVhdCA/IGA8c2VjdGlvbiBjbGFzcz0iYmxvY2siPjxkaXYgY2xhc3M9IndyYXAiPgogICAgPGEgY2xhc3M9ImZlYXR1cmUgcmV2ZWFsIiAke3Bvc3RMaW5rKGZlYXQpfT4KICAgICAgJHttZWRpYShmZWF0LmNvdmVyX2ltYWdlLCBmZWF0LnRpdGxlLCAxKX0KICAgICAgPGRpdj48ZGl2IGNsYXNzPSJraWNrZXIiPkZlYXR1cmVkPC9kaXY+PGgzPiR7ZXNjKGZlYXQudGl0bGUpfTwvaDM+PHA+JHtlc2MoZmVhdC5leGNlcnB0KX08L3A+CiAgICAgIDxkaXYgY2xhc3M9Im1ldGEiPiR7dGFnKGZlYXQpfTwvZGl2PjwvZGl2PgogICAgPC9hPjwvZGl2Pjwvc2VjdGlvbj5gIDogIiJ9CgogIDxzZWN0aW9uIGNsYXNzPSJibG9jayI+PGRpdiBjbGFzcz0id3JhcCI+CiAgICA8ZGl2IGNsYXNzPSJoZWFkIj48aDI+VGhlIGNpdHksIGluIGNsdXN0ZXJzPHNwYW4gY2xhc3M9Imd1Ij5cdTBhYjZcdTBhYjlcdTBhYzdcdTBhYjA8L3NwYW4+PC9oMj4ke3BhZ2VMaW5rKCJjbHVzdGVycyIsIkFsbCBjbHVzdGVycyIsIm1vcmUiKX08L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNsdXN0ZXJzIj4ke0QuY2x1c3RlcnMuc2xpY2UoMCwgNCkubWFwKGNsdXN0ZXJUaWxlKS5qb2luKCIiKX08L2Rpdj4KICA8L2Rpdj48L3NlY3Rpb24+CgogIDxzZWN0aW9uIGNsYXNzPSJibG9jayI+PGRpdiBjbGFzcz0id3JhcCI+CiAgICA8ZGl2IGNsYXNzPSJoZWFkIj48aDI+TGF0ZXN0IGZyb20gdGhlIG90bG88c3BhbiBjbGFzcz0iZ3UiPlx1MGFhOFx1MGFiNVx1MGFjMVx1MGE4Mjwvc3Bhbj48L2gyPiR7cGFnZUxpbmsoInJlYWQiLCJFdmVyeXRoaW5nIiwibW9yZSIpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0icG9zdHMiPiR7cmVzdC5tYXAoY2FyZCkuam9pbigiIikgfHwgYDxkaXYgY2xhc3M9ImVtcHR5Ij5Ob3RoaW5nIGhlcmUgeWV0LjwvZGl2PmB9PC9kaXY+CiAgPC9kaXY+PC9zZWN0aW9uPgoKICAke0QuZ2FsbGVyeS5sZW5ndGggPyBgPHNlY3Rpb24gY2xhc3M9ImJsb2NrIj48ZGl2IGNsYXNzPSJ3cmFwIj4KICAgIDxkaXYgY2xhc3M9ImhlYWQiPjxoMj5Gcm9tIHRoZSBnYWxsZXJ5PHNwYW4gY2xhc3M9Imd1Ij5cdTBhOWFcdTBhYmZcdTBhYTRcdTBhY2RcdTBhYjBcdTBhY2I8L3NwYW4+PC9oMj4ke3BhZ2VMaW5rKCJnYWxsZXJ5IiwiRnVsbCBnYWxsZXJ5IiwibW9yZSIpfTwvZGl2PgogICAgJHtnYWxsZXJ5R3JpZChELmdhbGxlcnkuc2xpY2UoMCwgNikpfQogIDwvZGl2Pjwvc2VjdGlvbj5gIDogIiJ9CgogICR7ZXYubGVuZ3RoID8gYDxzZWN0aW9uIGNsYXNzPSJibG9jayI+PGRpdiBjbGFzcz0id3JhcCI+CiAgICA8ZGl2IGNsYXNzPSJoZWFkIj48aDI+QXJvdW5kIHRoZSBjaXR5PHNwYW4gY2xhc3M9Imd1Ij5cdTBhODlcdTBhYTRcdTBhY2RcdTBhYjhcdTBhYjU8L3NwYW4+PC9oMj4ke3BhZ2VMaW5rKCJjYWxlbmRhciIsIkNhbGVuZGFyIiwibW9yZSIpfTwvZGl2PgogICAgPGRpdiBjbGFzcz0iY2FsIj4ke2V2Lm1hcChldmVudFJvdykuam9pbigiIil9PC9kaXY+CiAgPC9kaXY+PC9zZWN0aW9uPmAgOiAiIn1gOwp9CgpsZXQgZmlsdGVyID0gIkFsbCI7CmZ1bmN0aW9uIHJlYWQoKXsKICBjb25zdCB0eXBlcyA9IFsiQWxsIiwgLi4ubmV3IFNldChELnBvc3RzLm1hcChwID0+IHAudHlwZSB8fCAiQXJ0aWNsZSIpKV07CiAgY29uc3QgbGlzdCA9IGZpbHRlciA9PT0gIkFsbCIgPyBELnBvc3RzIDogRC5wb3N0cy5maWx0ZXIocCA9PiAocC50eXBlIHx8ICJBcnRpY2xlIikgPT09IGZpbHRlcik7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJwaGVhZCI+PGRpdiBjbGFzcz0id3JhcCI+PGRpdiBjbGFzcz0iZ3UiPlx1MGFiNVx1MGFiZVx1MGE4Mlx1MGE5YVx1MGFjYjwvZGl2PjxoMT5SZWFkPC9oMT4KICAgIDxwPkFydGljbGVzLCBibG9ncyBhbmQgYXJ0IGZyb20gdGhlIG90bG8uPC9wPjwvZGl2PjwvZGl2PgogICAgPHNlY3Rpb24gY2xhc3M9ImJsb2NrIj48ZGl2IGNsYXNzPSJ3cmFwIj4KICAgICAgPGRpdiBjbGFzcz0iaGVhZCI+PGRpdiBjbGFzcz0iY2hpcHMiPiR7dHlwZXMubWFwKHQgPT4gYDxidXR0b24gY2xhc3M9ImNoaXAgJHt0ID09PSBmaWx0ZXIgPyAib24iIDogIiJ9IiBkYXRhLWY9IiR7ZXNjKHQpfSI+JHtlc2ModCl9PC9idXR0b24+YCkuam9pbigiIil9PC9kaXY+PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBvc3RzIj4ke2xpc3QubWFwKGNhcmQpLmpvaW4oIiIpIHx8IGA8ZGl2IGNsYXNzPSJlbXB0eSI+Tm90aGluZyBoZXJlIHlldC48L2Rpdj5gfTwvZGl2PgogICAgPC9kaXY+PC9zZWN0aW9uPmA7Cn0KZnVuY3Rpb24gY2x1c3RlcnNQYWdlKCl7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJwaGVhZCI+PGRpdiBjbGFzcz0id3JhcCI+PGRpdiBjbGFzcz0iZ3UiPlx1MGFiNlx1MGFiOVx1MGFjN1x1MGFiMDwvZGl2PjxoMT5UaGUgY2l0eSwgaW4gY2x1c3RlcnM8L2gxPgogICAgPHA+U2V2ZW4gd2F5cyBpbnRvIEFtZGF2YWQuIFBpY2sgb25lIGFuZCBzdGFydCB3YWxraW5nLjwvcD48L2Rpdj48L2Rpdj4KICAgIDxzZWN0aW9uIGNsYXNzPSJibG9jayI+PGRpdiBjbGFzcz0id3JhcCI+PGRpdiBjbGFzcz0iY2x1c3RlcnMiPiR7RC5jbHVzdGVycy5tYXAoY2x1c3RlclRpbGUpLmpvaW4oIiIpfTwvZGl2PjwvZGl2Pjwvc2VjdGlvbj5gOwp9CmZ1bmN0aW9uIGNsdXN0ZXJQYWdlKGlkKXsKICBjb25zdCBjID0gY2x1c3RlcihpZCk7IGlmKCFjKSByZXR1cm4gbm90Rm91bmQoKTsKICBjb25zdCBwb3N0cyA9IEQucG9zdHMuZmlsdGVyKHAgPT4gcC5jbHVzdGVyID09PSBpZCksIGdhbCA9IEQuZ2FsbGVyeS5maWx0ZXIoZyA9PiBnLmNsdXN0ZXIgPT09IGlkKTsKICByZXR1cm4gYDxkaXYgY2xhc3M9InBoZWFkIj48ZGl2IGNsYXNzPSJ3cmFwIj48YSBjbGFzcz0iYmFjayIgaHJlZj0iIy8iPlx1MjE5MCBCYWNrPC9hPgogICAgPGRpdiBjbGFzcz0iZ3UiIHN0eWxlPSJtYXJnaW4tdG9wOjE4cHgiPiR7ZXNjKGMuZ3VqYXJhdGkpfTwvZGl2PjxoMT4ke2VzYyhjLm5hbWUpfTwvaDE+PHA+JHtlc2MoYy50YWdsaW5lKX08L3A+PC9kaXY+PC9kaXY+CiAgICA8c2VjdGlvbiBjbGFzcz0iYmxvY2siPjxkaXYgY2xhc3M9IndyYXAiPjxkaXYgY2xhc3M9InBvc3RzIj4ke3Bvc3RzLm1hcChjYXJkKS5qb2luKCIiKSB8fCBgPGRpdiBjbGFzcz0iZW1wdHkiPk5vIHdyaXRpbmcgaW4gdGhpcyBjbHVzdGVyIHlldC48L2Rpdj5gfTwvZGl2PjwvZGl2Pjwvc2VjdGlvbj4KICAgICR7Z2FsLmxlbmd0aCA/IGA8c2VjdGlvbiBjbGFzcz0iYmxvY2siPjxkaXYgY2xhc3M9IndyYXAiPjxkaXYgY2xhc3M9ImhlYWQiPjxoMj5QaG90b2dyYXBoczwvaDI+PC9kaXY+JHtnYWxsZXJ5R3JpZChnYWwpfTwvZGl2Pjwvc2VjdGlvbj5gIDogIiJ9YDsKfQpmdW5jdGlvbiBwb3N0UGFnZShzbHVnKXsKICBjb25zdCBwID0gRC5wb3N0cy5maW5kKHggPT4geC5zbHVnID09PSBzbHVnKTsgaWYoIXApIHJldHVybiBub3RGb3VuZCgpOwogIGNvbnN0IG1vcmUgPSBELnBvc3RzLmZpbHRlcih4ID0+IHggIT09IHAgJiYgeC5jbHVzdGVyID09PSBwLmNsdXN0ZXIpLnNsaWNlKDAsIDMpOwogIGNvbnN0IGV4dHJhID0gU3RyaW5nKHAuZ2FsbGVyeSB8fCAiIikuc3BsaXQoL1tcbixdKy8pLm1hcChzID0+IHMudHJpbSgpKS5maWx0ZXIoQm9vbGVhbik7CiAgcmV0dXJuIGA8YXJ0aWNsZT48ZGl2IGNsYXNzPSJ3cmFwIj4KICAgICAgPGRpdiBjbGFzcz0iYXJ0LWhlYWQiPjxhIGNsYXNzPSJiYWNrIiBocmVmPSIjLyI+XHUyMTkwIEJhY2s8L2E+PGRpdiBzdHlsZT0ibWFyZ2luLXRvcDoyMnB4Ij4ke3RhZyhwKX08L2Rpdj4KICAgICAgICA8aDE+JHtlc2MocC50aXRsZSl9PC9oMT4ke3AuZXhjZXJwdCA/IGA8cCBjbGFzcz0iZGVrIj4ke2VzYyhwLmV4Y2VycHQpfTwvcD5gIDogIiJ9CiAgICAgICAgPGRpdiBjbGFzcz0ibWV0YSI+JHtbcC5hdXRob3IsIGZtdERhdGUocC5kYXRlKV0uZmlsdGVyKEJvb2xlYW4pLm1hcChlc2MpLmpvaW4oIiBcdTAwYjcgIil9PC9kaXY+CiAgICAgICAgJHtwLnBhZ2VfdXJsID8gYDxidXR0b24gY2xhc3M9InNoYXJlIiBkYXRhLXVybD0iJHtlc2MocC5wYWdlX3VybCl9Ij5Db3B5IGxpbms8L2J1dHRvbj5gIDogIiJ9PC9kaXY+CiAgICAgICR7cC5jb3Zlcl9pbWFnZSA/IGA8ZGl2IGNsYXNzPSJhcnQtY292ZXIiPiR7bWVkaWEocC5jb3Zlcl9pbWFnZSwgcC50aXRsZSwgMSl9PC9kaXY+YCA6ICIifQogICAgICA8ZGl2IGNsYXNzPSJwcm9zZSI+JHtyZW5kZXJCb2R5KHAuYm9keSl9CiAgICAgICAgJHtleHRyYS5tYXAoKHUsaSkgPT4gYDxmaWd1cmUgY2xhc3M9ImZpZyI+JHttZWRpYSh1LCBwLnRpdGxlLCBpKX08L2ZpZ3VyZT5gKS5qb2luKCIiKX08L2Rpdj4KICAgIDwvZGl2PjwvYXJ0aWNsZT4KICAgICR7bW9yZS5sZW5ndGggPyBgPHNlY3Rpb24gY2xhc3M9ImJsb2NrIiBzdHlsZT0ibWFyZ2luLXRvcDo1NnB4Ij48ZGl2IGNsYXNzPSJ3cmFwIj48ZGl2IGNsYXNzPSJoZWFkIj48aDI+TW9yZSBmcm9tICR7ZXNjKGNsdXN0ZXIocC5jbHVzdGVyKT8ubmFtZSB8fCAidGhlIG90bG8iKX08L2gyPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwb3N0cyI+JHttb3JlLm1hcChjYXJkKS5qb2luKCIiKX08L2Rpdj48L2Rpdj48L3NlY3Rpb24+YCA6ICIifWA7Cn0KZnVuY3Rpb24gZ2FsbGVyeVBhZ2UoKXsKICByZXR1cm4gYDxkaXYgY2xhc3M9InBoZWFkIj48ZGl2IGNsYXNzPSJ3cmFwIj48ZGl2IGNsYXNzPSJndSI+XHUwYTlhXHUwYWJmXHUwYWE0XHUwYWNkXHUwYWIwXHUwYWNiPC9kaXY+PGgxPkdhbGxlcnk8L2gxPjxwPlBob3RvZ3JhcGhzIGFuZCBhcnR3b3JrIGZyb20gYWNyb3NzIHRoZSBjaXR5LjwvcD48L2Rpdj48L2Rpdj4KICAgIDxzZWN0aW9uIGNsYXNzPSJibG9jayI+PGRpdiBjbGFzcz0id3JhcCI+JHtnYWxsZXJ5R3JpZChELmdhbGxlcnkpfTwvZGl2Pjwvc2VjdGlvbj5gOwp9CmZ1bmN0aW9uIGNhbGVuZGFyUGFnZSgpewogIGNvbnN0IGV2ID0gdXBjb21pbmcoRC5jYWxlbmRhcik7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJwaGVhZCI+PGRpdiBjbGFzcz0id3JhcCI+PGRpdiBjbGFzcz0iZ3UiPlx1MGE4OVx1MGFhNFx1MGFjZFx1MGFiOFx1MGFiNTwvZGl2PjxoMT5Bcm91bmQgdGhlIGNpdHk8L2gxPjxwPkZlc3RpdmFscywgd2Fsa3MgYW5kIGdhdGhlcmluZ3Mgd29ydGgga25vd2luZyBhYm91dC48L3A+PC9kaXY+PC9kaXY+CiAgICA8c2VjdGlvbiBjbGFzcz0iYmxvY2siPjxkaXYgY2xhc3M9IndyYXAiPjxkaXYgY2xhc3M9ImNhbCI+JHtldi5tYXAoZXZlbnRSb3cpLmpvaW4oIiIpIHx8IGA8ZGl2IGNsYXNzPSJlbXB0eSI+Tm90aGluZyBjb21pbmcgdXAgcmlnaHQgbm93LjwvZGl2PmB9PC9kaXY+PC9kaXY+PC9zZWN0aW9uPmA7Cn0KZnVuY3Rpb24gYWJvdXRQYWdlKCl7CiAgY29uc3QgcyA9IEQuc2V0dGluZ3M7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJwaGVhZCI+PGRpdiBjbGFzcz0id3JhcCI+PGRpdiBjbGFzcz0iZ3UiPiR7ZXNjKHMuc2l0ZV90aXRsZSB8fCAiXHUwYTkzXHUwYTlmXHUwYWIyXHUwYWNiIil9PC9kaXY+PGgxPkFib3V0IE90bG88L2gxPjwvZGl2PjwvZGl2PgogICAgPHNlY3Rpb24gY2xhc3M9ImJsb2NrIj48ZGl2IGNsYXNzPSJ3cmFwIGFib3V0Ij4ke1N0cmluZyhzLmFib3V0fHwiIikuc3BsaXQoL1xuXHMqXG4vKS5tYXAodCA9PiBgPHA+JHtpbmxpbmUodCl9PC9wPmApLmpvaW4oIiIpfQogICAgJHtzLmVtYWlsID8gYDxwIHN0eWxlPSJmb250LXNpemU6MTdweDtmb250LWZhbWlseTp2YXIoLS11aSkiPldyaXRlIGluOiA8YSBzdHlsZT0iY29sb3I6dmFyKC0tcmVkKTtib3JkZXItYm90dG9tOjFweCBzb2xpZCIgaHJlZj0ibWFpbHRvOiR7ZXNjKHMuZW1haWwpfSI+JHtlc2Mocy5lbWFpbCl9PC9hPjwvcD5gIDogIiJ9PC9kaXY+PC9zZWN0aW9uPmA7Cn0KZnVuY3Rpb24gbWFpbnRlbmFuY2VQYWdlKCl7CiAgY29uc3QgcyA9IEQuc2V0dGluZ3M7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJwaGVhZCIgc3R5bGU9Im1pbi1oZWlnaHQ6NzB2aDtkaXNwbGF5OmdyaWQ7YWxpZ24tY29udGVudDpjZW50ZXIiPjxkaXYgY2xhc3M9IndyYXAiPgogICAgPGRpdiBjbGFzcz0ia2lja2VyIj5VbmRlciBtYWludGVuYW5jZSBcdTAwYjcgPHNwYW4gc3R5bGU9ImZvbnQtZmFtaWx5OnZhcigtLWd1KTtsZXR0ZXItc3BhY2luZzowO3RleHQtdHJhbnNmb3JtOm5vbmUiPlx1MGE5NVx1MGFiZVx1MGFhZSBcdTBhOWFcdTBhYmVcdTBhYjJcdTBhYzEgXHUwYTliXHUwYWM3PC9zcGFuPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3UiIHN0eWxlPSJtYXJnaW4tdG9wOjE0cHgiPiR7ZXNjKHMuc2l0ZV90aXRsZSB8fCAiXHUwYTkzXHUwYTlmXHUwYWIyXHUwYWNiIil9PC9kaXY+CiAgICA8aDE+JHtlc2Mocy5tYWludGVuYW5jZV90aXRsZSB8fCAiV2UncmUgdGlkeWluZyB1cCB0aGUgb3RsbyIpfTwvaDE+CiAgICA8cD4ke2VzYyhzLm1haW50ZW5hbmNlX21lc3NhZ2UgfHwgIk90bG8gaXMgdW5kZXIgbWFpbnRlbmFuY2UgZm9yIGEgbGl0dGxlIHdoaWxlLiBQbGVhc2UgY2hlY2sgYmFjayBzb29uLiIpfTwvcD4KICAgICR7cy5lbWFpbCA/IGA8cCBzdHlsZT0iZm9udC1mYW1pbHk6dmFyKC0tdWkpO2ZvbnQtc2l6ZToxNXB4Ij5OZWVkIHVzPyA8YSBzdHlsZT0iY29sb3I6dmFyKC0tcmVkKTtib3JkZXItYm90dG9tOjFweCBzb2xpZCIgaHJlZj0ibWFpbHRvOiR7ZXNjKHMuZW1haWwpfSI+JHtlc2Mocy5lbWFpbCl9PC9hPjwvcD5gIDogIiJ9CiAgPC9kaXY+PC9kaXY+YDsKfQpmdW5jdGlvbiBub3RGb3VuZCgpewogIHJldHVybiBgPGRpdiBjbGFzcz0icGhlYWQiPjxkaXYgY2xhc3M9IndyYXAiPjxkaXYgY2xhc3M9Imd1Ij5cdTBhOTNcdTBhOWZcdTBhYjJcdTBhY2I8L2Rpdj48aDE+VGhpcyBzdGVwIGlzIGVtcHR5PC9oMT48cD5UaGUgcGFnZSB5b3Ugd2VyZSBsb29raW5nIGZvciBpc24ndCBoZXJlLiA8YSBjbGFzcz0ibW9yZSIgaHJlZj0iIy8iPkdvIGJhY2s8L2E+PC9wPjwvZGl2PjwvZGl2PmA7Cn0KZnVuY3Rpb24gZm9vdGVyKCl7CiAgY29uc3QgcyA9IEQuc2V0dGluZ3M7CiAgcmV0dXJuIGA8ZGl2IGNsYXNzPSJ3cmFwIj4KICAgIDxkaXY+PHN2ZyBjbGFzcz0id20iIHN0eWxlPSJ3aWR0aDoyMDBweDtoZWlnaHQ6YXV0bztkaXNwbGF5OmJsb2NrIiBhcmlhLWxhYmVsPSJcdTBhOTNcdTBhOWZcdTBhYjJcdTBhY2IgT3RsbyIgcm9sZT0iaW1nIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2ODIgMzIwIj48cGF0aCB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1NS4wLDIzNS4wKSIgZD0iTTIyOC40IDAuMFEyMTQuNCAwLjAgMjE0LjQgLTE4LjJWLTEwOS42MDAwMDAwMDAwMDAwMVEyMTQuNCAtMTE1LjIgMjIxLjggLTExNy42MDAwMDAwMDAwMDAwMVEyMjQuNjAwMDAwMDAwMDAwMDIgLTExOC42MDAwMDAwMDAwMDAwMSAyMjUuNzAwMDAwMDAwMDAwMDIgLTExOS4wUTIyNi44IC0xMTkuNCAyMjguMjAwMDAwMDAwMDAwMDIgLTEyMC4zMDAwMDAwMDAwMDAwMVEyMjkuNjAwMDAwMDAwMDAwMDIgLTEyMS4yIDIzMC44IC0xMjIuODAwMDAwMDAwMDAwMDFWLTIxLjBRMjMwLjggLTEzLjQgMjM3LjIwMDAwMDAwMDAwMDAyIC0xMy40UTI0Mi40IC0xMy40IDI0Ni40IC0yMS4wUTI0Ni40IC0xMS40IDI0MS44IC01LjdRMjM3LjIwMDAwMDAwMDAwMDAyIDAuMCAyMjguNCAwLjBaTTk1LjQgLTkyLjBROTUuNCAtODQuNCA5MS43IC03OC40UTg4LjAgLTcyLjQgODEuMiAtNjguNFE3NC40IC02NC40IDY5LjIgLTYyLjMwMDAwMDAwMDAwMDAwNFE2NC4wIC02MC4yIDU2LjYgLTU4LjBRNjEuODAwMDAwMDAwMDAwMDA0IC01MC44MDAwMDAwMDAwMDAwMDQgNzIuOSAtNDMuNVE4NC4wIC0zNi4yIDk0LjgwMDAwMDAwMDAwMDAxIC0zNi4yUTEwNS4wIC0zNi40IDExNC4xIC00MS41UTEyMy4yIC00Ni42IDEyOC4wIC01Ni4yUTEyMS4wIC01OC42IDExNi44MDAwMDAwMDAwMDAwMSAtNjYuNFExMTIuNjAwMDAwMDAwMDAwMDEgLTc0LjIgMTEyLjYwMDAwMDAwMDAwMDAxIC04My4yUTExMi42MDAwMDAwMDAwMDAwMSAtOTUuMCAxMTYuNjAwMDAwMDAwMDAwMDEgLTEwMi4zMDAwMDAwMDAwMDAwMVExMjAuNjAwMDAwMDAwMDAwMDEgLTEwOS42MDAwMDAwMDAwMDAwMSAxMjcuNCAtMTA5LjYwMDAwMDAwMDAwMDAxUTEzNC42IC0xMDkuNjAwMDAwMDAwMDAwMDEgMTM4LjQgLTEwMS44MDAwMDAwMDAwMDAwMVExNDIuMjAwMDAwMDAwMDAwMDIgLTk0LjAgMTQyLjIwMDAwMDAwMDAwMDAyIC04My4yUTE0Mi4yMDAwMDAwMDAwMDAwMiAtNzIuNCAxNDAuNCAtNjMuMFExNDIuOCAtNjIuNDAwMDAwMDAwMDAwMDA2IDE0NC42IC02Mi40MDAwMDAwMDAwMDAwMDZRMTUyLjYgLTYyLjQwMDAwMDAwMDAwMDAwNiAxNTkuOCAtNjYuNFExNjcuMCAtNzAuNCAxNzEuMjAwMDAwMDAwMDAwMDIgLTc2LjJWLTExMC4wUTE3MS4yMDAwMDAwMDAwMDAwMiAtMTE1LjYwMDAwMDAwMDAwMDAxIDE3Ny40IC0xMTcuNFExODAuOCAtMTE4LjQgMTg1LjQgLTEyMC40UTE4Ny4wIC0xMjIuMCAxODcuNCAtMTIyLjgwMDAwMDAwMDAwMDAxVi0yMS4wUTE4Ny40IC0xMy40IDE5NC4yMDAwMDAwMDAwMDAwMiAtMTMuNFExOTkuNCAtMTMuNCAyMDIuOCAtMjEuMFEyMDMuMCAtMjAuMCAyMDMuMCAtMTcuNlEyMDMuMCAtOS44IDE5Ny44IC00LjlRMTkyLjYwMDAwMDAwMDAwMDAyIDAuMCAxODQuNjAwMDAwMDAwMDAwMDIgMC4wUTE3MS4yMDAwMDAwMDAwMDAwMiAwLjAgMTcxLjIwMDAwMDAwMDAwMDAyIC0xOC4yVi02MS42UTE2OC4yMDAwMDAwMDAwMDAwMiAtNTguMiAxNjIuMCAtNTUuNlExNTUuOCAtNTMuMCAxNTAuNiAtNTMuMFExNDIuOCAtNTMuMCAxMzguOCAtNTQuMlExMzMuNCAtMzguODAwMDAwMDAwMDAwMDA0IDEyMC43IC0yOS42UTEwOC4wIC0yMC40MDAwMDAwMDAwMDAwMDIgOTQuODAwMDAwMDAwMDAwMDEgLTIwLjQwMDAwMDAwMDAwMDAwMlE4Mi4yIC0yMC40MDAwMDAwMDAwMDAwMDIgNjcuMSAtMzAuODAwMDAwMDAwMDAwMDA0UTUyLjAgLTQxLjIgNDUuMiAtNTQuNDAwMDAwMDAwMDAwMDA2UTE2LjIgLTU1LjAgMTYuMiAtNzAuNjAwMDAwMDAwMDAwMDFRMTYuMiAtNzUuMCAyMC41IC03OC4wUTI0LjggLTgxLjAgMzAuNiAtODEuMFE0Mi42IC04MS4wIDUyLjYgLTY2LjJRNjMuMiAtNjguOCA2OS43IC03NS4yUTc2LjIgLTgxLjYwMDAwMDAwMDAwMDAxIDc2LjQgLTg3LjJRNzYuNCAtOTkuMCA2OC4xMDAwMDAwMDAwMDAwMSAtMTA2LjBRNTkuODAwMDAwMDAwMDAwMDA0IC0xMTMuMCA0OS44MDAwMDAwMDAwMDAwMDQgLTExMy4wUTQyLjAgLTExMy4wIDM1LjQgLTExMS4zMDAwMDAwMDAwMDAwMVEyOC44IC0xMDkuNjAwMDAwMDAwMDAwMDEgMjUuOCAtMTA4LjIwMDAwMDAwMDAwMDAyUTIyLjggLTEwNi44MDAwMDAwMDAwMDAwMSAxNC40IC0xMDIuNFE3LjgwMDAwMDAwMDAwMDAwMSAtOTkuMCA2LjYwMDAwMDAwMDAwMDAwMDUgLTk5LjBRNi4wIC05OS4wIDYuMCAtOTkuNlE2LjAgLTEwMC4yIDguMCAtMTAyLjJRMTYuMCAtMTExLjIgMjkuNDAwMDAwMDAwMDAwMDAyIC0xMTcuMFE0Mi44MDAwMDAwMDAwMDAwMDQgLTEyMi44MDAwMDAwMDAwMDAwMSA1OC40MDAwMDAwMDAwMDAwMDYgLTEyMi44MDAwMDAwMDAwMDAwMVE3NC4wIC0xMjIuODAwMDAwMDAwMDAwMDEgODQuNyAtMTE0LjMwMDAwMDAwMDAwMDAxUTk1LjQgLTEwNS44MDAwMDAwMDAwMDAwMSA5NS40IC05Mi4wWk0xMjYuNjAwMDAwMDAwMDAwMDEgLTkxLjRRMTIyLjQgLTkxLjQgMTIyLjQgLTgyLjYwMDAwMDAwMDAwMDAxUTEyMi40IC02OS4wIDEzMC4yMDAwMDAwMDAwMDAwMiAtNjUuNFExMzEuNCAtNzIuNjAwMDAwMDAwMDAwMDEgMTMxLjQgLTgxLjYwMDAwMDAwMDAwMDAxUTEzMS40IC05MS40IDEyNi42MDAwMDAwMDAwMDAwMSAtOTEuNFpNMzEuMjAwMDAwMDAwMDAwMDAzIC03Mi44UTI2LjQwMDAwMDAwMDAwMDAwMiAtNzIuOCAyNi40MDAwMDAwMDAwMDAwMDIgLTY5LjYwMDAwMDAwMDAwMDAxUTI2LjQwMDAwMDAwMDAwMDAwMiAtNjYuNjAwMDAwMDAwMDAwMDEgMzAuNiAtNjUuMFEzNC44MDAwMDAwMDAwMDAwMDQgLTYzLjQwMDAwMDAwMDAwMDAwNiA0MC4yIC02My40MDAwMDAwMDAwMDAwMDZRMzYuODAwMDAwMDAwMDAwMDA0IC03Mi44IDMxLjIwMDAwMDAwMDAwMDAwMyAtNzIuOFpNMjE0LjQgLTEyNS42MDAwMDAwMDAwMDAwMVEyMDYuNCAtMTMxLjggMTk2LjIwMDAwMDAwMDAwMDAyIC0xNDkuMjAwMDAwMDAwMDAwMDJRMTgzLjIgLTE3MS4yMDAwMDAwMDAwMDAwMiAxNzQuNjAwMDAwMDAwMDAwMDIgLTE3MS4yMDAwMDAwMDAwMDAwMlExNzIuOCAtMTcxLjIwMDAwMDAwMDAwMDAyIDE3MS41IC0xNzAuOTAwMDAwMDAwMDAwMDNRMTcwLjIgLTE3MC42MDAwMDAwMDAwMDAwMiAxNjguNyAtMTcwLjBRMTY3LjIgLTE2OS40IDE2Ni4wIC0xNjkuMjAwMDAwMDAwMDAwMDJRMTY1LjIgLTE2OS4wIDE2NC44IC0xNjkuMFExNjQuMiAtMTY5LjAgMTY0LjIgLTE2OS42MDAwMDAwMDAwMDAwMlExNjQuMiAtMTcwLjAgMTY1LjIgLTE3MS4wUTE2OC4yIC0xNzQuMCAxNzMuNSAtMTc3LjBRMTc4LjggLTE4MC4wIDE4My42MDAwMDAwMDAwMDAwMiAtMTgwLjBRMTkwLjAgLTE4MC4wIDE5Ni4xMDAwMDAwMDAwMDAwMiAtMTczLjRRMjAyLjIwMDAwMDAwMDAwMDAyIC0xNjYuOCAyMDYuMjAwMDAwMDAwMDAwMDIgLTE1Ni40UTIxMy4wIC0xNDEuNiAyMTcuOSAtMTM1LjZRMjIyLjggLTEyOS42IDIzMC44IC0xMjcuNFEyMjcuOCAtMTIzLjIgMjIzLjggLTEyMy4yUTIxNy40IC0xMjMuMiAyMTQuNCAtMTI1LjYwMDAwMDAwMDAwMDAxWiBNMzA3LjYgMC4wUTI4Ny4wIDAuMCAyNzQuNyAtMTEuMjAwMDAwMDAwMDAwMDAxUTI2Mi40IC0yMi40MDAwMDAwMDAwMDAwMDIgMjYyLjQgLTQxLjJRMjYyLjQgLTU2LjgwMDAwMDAwMDAwMDAwNCAyNzMuNiAtNjUuNFEyODQuOCAtNzQuMCAzMDcuOCAtODEuMlEzMTguNiAtODQuNjAwMDAwMDAwMDAwMDEgMzI0LjQgLTg5LjIwMDAwMDAwMDAwMDAyUTMzMC4yIC05My44MDAwMDAwMDAwMDAwMSAzMzAuMiAtMTAyLjRRMzMwLjIgLTExNS4yIDMxMy44IC0xMTUuMlEzMDkuNCAtMTE1LjIgMzAyLjQgLTExMy4wUTI5NS40IC0xMTAuODAwMDAwMDAwMDAwMDEgMjkzLjQgLTExMC44MDAwMDAwMDAwMDAwMVEyOTEuNCAtMTEwLjgwMDAwMDAwMDAwMDAxIDI5MS40IC0xMTEuODAwMDAwMDAwMDAwMDFRMjkxLjQgLTExNC42MDAwMDAwMDAwMDAwMSAyOTguOCAtMTE4LjYwMDAwMDAwMDAwMDAxUTMwNy40IC0xMjIuMiAzMTcuNCAtMTIyLjJRMzI5LjggLTEyMi4yIDMzOC42IC0xMTYuOVEzNDcuNCAtMTExLjYwMDAwMDAwMDAwMDAxIDM0Ny40IC0xMDIuMFEzNDcuNCAtOTcuMCAzNDUuMiAtOTIuOVEzNDMuMCAtODguODAwMDAwMDAwMDAwMDEgMzQwLjUgLTg2LjMwMDAwMDAwMDAwMDAxUTMzOC4wIC04My44MDAwMDAwMDAwMDAwMSAzMzIuMiAtODEuMFEzMjYuNCAtNzguMiAzMjMuMSAtNzcuMFEzMTkuOCAtNzUuOCAzMTIuMiAtNzMuNFEzMTAuMiAtNzIuOCAzMDkuMiAtNzIuNFEyOTQuNiAtNjcuMiAyODcuNiAtNTkuNlEyODAuNiAtNTIuMCAyODAuNiAtMzkuODAwMDAwMDAwMDAwMDA0UTI4MC42IC0yNi44IDI5MS4wIC0xOS4yMDAwMDAwMDAwMDAwMDNRMzAxLjQgLTExLjYwMDAwMDAwMDAwMDAwMSAzMTYuOCAtMTEuNjAwMDAwMDAwMDAwMDAxUTMyNS40IC0xMS42MDAwMDAwMDAwMDAwMDEgMzM1LjQgLTE2LjNRMzQ1LjQgLTIxLjAgMzUzLjEgLTI1LjcwMDAwMDAwMDAwMDAwM1EzNjAuOCAtMzAuNDAwMDAwMDAwMDAwMDAyIDM2NC4wIC0zMC40MDAwMDAwMDAwMDAwMDJRMzY0LjggLTMwLjQwMDAwMDAwMDAwMDAwMiAzNjQuOCAtMjkuNlEzNjQuOCAtMjguNiAzNjIuOSAtMjUuNVEzNjEuMCAtMjIuNDAwMDAwMDAwMDAwMDAyIDM1Ni41IC0xOC4wUTM1Mi4wIC0xMy42MDAwMDAwMDAwMDAwMDEgMzQ1LjcgLTkuNjAwMDAwMDAwMDAwMDAxUTMzOS40IC01LjYwMDAwMDAwMDAwMDAwMDUgMzI5LjI5OTk5OTk5OTk5OTk1IC0yLjgwMDAwMDAwMDAwMDAwMDNRMzE5LjIgMC4wIDMwNy42IDAuMFogTTQyNi40MDAwMDAwMDAwMDAwMyAtMTIzLjYwMDAwMDAwMDAwMDAxUTQ0MS40MDAwMDAwMDAwMDAwMyAtMTIzLjYwMDAwMDAwMDAwMDAxIDQ1Mi4yMDAwMDAwMDAwMDAwNSAtMTE3LjBRNDU4LjIwMDAwMDAwMDAwMDA1IC0xMTMuNCA0NTguMjAwMDAwMDAwMDAwMDUgLTExMC4yUTQ1OC4yMDAwMDAwMDAwMDAwNSAtMTA4LjYwMDAwMDAwMDAwMDAxIDQ1NS4yMDAwMDAwMDAwMDAwNSAtMTA3LjYwMDAwMDAwMDAwMDAxUTQ0Ni42IC0xMTIuODAwMDAwMDAwMDAwMDEgNDM3LjQwMDAwMDAwMDAwMDAzIC0xMTIuODAwMDAwMDAwMDAwMDFRNDE5LjIwMDAwMDAwMDAwMDA1IC0xMTIuODAwMDAwMDAwMDAwMDEgNDA3LjYgLTEwMS41UTM5Ni4wIC05MC4yIDM5Ni4wIC03NC4yUTM5Ni4wIC01Ny4wIDQxMy4zIC00My45UTQzMC42IC0zMC44IDQ1MS4wIC0yOC44UTQ2MS4wIC0yNy44IDQ2MS4yMDAwMDAwMDAwMDAwNSAtMjYuNDAwMDAwMDAwMDAwMDAyUTQ2MS4yMDAwMDAwMDAwMDAwNSAtMjUuMjAwMDAwMDAwMDAwMDAzIDQ1NS42IC0yMy42UTQ0Ny44IC0yMS40MDAwMDAwMDAwMDAwMDIgNDQwLjQwMDAwMDAwMDAwMDAzIC0yMS40MDAwMDAwMDAwMDAwMDJRNDE1LjYgLTIxLjQwMDAwMDAwMDAwMDAwMiAzOTcuMjAwMDAwMDAwMDAwMDUgLTM3LjMwMDAwMDAwMDAwMDAwNFEzNzguOCAtNTMuMiAzNzguOCAtNzYuNFEzNzguOCAtOTYuMCAzOTMuMjAwMDAwMDAwMDAwMDUgLTEwOS44MDAwMDAwMDAwMDAwMVE0MDcuNiAtMTIzLjYwMDAwMDAwMDAwMDAxIDQyNi40MDAwMDAwMDAwMDAwMyAtMTIzLjYwMDAwMDAwMDAwMDAxWk00OTYuMCAwLjBRNDgyLjAgMC4wIDQ4Mi4wIC0xOC4yVi03NS42MDAwMDAwMDAwMDAwMVE0NzguNDAwMDAwMDAwMDAwMDMgLTc2LjIgNDc0LjYgLTc2LjJRNDU1LjYgLTc2LjIgNDQ1LjIwMDAwMDAwMDAwMDA1IC02OC4yUTQzOS44IC02NC4wIDQzNi44IC02NC4wUTQzNS4yMDAwMDAwMDAwMDAwNSAtNjQuMCA0MzQuMSAtNjUuNFE0MzMuMCAtNjYuOCA0MzMuMCAtNjguNFE0MzMuMCAtNzEuNCA0MzQuMSAtNzMuMFE0MzUuMjAwMDAwMDAwMDAwMDUgLTc0LjYwMDAwMDAwMDAwMDAxIDQzOC40MDAwMDAwMDAwMDAwMyAtNzcuMlE0NTcuNDAwMDAwMDAwMDAwMDMgLTkyLjgwMDAwMDAwMDAwMDAxIDQ4Mi4wIC05My42MDAwMDAwMDAwMDAwMVYtMTA5LjYwMDAwMDAwMDAwMDAxUTQ4Mi4wIC0xMTUuMiA0ODkuNDAwMDAwMDAwMDAwMDMgLTExNy42MDAwMDAwMDAwMDAwMVE0OTIuMjAwMDAwMDAwMDAwMDUgLTExOC42MDAwMDAwMDAwMDAwMSA0OTMuMzAwMDAwMDAwMDAwMDcgLTExOS4wUTQ5NC40MDAwMDAwMDAwMDAwMyAtMTE5LjQgNDk1LjgwMDAwMDAwMDAwMDA3IC0xMjAuMzAwMDAwMDAwMDAwMDFRNDk3LjIwMDAwMDAwMDAwMDA1IC0xMjEuMiA0OTguNDAwMDAwMDAwMDAwMDMgLTEyMi44MDAwMDAwMDAwMDAwMVYtMjEuMFE0OTguNDAwMDAwMDAwMDAwMDMgLTEzLjQgNTA0LjggLTEzLjRRNTEwLjAgLTEzLjQgNTE0LjAgLTIxLjBRNTE0LjAgLTExLjQgNTA5LjQgLTUuN1E1MDQuOCAwLjAgNDk2LjAgMC4wWiBNNTMwLjQgLTEyNS42MDAwMDAwMDAwMDAwMVE1MjIuNCAtMTMxLjggNTEyLjE5OTk5OTk5OTk5OTkgLTE0OS4yMDAwMDAwMDAwMDAwMlE0OTkuMTk5OTk5OTk5OTk5OTMgLTE3MS4yMDAwMDAwMDAwMDAwMiA0OTAuNTk5OTk5OTk5OTk5OTcgLTE3MS4yMDAwMDAwMDAwMDAwMlE0ODguNzk5OTk5OTk5OTk5OTUgLTE3MS4yMDAwMDAwMDAwMDAwMiA0ODcuNDk5OTk5OTk5OTk5OTQgLTE3MC45MDAwMDAwMDAwMDAwM1E0ODYuMTk5OTk5OTk5OTk5OTMgLTE3MC42MDAwMDAwMDAwMDAwMiA0ODQuNjk5OTk5OTk5OTk5OTMgLTE3MC4wUTQ4My4xOTk5OTk5OTk5OTk5MyAtMTY5LjQgNDgxLjk5OTk5OTk5OTk5OTk0IC0xNjkuMjAwMDAwMDAwMDAwMDJRNDgxLjE5OTk5OTk5OTk5OTkzIC0xNjkuMCA0ODAuNzk5OTk5OTk5OTk5OTUgLTE2OS4wUTQ4MC4xOTk5OTk5OTk5OTk5MyAtMTY5LjAgNDgwLjE5OTk5OTk5OTk5OTkzIC0xNjkuNjAwMDAwMDAwMDAwMDJRNDgwLjE5OTk5OTk5OTk5OTkzIC0xNzAuMCA0ODEuMTk5OTk5OTk5OTk5OTMgLTE3MS4wUTQ4NC4xOTk5OTk5OTk5OTk5MyAtMTc0LjAgNDg5LjQ5OTk5OTk5OTk5OTk0IC0xNzcuMFE0OTQuNzk5OTk5OTk5OTk5OTUgLTE4MC4wIDQ5OS41OTk5OTk5OTk5OTk5NyAtMTgwLjBRNTA1Ljk5OTk5OTk5OTk5OTk0IC0xODAuMCA1MTIuMDk5OTk5OTk5OTk5OSAtMTczLjRRNTE4LjE5OTk5OTk5OTk5OTkgLTE2Ni44IDUyMi4xOTk5OTk5OTk5OTk5IC0xNTYuNFE1MjkuMCAtMTQxLjYgNTMzLjkgLTEzNS42UTUzOC44IC0xMjkuNiA1NDYuOCAtMTI3LjRRNTQzLjggLTEyMy4yIDUzOS44IC0xMjMuMlE1MzMuNCAtMTIzLjIgNTMwLjQgLTEyNS42MDAwMDAwMDAwMDAwMVpNNTQ2LjAgMC4wUTUzMi4wIDAuMCA1MzIuMCAtMTguMlYtMTA5LjYwMDAwMDAwMDAwMDAxUTUzMi4wIC0xMTUuMiA1MzkuNCAtMTE3LjYwMDAwMDAwMDAwMDAxUTU0Mi4yIC0xMTguNjAwMDAwMDAwMDAwMDEgNTQzLjMgLTExOS4wUTU0NC40IC0xMTkuNCA1NDUuOCAtMTIwLjMwMDAwMDAwMDAwMDAxUTU0Ny4yIC0xMjEuMiA1NDguNCAtMTIyLjgwMDAwMDAwMDAwMDAxVi0yMS4wUTU0OC40IC0xMy40IDU1NC44IC0xMy40UTU2MC4wIC0xMy40IDU2NC4wIC0yMS4wUTU2NC4wIC0xMS40IDU1OS40IC01LjdRNTU0LjggMC4wIDU0Ni4wIDAuMFoiIGZpbGw9IiNmZmYiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMjY3LjQsMjk1LjApIHNjYWxlKDEpIiBkPSJNMTMuMjYwMDAwMDAwMDAwMDAyIC0yNS4xOTQwMDAwMDAwMDAwMDNRMTguNjMyIC0yNS4xOTQwMDAwMDAwMDAwMDMgMjEuOTMgLTIxLjU3M1EyNS4yMjggLTE3Ljk1MiAyNS4yMjggLTEyLjAzNjAwMDAwMDAwMDAwMVEyNS4yMjggLTYuNTI4MDAwMDAwMDAwMDAwNSAyMS45ODEgLTIuODczUTE4LjczNCAwLjc4MiAxMy4yOTQgMC43ODJRNy44ODgwMDAwMDAwMDAwMDEgMC43ODIgNC42MjQwMDAwMDAwMDAwMDA2IC0yLjg1NjAwMDAwMDAwMDAwMDNRMS4zNiAtNi40OTQwMDAwMDAwMDAwMDEgMS4zNiAtMTIuMjA2MDAwMDAwMDAwMDAxUTEuMzYgLTE3LjkxODAwMDAwMDAwMDAwMyA0LjY0MSAtMjEuNTU2MDAwMDAwMDAwMDA0UTcuOTIyMDAwMDAwMDAwMDAxIC0yNS4xOTQwMDAwMDAwMDAwMDMgMTMuMjYwMDAwMDAwMDAwMDAyIC0yNS4xOTQwMDAwMDAwMDAwMDNaTTEzLjI5NCAtMjAuODQyMDAwMDAwMDAwMDAyUTEwLjIwMDAwMDAwMDAwMDAwMSAtMjAuODQyMDAwMDAwMDAwMDAyIDguMzMwMDAwMDAwMDAwMDAyIC0xOC40NzlRNi40NjAwMDAwMDAwMDAwMDEgLTE2LjExNiA2LjQ2MDAwMDAwMDAwMDAwMSAtMTIuMjA2UTYuNDYwMDAwMDAwMDAwMDAxIC04LjI5NjAwMDAwMDAwMDAwMSA4LjMzMDAwMDAwMDAwMDAwMiAtNS45MzMwMDAwMDAwMDAwMDFRMTAuMjAwMDAwMDAwMDAwMDAxIC0zLjU3MDAwMDAwMDAwMDAwMDMgMTMuMjk0IC0zLjU3MDAwMDAwMDAwMDAwMDNRMTYuMzU0MDAwMDAwMDAwMDAzIC0zLjU3MDAwMDAwMDAwMDAwMDMgMTguMjQxIC01LjkxNlEyMC4xMjggLTguMjYyIDIwLjEyOCAtMTIuMDdRMjAuMTI4IC0xNi4wODIgMTguMjc1IC0xOC40NjIwMDAwMDAwMDAwMDNRMTYuNDIyIC0yMC44NDIwMDAwMDAwMDAwMDIgMTMuMjk0IC0yMC44NDIwMDAwMDAwMDAwMDJaIE01Ny4yMjIgLTIwLjUzNlYwLjBINTIuMTIyVi0yMC41MzZINDQuNjA4MDAwMDAwMDAwMDA0Vi0yNC43ODZINjQuNDY0Vi0yMC41MzZaIE05MC4zMDQgLTI0Ljc4NlYtNC4yNUgxMDIuMTcwMDAwMDAwMDAwMDJWMC4wSDg1LjIwNDAwMDAwMDAwMDAxVi0yNC43ODZaIE0xMzMuNzkwMDAwMDAwMDAwMDIgLTI1LjE5NDAwMDAwMDAwMDAwM1ExMzkuMTYyIC0yNS4xOTQwMDAwMDAwMDAwMDMgMTQyLjQ2IC0yMS41NzNRMTQ1Ljc1OCAtMTcuOTUyIDE0NS43NTggLTEyLjAzNjAwMDAwMDAwMDAwMVExNDUuNzU4IC02LjUyODAwMDAwMDAwMDAwMDUgMTQyLjUxMTAwMDAwMDAwMDAyIC0yLjg3M1ExMzkuMjY0IDAuNzgyIDEzMy44MjQgMC43ODJRMTI4LjQxOCAwLjc4MiAxMjUuMTU0MDAwMDAwMDAwMDEgLTIuODU2MDAwMDAwMDAwMDAwM1ExMjEuODkwMDAwMDAwMDAwMDEgLTYuNDk0MDAwMDAwMDAwMDAxIDEyMS44OTAwMDAwMDAwMDAwMSAtMTIuMjA2MDAwMDAwMDAwMDAxUTEyMS44OTAwMDAwMDAwMDAwMSAtMTcuOTE4MDAwMDAwMDAwMDAzIDEyNS4xNzEwMDAwMDAwMDAwMiAtMjEuNTU2MDAwMDAwMDAwMDA0UTEyOC40NTIwMDAwMDAwMDAwMyAtMjUuMTk0MDAwMDAwMDAwMDAzIDEzMy43OTAwMDAwMDAwMDAwMiAtMjUuMTk0MDAwMDAwMDAwMDAzWk0xMzMuODI0IC0yMC44NDIwMDAwMDAwMDAwMDJRMTMwLjczMDAwMDAwMDAwMDAyIC0yMC44NDIwMDAwMDAwMDAwMDIgMTI4Ljg2IC0xOC40NzlRMTI2Ljk5MDAwMDAwMDAwMDAxIC0xNi4xMTYgMTI2Ljk5MDAwMDAwMDAwMDAxIC0xMi4yMDZRMTI2Ljk5MDAwMDAwMDAwMDAxIC04LjI5NjAwMDAwMDAwMDAwMSAxMjguODYgLTUuOTMzMDAwMDAwMDAwMDAxUTEzMC43MzAwMDAwMDAwMDAwMiAtMy41NzAwMDAwMDAwMDAwMDAzIDEzMy44MjQgLTMuNTcwMDAwMDAwMDAwMDAwM1ExMzYuODg0MDAwMDAwMDAwMDEgLTMuNTcwMDAwMDAwMDAwMDAwMyAxMzguNzcxMDAwMDAwMDAwMDIgLTUuOTE2UTE0MC42NTgwMDAwMDAwMDAwMiAtOC4yNjIgMTQwLjY1ODAwMDAwMDAwMDAyIC0xMi4wN1ExNDAuNjU4MDAwMDAwMDAwMDIgLTE2LjA4MiAxMzguODA1IC0xOC40NjIwMDAwMDAwMDAwMDNRMTM2Ljk1MjAwMDAwMDAwMDAzIC0yMC44NDIwMDAwMDAwMDAwMDIgMTMzLjgyNCAtMjAuODQyMDAwMDAwMDAwMDAyWiIgZmlsbD0iI2ZmZiIvPjwvc3ZnPjxwIHN0eWxlPSJtYXJnaW4tdG9wOjhweCI+JHtlc2Mocy50YWdsaW5lKX08L3A+PC9kaXY+CiAgICA8ZGl2PjxoNT5FeHBsb3JlPC9oNT4ke0QuY2x1c3RlcnMubWFwKGMgPT4gYDxhIGhyZWY9IiMvYy8ke2VuY29kZVVSSUNvbXBvbmVudChjLmlkKX0iPiR7ZXNjKGMubmFtZSl9PC9hPmApLmpvaW4oIiIpfTwvZGl2PgogICAgPGRpdj48aDU+Q29ubmVjdDwvaDU+CiAgICAgICR7cy5lbWFpbCA/IGA8YSBocmVmPSJtYWlsdG86JHtlc2Mocy5lbWFpbCl9Ij4ke2VzYyhzLmVtYWlsKX08L2E+YCA6ICIifQogICAgICAke2ltZ1VybChzLmluc3RhZ3JhbSkgPyBgPGEgaHJlZj0iJHtlc2Mocy5pbnN0YWdyYW0pfSIgdGFyZ2V0PSJfYmxhbmsiIHJlbD0ibm9vcGVuZXIiPkluc3RhZ3JhbTwvYT5gIDogIiJ9CiAgICAgIDxhIGhyZWY9Imh0dHBzOi8vd3d3LmZlbmlscHNoYWguY29tIiB0YXJnZXQ9Il9ibGFuayIgcmVsPSJub29wZW5lciI+ZmVuaWxwc2hhaC5jb208L2E+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJmaW5lIj4ke2VzYyhzLmZvb3Rlcl9ub3RlIHx8ICJBIGNvcm5lciBvZiBmZW5pbHBzaGFoLmNvbSIpfSBcdTAwYjcgXHUwMGE5ICR7bmV3IERhdGUoKS5nZXRGdWxsWWVhcigpfSBGZW5pbCBQLiBTaGFoPC9kaXY+PC9kaXY+YDsKfQoKLyogLS0tLS0tLS0tLS0tLS0tLSByb3V0ZXIgLS0tLS0tLS0tLS0tLS0tLSAqLwovKiBOYXZpZ2F0aW9uIHdvcmtzIGV2ZW4gaW5zaWRlIHNhbmRib3hlZCBmcmFtZXMgKEdvb2dsZSBTaXRlcyBlbWJlZHMsIHByZXZpZXdzKToKICAgY2xpY2tzIGFyZSBoYW5kbGVkIGhlcmUgaW5zdGVhZCBvZiByZWx5aW5nIG9uIHRoZSBicm93c2VyIGZvbGxvd2luZyAiIy8iIGxpbmtzLiAqLwpsZXQgY3VycmVudCA9IG51bGwsIHN0YWNrID0gW107CmZ1bmN0aW9uIGhhc2hQYXRoKCl7IHRyeXsgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChsb2NhdGlvbi5oYXNoLnJlcGxhY2UoL14jXC8/LywgIiIpKTsgfWNhdGNoKF8peyByZXR1cm4gIiI7IH0gfQpmdW5jdGlvbiBnbyhwYXRoLCBwdXNoKXsKICBwYXRoID0gU3RyaW5nKHBhdGggfHwgIiIpLnJlcGxhY2UoL14jP1wvPy8sICIiKTsKICBpZihwYXRoID09PSBjdXJyZW50KSByZXR1cm47CiAgaWYocHVzaCkgc3RhY2sucHVzaChwYXRoKTsgZWxzZSBzdGFjayA9IFtwYXRoXTsKICBjdXJyZW50ID0gcGF0aDsKICBpZihwdXNoKXsgdHJ5eyBoaXN0b3J5LnB1c2hTdGF0ZShudWxsLCAiIiwgIiMvIiArIHBhdGgpOyB9Y2F0Y2goXyl7fSB9CiAgcmVuZGVyKHBhdGgpOwp9CmZ1bmN0aW9uIHJvdXRlKCl7IGdvKGhhc2hQYXRoKCksIGZhbHNlKTsgfQpmdW5jdGlvbiByZW5kZXIoaCl7CiAgY29uc3QgW2EsIGJdID0gaC5zcGxpdCgiLyIpLm1hcCh4ID0+IHsgdHJ5eyByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHgpOyB9Y2F0Y2goXyl7IHJldHVybiB4OyB9IH0pOwogIGNvbnN0IHZpZXdzID0ge2hvbWUsIHJlYWQsIGNsdXN0ZXJzOmNsdXN0ZXJzUGFnZSwgZ2FsbGVyeTpnYWxsZXJ5UGFnZSwgY2FsZW5kYXI6Y2FsZW5kYXJQYWdlLCBhYm91dDphYm91dFBhZ2UsCiAgICBwb3N0OigpID0+IHBvc3RQYWdlKFNMVUcpLCBjbHVzdGVyOigpID0+IGNsdXN0ZXJQYWdlKFNMVUcpfTsKICBsZXQgaHRtbDsKICBpZih0cnV0aHkoRC5zZXR0aW5ncy5tYWludGVuYW5jZSkpIGh0bWwgPSBtYWludGVuYW5jZVBhZ2UoKTsKICBlbHNlIGlmKGEgPT09ICJjIiAmJiBiKSBodG1sID0gY2x1c3RlclBhZ2UoYik7CiAgZWxzZSBpZihhID09PSAicCIgJiYgYikgaHRtbCA9IHBvc3RQYWdlKGIpOwogIGVsc2UgaHRtbCA9ICh2aWV3c1tQQUdFXSB8fCBob21lKSgpOwogIGlmKCFhICYmIChQQUdFID09PSAicG9zdCIgfHwgUEFHRSA9PT0gImNsdXN0ZXIiKSl7CiAgICBjb25zdCB0byA9IFBBR0UgPT09ICJwb3N0IiA/ICJyZWFkIiA6ICJjbHVzdGVycyI7CiAgICBodG1sID0gaHRtbC5yZXBsYWNlKCc8YSBjbGFzcz0iYmFjayIgaHJlZj0iIy8iPlx1MjE5MCBCYWNrPC9hPicsIGA8YSBjbGFzcz0iYmFjayIgaHJlZj0iJHtwYWdlVXJsKHRvKX0iIHRhcmdldD0iJHtMSU5LX1RBUkdFVH0iPlx1MjE5MCAke1BBR0UgPT09ICJwb3N0IiA/ICJBbGwgd3JpdGluZyIgOiAiQWxsIGNsdXN0ZXJzIn08L2E+YCk7CiAgfQogICQoIiNhcHAiKS5pbm5lckhUTUwgPSBodG1sOwogIHRyeXsgd2luZG93LnNjcm9sbFRvKDAsIDApOyB9Y2F0Y2goXyl7fQogIG9ic2VydmUoKTsKfQpsZXQgaW87CmZ1bmN0aW9uIG9ic2VydmUoKXsKICBpZighKCJJbnRlcnNlY3Rpb25PYnNlcnZlciIgaW4gd2luZG93KSl7IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIi5yZXZlYWwiKS5mb3JFYWNoKGUgPT4gZS5jbGFzc0xpc3QuYWRkKCJpbiIpKTsgcmV0dXJuOyB9CiAgaW8gJiYgaW8uZGlzY29ubmVjdCgpOwogIGlvID0gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyKGVzID0+IGVzLmZvckVhY2goZSA9PiB7IGlmKGUuaXNJbnRlcnNlY3RpbmcpeyBlLnRhcmdldC5jbGFzc0xpc3QuYWRkKCJpbiIpOyBpby51bm9ic2VydmUoZS50YXJnZXQpOyB9IH0pLCB7cm9vdE1hcmdpbjoiMHB4IDBweCAtNiUgMHB4In0pOwogIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIi5yZXZlYWwiKS5mb3JFYWNoKGUgPT4gaW8ub2JzZXJ2ZShlKSk7Cn0KCi8qIGNoaXBzICsgbGlnaHRib3ggKi8KZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigiY2xpY2siLCBlID0+IHsKICBjb25zdCBsaW5rID0gZS50YXJnZXQuY2xvc2VzdCgnYVtocmVmXj0iIy8iXSwgYVtocmVmPSIjIl0nKTsKICBpZihsaW5rKXsKICAgIGUucHJldmVudERlZmF1bHQoKTsKICAgIGlmKGxpbmsuY2xhc3NMaXN0LmNvbnRhaW5zKCJiYWNrIikgJiYgc3RhY2subGVuZ3RoID4gMSl7IHN0YWNrLnBvcCgpOyBjb25zdCBwcmV2ID0gc3RhY2sucG9wKCk7IGdvKHByZXYsIHRydWUpOyByZXR1cm47IH0KICAgIGdvKGxpbmsuZ2V0QXR0cmlidXRlKCJocmVmIikuc2xpY2UoMSksIHRydWUpOyByZXR1cm47CiAgfQogIGNvbnN0IHNoYXJlID0gZS50YXJnZXQuY2xvc2VzdCgiLnNoYXJlIik7CiAgaWYoc2hhcmUpewogICAgY29uc3QgdXJsID0gc2hhcmUuZGF0YXNldC51cmwsIGRvbmUgPSAoKSA9PiB7IHNoYXJlLnRleHRDb250ZW50ID0gIkxpbmsgY29waWVkIjsgc2V0VGltZW91dCgoKSA9PiBzaGFyZS50ZXh0Q29udGVudCA9ICJDb3B5IGxpbmsiLCAyMDAwKTsgfTsKICAgIHRyeXsgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodXJsKS50aGVuKGRvbmUsICgpID0+IHdpbmRvdy5wcm9tcHQoIkNvcHkgdGhpcyBsaW5rOiIsIHVybCkpOyB9Y2F0Y2goXyl7IHdpbmRvdy5wcm9tcHQoIkNvcHkgdGhpcyBsaW5rOiIsIHVybCk7IH0KICAgIHJldHVybjsKICB9CiAgY29uc3QgY2hpcCA9IGUudGFyZ2V0LmNsb3Nlc3QoIi5jaGlwIik7CiAgaWYoY2hpcCl7IGZpbHRlciA9IGNoaXAuZGF0YXNldC5mOyByZW5kZXIoY3VycmVudCB8fCAiIik7IHJldHVybjsgfQogIGNvbnN0IGZpZyA9IGUudGFyZ2V0LmNsb3Nlc3QoIi5nYWwgZmlndXJlIik7CiAgaWYoZmlnKXsKICAgIGNvbnN0IGltZyA9IGZpZy5xdWVyeVNlbGVjdG9yKCJpbWciKTsgaWYoIWltZykgcmV0dXJuOwogICAgJCgiI2xiIGltZyIpLnNyYyA9IGltZy5zcmM7ICQoIiNsYiBwIikudGV4dENvbnRlbnQgPSBmaWcucXVlcnlTZWxlY3RvcigiZmlnY2FwdGlvbiIpPy50ZXh0Q29udGVudCB8fCAiIjsKICAgICQoIiNsYiIpLmNsYXNzTGlzdC5hZGQoIm9wZW4iKTsgcmV0dXJuOwogIH0KICBpZihlLnRhcmdldC5jbG9zZXN0KCIjbGIiKSkgJCgiI2xiIikuY2xhc3NMaXN0LnJlbW92ZSgib3BlbiIpOwp9KTsKZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigia2V5ZG93biIsIGUgPT4geyBpZihlLmtleSA9PT0gIkVzY2FwZSIpICQoIiNsYiIpLmNsYXNzTGlzdC5yZW1vdmUoIm9wZW4iKTsgfSk7CgooYXN5bmMgKCkgPT4gewogIEQgPSBhd2FpdCBsb2FkKCk7CiAgaWYoRC5zZXR0aW5ncy5zaXRlX3VybCkgU0lURSA9IFN0cmluZyhELnNldHRpbmdzLnNpdGVfdXJsKS5yZXBsYWNlKC9cLyskLywgIiIpOwogIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCJoYXNoY2hhbmdlIiwgcm91dGUpOwogIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCJwb3BzdGF0ZSIsIHJvdXRlKTsKICByb3V0ZSgpOwp9KSgpOwoKfSkoKTsK';

/* ===== Added for the unified /admin (fenilpshah.com) ===== */
function adminOp_(p) {
  const ss = SpreadsheetApp.getActive();
  const table = tab => {
    const sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 2) return [];
    const head = headers_(sh), v = sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues();
    return v.map((r, i) => { const o = { row: i + 2 }; head.forEach((h, j) => { o[h] = r[j] instanceof Date ? r[j].toISOString() : r[j]; }); return o; });
  };
  switch (p.op) {
    case 'posts':
      return { ok: true, sheet: ss.getUrl(), rows: table('Posts').filter(r => String(r.title || r.slug).trim())
        .map(r => ({ row: r.row, slug: r.slug, title: r.title, type: r.type, cluster: r.cluster, date: r.date,
          published: yes_(r.published, true), featured: yes_(r.featured, false) })) };
    case 'setPost': {
      const col = { published: 'published', featured: 'featured' }[p.field];
      if (!col || !(p.row >= 2)) return { ok: false, error: 'Unknown request.' };
      const sh = ss.getSheetByName('Posts'), c = headers_(sh).indexOf(col) + 1;
      if (!c) return { ok: false, error: 'No "' + col + '" column in Posts.' };
      const cell = sh.getRange(p.row, c), was = cell.getValue();
      cell.setValue(typeof was === 'boolean' ? !!p.value : (p.value ? 'Yes' : 'No')); clearCache_();
      return { ok: true };
    }
    case 'messages':
      return { ok: true, rows: table('Messages').reverse().slice(0, 200) };
    case 'markReplied': {
      if (!(p.row >= 2)) return { ok: false, error: 'Message not found.' };
      setByHeader_('Messages', p.row, 'replied', p.value ? 'Yes' : ''); return { ok: true };
    }
    case 'refresh': clearCache_(); return { ok: true };
    default: return { ok: false, error: 'Unknown Otlo request.' };
  }
}


  return {
    doGet: (typeof doGet === "function" ? doGet : undefined),
    doPost: (typeof doPost === "function" ? doPost : undefined),
    onOpen: (typeof onOpen === "function" ? onOpen : undefined),
    refresh: (typeof refresh === "function" ? refresh : undefined),
    imageHelp: (typeof imageHelp === "function" ? imageHelp : undefined),
    connectZoho: (typeof connectZoho === "function" ? connectZoho : undefined),
    testAutoReply: (typeof testAutoReply === "function" ? testAutoReply : undefined),
    setup: (typeof setup === "function" ? setup : undefined),
    onEdit: (typeof onEdit === "function" ? onEdit : undefined),
    adminOp_: (typeof adminOp_ === "function" ? adminOp_ : undefined),
    setSetting_: (typeof setSetting_ === "function" ? setSetting_ : undefined),
    clearCache_: (typeof clearCache_ === "function" ? clearCache_ : undefined)
  };
}).apply(null, env_('OTLO', 'otlo'));


/* ################################################################## *
 *  GREET  —  original code, unchanged except where noted
 *  (opens FPS.SHEETS.greet; settings/cache/triggers prefixed "GREET.")
 * ################################################################## */
const GREET = (function (SpreadsheetApp, PropertiesService, CacheService, ScriptApp) {
/**
 * Greeting Site — Google Sheet backend for sorry. / birthday. / greetings.fenilpshah.com
 *
 * Every person gets their OWN private link. Links never mix, and nobody can see who else got one.
 *
 * Sheets:
 *   Master   → Name | Page Type | From | Active | Code | Link | Embed line
 *              Name       – who it's for (keep names unique, e.g. "Riya S" and "Riya M")
 *              Page Type  – Sorry / Birthday / Letter
 *              From       – your name as it should appear (e.g. Fenil)
 *              Active     – ticked = their link works; untick to switch that link off
 *              Code       – filled in automatically (e.g. riya-7q2m) = the Google Sites page path
 *              Link       – filled in automatically: the link you send them
 *              Embed line – filled in automatically: paste this as the FIRST line of that page's embed
 *              Song       – optional: Google Drive link to an MP3. Share it "Anyone with the link" for an
 *                           instant start (streams); private files also work but take longer to load.
 *              Start at   – optional: where the song starts, e.g. 0:45 (blank = from the beginning)
 *              Design     – 1, 2 or 3 (blank = 1). See the "Designs" tab for what each one looks like.
 *              Track       – ticked = log their visits in the Activity tab
 *              Message box – ticked = at the end they can write you a message (emailed + saved in Replies)
 *              Open alert  – ticked = you get an email the moment they open their link
 *
 *              Email       – optional: their email address, for 💌 Greeting Site → Send link by email
 *              Link emailed – filled in automatically when their link is emailed
 *              Times opened – counts every time their link is opened (your Preview-mode tests don't count)
 *
 *   Settings → who emails come from (Zoho), where alerts go, your 3 site addresses, Preview mode
 *   Activity → one row per visit: device, how far they got, what they chose, time on page
 *   Replies  → their messages to you. Type in "Your reply" and it appears on their link next time they open it.
 *   Messages → Name | Message 1 … Message 5
 *              Sorry:    up to 5 messages, shown one by one with stickers
 *              Birthday: Message 1 = the wish (others ignored)
 *              Letter:   Messages 1–5 = paragraphs of the letter
 */

const MASTER = 'Master';
const MESSAGES = 'Messages';
const MAX_MESSAGES = 5;
const COL = { NAME: 1, TYPE: 2, FROM: 3, ACTIVE: 4, CODE: 5, LINK: 6, EMBED: 7, SONG: 8, START: 9, DESIGN: 10, TRACK: 11, MSG: 12, ALERT: 13, EMAIL: 14, EMAILED: 15, OPENS: 16 };
const HEADERS = ['Name', 'Page Type', 'From', 'Active', 'Code', 'Link', 'Embed line', 'Song', 'Start at', 'Design', 'Track', 'Message box', 'Open alert', 'Email', 'Link emailed', 'Times opened'];
const TOGGLES = [COL.TRACK, COL.MSG, COL.ALERT];
const DESIGN_GUIDE = [
  ['Page Type', 'Design', 'Name', 'What it looks like', 'Messages used'],
  ['Sorry', 1, 'Sticker Scrapbook', 'Pastel pink notebook pages with cute stickers (bear, cloud, bunny, heart, kitty). Opens with a pink envelope.', 'Messages 1–5, one note each'],
  ['Sorry', 2, 'Rainy Window', 'Night rain on a window; your words are written on the fogged glass. If they forgive you, the rain stops and a rainbow appears.', 'Messages 1–5, one per tap'],
  ['Sorry', 3, 'Text Message', 'Starts as a phone lock-screen notification, then plays out as a chat with typing dots. They reply with a button.', 'Messages 1–5 as chat bubbles'],
  ['Birthday', 1, 'Night Party', 'Dark party with gold confetti: open a gift, blow out the candles, then the wish types itself out.', 'Message 1 = the wish'],
  ['Birthday', 2, 'Balloon Pop', 'Bright sunny sky; they pop 5 balloons to spell “Happy Birthday to you, Name!”, then the wish card appears.', 'Message 1 = the wish'],
  ['Birthday', 3, 'Newspaper', '“The Daily Name” front page spins in like an old movie, with a headline, a birthday stamp and your wish as the lead story.', 'Message 1 = the wish'],
  ['Letter', 1, 'Airmail & Wax Seal', 'Airmail envelope flips over, the wax seal breaks, and a paper letter unfolds.', 'Messages 1–5 = paragraphs'],
  ['Letter', 2, 'Typewriter', 'Your letter is typed out live on a typewriter, key by key, ending with a ding.', 'Messages 1–5 = paragraphs'],
  ['Letter', 3, 'Message in a Bottle', 'A bottle bobs on a sunset sea; they uncork it and a parchment scroll unrolls.', 'Messages 1–5 = paragraphs']
];
const MAX_SONG_BYTES = 12 * 1024 * 1024;
const ROWS = 300;

/* ---------- Menu ---------- */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💌 Greeting Site')
    .addItem('Fill in missing codes & links', 'fillMissingCodes')
    .addItem('Show setup steps for selected row', 'showStepsForRow')
    .addItem('Send link by email (selected rows)', 'sendLinkByEmail')
    .addSeparator()
    .addItem('Preview mode ON (30 min, nothing logged)', 'startPreview')
    .addItem('Preview mode OFF', 'stopPreview')
    .addSeparator()
    .addItem('Connect Zoho Mail', 'connectZoho')
    .addItem('Send a test email', 'sendTestEmail')
    .addItem('Disconnect Zoho Mail', 'disconnectZoho')
    .addSeparator()
    .addItem('Set up / repair sheets', 'setupSheets')
    .addToUi();
}

/* ---------- One-time setup (safe to run again) ---------- */
function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const m = ss.getSheetByName(MASTER) || ss.insertSheet(MASTER, 0);
  const g = ss.getSheetByName(MESSAGES) || ss.insertSheet(MESSAGES, 1);

  m.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  const msgHeaders = ['Name'];
  for (let i = 1; i <= MAX_MESSAGES; i++) msgHeaders.push('Message ' + i);
  g.getRange(1, 1, 1, msgHeaders.length).setValues([msgHeaders]);

  [[m, HEADERS.length], [g, msgHeaders.length]].forEach(([sh, n]) => {
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#2d1a3d').setFontColor('#ffffff');
  });

  m.getRange(2, COL.TYPE, ROWS).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Sorry', 'Birthday', 'Letter'], true).setAllowInvalid(false).build()
  );
  m.getRange(2, COL.ACTIVE, ROWS).insertCheckboxes();
  m.getRange(2, COL.CODE, ROWS, 3).setBackground('#f6f3fa').setFontColor('#5b4a66');
  m.setColumnWidth(COL.NAME, 170); m.setColumnWidth(COL.TYPE, 110); m.setColumnWidth(COL.FROM, 120);
  m.setColumnWidth(COL.ACTIVE, 70); m.setColumnWidth(COL.CODE, 130); m.setColumnWidth(COL.LINK, 320); m.setColumnWidth(COL.EMBED, 380);
  m.setColumnWidth(COL.SONG, 260); m.setColumnWidth(COL.START, 80); m.setColumnWidth(COL.DESIGN, 70);
  m.getRange(2, COL.DESIGN, ROWS).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['1', '2', '3'], true).setAllowInvalid(false).build()
  ).setHorizontalAlignment('center');
  m.getRange(2, COL.START, ROWS).setNumberFormat('@'); // keep 0:45 as typed

  // Per-person feature switches (existing people get them switched ON)
  TOGGLES.forEach(c => {
    const rng = m.getRange(2, c, ROWS), before = rng.getValues(), names = m.getRange(2, COL.NAME, ROWS).getValues();
    rng.insertCheckboxes();
    rng.setValues(before.map((v, i) => [v[0] === true || (v[0] !== false && String(names[i][0]).trim() !== '')]));
    m.setColumnWidth(c, 100);
  });
  m.getRange(1, COL.TRACK, 1, 3).setBackground('#4a2d6b');
  m.setColumnWidth(COL.EMAIL, 220); m.setColumnWidth(COL.EMAILED, 150);
  m.getRange(1, COL.EMAIL, 1, 2).setBackground('#1f4d5c');
  m.getRange(2, COL.EMAIL, ROWS).setDataValidation(SpreadsheetApp.newDataValidation().requireTextIsEmail().setAllowInvalid(true).build());
  m.getRange(2, COL.EMAILED, ROWS).setNumberFormat('d mmm yyyy, h:mm am/pm').setBackground('#f6f3fa').setFontColor('#5b4a66');
  m.setColumnWidth(COL.OPENS, 110); m.getRange(1, COL.OPENS).setBackground('#1f4d5c');
  m.getRange(2, COL.OPENS, ROWS).setHorizontalAlignment('center').setBackground('#f6f3fa').setFontColor('#5b4a66');

  // Greyed-out rows = link switched off
  const rules = m.getConditionalFormatRules().filter(r => {
    const f = r.getBooleanCondition();
    return !(f && /\$D2/.test(String(f.getCriteriaValues()[0])));
  });
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($A2<>"",$D2<>TRUE)').setFontColor('#b3a9bb').setStrikethrough(true)
    .setRanges([m.getRange(2, 1, ROWS, 3)]).build());
  m.setConditionalFormatRules(rules);

  g.getRange(2, 1, ROWS).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(m.getRange('A2:A'), true).setAllowInvalid(true).build()
  );
  g.setColumnWidth(1, 170);
  for (let c = 2; c <= 1 + MAX_MESSAGES; c++) g.setColumnWidth(c, 300);
  g.getRange(2, 2, ROWS, MAX_MESSAGES).setWrap(true).setVerticalAlignment('top');

  const s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(s1);

  const dg = ss.getSheetByName('Designs') || ss.insertSheet('Designs');
  dg.clear();
  dg.getRange(1, 1, DESIGN_GUIDE.length, DESIGN_GUIDE[0].length).setValues(DESIGN_GUIDE).setWrap(true).setVerticalAlignment('top');
  dg.getRange(1, 1, 1, DESIGN_GUIDE[0].length).setFontWeight('bold').setBackground('#2d1a3d').setFontColor('#ffffff');
  dg.setFrozenRows(1); dg.setColumnWidth(1, 90); dg.setColumnWidth(2, 60); dg.setColumnWidth(3, 160); dg.setColumnWidth(4, 460); dg.setColumnWidth(5, 190);
  [[2, 4, '#fff0f4'], [5, 7, '#f1ecff'], [8, 10, '#fbf4e6']].forEach(([a, b, c]) => dg.getRange(a, 1, b - a + 1, 5).setBackground(c));

  setupExtras_(ss);
  fillMissingCodes();
  ss.toast('Sheets are ready. Every person now has a code and a link.', '💌 Greeting Site', 5);
}

/* ---------- Codes & links ---------- */
function onEdit(e) {
  const sh = e.range.getSheet();
  if (sh.getName() === SETTINGS) { if (e.range.getColumn() <= 2) fillMissingCodes(); return; } // site address changed → rebuild links
  if (sh.getName() !== MASTER || e.range.getRow() < 2) return;
  const st = settings_();
  const first = e.range.getRow(), last = first + e.range.getNumRows() - 1;
  for (let r = first; r <= last; r++) ensureRow_(sh, r, st);
}

function fillMissingCodes() {
  const sh = SpreadsheetApp.getActive().getSheetByName(MASTER);
  if (!sh) return;
  const st = settings_();
  for (let r = 2; r <= sh.getLastRow(); r++) ensureRow_(sh, r, st);
}

function ensureRow_(sh, r, st) {
  st = st || settings_();
  const row = sh.getRange(r, 1, 1, HEADERS.length).getValues()[0];
  const name = String(row[COL.NAME - 1]).trim();
  if (!name) return;
  let code = String(row[COL.CODE - 1]).trim();
  if (!code) {
    code = newCode_(sh, name);
    sh.getRange(r, COL.CODE).setValue(code);
    if (row[COL.ACTIVE - 1] === '' ) sh.getRange(r, COL.ACTIVE).setValue(true);
    TOGGLES.forEach(c => sh.getRange(r, c).insertCheckboxes().setValue(true)); // new person: features on by default
  }
  const type = String(row[COL.TYPE - 1]).trim().toLowerCase();
  const base = (type === 'birthday' ? st.sites.birthday : type === 'letter' ? st.sites.letter : st.sites.sorry).replace(/\/+$/, '');
  sh.getRange(r, COL.LINK, 1, 2).setValues([[
    `${base}/${code}`,
    `<!DOCTYPE html><script>window.GREETING_KEY="${code}"</script>`
  ]]);
}

function newCode_(sh, name) {
  const slug = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16) || 'note';
  const taken = new Set(sh.getRange(2, COL.CODE, Math.max(sh.getLastRow() - 1, 1)).getValues().map(v => String(v[0])));
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code;
  do {
    let s = '';
    for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
    code = `${slug}-${s}`;
  } while (taken.has(code));
  return code;
}

function showStepsForRow() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet(), ui = SpreadsheetApp.getUi();
  if (sh.getName() !== MASTER) return ui.alert('Go to the Master sheet and click on a person’s row first.');
  const r = sh.getActiveRange().getRow();
  if (r < 2 || !String(sh.getRange(r, COL.NAME).getValue()).trim()) return ui.alert('Select a row that has a name.');
  ensureRow_(sh, r, settings_());
  const v = sh.getRange(r, 1, 1, HEADERS.length).getValues()[0];
  const host = String(v[COL.LINK - 1]).split('/')[2];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const html = HtmlService.createHtmlOutput(`
    <div style="font:14px/1.55 system-ui,sans-serif;color:#2d1a3d">
      <p><b>${esc(v[0])}</b> · ${esc(v[1] || 'Sorry')}</p>
      <ol style="padding-left:18px">
        <li>Open the Google Site for <b>${esc(host)}</b>.</li>
        <li>In <b>Pages</b>, click ⋮ on your template page → <b>Duplicate</b>.</li>
        <li>Click ⋮ on the copy → <b>Properties</b> → <b>Custom path</b>:<br>
          <input style="width:100%;padding:6px;margin-top:4px" value="${esc(v[COL.CODE - 1])}" onclick="this.select()"></li>
        <li>Edit the embed and replace the <b>first line</b> with:<br>
          <input style="width:100%;padding:6px;margin-top:4px" value="${esc(v[COL.EMBED - 1])}" onclick="this.select()"></li>
        <li><b>Publish</b>, then send this link:<br>
          <input style="width:100%;padding:6px;margin-top:4px" value="${esc(v[COL.LINK - 1])}" onclick="this.select()"></li>
      </ol>
      <p style="color:#7a6a85">Tip: hide the copied page from the site menu (⋮ → Hide from navigation).</p>
    </div>`).setWidth(460).setHeight(430);
  ui.showModalDialog(html, '💌 Setup steps');
}

/* ---------- Web app endpoint ---------- */
function doGet(e) {
  const key = e && e.parameter && String(e.parameter.k || '').trim();
  const wantSong = e && e.parameter && e.parameter.song === '1';
  const json = JSON.stringify(wantSong ? getSong_(key) : getByKey_(key));
  const cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[\w$.]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function findRow_(key) {
  if (!key) return null;
  const m = SpreadsheetApp.getActive().getSheetByName(MASTER);
  if (!m) return null;
  const row = m.getRange(1, 1, Math.max(m.getLastRow(), 1), HEADERS.length).getValues().slice(1)
    .find(r => String(r[COL.CODE - 1]).trim() === key);
  return row && row[COL.ACTIVE - 1] === true ? row : null;
}

function driveId_(link) {
  const s = String(link || '').trim();
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/) || s.match(/^([\w-]{20,})$/);
  return m ? m[1] : '';
}

function startSeconds_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes(); // "0:45" auto-read as h:mm → treat as m:ss
  const s = String(v || '').trim();
  if (!s) return 0;
  const parts = s.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/* Streams the MP3 from YOUR Drive (file can stay private). Only for an active person's own code. */
function getSong_(key) {
  const row = findRow_(key);
  const id = row && driveId_(row[COL.SONG - 1]);
  if (!id) return { ok: false };
  try {
    const blob = DriveApp.getFileById(id).getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > MAX_SONG_BYTES) return { ok: false, error: 'too big' };
    return { ok: true, mime: blob.getContentType() || 'audio/mpeg', data: Utilities.base64Encode(bytes) };
  } catch (err) {
    return { ok: false, error: 'not found' };
  }
}

function getByKey_(key) {
  const ss = SpreadsheetApp.getActive();
  const row = findRow_(key);
  if (!row) return { active: false };

  const name = String(row[COL.NAME - 1]).trim();
  const t = String(row[COL.TYPE - 1]).trim().toLowerCase();
  const mode = (t === 'birthday' || t === 'letter') ? t : 'sorry';
  const from = String(row[COL.FROM - 1] || '').trim();

  let messages = [];
  const g = ss.getSheetByName(MESSAGES);
  if (g) {
    const mr = g.getDataRange().getValues().slice(1)
      .find(r => String(r[0]).trim().toLowerCase() === name.toLowerCase());
    if (mr) messages = mr.slice(1, 1 + MAX_MESSAGES).map(v => String(v).trim()).filter(Boolean);
  }
  const songId = driveId_(row[COL.SONG - 1]);
  let songUrl = '';
  if (songId) {
    try { // Fast path: if the MP3 is shared "Anyone with the link", the page streams it straight from Drive.
      const acc = DriveApp.getFileById(songId).getSharingAccess();
      if (acc === DriveApp.Access.ANYONE_WITH_LINK || acc === DriveApp.Access.ANYONE) {
        songUrl = `https://drive.usercontent.google.com/download?id=${songId}&export=download&confirm=t`;
      }
    } catch (err) {}
  }
  const design = [1, 2, 3].includes(parseInt(row[COL.DESIGN - 1], 10)) ? parseInt(row[COL.DESIGN - 1], 10) : 1;
  const track = row[COL.TRACK - 1] === true, msg = row[COL.MSG - 1] === true, alert = row[COL.ALERT - 1] === true;
  return { active: true, mode, design, name, from, messages, song: !!songId, songUrl, start: songId ? startSeconds_(row[COL.START - 1]) : 0,
    track, msg, ping: track || alert, reply: msg ? latestReply_(key) : null };
}


/* =====================================================================
   TRACKING · MESSAGES TO YOU · OPEN ALERTS
   ===================================================================== */
const SETTINGS = 'Settings', ACTIVITY = 'Activity', REPLIES = 'Replies';
const DEFAULT_EMAIL = 'fenil@fenilpshah.com';
const ACT_HEAD = ['Opened at', 'Name', 'Code', 'Page', 'Device', 'Furthest step', 'Choice', 'Time on page', 'Last seen', 'Visit ID'];
const REP_HEAD = ['Sent at', 'Name', 'Code', 'Page', 'Their message', 'Wants reply', 'Contact', 'Your reply', 'Reply seen'];
const RC = { MSG: 5, WANTS: 6, CONTACT: 7, REPLY: 8, SEEN: 9 };

function setupExtras_(ss) {
  const head = (sh, h, color) => {
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground(color || '#2d1a3d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  };
  buildSettings_(ss);

  const a = ss.getSheetByName(ACTIVITY) || ss.insertSheet(ACTIVITY);
  head(a, ACT_HEAD, '#1f4d5c');
  [150, 130, 130, 190, 150, 220, 160, 100, 150, 90].forEach((w, i) => a.setColumnWidth(i + 1, w));
  a.getRange('A:A').setNumberFormat('d mmm yyyy, h:mm am/pm'); a.getRange('I:I').setNumberFormat('d mmm, h:mm am/pm');

  const r = ss.getSheetByName(REPLIES) || ss.insertSheet(REPLIES);
  head(r, REP_HEAD, '#7a2140');
  [150, 130, 130, 190, 380, 90, 200, 380, 150].forEach((w, i) => r.setColumnWidth(i + 1, w));
  r.getRange(1, RC.REPLY).setBackground('#c9871a');
  r.getRange('E:E').setWrap(true); r.getRange('H:H').setWrap(true);
  r.getRange('A:A').setNumberFormat('d mmm yyyy, h:mm am/pm'); r.getRange('I:I').setNumberFormat('d mmm, h:mm am/pm');
  const rules = [SpreadsheetApp.newConditionalFormatRule() // waiting for your reply → highlighted
    .whenFormulaSatisfied('=AND($F2="Yes",$H2="")').setBackground('#fff4cf').setRanges([r.getRange('A2:I1000')]).build()];
  r.setConditionalFormatRules(rules);
}

const SET_ROWS = [
  ['Alerts go to', DEFAULT_EMAIL, 'Where “just opened” alerts and their messages to you are sent.'],
  ['Send from', 'wishes.no-reply@fenilpshah.com', 'The address every email is sent from. Must be your Zoho mailbox or one of its aliases.'],
  ['Sender name', 'Fenil P. Shah', 'The name people see in their inbox when you email them their link.'],
  ['Alerts sender name', 'Wishes · Alerts', 'The name you see on your own alerts (opened, messages, tests).'],
  ['Zoho region', 'in', 'in = India (zoho.in) · com = Global (zoho.com) · eu = Europe. Filled in automatically when you connect.'],
  ['Zoho status', 'Not connected', 'Use 💌 Greeting Site → Connect Zoho Mail. Until then, emails go out from your Gmail instead.'],
  ['Sorry site', FPS.SITE + '/g', 'Sorry links are built from this. Change it and every link updates.'],
  ['Birthday site', FPS.SITE + '/g', 'Birthday links are built from this.'],
  ['Letter site', FPS.SITE + '/g', 'Letter links are built from this.'],
  ['Preview mode until', '', 'Before testing a link yourself: 💌 Greeting Site → Preview mode ON. For 30 minutes your opens aren’t logged and no open alerts are sent (messages still work, so you can test them).']
];
const SET_ALIASES = { 'Send emails to': 'Alerts go to' };

function buildSettings_(ss) {
  const st = ss.getSheetByName(SETTINGS) || ss.insertSheet(SETTINGS);
  const old = {};
  if (st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach(([k, v]) => { k = SET_ALIASES[k] || k; if (k) old[k] = v; });
  st.clear(); st.clearConditionalFormatRules();
  st.getRange(1, 1, 1, 3).setValues([['Setting', 'Value', 'What it does']]).setFontWeight('bold').setBackground('#2d1a3d').setFontColor('#ffffff');
  st.getRange(2, 1, SET_ROWS.length, 3).setValues(SET_ROWS.map(([k, d, n]) => [k, (k in old && old[k] !== '') ? old[k] : d, n]));
  st.setFrozenRows(1); st.setColumnWidth(1, 160); st.setColumnWidth(2, 330); st.setColumnWidth(3, 520);
  st.getRange(2, 1, SET_ROWS.length, 1).setFontWeight('bold');
  st.getRange(2, 3, SET_ROWS.length, 1).setWrap(true).setFontColor('#7a6d84');
  st.getRange(2, 2, SET_ROWS.length, 1).setBackground('#fffbea');
  const row = k => 2 + SET_ROWS.findIndex(x => x[0] === k);
  st.getRange(row('Zoho region'), 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['in', 'com', 'eu', 'com.au', 'jp', 'ca'], true).build());
  st.getRange(row('Zoho status'), 2).setBackground('#f2f2f2').setFontColor('#555555');
  st.getRange(row('Preview mode until'), 2).setNumberFormat('d mmm yyyy, h:mm am/pm');
}

function settings_() {
  const st = SpreadsheetApp.getActive().getSheetByName(SETTINGS);
  const m = {};
  if (st && st.getLastRow() > 1) st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach(([k, v]) => { m[SET_ALIASES[k] || k] = v; });
  const get = k => { const v = m[k]; return v === undefined || v === '' ? SET_ROWS.find(x => x[0] === k)[1] : v; };
  const prev = m['Preview mode until'];
  return {
    email: String(get('Alerts go to')).trim(), from: String(get('Send from')).trim(),
    senderName: String(get('Sender name')).trim(), alertsName: String(get('Alerts sender name')).trim(), region: String(get('Zoho region')).trim() || 'in',
    sites: { sorry: String(get('Sorry site')).trim(), birthday: String(get('Birthday site')).trim(), letter: String(get('Letter site')).trim() },
    previewUntil: prev instanceof Date ? prev.getTime() : 0
  };
}
function setSetting_(key, value) {
  const ss = SpreadsheetApp.getActive();
  let st = ss.getSheetByName(SETTINGS);
  if (!st) { buildSettings_(ss); st = ss.getSheetByName(SETTINGS); }
  const keys = st.getRange(2, 1, Math.max(st.getLastRow() - 1, 1), 1).getValues().map(v => SET_ALIASES[v[0]] || v[0]);
  let i = keys.indexOf(key);
  if (i < 0) { buildSettings_(ss); return setSetting_(key, value); }
  st.getRange(i + 2, 2).setValue(value);
}
function startPreview() {
  setSetting_('Preview mode until', new Date(Date.now() + 30 * 60000));
  SpreadsheetApp.getActive().toast('Preview mode is ON for 30 minutes. Your test opens won’t be logged.', '💌 Greeting Site', 6);
}
function stopPreview() {
  setSetting_('Preview mode until', '');
  SpreadsheetApp.getActive().toast('Preview mode is OFF. Visits are being logged again.', '💌 Greeting Site', 5);
}

/* ---------- Page → sheet (events and messages) ---------- */
function doPost(e) {
  let out = { ok: false };
  try { out = handlePost_(JSON.parse(e.postData.contents)); }
  catch (err) { out = { ok: false, error: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handlePost_(p) {
  const row = findRow_(String(p.k || '').trim());
  if (!row) return { ok: false };
  const info = rowInfo_(row);
  if (p.t === 'msg') return saveMessage_(info, p);
  if (p.t === 'ev') return logEvent_(info, p);
  return { ok: false };
}

function rowInfo_(row) {
  const t = String(row[COL.TYPE - 1]).trim().toLowerCase();
  const mode = (t === 'birthday' || t === 'letter') ? t : 'sorry';
  const d = [1, 2, 3].includes(parseInt(row[COL.DESIGN - 1], 10)) ? parseInt(row[COL.DESIGN - 1], 10) : 1;
  const g = DESIGN_GUIDE.find(x => String(x[0]).toLowerCase() === mode && x[1] === d);
  return {
    name: String(row[COL.NAME - 1]).trim(), code: String(row[COL.CODE - 1]).trim(), link: String(row[COL.LINK - 1]),
    mode, page: `${mode[0].toUpperCase() + mode.slice(1)} · ${g ? g[2] : 'Design ' + d}`,
    what: { sorry: 'sorry note', birthday: 'birthday wish', letter: 'letter' }[mode],
    track: row[COL.TRACK - 1] === true, msg: row[COL.MSG - 1] === true, alert: row[COL.ALERT - 1] === true
  };
}

const clean_ = (v, n) => { const s = String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, n); return /^[=+\-@]/.test(s) ? "'" + s : s; };
const secsText_ = n => { n = Math.max(0, Math.round(Number(n) || 0)); return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`; };
const when_ = d => Utilities.formatDate(d, Session.getScriptTimeZone(), "d MMM yyyy, h:mm a");
const h_ = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function logEvent_(info, p) {
  const ev = String(p.ev || '');
  if (ev === 'replyseen') { if (info.msg) markSeen_(info, p.row); return { ok: true }; }
  if (settings_().previewUntil > Date.now()) return { ok: true, preview: true };
  if (ev === 'open') {
    const n = countOpen_(info);
    if (info.alert) sendOpenAlert_(info, p, n);
  }
  if (!info.track) return { ok: true };
  const sid = clean_(p.sid, 24);
  if (!sid) return { ok: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(ACTIVITY) || (setupExtras_(SpreadsheetApp.getActive()), SpreadsheetApp.getActive().getSheetByName(ACTIVITY));
    const now = new Date();
    let r = 0;
    const last = sh.getLastRow();
    if (last > 1) {
      const from = Math.max(2, last - 300);
      const ids = sh.getRange(from, 10, last - from + 1, 1).getValues();
      for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === sid) { r = from + i; break; }
    }
    if (!r) {
      sh.appendRow([now, clean_(info.name, 80), info.code, info.page, clean_(p.dev, 60), 'Opened the link', '', secsText_(p.secs), now, sid]);
      r = sh.getLastRow();
    }
    if (ev === 'step') sh.getRange(r, 6).setValue(clean_(p.v, 80));
    if (ev === 'choice') sh.getRange(r, 7).setValue(clean_(p.v, 60));
    sh.getRange(r, 8, 1, 2).setValues([[secsText_(p.secs), now]]);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

function saveMessage_(info, p) {
  if (!info.msg) return { ok: false, error: 'off' };
  const text = String(p.text || '').trim().slice(0, 1000);
  if (!text) return { ok: false, error: 'empty' };
  const cache = CacheService.getScriptCache(), ck = 'msgs_' + info.code, n = Number(cache.get(ck) || 0);
  if (n >= 5) return { ok: false, error: 'limit' };
  cache.put(ck, String(n + 1), 3600);
  const wants = p.wants === true, contact = String(p.contact || '').trim().slice(0, 150), now = new Date();
  const ss = SpreadsheetApp.getActive();
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = ss.getSheetByName(REPLIES) || (setupExtras_(ss), ss.getSheetByName(REPLIES));
    sh.appendRow([now, clean_(info.name, 80), info.code, info.page, clean_(text, 1000), wants ? 'Yes' : 'No', clean_(contact, 150), '', '']);
  } finally { lock.releaseLock(); }
  try { sendMessageEmail_(info, { text, wants, contact, dev: String(p.dev || ''), now }); } catch (err) {}
  return { ok: true };
}

function latestReply_(code) {
  const sh = SpreadsheetApp.getActive().getSheetByName(REPLIES);
  if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, REP_HEAD.length).getValues();
  for (let i = v.length - 1; i >= 0; i--) {
    if (String(v[i][2]).trim() === code && String(v[i][RC.REPLY - 1]).trim()) {
      return { text: String(v[i][RC.REPLY - 1]).trim(), msg: String(v[i][RC.MSG - 1]).replace(/^'/, ''), row: i + 2 };
    }
  }
  return null;
}

function markSeen_(info, row) {
  const sh = SpreadsheetApp.getActive().getSheetByName(REPLIES), r = parseInt(row, 10);
  if (!sh || !(r >= 2) || r > sh.getLastRow()) return;
  if (String(sh.getRange(r, 3).getValue()).trim() !== info.code) return;
  if (!sh.getRange(r, RC.SEEN).getValue()) sh.getRange(r, RC.SEEN).setValue(new Date());
}

/* ---------- Emails ---------- */
function emailShell_(o) { // { a1, a2, kicker, title, sub, inner, cta:{href,label,bg}, footer, preheader }
  const cta = o.cta ? `<div style="margin-top:24px"><a href="${o.cta.href}" style="display:inline-block;background:${o.cta.bg || '#24182c'};color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:15px;font-weight:bold">${o.cta.label}</a></div>` : '';
  return `<div style="background:#f3eff7;padding:28px 12px;font-family:Helvetica,Arial,sans-serif;color:#24182c">
  <span style="display:none;font-size:1px;color:#f3eff7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${o.preheader || ''}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(60,30,80,.12)">
    <tr><td style="background:${o.a1};background-image:linear-gradient(135deg,${o.a1},${o.a2});padding:28px 28px;color:#ffffff">
      <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">${o.kicker}</div>
      <div style="font-size:26px;font-weight:bold;margin-top:6px;line-height:1.25">${o.title}</div>
      ${o.sub ? `<div style="font-size:14px;margin-top:6px;opacity:.92">${o.sub}</div>` : ''}
    </td></tr>
    <tr><td style="padding:26px 28px 28px">${o.inner}${cta}${o.after || ''}</td></tr>
  </table>
  <div style="max-width:520px;margin:14px auto 0;text-align:center;font-size:12px;line-height:1.5;color:#8a7d94">${o.footer || 'Sent by your Greeting Site'}</div>
</div>`;
}
const sheetCta_ = () => ({ href: SpreadsheetApp.getActive().getUrl(), label: 'Open your sheet' });
const metaRow_ = (k, v) => `<tr><td style="padding:5px 0;color:#8a7d94;font-size:13px;width:110px;vertical-align:top">${k}</td><td style="padding:5px 0;font-size:14px">${v}</td></tr>`;

function sendMessageEmail_(info, m) {
  const s = settings_();
  const badge = m.wants
    ? `<div style="display:inline-block;background:#fff1c9;color:#8a5a00;border:1px solid #f1d48a;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:bold;margin-bottom:16px">⏳ Expects a reply</div>` : '';
  const contact = m.contact ? `<div style="margin-top:16px;background:#f6f2fa;border-radius:12px;padding:12px 16px;font-size:14px">Reply to them at: <b>${h_(m.contact)}</b></div>` : '';
  const tip = m.wants ? `<p style="font-size:13px;color:#6d5f77;margin:16px 0 0;line-height:1.5">💡 To answer on their link, type your reply in the <b>Your reply</b> column of the <b>Replies</b> tab. They’ll see it the next time they open their link.</p>` : '';
  const inner = `${badge}
    <div style="border-left:4px solid #ff6f91;background:#fff6f8;padding:16px 18px;border-radius:10px;font-size:17px;line-height:1.6;white-space:pre-wrap">${h_(m.text)}</div>
    ${contact}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;width:100%">
      ${metaRow_('From', `<b>${h_(info.name)}</b>`)}${metaRow_('Page', h_(info.page))}${metaRow_('Sent', h_(when_(m.now)))}${m.dev ? metaRow_('Device', h_(m.dev)) : ''}${metaRow_('Their link', `<a href="${h_(info.link)}" style="color:#7a4dff">${h_(info.link)}</a>`)}
    </table>${tip}`;
  sendMail_({
    to: s.email, fromName: s.alertsName,
    subject: `💌 ${info.name} replied to your ${info.what}${m.wants ? ' (expects a reply)' : ''}`,
    html: emailShell_({ a1: '#ff6f91', a2: '#9b7bff', kicker: 'New message', title: `💌 From ${h_(info.name)}`, sub: h_(info.page), inner, cta: sheetCta_(),
      preheader: h_(m.text.slice(0, 90)) }),
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.contact) ? m.contact : ''
  });
}

const ord_ = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

/* Adds 1 to "Times opened" in Master and remembers when they first opened it. */
function countOpen_(info) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(MASTER);
    const codes = sh.getRange(2, COL.CODE, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
    const i = codes.findIndex(v => String(v[0]).trim() === info.code);
    if (i < 0) return 1;
    const cell = sh.getRange(i + 2, COL.OPENS), n = (Number(cell.getValue()) || 0) + 1;
    cell.setValue(n);
    const P = PropertiesService.getScriptProperties(), k = 'first_open_' + info.code;
    if (!P.getProperty(k) || n === 1) P.setProperty(k, String(Date.now()));
    return n;
  } finally { lock.releaseLock(); }
}

/* An email every time they open it — "1st time", "2nd time", "4th time"… */
function sendOpenAlert_(info, p, n) {
  n = n || 1;
  try {
    const now = new Date(), again = n > 1;
    const firstTs = Number(PropertiesService.getScriptProperties().getProperty('first_open_' + info.code));
    const lead = again
      ? `<b>${h_(info.name)}</b> just opened the ${h_(info.what)} you sent them again. That’s the <b>${ord_(n)} time</b> they’ve opened it 💛`
      : `<b>${h_(info.name)}</b> just opened the ${h_(info.what)} you sent them, for the first time.`;
    const badge = `<div style="display:inline-block;background:${again ? '#eaf3ff' : '#eafaf1'};color:${again ? '#1f5fa8' : '#1d7a4a'};border-radius:999px;padding:6px 14px;font-size:13px;font-weight:bold;margin-bottom:14px">${again ? '🔁 ' + ord_(n) + ' time opened' : '✨ First time opened'}</div>`;
    const inner = `${badge}<p style="font-size:16px;line-height:1.6;margin:0 0 14px">${lead}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
        ${metaRow_('Page', h_(info.page))}${metaRow_('Opened', h_(when_(now)))}${metaRow_('Times opened', `<b>${n}</b>`)}
        ${again && firstTs ? metaRow_('First opened', h_(when_(new Date(firstTs)))) : ''}${p.dev ? metaRow_('Device', h_(String(p.dev).slice(0, 60))) : ''}
      </table>`;
    const st = settings_();
    sendMail_({
      to: st.email, fromName: st.alertsName,
      subject: again ? `👀 ${info.name} opened your ${info.what} again (${ord_(n)} time)` : `👀 ${info.name} just opened your ${info.what}`,
      html: emailShell_({ a1: '#3a8dde', a2: '#9b7bff', kicker: again ? 'Opened again' : 'Opened just now',
        title: again ? `👀 ${h_(info.name)} is back · ${ord_(n)} time` : `👀 ${h_(info.name)} is reading it`, sub: h_(info.page), inner, cta: sheetCta_(),
        preheader: again ? `${h_(info.name)} opened it again: ${ord_(n)} time.` : `${h_(info.name)} just opened your ${h_(info.what)}.` })
    });
  } catch (err) {}
}


/* =====================================================================
   ZOHO MAIL  (all emails go out through Zoho; Gmail is only a fallback)
   Secrets are kept in Script Properties — never in the sheet.
   ===================================================================== */
const ZP_ = () => PropertiesService.getScriptProperties();
// Your Zoho Self Client (api-console.zoho → Self Client → Client Secret tab). Keep this script private.
const ZOHO_CLIENT_ID = '';   // removed from the code: asked once by Connect Zoho Mail, then kept in Script Properties
const ZOHO_CLIENT_SECRET = '';
const ZOHO_REGIONS = ['in', 'com', 'eu', 'com.au', 'jp', 'ca'];

function connectZoho() {
  const ui = SpreadsheetApp.getUi();
  const ask = (title, msg) => { const r = ui.prompt(title, msg, ui.ButtonSet.OK_CANCEL); return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null; };
  const id = ZOHO_CLIENT_ID || ask('Connect Zoho Mail', 'Paste your Zoho Client ID:'); if (!id) return;
  const secret = ZOHO_CLIENT_SECRET || ask('Connect Zoho Mail', 'Paste your Client Secret:'); if (!secret) return;
  const code = ask('Connect Zoho Mail', 'Paste the code from Zoho API Console → Self Client → Generate Code\n(scope: ZohoMail.messages.CREATE,ZohoMail.accounts.READ — it expires 10 minutes after you create it):'); if (!code) return;

  const st = settings_();
  const regions = [st.region].concat(ZOHO_REGIONS.filter(r => r !== st.region));
  let tok = null, region = null, lastErr = '';
  for (const r of regions) {
    const res = UrlFetchApp.fetch(`https://accounts.zoho.${r}/oauth/v2/token`, {
      method: 'post', muteHttpExceptions: true,
      payload: { code, client_id: id, client_secret: secret, grant_type: 'authorization_code' }
    });
    let j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
    if (j.refresh_token) { tok = j; region = r; break; }
    lastErr = j.error || res.getResponseCode();
  }
  if (!tok) {
    ui.alert('Couldn’t connect to Zoho',
      `Zoho said: ${lastErr}\n\nMost often the code has expired (they last 10 minutes) or was already used. Generate a new code and try again.`, ui.ButtonSet.OK);
    return;
  }
  const P = ZP_();
  P.setProperties({ ZOHO_CLIENT_ID: id, ZOHO_CLIENT_SECRET: secret, ZOHO_REFRESH: tok.refresh_token, ZOHO_DC: region });
  CacheService.getScriptCache().put('zoho_at', tok.access_token, Math.max(60, (tok.expires_in || 3600) - 300));

  // Find the Zoho account that owns the "Send from" address (works for aliases too)
  const res = UrlFetchApp.fetch(`https://mail.zoho.${region}/api/accounts`, { headers: { Authorization: 'Zoho-oauthtoken ' + tok.access_token }, muteHttpExceptions: true });
  let accounts = []; try { accounts = JSON.parse(res.getContentText()).data || []; } catch (e) {}
  const from = st.from.toLowerCase();
  const addrs = a => [a.primaryEmailAddress, a.mailboxAddress, a.incomingUserName]
    .concat((a.emailAddress || []).map(x => x.mailId)).concat((a.sendMailDetails || []).map(x => x.fromAddress))
    .filter(Boolean).map(x => String(x).toLowerCase());
  const acc = accounts.find(a => addrs(a).includes(from)) || accounts[0];
  if (!acc) {
    ui.alert('Connected, but no mailbox found', 'Zoho connected, but didn’t return any mail account. Make sure you generated the code while logged into the account that owns ' + st.from, ui.ButtonSet.OK);
    return;
  }
  P.setProperty('ZOHO_ACCOUNT_ID', String(acc.accountId));
  setSetting_('Zoho region', region);
  const aliasOk = addrs(acc).includes(from);
  setSetting_('Zoho status', `Connected ✓ (${acc.primaryEmailAddress || acc.mailboxAddress || 'account ' + acc.accountId})`);

  try {
    sendTestEmail(true);
    ui.alert('Zoho Mail is connected 🎉', `A test email was sent from ${st.from} to ${st.email}.` +
      (aliasOk ? '' : `\n\nNote: ${st.from} wasn’t listed on this Zoho account. If the test email fails or comes from a different address, add it as a "Send mail as" address in Zoho Mail settings.`), ui.ButtonSet.OK);
  } catch (e) {
    setSetting_('Zoho status', 'Connected, but sending failed: ' + String(e.message || e).slice(0, 150));
    ui.alert('Connected, but the test email failed', String(e.message || e), ui.ButtonSet.OK);
  }
}

function disconnectZoho() {
  ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH', 'ZOHO_DC', 'ZOHO_ACCOUNT_ID'].forEach(k => ZP_().deleteProperty(k));
  CacheService.getScriptCache().remove('zoho_at');
  setSetting_('Zoho status', 'Not connected');
  SpreadsheetApp.getActive().toast('Zoho Mail disconnected. Emails will go out from Gmail until you reconnect.', '💌 Greeting Site', 6);
}

function zohoReady_() { const P = ZP_().getProperties(); return !!(P.ZOHO_REFRESH && P.ZOHO_ACCOUNT_ID && P.ZOHO_CLIENT_ID); }

function zohoToken_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('zoho_at');
  if (hit) return hit;
  const P = ZP_().getProperties();
  const res = UrlFetchApp.fetch(`https://accounts.zoho.${P.ZOHO_DC}/oauth/v2/token`, {
    method: 'post', muteHttpExceptions: true,
    payload: { refresh_token: P.ZOHO_REFRESH, client_id: P.ZOHO_CLIENT_ID, client_secret: P.ZOHO_CLIENT_SECRET, grant_type: 'refresh_token' }
  });
  const j = JSON.parse(res.getContentText());
  if (!j.access_token) throw new Error('Zoho token refresh failed: ' + (j.error || res.getResponseCode()));
  cache.put('zoho_at', j.access_token, Math.max(60, (j.expires_in || 3600) - 300));
  return j.access_token;
}

function zohoSend_(to, subject, html, fromName) {
  const P = ZP_().getProperties(), st = settings_();
  const name = String(fromName || '').replace(/["<>]/g, '').trim();
  const send = (token, withName) => UrlFetchApp.fetch(`https://mail.zoho.${P.ZOHO_DC}/api/accounts/${P.ZOHO_ACCOUNT_ID}/messages`, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Zoho-oauthtoken ' + token },
    payload: JSON.stringify({ fromAddress: withName && name ? `"${name}" <${st.from}>` : st.from, toAddress: to, subject, content: html, mailFormat: 'html', askReceipt: 'no' })
  });
  let res = send(zohoToken_(), true);
  if (res.getResponseCode() === 401) { CacheService.getScriptCache().remove('zoho_at'); res = send(zohoToken_(), true); }
  if (name && res.getResponseCode() >= 400 && res.getResponseCode() !== 401) res = send(zohoToken_(), false); // Zoho didn't accept the name → send without it
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`Zoho ${code}: ${res.getContentText().slice(0, 200)}`);
}

/* Every email goes through here. Zoho first; if it isn't connected or fails, Gmail sends it instead. */
function sendMail_(o) {
  if (zohoReady_()) {
    try { zohoSend_(o.to, o.subject, o.html, o.fromName); return 'zoho'; }
    catch (e) { try { setSetting_('Zoho status', 'Error ' + new Date().toLocaleString() + ': ' + String(e.message || e).slice(0, 150)); } catch (x) {} }
  }
  const opts = { to: o.to, subject: o.subject, htmlBody: o.html, name: o.fromName || 'Greeting Site' };
  if (o.replyTo) opts.replyTo = o.replyTo;
  MailApp.sendEmail(opts);
  return 'gmail';
}

function sendTestEmail(silent) {
  const st = settings_();
  const via = sendMail_({
    to: st.email, fromName: st.alertsName, subject: '✅ Greeting Site test email',
    html: emailShell_({ a1: '#2bb673', a2: '#3a8dde', kicker: 'All set', title: '✅ Emails are working', inner:
      `<p style="font-size:16px;line-height:1.6;margin:0">This is a test from your Greeting Site. Alerts, messages and links will be sent from <b>${h_(st.from)}</b> to people, and alerts will reach you at <b>${h_(st.email)}</b>.</p>`,
      cta: sheetCta_() })
  });
  if (silent !== true) SpreadsheetApp.getActive().toast(`Test email sent to ${st.email} via ${via === 'zoho' ? 'Zoho Mail' : 'Gmail (Zoho not connected)'}.`, '💌 Greeting Site', 6);
  return via;
}

/* =====================================================================
   SEND LINK BY EMAIL
   ===================================================================== */
const LINK_STYLE = {
  sorry: { a1: '#ff6f91', a2: '#b48cff', btn: '#e0527a', kicker: 'A note for you',
    subject: (n, f) => `💌 A little note for you, ${n}`,
    title: n => `${n}, I owe you a few words 🤍`,
    body: f => `${f} made something just for you. Find a quiet minute, then open it. Sound on if you can 🔊`,
    label: 'Open the note 💌' },
  birthday: { a1: '#ff8a3d', a2: '#ff4f9a', btn: '#ff4f7b', kicker: 'A birthday surprise',
    subject: (n, f) => `🎂 Happy Birthday, ${n}! A little surprise from ${f}`,
    title: n => `Happy Birthday, ${n}! 🎂`,
    body: f => `${f} made you a little birthday surprise. Open it when you have a minute — sound on 🔊`,
    label: 'Open your surprise 🎁' },
  letter: { a1: '#8c5a3c', a2: '#c9965b', btn: '#8c2f2f', kicker: 'You’ve got mail',
    subject: (n, f) => `✉️ A letter for you, ${n}`,
    title: n => `A letter for ${n} ✉️`,
    body: f => `${f} wrote you a letter. Find a quiet corner — it’s meant to be read slowly.`,
    label: 'Open the letter ✉️' }
};

function sendLinkEmail_(row, to) {
  const info = rowInfo_(row), sty = LINK_STYLE[info.mode], from = String(row[COL.FROM - 1] || '').trim() || 'Someone';
  const msgOn = row[COL.MSG - 1] === true;
  const inner = `<p style="font-size:17px;line-height:1.65;margin:0">${h_(sty.body(from))}</p>`;
  const after = `<p style="font-size:13px;color:#8a7d94;margin:22px 0 0;line-height:1.5">Button not working? Copy this link:<br><a href="${h_(info.link)}" style="color:${sty.btn};word-break:break-all">${h_(info.link)}</a></p>`;
  sendMail_({
    to, fromName: settings_().senderName, subject: sty.subject(info.name, from),
    html: emailShell_({ a1: sty.a1, a2: sty.a2, kicker: sty.kicker, title: h_(sty.title(info.name)), inner,
      cta: { href: info.link, label: sty.label, bg: sty.btn }, after,
      preheader: h_(sty.body(from)),
      footer: `Sent with care by ${h_(from)}. This is a no-reply address${msgOn ? ' — you can write back from inside the page 💌' : '.'}` })
  });
}

function sendLinkByEmail() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getActiveSheet(), ui = SpreadsheetApp.getUi();
  if (sh.getName() !== MASTER) return ui.alert('Go to the Master sheet and select the people (rows) you want to email.');
  const sel = sh.getActiveRange(), st = settings_();
  const first = Math.max(2, sel.getRow()), last = sel.getRow() + sel.getNumRows() - 1;
  const ok = [], skipped = [];
  for (let r = first; r <= last; r++) {
    const name = String(sh.getRange(r, COL.NAME).getValue()).trim();
    if (!name) continue;
    ensureRow_(sh, r, st);
    const row = sh.getRange(r, 1, 1, HEADERS.length).getValues()[0];
    const email = String(row[COL.EMAIL - 1]).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped.push(`${name} — no email address`); continue; }
    if (row[COL.ACTIVE - 1] !== true) { skipped.push(`${name} — link is switched off (Active unticked)`); continue; }
    const prev = row[COL.EMAILED - 1];
    ok.push({ r, row, name, email, prev: prev instanceof Date ? Utilities.formatDate(prev, Session.getScriptTimeZone(), 'd MMM, h:mm a') : '' });
  }
  if (!ok.length) return ui.alert('Nothing to send', skipped.length ? skipped.join('\n') : 'Select at least one row with a name.', ui.ButtonSet.OK);
  const list = ok.map(o => `• ${o.name} → ${o.email}${o.prev ? `   (already emailed ${o.prev})` : ''}`).join('\n');
  const yes = ui.alert(`Email ${ok.length === 1 ? 'this link' : ok.length + ' links'}?`,
    `${list}${skipped.length ? '\n\nSkipped:\n' + skipped.join('\n') : ''}\n\nFrom: ${st.from}`, ui.ButtonSet.YES_NO);
  if (yes !== ui.Button.YES) return;
  let sent = 0; const failed = [];
  ok.forEach(o => {
    try { sendLinkEmail_(o.row, o.email); sh.getRange(o.r, COL.EMAILED).setValue(new Date()); sent++; }
    catch (e) { failed.push(`${o.name}: ${String(e.message || e).slice(0, 120)}`); }
  });
  if (failed.length) ui.alert('Some emails didn’t send', `Sent: ${sent}\n\nFailed:\n${failed.join('\n')}`, ui.ButtonSet.OK);
  else ss.toast(`Sent ${sent} link${sent === 1 ? '' : 's'} 💌`, '💌 Greeting Site', 5);
}

/* ===== Added for the unified /admin (fenilpshah.com) ===== */
function rowByCode_(code) {
  const m = SpreadsheetApp.getActive().getSheetByName(MASTER);
  const codes = m.getRange(2, COL.CODE, Math.max(m.getLastRow() - 1, 1), 1).getValues();
  const i = codes.findIndex(v => String(v[0]).trim() === String(code || '').trim());
  return i < 0 ? 0 : i + 2;
}
function adminOp_(p) {
  const ss = SpreadsheetApp.getActive(), m = ss.getSheetByName(MASTER);
  const nf = { ok: false, error: 'That greeting was not found.' };
  switch (p.op) {
    case 'list': {
      fillMissingCodes();
      const v = m.getLastRow() > 1 ? m.getRange(2, 1, m.getLastRow() - 1, HEADERS.length).getValues() : [];
      const rep = ss.getSheetByName(REPLIES), waiting = {};
      if (rep && rep.getLastRow() > 1) rep.getRange(2, 1, rep.getLastRow() - 1, REP_HEAD.length).getValues()
        .forEach(r => { if (r[RC.WANTS - 1] === 'Yes' && !String(r[RC.REPLY - 1]).trim()) waiting[r[2]] = (waiting[r[2]] || 0) + 1; });
      const msgs = {}, g = ss.getSheetByName(MESSAGES);
      if (g && g.getLastRow() > 1) g.getRange(2, 1, g.getLastRow() - 1, 1 + MAX_MESSAGES).getValues()
        .forEach(r => { const n = String(r[0]).trim().toLowerCase(); if (n) msgs[n] = r.slice(1).map(x => String(x)); });
      const rows = v.map((r, i) => ({
        row: i + 2, name: String(r[0]).trim(), type: String(r[1] || 'Sorry'), from: String(r[2] || ''), active: r[3] === true,
        code: String(r[4]), link: String(r[5]), song: String(r[7] || ''), start: String(r[8] || ''), design: Number(r[9]) || 1,
        track: r[10] === true, msg: r[11] === true, alert: r[12] === true, email: String(r[13] || ''),
        emailed: r[14] instanceof Date ? r[14].toISOString() : '', opens: Number(r[15]) || 0,
        waiting: waiting[String(r[4])] || 0, messages: msgs[String(r[0]).trim().toLowerCase()] || []
      })).filter(x => x.name);
      return { ok: true, rows, sheet: ss.getUrl(), preview: settings_().previewUntil > Date.now() };
    }
    case 'save': {   // add or edit one greeting (and its messages)
      const d = p.data || {};
      const name = String(d.name || '').trim();
      if (!name) return { ok: false, error: 'Please enter a name.' };
      let r = d.code ? rowByCode_(d.code) : 0;
      if (d.code && !r) return nf;
      if (!r) { r = Math.max(m.getLastRow() + 1, 2); }
      const type = ['Sorry', 'Birthday', 'Letter'].indexOf(d.type) >= 0 ? d.type : 'Sorry';
      m.getRange(r, COL.NAME, 1, 3).setValues([[name, type, String(d.from || 'Fenil').trim()]]);
      m.getRange(r, COL.SONG, 1, 3).setValues([[String(d.song || '').trim(), String(d.start || '').trim(), String([1, 2, 3].indexOf(Number(d.design)) >= 0 ? Number(d.design) : 1)]]);
      m.getRange(r, COL.EMAIL).setValue(String(d.email || '').trim());
      if (!d.code) { m.getRange(r, COL.ACTIVE).insertCheckboxes().setValue(true); }
      ensureRow_(m, r, settings_());
      const g = ss.getSheetByName(MESSAGES);
      const list = (d.messages || []).map(x => String(x || '').trim()).slice(0, MAX_MESSAGES);
      while (list.length < MAX_MESSAGES) list.push('');
      const names = g.getLastRow() > 1 ? g.getRange(2, 1, g.getLastRow() - 1, 1).getValues().map(x => String(x[0]).trim().toLowerCase()) : [];
      const oldName = String(d.oldName || name).trim().toLowerCase();
      let gr = names.indexOf(oldName); gr = gr < 0 ? names.indexOf(name.toLowerCase()) : gr;
      const at = gr < 0 ? Math.max(g.getLastRow() + 1, 2) : gr + 2;
      g.getRange(at, 1, 1, 1 + MAX_MESSAGES).setValues([[name].concat(list)]);
      return { ok: true, code: String(m.getRange(r, COL.CODE).getValue()), link: String(m.getRange(r, COL.LINK).getValue()) };
    }
    case 'set': {
      const c = { active: COL.ACTIVE, track: COL.TRACK, msg: COL.MSG, alert: COL.ALERT }[p.field];
      if (!c) return { ok: false, error: 'Unknown setting.' };
      const r = rowByCode_(p.code); if (!r) return nf;
      m.getRange(r, c).setValue(!!p.value);
      return { ok: true };
    }
    case 'sendLink': {
      const r = rowByCode_(p.code); if (!r) return nf;
      ensureRow_(m, r, settings_());
      const row = m.getRange(r, 1, 1, HEADERS.length).getValues()[0];
      const email = String(p.email || row[COL.EMAIL - 1] || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Add a valid email address first.' };
      if (row[COL.ACTIVE - 1] !== true) return { ok: false, error: 'This link is switched off. Turn it on first.' };
      if (p.email) m.getRange(r, COL.EMAIL).setValue(email);
      sendLinkEmail_(row, email);
      m.getRange(r, COL.EMAILED).setValue(new Date());
      return { ok: true };
    }
    case 'replies': {
      const sh = ss.getSheetByName(REPLIES);
      if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [] };
      const v = sh.getRange(2, 1, sh.getLastRow() - 1, REP_HEAD.length).getValues();
      return { ok: true, rows: v.map((r, i) => ({ row: i + 2, at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), name: r[1], code: r[2], page: r[3],
        text: String(r[4]).replace(/^'/, ''), wants: r[5] === 'Yes', contact: String(r[6]).replace(/^'/, ''), reply: String(r[7] || ''),
        seen: r[8] instanceof Date ? r[8].toISOString() : '' })).reverse().slice(0, 200) };
    }
    case 'reply': {
      const sh = ss.getSheetByName(REPLIES), r = parseInt(p.row, 10);
      if (!sh || !(r >= 2) || r > sh.getLastRow()) return { ok: false, error: 'Message not found.' };
      sh.getRange(r, RC.REPLY).setValue(clean_(p.text, 2000));
      sh.getRange(r, RC.SEEN).setValue('');
      return { ok: true };
    }
    case 'activity': {
      const sh = ss.getSheetByName(ACTIVITY);
      if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [] };
      const n = Math.min(200, sh.getLastRow() - 1), from = sh.getLastRow() - n + 1;
      return { ok: true, rows: sh.getRange(from, 1, n, ACT_HEAD.length).getValues().map(r => ({
        at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]), name: r[1], code: r[2], page: r[3], device: r[4],
        step: r[5], choice: r[6], time: r[7] })).reverse() };
    }
    case 'preview':
      setSetting_('Preview mode until', p.on ? new Date(Date.now() + 30 * 60000) : '');
      return { ok: true, preview: !!p.on };
    default: return { ok: false, error: 'Unknown greetings request.' };
  }
}


  return {
    doGet: (typeof doGet === "function" ? doGet : undefined),
    doPost: (typeof doPost === "function" ? doPost : undefined),
    onOpen: (typeof onOpen === "function" ? onOpen : undefined),
    fillMissingCodes: (typeof fillMissingCodes === "function" ? fillMissingCodes : undefined),
    startPreview: (typeof startPreview === "function" ? startPreview : undefined),
    stopPreview: (typeof stopPreview === "function" ? stopPreview : undefined),
    connectZoho: (typeof connectZoho === "function" ? connectZoho : undefined),
    sendTestEmail: (typeof sendTestEmail === "function" ? sendTestEmail : undefined),
    disconnectZoho: (typeof disconnectZoho === "function" ? disconnectZoho : undefined),
    setupSheets: (typeof setupSheets === "function" ? setupSheets : undefined),
    onEdit: (typeof onEdit === "function" ? onEdit : undefined),
    adminOp_: (typeof adminOp_ === "function" ? adminOp_ : undefined)
  };
}).apply(null, env_('GREET', 'greet'));


/* ================================================================== *
 *  Menu items and background jobs (Apps Script needs top-level names)
 * ================================================================== */
function BOOK__setupSheets(e) { return BOOK.setupSheets(e); }
function BOOK__connectZoho(e) { return BOOK.connectZoho(e); }
function BOOK__sendTestEmail(e) { return BOOK.sendTestEmail(e); }
function BOOK__enableReminders(e) { return BOOK.enableReminders(e); }
function BOOK__previewSlots(e) { return BOOK.previewSlots(e); }
function BOOK__setOwnerPassword(e) { return BOOK.setOwnerPassword(e); }
function BOOK__showCalendarLink(e) { return BOOK.showCalendarLink(e); }
function BOOK__syncCalendarNow(e) { return BOOK.syncCalendarNow(e); }
function BOOK__resetCalendarLink(e) { return BOOK.resetCalendarLink(e); }
function BOOK__sendReminders(e) { return BOOK.sendReminders(e); }
function IQ__setup(e) { return IQ.setup(e); }
function IQ__generatePasswords(e) { return IQ.generatePasswords(e); }
function IQ__resetStudent(e) { return IQ.resetStudent(e); }
function IQ__sweepExpired(e) { return IQ.sweepExpired(e); }
function IQ__menuZohoConnect(e) { return IQ.menuZohoConnect(e); }
function IQ__menuMailStatus(e) { return IQ.menuMailStatus(e); }
function zohoConnectFromDialog(v) { return IQ.zohoConnectFromDialog(v); }   // called from the IQ Zoho dialog
function zohoTestFromDialog(v) { return IQ.zohoTestFromDialog(v); }   // called from the IQ Zoho dialog
function zohoDisconnectFromDialog(v) { return IQ.zohoDisconnectFromDialog(v); }   // called from the IQ Zoho dialog
function OTLO__refresh(e) { return OTLO.refresh(e); }
function OTLO__imageHelp(e) { return OTLO.imageHelp(e); }
function OTLO__connectZoho(e) { return OTLO.connectZoho(e); }
function OTLO__testAutoReply(e) { return OTLO.testAutoReply(e); }
function OTLO__setup(e) { return OTLO.setup(e); }
function OTLO__onEdit(e) { return OTLO.onEdit(e); }
function GREET__fillMissingCodes(e) { return GREET.fillMissingCodes(e); }
function GREET__startPreview(e) { return GREET.startPreview(e); }
function GREET__stopPreview(e) { return GREET.stopPreview(e); }
function GREET__connectZoho(e) { return GREET.connectZoho(e); }
function GREET__sendTestEmail(e) { return GREET.sendTestEmail(e); }
function GREET__disconnectZoho(e) { return GREET.disconnectZoho(e); }
function GREET__setupSheets(e) { return GREET.setupSheets(e); }
function GREET__onEdit(e) { return GREET.onEdit(e); }

/* ================================================================== *
 *  ROUTER — one /exec URL for everything
 * ================================================================== */
const APPS_ = { book: () => BOOK, iq: () => IQ, otlo: () => OTLO, greet: () => GREET };

function svc_(e) {
  const path = String((e && e.pathInfo) || '').replace(/^\/+/, '').split('/')[0].toLowerCase();
  return path || String((e && e.parameter && e.parameter.svc) || '').toLowerCase();
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  const s = svc_(e);
  try {
    if (APPS_[s]) return APPS_[s]().doGet(e);
    return out_({ ok: true, site: FPS.SITE, services: Object.keys(APPS_).concat('admin') });
  } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); }
}

function doPost(e) {
  const s = svc_(e);
  try {
    if (s === 'admin') {
      let p = {};
      try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
      return out_(hubAdmin_(p));
    }
    if (APPS_[s]) return APPS_[s]().doPost(e);
    return out_({ ok: false, error: 'Unknown service. Use /book, /iq, /otlo, /greet or /admin.' });
  } catch (err) { return out_({ ok: false, error: String(err && err.message || err) }); }
}

/* ================================================================== *
 *  ONE ADMIN — fenilpshah.com/admin
 *  Sign-in uses your booking owner password (Fenil Book → Set owner
 *  PDF password, or change it inside /admin → Bookings → Settings).
 *  The same session works for every tab.
 * ================================================================== */
function hubAdmin_(p) {
  const op = String(p.op || '');
  if (op === 'login') return BOOK.admin_({ op: 'login', password: p.password });
  const chk = BOOK.admin_({ op: '__session_check__', token: p.token });   // refreshes the session
  if (chk && chk.signedOut) return chk;
  if (op === 'logout') return BOOK.admin_({ op: 'logout', token: p.token });
  if (op === 'overview') return overview_(p.token);
  const dot = op.indexOf('.'), app = op.slice(0, dot), sub = op.slice(dot + 1);
  const data = Object.assign({}, p, { op: sub });
  if (app === 'greet') return GREET.adminOp_(data);
  if (app === 'iq')    return IQ.adminOp_(data);
  if (app === 'otlo')  return OTLO.adminOp_(data);
  return { ok: false, error: 'Unknown admin request.' };
}

function overview_(token) {
  const o = { ok: true, site: FPS.SITE, sheets: {}, counts: {} };
  Object.keys(FPS.SHEETS).forEach(k => {
    try { o.sheets[k] = SpreadsheetApp.openById(FPS.SHEETS[k]).getUrl(); } catch (e) { o.sheets[k] = ''; }
  });
  try { const d = BOOK.admin_({ op: 'dashboard', token }); o.counts.book = d && d.stats ? d.stats : null; } catch (e) {}
  try { const g = GREET.adminOp_({ op: 'list' }); o.counts.greet = { total: g.rows.length, active: g.rows.filter(r => r.active).length,
    opens: g.rows.reduce((a, r) => a + r.opens, 0), waiting: g.rows.reduce((a, r) => a + r.waiting, 0) }; } catch (e) {}
  try { const s = IQ.adminOp_({ op: 'students' }), r = IQ.adminOp_({ op: 'results' }), l = IQ.adminOp_({ op: 'live' });
    o.counts.iq = { students: s.rows.length, results: r.rows.length, live: l.rows.length }; } catch (e) {}
  try { const ps = OTLO.adminOp_({ op: 'posts' }), ms = OTLO.adminOp_({ op: 'messages' });
    o.counts.otlo = { posts: ps.rows.length, published: ps.rows.filter(r => r.published).length,
      unreplied: ms.rows.filter(m => !String(m.replied || '').trim()).length }; } catch (e) {}
  return o;
}

/* ================================================================== *
 *  CONTROL SHEET MENU
 *  Bind this project to one new, empty Google Sheet (the "Control"
 *  sheet). Every app's old menu appears there.
 * ================================================================== */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🌐 fenilpshah.com')
    .addItem('1. Import settings from old scripts', 'HUB_importOld')
    .addItem('2. Set up everything (triggers + new links)', 'HUB_setupAll')
    .addSeparator()
    .addItem('Point all links to the new site again', 'HUB_migrateLinks')
    .addItem('Show web app URL and sheet links', 'HUB_info')
    .addToUi();
  [BOOK, IQ, OTLO, GREET].forEach(a => { try { if (a.onOpen) a.onOpen(); } catch (e) {} });
}

function execUrl_() {
  let u = /^https:\/\/script\.google\.com\//.test(FPS.EXEC) ? FPS.EXEC : '';
  if (!u) { try { u = ScriptApp.getService().getUrl() || ''; } catch (e) {} }
  if (/\/dev$/.test(u)) u = '';
  return u.replace(/\/+$/, '');
}

function setKV_(sheetId, tab, map) {
  const sh = SpreadsheetApp.openById(sheetId).getSheetByName(tab);
  if (!sh) return;
  const keys = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(v => String(v[0]).trim());
  Object.keys(map).forEach(k => {
    const i = keys.indexOf(k);
    if (i >= 0) sh.getRange(i + 1, 2).setValue(map[k]); else { sh.appendRow([k, map[k]]); keys.push(k); }
  });
}

/** Rewrites every stored link (emails, greeting links, Otlo) to the new site. Safe to run again. */
function HUB_migrateLinks(silent) {
  const S = FPS.SITE.replace(/\/+$/, ''), X = execUrl_(), done = [];
  if (!X) throw new Error('Paste your /exec URL into FPS.EXEC at the top of Code.gs first.');
  try { setKV_(FPS.SHEETS.book, 'Settings', { 'Booking page URL': S + '/book', 'Feedback link (optional)': S + '/book/feedback', 'Web app URL (/exec)': X + '/book' }); done.push('Booking'); } catch (e) { done.push('Booking ✕ ' + e.message); }
  try { setKV_(FPS.SHEETS.greet, 'Settings', { 'Sorry site': S + '/g', 'Birthday site': S + '/g', 'Letter site': S + '/g' }); GREET.fillMissingCodes(); done.push('Greetings'); } catch (e) { done.push('Greetings ✕ ' + e.message); }
  try { OTLO.setSetting_('site_url', S + '/otlo'); OTLO.setSetting_('api_url', X + '/otlo'); OTLO.clearCache_(); done.push('Otlo'); } catch (e) { done.push('Otlo ✕ ' + e.message); }
  if (silent !== true) SpreadsheetApp.getUi().alert('Links updated', done.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  return done;
}

/** Installs the background jobs every app needs, then updates the links. */
function HUB_setupAll() {
  const ui = SpreadsheetApp.getUi();
  const want = [
    ['IQ__sweepExpired',   b => b.timeBased().everyMinutes(5).create()],
    ['BOOK__sendReminders', b => b.timeBased().everyHours(1).create()],
    ['GREET__onEdit',      b => b.forSpreadsheet(FPS.SHEETS.greet).onEdit().create()],
    ['OTLO__onEdit',       b => b.forSpreadsheet(FPS.SHEETS.otlo).onEdit().create()]
  ];
  const names = want.map(w => w[0]);
  ScriptApp.getProjectTriggers().filter(t => names.indexOf(t.getHandlerFunction()) >= 0).forEach(t => ScriptApp.deleteTrigger(t));
  const log = [];
  want.forEach(([fn, make]) => { try { make(ScriptApp.newTrigger(fn)); log.push('✓ ' + fn); } catch (e) { log.push('✕ ' + fn + ': ' + e.message); } });
  try { log.push(''); log.push(HUB_migrateLinks(true).join('\n')); } catch (e) { log.push('Links ✕ ' + e.message); }
  ui.alert('fenilpshah.com is set up', log.join('\n') +
    '\n\nIf you want booking reminders off, delete the BOOK__sendReminders trigger (Triggers ⏰ in the left bar).', ui.ButtonSet.OK);
}

/**
 * Copies the private settings (Zoho tokens, owner password, calendar key, Drive folders…)
 * from your four OLD scripts, so nothing has to be reconnected.
 * In each old Apps Script project, add and run this once, then copy the log line:
 *     function exportForFenil(){ Logger.log(JSON.stringify(PropertiesService.getScriptProperties().getProperties())); }
 * Paste each line into the "Import" tab of the Control sheet: column A = book / iq / otlo / greet, column B = the line.
 */
function HUB_importOld() {
  const ss = SpreadsheetApp.getActive(), ui = SpreadsheetApp.getUi();
  let sh = ss.getSheetByName('Import');
  if (!sh) {
    sh = ss.insertSheet('Import');
    sh.getRange(1, 1, 1, 3).setValues([['App (book / iq / otlo / greet)', 'Paste the exportForFenil() log line here', 'Status']]).setFontWeight('bold');
    sh.getRange(2, 1, 4, 1).setValues([['book'], ['iq'], ['otlo'], ['greet']]);
    sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 600); sh.setColumnWidth(3, 220);
    ui.alert('Import tab created', 'In each old Apps Script project run:\n\nfunction exportForFenil(){ Logger.log(JSON.stringify(PropertiesService.getScriptProperties().getProperties())); }\n\nPaste each log line in column B next to its app, then run this menu item again.', ui.ButtonSet.OK);
    return;
  }
  const NS = { book: 'BOOK', iq: 'IQ', otlo: 'OTLO', greet: 'GREET' }, rp = PropertiesService.getScriptProperties();
  const v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues(), log = [];
  v.forEach((r, i) => {
    const app = String(r[0]).trim().toLowerCase(), raw = String(r[1]).trim();
    if (!NS[app] || !raw) return;
    try {
      const obj = JSON.parse(raw), x = {};
      Object.keys(obj).forEach(k => { x[NS[app] + '.' + k] = obj[k]; });
      rp.setProperties(x);
      sh.getRange(i + 2, 2).setValue('(imported — removed from the sheet for safety)');
      sh.getRange(i + 2, 3).setValue('✓ ' + Object.keys(obj).length + ' settings, ' + new Date().toLocaleString());
      log.push('✓ ' + app + ': ' + Object.keys(obj).length);
    } catch (e) { sh.getRange(i + 2, 3).setValue('✕ not valid JSON'); log.push('✕ ' + app); }
  });
  CacheService.getScriptCache().removeAll(['BOOK.zoho_at', 'GREET.zoho_at']);
  ui.alert('Import finished', (log.join('\n') || 'Nothing to import.') +
    '\n\nZoho, your owner password and the IQ Drive folders now carry over.', ui.ButtonSet.OK);
}

function HUB_info() {
  const X = execUrl_(), lines = ['Web app: ' + (X || '(not deployed yet)'), ''];
  Object.keys(FPS.SHEETS).forEach(k => { let u = ''; try { u = SpreadsheetApp.openById(FPS.SHEETS[k]).getUrl(); } catch (e) { u = '✕ ' + e.message; } lines.push(k + ': ' + u); });
  SpreadsheetApp.getUi().alert('fenilpshah.com', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}
