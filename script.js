let currentLang = 'ur';

function setLang(lang){
  currentLang = lang;
  renderCalendar();
}

function renderCalendar(){
  const userTime = new Date();
  const table = document.getElementById("calendar");
  table.innerHTML = `
  <tr>
    <th>${currentLang==='ur'?'دن':'Day'}</th>
    <th>${currentLang==='ur'?'تاریخ (ہجری)':'Hijri Date'}</th>
    <th>${currentLang==='ur'?'تاریخ (گریگورین)':'Gregorian Date'}</th>
    <th>${currentLang==='ur'?'سحر':'Sehri'}</th>
    <th>${currentLang==='ur'?'افطار':'Iftar'}</th>
    <th>${currentLang==='ur'?'دعا':'Dua'}</th>
    <th>${currentLang==='ur'?'روزہ ٹریکر':'Fasting Tracker'}</th>
  </tr>`;

  calendarData.forEach(d=>{
    const tr = document.createElement("tr");
    if(userTime.toDateString() === new Date(d.greg).toDateString()) tr.classList.add("today");

    tr.innerHTML = `
      <td>${d.day}</td>
      <td>${d.hijri}</td>
      <td>${d.greg}</td>
      <td>${d.sehri}</td>
      <td>${d.iftar}</td>
      <td class="dua">${d.dua}</td>
      <td><input type="checkbox" onchange="toggleCheck(this)"></td>
    `;
    table.appendChild(tr);
  });
}

// Fasting Tracker
function toggleCheck(checkbox){
  if(checkbox.checked) checkbox.parentElement.classList.add('checked');
  else checkbox.parentElement.classList.remove('checked');
}

// Initial render
renderCalendar();