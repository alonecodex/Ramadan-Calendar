const fallbackDuas = [
  "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
  "رَبِّ اغْفِرْ وَارْحَمْ وَأَنْتَ خَيْرُ الرَّاحِمِينَ",
  "اللَّهُمَّ اجْعَلْنَا مِنَ الْمُتَّقِينَ",
  "رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ",
  "اللَّهُمَّ ارْزُقْنَا صِيَامًا مَقْبُولًا وَدُعَاءً مُسْتَجَابًا",
  "رَبِّ زِدْنِي عِلْمًا وَاهْدِنِي لِأَحْسَنِ الْأَعْمَالِ",
  "اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ",
  "اللَّهُمَّ بَارِكْ لَنَا فِي رَمَضَانَ وَبَلِّغْنَا لَيْلَةَ الْقَدْرِ",
  "رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا",
  "اللَّهُمَّ اغْفِرْ لَنَا وَلِوَالِدِينَا وَلِلْمُؤْمِنِينَ",
];

const fallbackCalendarData = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const baseDate = new Date(2026, 1, 18 + i);
  const sehriHour = 5;
  const sehriMin = Math.max(10 - Math.floor(i / 2), 0);
  const iftarHour = 18;
  const iftarMin = 8 + Math.floor(i / 2);

  return {
    day,
    hijri: `${day} Ramadan`,
    greg: baseDate.toDateString(),
    sehri24: `${String(sehriHour).padStart(2, "0")}:${String(sehriMin).padStart(2, "0")}`,
    iftar24: `${String(iftarHour).padStart(2, "0")}:${String(iftarMin).padStart(2, "0")}`,
    dua: fallbackDuas[i % fallbackDuas.length],
  };
});
