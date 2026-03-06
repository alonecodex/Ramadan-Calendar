function toggleCheck(cb){
  cb.closest('.day-card').classList.toggle('checked', cb.checked);
}

// Dynamic render from data.js
function renderCalendar(){
  const container = document.getElementById("calendar-container");
  container.innerHTML = "";
  const userTime = new Date();

  calendarData.forEach(day=>{
    const card = document.createElement('div');
    card.className = "day-card";
    if(userTime.toDateString() === new Date(day.greg).toDateString()) card.classList.add("today");

    card.innerHTML = `
      <div class="date-header">
        <span class="hijri-date">${day.hijri}</span>
        <span class="greg-date">${day.greg}</span>
      </div>
      <div class="time-info">
        <div>سحر: <span class="sehri">${day.sehri}</span></div>
        <div>افطار: <span class="iftar">${day.iftar}</span></div>
      </div>
      <div class="dua">${day.dua}</div>
      <div class="tracker">
        <label><input type="checkbox" onchange="toggleCheck(this)"> روزہ مکمل</label>
      </div>
    `;
    container.appendChild(card);
  });
}
renderCalendar();
