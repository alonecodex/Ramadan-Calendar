const gpsBtn = document.getElementById('gpsBtn');
const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const citySuggestions = document.getElementById('citySuggestions');
const locationLabel = document.getElementById('locationLabel');
const timezoneLabel = document.getElementById('timezoneLabel');
const statusText = document.getElementById('statusText');
const sehriTimeEl = document.getElementById('sehriTime');
const iftarTimeEl = document.getElementById('iftarTime');
const sehriCountdownEl = document.getElementById('sehriCountdown');
const iftarCountdownEl = document.getElementById('iftarCountdown');
const nextPrayerNameEl = document.getElementById('nextPrayerName');
const nextPrayerTimeEl = document.getElementById('nextPrayerTime');
const nextPrayerCountdownEl = document.getElementById('nextPrayerCountdown');
const calendarBody = document.getElementById('calendarBody');
const calendarTitle = document.getElementById('calendarTitle');
const methodSelect = document.getElementById('methodSelect');
const schoolSelect = document.getElementById('schoolSelect');
const dateModeSelect = document.getElementById('dateModeSelect');
const reloadBtn = document.getElementById('reloadBtn');
const addFavBtn = document.getElementById('addFavBtn');
const favoritesList = document.getElementById('favoritesList');
const notifyBtn = document.getElementById('notifyBtn');
const installBtn = document.getElementById('installBtn');
const progressText = document.getElementById('progressText');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const duaText = document.getElementById('duaText');
const membersInput = document.getElementById('membersInput');
const fitranaInput = document.getElementById('fitranaInput');
const zakatAmountInput = document.getElementById('zakatAmountInput');
const fitranaResult = document.getElementById('fitranaResult');
const zakatResult = document.getElementById('zakatResult');

const STORAGE_KEYS = {
  settings: 'ramadan.settings',
  favorites: 'ramadan.favorites',
  lastLocation: 'ramadan.lastLocation',
  notified: 'ramadan.notified'
};

const duas = [
  'Allahumma innaka afuwwun tuhibbul afwa fafu anni.',
  'Rabbana taqabbal minna innaka Antas-Sami ul-Aleem.',
  'Allahumma inni asaluka al-jannah wa audhu bika min an-naar.',
  'Rabbighfir warham wa anta khairur-raahimeen.',
  'Hasbunallahu wa ni mal wakeel.',
  'Allahumma barik lana fi rizqina waqina adhaban naar.'
];

let countdownTimer = null;
let notifyTimer = null;
let dailyEventEntries = [];
let ramadanRows = [];
let currentLocation = { label: 'Karachi, Pakistan', lat: 24.8607, lon: 67.0011 };
let currentSettings = { method: '1', school: '1', dateMode: 'greg' };
let currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let deferredInstallPrompt = null;
let notifiedMap = {};
let suggestionItems = [];
let suggestionTimer = null;
let activeSuggestionIndex = -1;

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDiff(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function stripTimezoneText(timingValue) {
  return timingValue.split(' ')[0];
}

function format12Hour(time24) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time24 || '');
  if (!match) return time24 || '--:--';

  let hour = Number(match[1]);
  const min = match[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ampm}`;
}

function toDateFromApiGregorian(gregorianObj) {
  const y = Number(gregorianObj.year);
  const m = Number(gregorianObj.month.number);
  const d = Number(gregorianObj.day);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function monthOffset(year, month, offset) {
  const d = new Date(year, month - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getTimeZoneOffsetMinutes(timeZone, date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const zonePart = parts.find((p) => p.type === 'timeZoneName');
  const value = zonePart ? zonePart.value : 'GMT+00:00';
  const match = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(value);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hh = Number(match[2]);
  const mm = Number(match[3] || '0');
  return sign * (hh * 60 + mm);
}

function zonedDateTimeToUtcMs(year, month, day, hour, minute, timeZone) {
  const approxUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const offset = getTimeZoneOffsetMinutes(timeZone, new Date(approxUtc));
  return approxUtc - offset * 60 * 1000;
}

function datePartsInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  return {
    year: Number(fmt.find((p) => p.type === 'year').value),
    month: Number(fmt.find((p) => p.type === 'month').value),
    day: Number(fmt.find((p) => p.type === 'day').value)
  };
}

function parseHHMM(value) {
  const [h, m] = (value || '00:00').split(':').map(Number);
  return { h: Number.isNaN(h) ? 0 : h, m: Number.isNaN(m) ? 0 : m };
}

function buildEventTimestamp(baseDate, hhmm, timeZone) {
  const p = datePartsInZone(baseDate, timeZone);
  const t = parseHHMM(hhmm);
  return zonedDateTimeToUtcMs(p.year, p.month, p.day, t.h, t.m, timeZone);
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(currentSettings));
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}');
    currentSettings = {
      method: parsed.method || '1',
      school: parsed.school || '1',
      dateMode: (parsed.dateMode === 'hijri' || parsed.dateMode === 'greg') ? parsed.dateMode : 'greg'
    };
  } catch {
    currentSettings = { method: '1', school: '1', dateMode: 'greg' };
  }

  methodSelect.value = currentSettings.method;
  schoolSelect.value = currentSettings.school;
  dateModeSelect.value = currentSettings.dateMode;
}

function saveLastLocation() {
  localStorage.setItem(STORAGE_KEYS.lastLocation, JSON.stringify(currentLocation));
}

function loadLastLocation() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.lastLocation) || '{}');
    if (parsed && parsed.lat && parsed.lon && parsed.label) currentLocation = parsed;
  } catch {}
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites) || '[]');
  } catch {
    return [];
  }
}

function setFavorites(favs) {
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favs));
}

function loadNotifiedMap() {
  try {
    notifiedMap = JSON.parse(localStorage.getItem(STORAGE_KEYS.notified) || '{}');
  } catch {
    notifiedMap = {};
  }
}

function saveNotifiedMap() {
  localStorage.setItem(STORAGE_KEYS.notified, JSON.stringify(notifiedMap));
}

function pruneNotifiedMap() {
  const now = Date.now();
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  Object.keys(notifiedMap).forEach((key) => {
    if (now - notifiedMap[key] > twoDays) delete notifiedMap[key];
  });
  saveNotifiedMap();
}

function alreadyNotified(key) {
  return Boolean(notifiedMap[key]);
}

function markNotified(key) {
  notifiedMap[key] = Date.now();
  saveNotifiedMap();
}

function renderFavorites() {
  const favs = getFavorites();
  favoritesList.innerHTML = '';

  if (!favs.length) {
    const empty = document.createElement('span');
    empty.textContent = 'No favorites yet.';
    empty.className = 'status';
    favoritesList.appendChild(empty);
    return;
  }

  favs.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'fav-item';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'fav-load';
    loadBtn.textContent = f.label;
    loadBtn.addEventListener('click', () => {
      currentLocation = f;
      saveLastLocation();
      loadCalendarForCoordinates(f.lat, f.lon, f.label);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'fav-remove';
    removeBtn.textContent = 'x';
    removeBtn.title = `Remove ${f.label}`;
    removeBtn.addEventListener('click', () => {
      const rest = getFavorites().filter((x) => x.label !== f.label);
      setFavorites(rest);
      renderFavorites();
      statusText.textContent = `Removed ${f.label} from favorites.`;
    });

    item.append(loadBtn, removeBtn);
    favoritesList.appendChild(item);
  });
}

function addCurrentToFavorites() {
  const favs = getFavorites();
  const exists = favs.some((f) => f.label === currentLocation.label);

  if (!exists) {
    favs.push(currentLocation);
    setFavorites(favs);
    renderFavorites();
    statusText.textContent = 'Added to favorites.';
  } else {
    statusText.textContent = 'Already in favorites.';
  }
}

function updateDua(todayHijriDay) {
  const index = todayHijriDay ? (Number(todayHijriDay) - 1) % duas.length : new Date().getDate() % duas.length;
  duaText.textContent = duas[Math.max(0, index)];
}

function updateZakatUI() {
  const members = Math.max(1, Number(membersInput.value || 1));
  const fitranaPerHead = Math.max(0, Number(fitranaInput.value || 0));
  const zakatableAmount = Math.max(0, Number(zakatAmountInput.value || 0));

  fitranaResult.textContent = `Total Fitrana: ${(members * fitranaPerHead).toFixed(2)}`;
  zakatResult.textContent = `Estimated Zakat (2.5%): ${(zakatableAmount * 0.025).toFixed(2)}`;
}

function clearCalendar() {
  calendarBody.innerHTML = '';
}

function getDateLabel(row) {
  if (currentSettings.dateMode === 'hijri') return row.hijriDate;
  return row.gregDate;
}
function renderCalendar(rows, todayIndex) {
  clearCalendar();

  rows.forEach((item, idx) => {
    const tr = document.createElement('tr');
    if (idx === todayIndex) tr.classList.add('today');

    const roza = document.createElement('td');
    roza.textContent = item.roza;

    const date = document.createElement('td');
    date.textContent = getDateLabel(item);

    const sehri = document.createElement('td');
    sehri.className = 'sehri-cell';
    sehri.textContent = format12Hour(item.sehri);

    const iftar = document.createElement('td');
    iftar.className = 'iftar-cell';
    iftar.textContent = format12Hour(item.iftar);

    tr.append(roza, date, sehri, iftar);
    calendarBody.appendChild(tr);
  });
}

function buildQuery(lat, lon) {
  return `latitude=${lat}&longitude=${lon}&method=${currentSettings.method}&school=${currentSettings.school}`;
}

async function getMonthData(lat, lon, year, month) {
  const res = await fetch(`https://api.aladhan.com/v1/calendar/${year}/${month}?${buildQuery(lat, lon)}`);
  if (!res.ok) throw new Error('Failed to fetch prayer timings.');
  const json = await res.json();
  if (!json.data || !Array.isArray(json.data)) throw new Error('Invalid timings response.');
  return json.data;
}

async function getNearbyMonthsData(lat, lon) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const prev = monthOffset(y, m, -1);
  const next = monthOffset(y, m, 1);

  const [prevData, currentData, nextData] = await Promise.all([
    getMonthData(lat, lon, prev.year, prev.month),
    getMonthData(lat, lon, y, m),
    getMonthData(lat, lon, next.year, next.month)
  ]);

  return [...prevData, ...currentData, ...nextData];
}

async function getTodayData(lat, lon) {
  const res = await fetch(`https://api.aladhan.com/v1/timings?${buildQuery(lat, lon)}`);
  if (!res.ok) throw new Error('Failed to fetch today timings.');
  const json = await res.json();
  if (!json.data || !json.data.date || !json.data.timings) throw new Error('Invalid today timings response.');
  return json.data;
}

async function getRamadanHijriData(lat, lon, hijriYear) {
  const res = await fetch(`https://api.aladhan.com/v1/hijriCalendar/${hijriYear}/9?${buildQuery(lat, lon)}`);
  if (!res.ok) throw new Error('Failed to fetch Ramadan month data.');
  const json = await res.json();
  if (!json.data || !Array.isArray(json.data)) throw new Error('Invalid Ramadan month response.');
  return json.data;
}

function buildDailyEvents(allData, timeZone) {
  return allData
    .map((d) => {
      const baseDate = toDateFromApiGregorian(d.date.gregorian);
      const sehri = stripTimezoneText(d.timings.Imsak);
      const iftar = stripTimezoneText(d.timings.Maghrib);
      const fajr = stripTimezoneText(d.timings.Fajr);
      const dhuhr = stripTimezoneText(d.timings.Dhuhr);
      const asr = stripTimezoneText(d.timings.Asr);
      const isha = stripTimezoneText(d.timings.Isha);

      return {
        baseDate,
        sehri,
        iftar,
        prayers: [
          { name: 'Fajr', time: fajr },
          { name: 'Dhuhr', time: dhuhr },
          { name: 'Asr', time: asr },
          { name: 'Maghrib', time: iftar },
          { name: 'Isha', time: isha }
        ],
        sehriTs: buildEventTimestamp(baseDate, sehri, timeZone),
        iftarTs: buildEventTimestamp(baseDate, iftar, timeZone)
      };
    })
    .sort((a, b) => a.baseDate - b.baseDate);
}

function buildRamadanRows(ramadanData) {
  const today = new Date();
  let todayRamadanIndex = -1;
  const dayMap = new Map();

  ramadanData.forEach((d) => {
    const hijriMonthNum = Number(d.date.hijri.month.number);
    const hijriDay = Number(d.date.hijri.day);
    if (hijriMonthNum !== 9 || Number.isNaN(hijriDay)) return;

    const baseDate = toDateFromApiGregorian(d.date.gregorian);
    dayMap.set(hijriDay, {
      roza: String(hijriDay),
      hijriDate: `${d.date.hijri.day} Ramadan ${d.date.hijri.year}`,
      gregDate: `${pad(baseDate.getDate())}-${baseDate.toLocaleString('en-US', { month: 'short' })}-${baseDate.getFullYear()}`,
      sehri: stripTimezoneText(d.timings.Imsak),
      iftar: stripTimezoneText(d.timings.Maghrib),
      baseDate
    });
  });

  const rows = [];
  for (let day = 1; day <= 30; day += 1) {
    if (dayMap.has(day)) {
      rows.push(dayMap.get(day));
    } else {
      rows.push({ roza: String(day), hijriDate: `${day} Ramadan`, gregDate: '--', sehri: '--:--', iftar: '--:--', baseDate: null });
    }
  }

  rows.forEach((row, idx) => {
    if (row.baseDate && isSameDay(row.baseDate, today)) todayRamadanIndex = idx;
  });

  return { rows, todayRamadanIndex };
}

function updateRamadanProgress(todayData) {
  const monthNum = Number(todayData.date.hijri.month.number);
  const day = Number(todayData.date.hijri.day);

  let completed = 0;
  if (monthNum === 9) completed = Math.min(30, Math.max(1, day));
  if (monthNum > 9) completed = 30;

  const percent = Math.round((completed / 30) * 100);
  progressText.textContent = completed > 0 ? `Day ${completed} of 30` : 'Ramadan has not started yet';
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;

  updateDua(day);
}

function updateTodayDisplay() {
  const today = dailyEventEntries.find((e) => isSameDay(e.baseDate, new Date()));
  if (!today) {
    sehriTimeEl.textContent = '--:--';
    iftarTimeEl.textContent = '--:--';
    return;
  }
  sehriTimeEl.textContent = format12Hour(today.sehri);
  iftarTimeEl.textContent = format12Hour(today.iftar);
}

function getUpcomingPrayer() {
  if (!dailyEventEntries.length) return null;

  const now = Date.now();
  const prayerEvents = [];

  dailyEventEntries.forEach((entry) => {
    entry.prayers.forEach((p) => {
      prayerEvents.push({
        name: p.name,
        time: p.time,
        ts: buildEventTimestamp(entry.baseDate, p.time, currentTimezone)
      });
    });
  });

  prayerEvents.sort((a, b) => a.ts - b.ts);
  return prayerEvents.find((p) => p.ts > now) || null;
}

function findNextEventTs(type) {
  const now = Date.now();
  const arr = dailyEventEntries
    .map((e) => ({ label: type === 'sehri' ? 'Sehri' : 'Iftar', ts: type === 'sehri' ? e.sehriTs : e.iftarTs }))
    .filter((x) => x.ts > now)
    .sort((a, b) => a.ts - b.ts);
  return arr[0] || null;
}

function updateCountdowns() {
  if (!dailyEventEntries.length) return;

  const now = Date.now();
  const nextSehri = findNextEventTs('sehri');
  const nextIftar = findNextEventTs('iftar');

  sehriCountdownEl.textContent = nextSehri ? `in ${formatDiff(nextSehri.ts - now)}` : 'Not available';
  iftarCountdownEl.textContent = nextIftar ? `in ${formatDiff(nextIftar.ts - now)}` : 'Not available';

  const nextPrayer = getUpcomingPrayer();
  if (!nextPrayer) {
    nextPrayerNameEl.textContent = '--';
    nextPrayerTimeEl.textContent = '--';
    nextPrayerCountdownEl.textContent = 'Not available';
  } else {
    nextPrayerNameEl.textContent = nextPrayer.name;
    nextPrayerTimeEl.textContent = format12Hour(nextPrayer.time);
    nextPrayerCountdownEl.textContent = `in ${formatDiff(nextPrayer.ts - now)}`;
  }
}

function scheduleNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (notifyTimer) clearInterval(notifyTimer);

  notifyTimer = setInterval(() => {
    const now = Date.now();
    const nextSehri = findNextEventTs('sehri');
    const nextIftar = findNextEventTs('iftar');

    [nextSehri, nextIftar].forEach((eventObj) => {
      if (!eventObj) return;
      const diff = eventObj.ts - now;
      const minuteKey = `${eventObj.label}-${Math.floor(eventObj.ts / 60000)}`;

      if (diff > 0 && diff <= 60000 && !alreadyNotified(minuteKey)) {
        new Notification(`Upcoming ${eventObj.label}`, {
          body: `${eventObj.label} is in less than 1 minute at ${new Date(eventObj.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
        });
        markNotified(minuteKey);
      }
    });
  }, 20000);
}

async function reverseGeocode(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat=${lat}&lon=${lon}`);
  if (!res.ok) return `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`;

  const json = await res.json();
  const a = json.address || {};
  const primary = [a.house_number, a.road].filter(Boolean).join(' ');
  const area = a.suburb || a.neighbourhood || a.city_district || a.town || a.village || a.city;
  const city = a.city || a.town || a.village || a.county || '';
  const country = a.country || '';

  const exact = [primary, area, city, country].filter(Boolean);
  if (exact.length) return exact.join(', ');
  return json.display_name || `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`;
}

async function geocodeCity(cityName) {
  const q = encodeURIComponent(cityName);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${q}`);
  if (!res.ok) throw new Error('City lookup failed.');

  const json = await res.json();
  if (!json.length) throw new Error('City not found. Try another name.');

  return {
    lat: Number(json[0].lat),
    lon: Number(json[0].lon),
    label: json[0].display_name.split(',').slice(0, 2).join(', ')
  };
}

function hideSuggestions() {
  citySuggestions.classList.add('hidden');
  activeSuggestionIndex = -1;
}

function applyActiveSuggestion(index) {
  if (index < 0 || index >= suggestionItems.length) return;
  const item = suggestionItems[index];
  cityInput.value = item.label;
  hideSuggestions();
}

function setActiveSuggestion(index) {
  const buttons = citySuggestions.querySelectorAll('.suggestion-item');
  buttons.forEach((b) => b.classList.remove('active'));
  if (index >= 0 && index < buttons.length) {
    activeSuggestionIndex = index;
    buttons[index].classList.add('active');
  }
}

function renderCitySuggestions(items) {
  citySuggestions.innerHTML = '';
  suggestionItems = items;
  activeSuggestionIndex = -1;

  if (!items.length) {
    hideSuggestions();
    return;
  }

  items.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suggestion-item';
    btn.setAttribute('role', 'option');
    btn.textContent = item.label;

    btn.addEventListener('mouseenter', () => setActiveSuggestion(index));
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      cityInput.value = item.label;
      hideSuggestions();
    });

    citySuggestions.appendChild(btn);
  });

  citySuggestions.classList.remove('hidden');
}

async function fetchCitySuggestions(query) {
  if (!query || query.length < 2) {
    renderCitySuggestions([]);
    return;
  }

  const q = encodeURIComponent(query);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&q=${q}`);
  if (!res.ok) return;

  const data = await res.json();
  const items = data.map((x) => ({
    lat: Number(x.lat),
    lon: Number(x.lon),
    label: x.display_name.split(',').slice(0, 3).join(', '),
    fullLabel: x.display_name
  }));

  renderCitySuggestions(items);
}

function getSelectedSuggestion(value) {
  const v = (value || '').trim().toLowerCase();

  if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestionItems.length) {
    const active = suggestionItems[activeSuggestionIndex];
    if (active.label.toLowerCase().startsWith(v) || active.fullLabel.toLowerCase().includes(v)) {
      return active;
    }
  }

  return suggestionItems.find((x) => x.label.toLowerCase() === v || x.fullLabel.toLowerCase() === v) || null;
}
async function loadCalendarForCoordinates(lat, lon, locationName) {
  try {
    statusText.textContent = 'Loading Ramadan timings...';
    currentLocation = { lat, lon, label: locationName };
    saveLastLocation();

    const [allData, todayData] = await Promise.all([
      getNearbyMonthsData(lat, lon),
      getTodayData(lat, lon)
    ]);

    currentTimezone = todayData.meta && todayData.meta.timezone ? todayData.meta.timezone : currentTimezone;
    timezoneLabel.textContent = `Timezone: ${currentTimezone}`;

    dailyEventEntries = buildDailyEvents(allData, currentTimezone);

    const hijriYear = Number(todayData.date.hijri.year);
    let ramadanData = [];
    try {
      ramadanData = await getRamadanHijriData(lat, lon, hijriYear);
    } catch {
      ramadanData = allData.filter((d) => Number(d.date.hijri.month.number) === 9);
    }

    const { rows, todayRamadanIndex } = buildRamadanRows(ramadanData);
    ramadanRows = rows;

    locationLabel.textContent = `Location: ${locationName}`;
    calendarTitle.textContent = `Ramadan Calendar - ${locationName}`;

    updateTodayDisplay();
    updateRamadanProgress(todayData);
    renderCalendar(rows, todayRamadanIndex);
    updateCountdowns();

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdowns, 1000);

    scheduleNotifications();
    statusText.textContent = 'Timings loaded successfully.';
  } catch (err) {
    statusText.textContent = err.message || 'Failed to load timings.';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      statusText.textContent = 'Offline mode setup failed.';
    });
  }
}

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installBtn.classList.add('hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.add('hidden');
  });
}

reloadBtn.addEventListener('click', () => {
  currentSettings.method = methodSelect.value;
  currentSettings.school = schoolSelect.value;
  currentSettings.dateMode = dateModeSelect.value;
  saveSettings();
  loadCalendarForCoordinates(currentLocation.lat, currentLocation.lon, currentLocation.label);
});

dateModeSelect.addEventListener('change', () => {
  currentSettings.dateMode = dateModeSelect.value;
  saveSettings();
  renderCalendar(ramadanRows, ramadanRows.findIndex((r) => r.baseDate && isSameDay(r.baseDate, new Date())));
});

gpsBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    statusText.textContent = 'Geolocation is not supported in this browser.';
    return;
  }

  statusText.textContent = 'Getting your location...';
  navigator.geolocation.getCurrentPosition(async (position) => {
    try {
      const { latitude, longitude } = position.coords;
      const locName = await reverseGeocode(latitude, longitude);
      loadCalendarForCoordinates(latitude, longitude, locName);
    } catch {
      statusText.textContent = 'Failed to process GPS location.';
    }
  }, () => {
    statusText.textContent = 'Unable to access GPS location.';
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
});

cityInput.addEventListener('input', () => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(() => {
    fetchCitySuggestions(cityInput.value.trim());
  }, 180);
});

cityInput.addEventListener('focus', () => {
  if (cityInput.value.trim().length >= 2) {
    fetchCitySuggestions(cityInput.value.trim());
  }
});

cityInput.addEventListener('keydown', (e) => {
  if (citySuggestions.classList.contains('hidden')) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const next = Math.min(suggestionItems.length - 1, activeSuggestionIndex + 1);
    setActiveSuggestion(next);
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prev = Math.max(0, activeSuggestionIndex - 1);
    setActiveSuggestion(prev);
    return;
  }

  if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
    e.preventDefault();
    applyActiveSuggestion(activeSuggestionIndex);
    return;
  }

  if (e.key === 'Escape') {
    hideSuggestions();
  }
});

document.addEventListener('click', (e) => {
  if (!searchForm.contains(e.target)) {
    hideSuggestions();
  }
});
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const city = cityInput.value.trim();
    if (!city) return;

    statusText.textContent = 'Searching city...';
    const selected = getSelectedSuggestion(city);
    const result = selected || await geocodeCity(city);
    hideSuggestions();
    loadCalendarForCoordinates(result.lat, result.lon, result.label);
  } catch (err) {
    statusText.textContent = err.message;
  }
});

addFavBtn.addEventListener('click', addCurrentToFavorites);

notifyBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) {
    statusText.textContent = 'Notifications are not supported on this device.';
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    scheduleNotifications();
    statusText.textContent = 'Alerts enabled.';
  } else {
    statusText.textContent = 'Notification permission was denied.';
  }
});

[membersInput, fitranaInput, zakatAmountInput].forEach((el) => {
  el.addEventListener('input', updateZakatUI);
});



function init() {
  loadSettings();
  loadLastLocation();
  loadNotifiedMap();
  pruneNotifiedMap();
  renderFavorites();
  updateZakatUI();
  setupInstallPrompt();

  locationLabel.textContent = `Location: ${currentLocation.label}`;
  loadCalendarForCoordinates(currentLocation.lat, currentLocation.lon, currentLocation.label);
  registerServiceWorker();
}

init();





















