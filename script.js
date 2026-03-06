const gpsBtn = document.getElementById('gpsBtn');
const searchForm = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const locationLabel = document.getElementById('locationLabel');
const statusText = document.getElementById('statusText');
const sehriTimeEl = document.getElementById('sehriTime');
const iftarTimeEl = document.getElementById('iftarTime');
const sehriCountdownEl = document.getElementById('sehriCountdown');
const iftarCountdownEl = document.getElementById('iftarCountdown');
const calendarBody = document.getElementById('calendarBody');
const calendarTitle = document.getElementById('calendarTitle');

let countdownTimer = null;
let currentLocationName = '';
let eventEntries = [];

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDiff(ms) {
  const total = Math.floor(ms / 1000);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function stripTimezoneText(timingValue) {
  return timingValue.split(' ')[0];
}

function toDateFromApiGregorian(gregorianObj) {
  const y = Number(gregorianObj.year);
  const m = Number(gregorianObj.month.number);
  const d = Number(gregorianObj.day);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function timeOnDate(dateObj, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    h,
    m,
    0,
    0
  );
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clearCalendar() {
  calendarBody.innerHTML = '';
}

function renderCalendar(rows, todayIndex) {
  clearCalendar();

  rows.forEach((item, idx) => {
    const tr = document.createElement('tr');
    if (idx === todayIndex) tr.classList.add('today');

    const roza = document.createElement('td');
    roza.textContent = item.roza;

    const date = document.createElement('td');
    date.textContent = item.date;

    const sehri = document.createElement('td');
    sehri.className = 'sehri-cell';
    sehri.textContent = item.sehri;

    const iftar = document.createElement('td');
    iftar.className = 'iftar-cell';
    iftar.textContent = item.iftar;

    tr.append(roza, date, sehri, iftar);
    calendarBody.appendChild(tr);
  });
}

async function getRamadanMonthData(lat, lon) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=2`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch prayer timings.');
  }

  const json = await res.json();
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('Invalid timings response.');
  }

  return json.data;
}

function buildRamadanRowsAndEvents(data) {
  const rows = [];
  const events = [];
  let todayRamadanIndex = -1;
  const now = new Date();

  data.forEach((d) => {
    const hijriMonth = d.date.hijri.month.en;
    if (hijriMonth !== 'Ramadan') return;

    const baseDate = toDateFromApiGregorian(d.date.gregorian);
    const sehri = stripTimezoneText(d.timings.Imsak);
    const iftar = stripTimezoneText(d.timings.Maghrib);

    rows.push({
      roza: d.date.hijri.day,
      date: `${pad(baseDate.getDate())}-${baseDate.toLocaleString('en-US', { month: 'short' })}-${baseDate.getFullYear()}`,
      sehri,
      iftar,
      baseDate
    });

    events.push({
      baseDate,
      sehri,
      iftar,
      sehriDateTime: timeOnDate(baseDate, sehri),
      iftarDateTime: timeOnDate(baseDate, iftar)
    });
  });

  rows.forEach((row, index) => {
    if (isSameDay(row.baseDate, now)) todayRamadanIndex = index;
  });

  return { rows, events, todayRamadanIndex };
}

function updateTodayDisplay() {
  const now = new Date();
  const todayEvent = eventEntries.find((e) => isSameDay(e.baseDate, now));

  if (!todayEvent) {
    sehriTimeEl.textContent = '--:--';
    iftarTimeEl.textContent = '--:--';
    return;
  }

  sehriTimeEl.textContent = todayEvent.sehri;
  iftarTimeEl.textContent = todayEvent.iftar;
}

function updateCountdowns() {
  if (!eventEntries.length) return;

  const now = new Date();

  const nextSehri = eventEntries.find((e) => e.sehriDateTime > now);
  const nextIftar = eventEntries.find((e) => e.iftarDateTime > now);

  sehriCountdownEl.textContent = nextSehri
    ? `in ${formatDiff(nextSehri.sehriDateTime - now)}`
    : 'Passed for listed days';

  iftarCountdownEl.textContent = nextIftar
    ? `in ${formatDiff(nextIftar.iftarDateTime - now)}`
    : 'Passed for listed days';
}

async function loadCalendarForCoordinates(lat, lon, locationName) {
  try {
    statusText.textContent = 'Loading Ramadan timings...';
    currentLocationName = locationName;

    const data = await getRamadanMonthData(lat, lon);
    const { rows, events, todayRamadanIndex } = buildRamadanRowsAndEvents(data);
    eventEntries = events;
    updateTodayDisplay();

    calendarTitle.textContent = `Ramadan Calendar - ${currentLocationName}`;

    if (!rows.length) {
      clearCalendar();
      sehriCountdownEl.textContent = 'Not available';
      iftarCountdownEl.textContent = 'Not available';
      statusText.textContent = 'No Ramadan dates found in current month for this location.';
      return;
    }

    renderCalendar(rows, todayRamadanIndex);
    updateCountdowns();
    statusText.textContent = 'Timings loaded successfully.';

    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdowns, 1000);
  } catch (err) {
    statusText.textContent = err.message;
  }
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) return `Lat ${lat.toFixed(3)}, Lon ${lon.toFixed(3)}`;

  const json = await res.json();
  const city = json.address.city || json.address.town || json.address.village || 'Unknown city';
  const country = json.address.country || '';
  return `${city}${country ? `, ${country}` : ''}`;
}

async function geocodeCity(cityName) {
  const q = encodeURIComponent(cityName);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${q}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('City lookup failed.');

  const json = await res.json();
  if (!json.length) throw new Error('City not found. Try another name.');

  return {
    lat: Number(json[0].lat),
    lon: Number(json[0].lon),
    label: json[0].display_name.split(',').slice(0, 2).join(', ')
  };
}

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
      locationLabel.textContent = `Location: ${locName}`;
      loadCalendarForCoordinates(latitude, longitude, locName);
    } catch {
      statusText.textContent = 'Failed to process GPS location.';
    }
  }, () => {
    statusText.textContent = 'Unable to access GPS location.';
  });
});

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const city = cityInput.value.trim();
    if (!city) return;

    statusText.textContent = 'Searching city...';
    const result = await geocodeCity(city);
    locationLabel.textContent = `Location: ${result.label}`;
    loadCalendarForCoordinates(result.lat, result.lon, result.label);
  } catch (err) {
    statusText.textContent = err.message;
  }
});
