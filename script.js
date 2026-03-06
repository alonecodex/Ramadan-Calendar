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
let dailyEventEntries = [];

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
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), h, m, 0, 0);
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

function monthOffset(year, month, offset) {
  const d = new Date(year, month - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

async function getMonthData(lat, lon, year, month) {
  const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=2`;
  const res = await fetch(url);
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
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch today timings.');

  const json = await res.json();
  if (!json.data || !json.data.date || !json.data.date.hijri) {
    throw new Error('Invalid today timings response.');
  }

  return json.data;
}

async function getRamadanHijriData(lat, lon, hijriYear) {
  const url = `https://api.aladhan.com/v1/hijriCalendar/${hijriYear}/9?latitude=${lat}&longitude=${lon}&method=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch Ramadan month data.');

  const json = await res.json();
  if (!json.data || !Array.isArray(json.data)) throw new Error('Invalid Ramadan month response.');
  return json.data;
}

function buildDailyEvents(allData) {
  return allData
    .map((d) => {
      const baseDate = toDateFromApiGregorian(d.date.gregorian);
      const sehri = stripTimezoneText(d.timings.Imsak);
      const iftar = stripTimezoneText(d.timings.Maghrib);
      return {
        baseDate,
        sehri,
        iftar,
        sehriDateTime: timeOnDate(baseDate, sehri),
        iftarDateTime: timeOnDate(baseDate, iftar)
      };
    })
    .sort((a, b) => a.baseDate - b.baseDate);
}

function buildRamadanRows(ramadanData) {
  const now = new Date();
  let todayRamadanIndex = -1;

  const dayMap = new Map();
  ramadanData.forEach((d) => {
    const hijriMonthNum = Number(d.date.hijri.month.number);
    const hijriDay = Number(d.date.hijri.day);
    if (hijriMonthNum !== 9 || Number.isNaN(hijriDay)) return;

    const baseDate = toDateFromApiGregorian(d.date.gregorian);
    dayMap.set(hijriDay, {
      roza: String(hijriDay),
      date: `${pad(baseDate.getDate())}-${baseDate.toLocaleString('en-US', { month: 'short' })}-${baseDate.getFullYear()}`,
      sehri: stripTimezoneText(d.timings.Imsak),
      iftar: stripTimezoneText(d.timings.Maghrib),
      baseDate
    });
  });

  const rows = [];
  for (let day = 1; day <= 30; day += 1) {
    const found = dayMap.get(day);
    if (found) {
      rows.push(found);
    } else {
      rows.push({
        roza: String(day),
        date: '--',
        sehri: '--:--',
        iftar: '--:--',
        baseDate: null
      });
    }
  }

  rows.forEach((row, idx) => {
    if (row.baseDate && isSameDay(row.baseDate, now)) todayRamadanIndex = idx;
  });

  return { rows, todayRamadanIndex };
}

function updateTodayDisplay() {
  const now = new Date();
  const todayEvent = dailyEventEntries.find((e) => isSameDay(e.baseDate, now));

  if (!todayEvent) {
    sehriTimeEl.textContent = '--:--';
    iftarTimeEl.textContent = '--:--';
    return;
  }

  sehriTimeEl.textContent = todayEvent.sehri;
  iftarTimeEl.textContent = todayEvent.iftar;
}

function updateCountdowns() {
  if (!dailyEventEntries.length) return;

  const now = new Date();
  const nextSehri = dailyEventEntries.find((e) => e.sehriDateTime > now);
  const nextIftar = dailyEventEntries.find((e) => e.iftarDateTime > now);

  sehriCountdownEl.textContent = nextSehri
    ? `in ${formatDiff(nextSehri.sehriDateTime - now)}`
    : 'Not available';

  iftarCountdownEl.textContent = nextIftar
    ? `in ${formatDiff(nextIftar.iftarDateTime - now)}`
    : 'Not available';
}

async function loadCalendarForCoordinates(lat, lon, locationName) {
  try {
    statusText.textContent = 'Loading Ramadan timings...';
    currentLocationName = locationName;

    const [allData, todayData] = await Promise.all([
      getNearbyMonthsData(lat, lon),
      getTodayData(lat, lon)
    ]);

    dailyEventEntries = buildDailyEvents(allData);
    updateTodayDisplay();
    updateCountdowns();

    const hijriYear = Number(todayData.date.hijri.year);
    let ramadanData = [];

    try {
      ramadanData = await getRamadanHijriData(lat, lon, hijriYear);
    } catch {
      ramadanData = allData.filter((d) => Number(d.date.hijri.month.number) === 9);
    }

    const { rows, todayRamadanIndex } = buildRamadanRows(ramadanData);

    calendarTitle.textContent = `Ramadan Calendar - ${currentLocationName}`;
    renderCalendar(rows, todayRamadanIndex);
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

locationLabel.textContent = 'Location: Karachi, Pakistan';
loadCalendarForCoordinates(24.8607, 67.0011, 'Karachi, Pakistan');
