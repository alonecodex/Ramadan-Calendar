const calendarContainer = document.getElementById("calendar-container");
const searchInput = document.getElementById("search-input");
const locationStatus = document.getElementById("location-status");
const countdownText = document.getElementById("countdown-text");
const gpsBtn = document.getElementById("use-gps-btn");
const refreshBtn = document.getElementById("refresh-btn");

let calendarData = [...fallbackCalendarData];
let filteredData = [...calendarData];
let userCoords = null;
let countdownTimer = null;

function formatTo12Hour(time24) {
  const [hStr, mStr] = time24.split(":");
  let hour = Number(hStr);
  const minute = Number(mStr);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function parseTimeForDate(dateRef, time24) {
  const [hour, minute] = time24.split(":").map(Number);
  const dt = new Date(dateRef);
  dt.setHours(hour, minute, 0, 0);
  return dt;
}

function getCountdownString(targetDate) {
  const diff = targetDate - new Date();
  if (diff <= 0) return "00h 00m 00s";
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
}

function toggleCheck(checkbox) {
  checkbox.closest(".day-card").classList.toggle("checked", checkbox.checked);
}
window.toggleCheck = toggleCheck;

function shareOnWhatsApp(day) {
  const message = `🌙 Ramadan Day ${day.day}
📅 ${day.hijri} (${day.greg})
🥣 Sehri: ${day.sehri12}
🌇 Iftar: ${day.iftar12}
🤲 Dua: ${day.dua}`;
  const link = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(link, "_blank", "noopener,noreferrer");
}
window.shareOnWhatsApp = shareOnWhatsApp;

function renderCalendar(data = filteredData) {
  calendarContainer.innerHTML = "";

  if (!data.length) {
    calendarContainer.innerHTML = `<p class="empty">No days match your search.</p>`;
    return;
  }

  const todayString = new Date().toDateString();

  data.forEach((day) => {
    const isToday = new Date(day.greg).toDateString() === todayString;

    const card = document.createElement("article");
    card.className = `day-card ${isToday ? "today" : ""}`;
    card.innerHTML = `
      <div class="date-header">
        <span class="hijri-date">${day.hijri}</span>
        <span class="greg-date">${day.greg}</span>
      </div>
      <div class="time-info">
        <div>🥣 Sehri: <strong>${day.sehri12}</strong> <small>(${day.sehri24})</small></div>
        <div>🌇 Iftar: <strong>${day.iftar12}</strong> <small>(${day.iftar24})</small></div>
      </div>
      <div class="dua">🤲 ${day.dua}</div>
      <div class="card-actions">
        <label><input type="checkbox" onchange="toggleCheck(this)"> Fast Completed</label>
        <button class="btn wa" onclick='shareOnWhatsApp(${JSON.stringify(day).replace(/'/g, "\\'")})'>WhatsApp Share</button>
      </div>
    `;

    calendarContainer.appendChild(card);
  });
}

function updateCountdown() {
  const today = calendarData.find((d) => new Date(d.greg).toDateString() === new Date().toDateString());
  if (!today) {
    countdownText.textContent = "Today is outside current Ramadan dataset.";
    return;
  }

  const now = new Date();
  const sehriTime = parseTimeForDate(now, today.sehri24);
  const iftarTime = parseTimeForDate(now, today.iftar24);

  if (now < sehriTime) {
    countdownText.textContent = `⏳ Sehri in ${getCountdownString(sehriTime)}`;
  } else if (now < iftarTime) {
    countdownText.textContent = `⏳ Iftar in ${getCountdownString(iftarTime)}`;
  } else {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowData = calendarData.find((d) => new Date(d.greg).toDateString() === tomorrow.toDateString());
    if (tomorrowData) {
      const nextSehri = parseTimeForDate(tomorrow, tomorrowData.sehri24);
      countdownText.textContent = `✅ Fast complete. Next Sehri in ${getCountdownString(nextSehri)}`;
    } else {
      countdownText.textContent = "Ramadan Mubarak! Month completed in this calendar.";
    }
  }
}

function normalizeCalendarRows(rows) {
  return rows
    .sort((a, b) => new Date(a.date.gregorian.date) - new Date(b.date.gregorian.date))
    .slice(0, 30)
    .map((entry, idx) => ({
      day: idx + 1,
      hijri: `${idx + 1} Ramadan`,
      greg: new Date(entry.date.gregorian.date).toDateString(),
      sehri24: entry.timings.Fajr.slice(0, 5),
      iftar24: entry.timings.Maghrib.slice(0, 5),
      sehri12: formatTo12Hour(entry.timings.Fajr.slice(0, 5)),
      iftar12: formatTo12Hour(entry.timings.Maghrib.slice(0, 5)),
      dua: fallbackDuas[idx % fallbackDuas.length],
    }));
}

async function fetchRamadanByCoordinates(latitude, longitude) {
  const currentYear = new Date().getFullYear();
  const collected = [];

  for (let year = currentYear; year <= currentYear + 1; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const endpoint = `https://api.aladhan.com/v1/calendar?latitude=${latitude}&longitude=${longitude}&method=2&month=${month}&year=${year}`;
      const response = await fetch(endpoint);
      if (!response.ok) continue;
      const json = await response.json();
      const ramadanRows = (json.data || []).filter((row) => row.date.hijri.month.number === 9);
      collected.push(...ramadanRows);
    }
    if (collected.length >= 30) break;
  }

  if (collected.length < 29) {
    throw new Error("Could not fetch full Ramadan data for this location.");
  }

  return normalizeCalendarRows(collected);
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.state || "your location";
  } catch {
    return "your location";
  }
}

async function detectLocationAndLoad() {
  if (!navigator.geolocation) {
    locationStatus.textContent = "Geolocation not supported. Showing fallback calendar.";
    return;
  }

  locationStatus.textContent = "Detecting location...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        userCoords = { latitude, longitude };
        const city = await reverseGeocode(latitude, longitude);
        locationStatus.textContent = `Location: ${city} (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;

        const freshData = await fetchRamadanByCoordinates(latitude, longitude);
        calendarData = freshData;
      } catch (error) {
        console.error(error);
        locationStatus.textContent = "Could not load online timings. Showing fallback calendar.";
        calendarData = [...fallbackCalendarData].map((d) => ({
          ...d,
          sehri12: formatTo12Hour(d.sehri24),
          iftar12: formatTo12Hour(d.iftar24),
        }));
      }

      filteredData = [...calendarData];
      renderCalendar();
      if (countdownTimer) clearInterval(countdownTimer);
      updateCountdown();
      countdownTimer = setInterval(updateCountdown, 1000);
    },
    (error) => {
      console.error(error);
      locationStatus.textContent = "Location denied/unavailable. Showing fallback calendar.";
      calendarData = [...fallbackCalendarData].map((d) => ({
        ...d,
        sehri12: formatTo12Hour(d.sehri24),
        iftar12: formatTo12Hour(d.iftar24),
      }));
      filteredData = [...calendarData];
      renderCalendar();
      if (countdownTimer) clearInterval(countdownTimer);
      updateCountdown();
      countdownTimer = setInterval(updateCountdown, 1000);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
  );
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    filteredData = [...calendarData];
    renderCalendar();
    return;
  }

  filteredData = calendarData.filter((day) =>
    [day.hijri, day.greg, day.dua, String(day.day), day.sehri12, day.iftar12]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );

  renderCalendar();
}

searchInput.addEventListener("input", applySearch);
gpsBtn.addEventListener("click", detectLocationAndLoad);
refreshBtn.addEventListener("click", async () => {
  if (userCoords) {
    locationStatus.textContent = "Refreshing calendar...";
    try {
      calendarData = await fetchRamadanByCoordinates(userCoords.latitude, userCoords.longitude);
      filteredData = [...calendarData];
      renderCalendar();
      updateCountdown();
      locationStatus.textContent = "Calendar refreshed successfully.";
    } catch {
      locationStatus.textContent = "Refresh failed. Keeping current data.";
    }
  } else {
    detectLocationAndLoad();
  }
});

calendarData = fallbackCalendarData.map((d) => ({
  ...d,
  sehri12: formatTo12Hour(d.sehri24),
  iftar12: formatTo12Hour(d.iftar24),
}));
filteredData = [...calendarData];
renderCalendar();
updateCountdown();
countdownTimer = setInterval(updateCountdown, 1000);
