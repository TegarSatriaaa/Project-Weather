
// ===== CONFIG =====
const API_KEY  = "274ff4cdd0124b21316d86ae8282a4e0";
const GEO_URL  = "https://api.openweathermap.org/geo/1.0/direct";
const WX_URL   = "https://api.openweathermap.org/data/2.5/weather";
const FC_URL   = "https://api.openweathermap.org/data/2.5/forecast";
const ICON_URL = (i) => `https://openweathermap.org/img/wn/${i}@2x.png`;

// ===== DOM REFS =====
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const cityInput       = $("#cityInput");
const searchBtn       = $("#searchBtn");
const useLocationBtn  = $("#useLocation");
const toggleUnitsBtn  = $("#toggleUnits");
const toggleThemeBtn  = $("#toggleTheme");
const themeIcon       = $("#themeIcon");
const unitLabel       = $("#unitLabel");
const recentChips     = $("#recentChips");
const acDrop          = $("#autocompleteDropdown");
const loadingOverlay  = $("#loadingOverlay");
const loadingText     = $("#loadingText");
const toast           = $("#toast");
const brandEmoji      = $("#brandEmoji");
const favBtn          = $("#favBtn");
const favIcon         = $("#favIcon");
const favSection      = $("#favSection");
const favChips        = $("#favChips");
const clearFavBtn     = $("#clearFavBtn");
const hourlyScroll    = $("#hourlyScroll");
const forecastGrid    = $("#forecastGrid");
const recoGrid        = $("#recoGrid");

// ===== STATE =====
let units     = localStorage.getItem("skyla_units") || "metric";
let darkMode  = localStorage.getItem("skyla_dark") === "1";
let favs      = JSON.parse(localStorage.getItem("skyla_favs") || "[]");
let recent    = JSON.parse(localStorage.getItem("skyla_recent") || "[]");
let acTimeout = null;
let lastCity  = null;
let clockInterval = null;

// ===== WEATHER EMOJI MAP =====
const weatherEmoji = (id, isNight) => {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 500) return "🌧️";
  if (id >= 500 && id < 600) { return id >= 502 ? "🌧️" : "🌦️"; }
  if (id >= 600 && id < 700) return id === 611 ? "🌨️" : "❄️";
  if (id >= 700 && id < 800) return id === 781 ? "🌪️" : "🌫️";
  if (id === 800) return isNight ? "🌙" : "☀️";
  if (id === 801) return isNight ? "🌙" : "🌤️";
  if (id === 802) return "⛅";
  if (id >= 803) return "☁️";
  return isNight ? "🌙" : "⛅";
};

const brandEmojiMap = (id) => {
  if (id >= 200 && id < 300) return "⛈️";
  if (id >= 300 && id < 600) return "🌧️";
  if (id >= 600 && id < 700) return "❄️";
  if (id >= 700 && id < 800) return "🌫️";
  if (id === 800) return "☀️";
  if (id > 800) return "⛅";
  return "🌤️";
};

// ===== THEME =====
const applyDarkMode = (val) => {
  document.body.classList.toggle("dark-mode", val);
  themeIcon.className = val ? "bx bx-moon" : "bx bx-sun";
  localStorage.setItem("skyla_dark", val ? "1" : "0");
};

const applyWeatherTheme = (id) => {
  const cls = document.body.classList;
  ["weather-sunny","weather-cloudy","weather-rainy","weather-thunder",
   "weather-snowy","weather-foggy","weather-default"].forEach(c => cls.remove(c));
  if (id >= 200 && id < 300) cls.add("weather-thunder");
  else if (id >= 300 && id < 600) cls.add("weather-rainy");
  else if (id >= 600 && id < 700) cls.add("weather-snowy");
  else if (id >= 700 && id < 800) cls.add("weather-foggy");
  else if (id === 800) cls.add("weather-sunny");
  else if (id > 800) cls.add("weather-cloudy");
  else cls.add("weather-default");
};

// ===== LOADING =====
const setLoading = (on, msg = "Sedang mencari cuaca…") => {
  loadingText.textContent = msg;
  loadingOverlay.classList.toggle("active", on);
};

// ===== TOAST =====
let toastTimer;
const showToast = (msg, duration = 2500) => {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
};

// ===== RECENT =====
const saveRecent = (city) => {
  recent = [city, ...recent.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, 8);
  localStorage.setItem("skyla_recent", JSON.stringify(recent));
  renderRecent();
};
const removeRecent = (city) => {
  recent = recent.filter(c => c.toLowerCase() !== city.toLowerCase());
  localStorage.setItem("skyla_recent", JSON.stringify(recent));
  renderRecent();
};
const renderRecent = () => {
  recentChips.innerHTML = "";
  if (recent.length === 0) return;
  const label = document.createElement("span");
  label.style.cssText = "font-size:0.7rem;font-weight:800;color:var(--text-muted);align-self:center;white-space:nowrap";
  label.textContent = "Recent:";
  recentChips.appendChild(label);
  recent.forEach(city => {
    const chip = document.createElement("button");
    chip.className = "r-chip";
    chip.innerHTML = `🕐 ${city} <i class='bx bx-x' data-city="${city}"></i>`;
    chip.querySelector("span, i")?.addEventListener("click", (e) => {
      e.stopPropagation();
      removeRecent(city);
    });
    chip.addEventListener("click", (e) => {
      if (e.target.tagName === "I") return;
      fetchByCity(city);
    });
    chip.querySelector("i").addEventListener("click", (e) => {
      e.stopPropagation();
      removeRecent(e.target.dataset.city);
    });
    recentChips.appendChild(chip);
  });
};

// ===== FAVORITES =====
const toggleFav = (city) => {
  const idx = favs.findIndex(f => f.toLowerCase() === city.toLowerCase());
  if (idx >= 0) {
    favs.splice(idx, 1);
    showToast(`💔 ${city} dihapus dari favorit`);
  } else {
    favs.push(city);
    showToast(`❤️ ${city} ditambahkan ke favorit!`);
  }
  localStorage.setItem("skyla_favs", JSON.stringify(favs));
  updateFavBtn();
  renderFavs();
};
const updateFavBtn = () => {
  const isF = lastCity && favs.some(f => f.toLowerCase() === lastCity.toLowerCase());
  favBtn.classList.toggle("active", isF);
  favIcon.className = isF ? "bx bxs-heart" : "bx bx-heart";
};
const renderFavs = () => {
  if (favs.length === 0) { favSection.style.display = "none"; return; }
  favSection.style.display = "block";
  favChips.innerHTML = "";
  favs.forEach(city => {
    const chip = document.createElement("div");
    chip.className = "fav-chip";
    chip.innerHTML = `❤️ ${city} <span class="remove-fav" data-city="${city}">✕</span>`;
    chip.addEventListener("click", (e) => {
      if (e.target.classList.contains("remove-fav")) {
        toggleFav(e.target.dataset.city);
        return;
      }
      fetchByCity(city);
    });
    favChips.appendChild(chip);
  });
};

// ===== CLOCK =====
const startClock = (tzOffset) => {
  clearInterval(clockInterval);
  const tick = () => {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const local = new Date(utc + tzOffset * 1000);
    const opts = { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false };
    $("#localTime").textContent = local.toLocaleString("id-ID", opts);
  };
  tick();
  clockInterval = setInterval(tick, 1000);
};

// ===== TIME FORMAT =====
const fmtTime = (unix, tzOffset) => {
  const d = new Date((unix + tzOffset) * 1000);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
};

// ===== COMFORT =====
const calcComfort = (wx) => {
  const feels = wx.main.feels_like;
  const humidity = wx.main.humidity;
  const windMs = wx.wind.speed;
  const ideal = units === "metric" ? 24 : 75;
  let score = 100;
  score -= Math.min(40, Math.abs(feels - ideal) * 2.2);
  score -= Math.min(25, Math.max(0, humidity - 50) * 0.5);
  score -= Math.min(15, windMs * 1.5);
  return Math.max(0, Math.min(100, Math.round(score)));
};
const comfortEmoji = (pct) => {
  if (pct >= 85) return "😎";
  if (pct >= 70) return "😊";
  if (pct >= 55) return "🙂";
  if (pct >= 40) return "😐";
  if (pct >= 25) return "😓";
  return "😰";
};

// ===== UV LABEL =====
const uvLabel = (uv) => {
  if (uv === null || uv === undefined) return { text: "—", cls: "" };
  if (uv <= 2)  return { text: "Rendah", cls: "uv-low" };
  if (uv <= 5)  return { text: "Sedang", cls: "uv-mod" };
  if (uv <= 7)  return { text: "Tinggi", cls: "uv-high" };
  if (uv <= 10) return { text: "Sangat Tinggi", cls: "uv-vhigh" };
  return { text: "Ekstrem", cls: "uv-ext" };
};

// ===== SUN ARC ANIMATION =====
const animateSunArc = (sunriseUnix, sunsetUnix, nowUnix, tzOffset) => {
  const sr = sunriseUnix + tzOffset;
  const ss = sunsetUnix + tzOffset;
  const now = nowUnix + tzOffset;
  let pct = (now - sr) / (ss - sr);
  pct = Math.max(0, Math.min(1, pct));

  // Animate arc path
  const arcEl = $("#arcProgress");
  const total = 230;
  arcEl.style.strokeDashoffset = total * (1 - pct);

  // Move sun ball along arc
  // SVG path: M 10 95 Q 100 -10 190 95
  const t = pct;
  const x = (1-t)*(1-t)*10 + 2*(1-t)*t*100 + t*t*190;
  const y = (1-t)*(1-t)*95 + 2*(1-t)*t*(-10) + t*t*95;
  const svgEl = $(".arc-svg");
  const rect = svgEl.getBoundingClientRect();
  const vbW = 200, vbH = 100;
  const xPct = x / vbW * 100;
  const yPct = y / vbH * 100;
  const sunBall = $("#sunBall");
  sunBall.style.left = xPct + "%";
  sunBall.style.top  = yPct + "%";
};

// ===== RECOMMENDATIONS =====
const buildRecos = (wx, isNight) => {
  const recos = [];
  const t = Math.round(wx.main.temp);
  const h = wx.main.humidity;
  const id = wx.weather[0].id;
  const wind = wx.wind.speed;
  const unitSym = units === "metric" ? "°C" : "°F";
  const windyThresh = units === "metric" ? 7 : 15;
  const hotThresh   = units === "metric" ? 32 : 90;
  const coldThresh  = units === "metric" ? 18 : 64;

  if (id >= 200 && id < 300) recos.push({ emoji: "⛈️", text: "Waspada petir! Sebaiknya di dalam ruangan.", level: "danger" });
  if (id >= 300 && id < 600) recos.push({ emoji: "☔", text: "Jangan lupa bawa payung atau jas hujan ya!", level: "warn" });
  if (id >= 600 && id < 700) recos.push({ emoji: "🧤", text: "Dingin banget! Pakai jaket tebal & sarung tangan.", level: "warn" });
  if (id >= 700 && id < 800) recos.push({ emoji: "🚗", text: "Jarak pandang rendah, berkendara hati-hati.", level: "warn" });
  if (wind > windyThresh) recos.push({ emoji: "💨", text: `Angin cukup kencang (${(units==="metric"?(wind*3.6).toFixed(0)+"km/j":(wind*2.23).toFixed(0)+"mph")}), pegang benda-benda di luar!`, level: "warn" });
  if (!isNight && id === 800 && t >= hotThresh) recos.push({ emoji: "🧴", text: "Terik banget! Pakai sunscreen & minum air yang banyak.", level: "warn" });
  if (t <= coldThresh) recos.push({ emoji: "🧥", text: `Suhu ${t}${unitSym} terasa dingin, bawa outer atau jaket.`, level: "ok" });
  if (h >= 80) recos.push({ emoji: "👕", text: "Kelembapan tinggi, pilih pakaian breathable biar nyaman.", level: "ok" });
  if (h < 30) recos.push({ emoji: "💧", text: "Udara kering, minum air lebih banyak dan pakai pelembab.", level: "ok" });
  if (!isNight && id === 800 && t >= 22 && t < hotThresh) recos.push({ emoji: "😎", text: "Cuaca cerah dan nyaman! Pas banget buat jalan-jalan.", level: "ok" });
  if (isNight) recos.push({ emoji: "🌙", text: "Malam hari, jaga kehangatan dan istirahat yang cukup!", level: "ok" });

  if (recos.length === 0) recos.push({ emoji: "✨", text: "Cuaca bersahabat. Selamat beraktivitas hari ini!", level: "ok" });

  recoGrid.innerHTML = "";
  recos.forEach((r, i) => {
    const card = document.createElement("div");
    card.className = `reco-card ${r.level}`;
    card.style.animationDelay = (i * 0.07) + "s";
    card.innerHTML = `<span class="reco-emoji">${r.emoji}</span><span class="reco-text">${r.text}</span>`;
    recoGrid.appendChild(card);
  });
};

// ===== RENDER HOURLY =====
const renderHourly = (list, tzOffset) => {
  hourlyScroll.innerHTML = "";
  const now = Date.now() / 1000;
  const next = list.filter(i => i.dt >= now - 3600).slice(0, 12);
  if (next.length === 0) { hourlyScroll.innerHTML = "<div class='hourly-placeholder'><span>Data tidak tersedia</span></div>"; return; }
  next.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "hour-card" + (idx === 0 ? " active" : "");
    const d = new Date((item.dt + tzOffset) * 1000);
    const hh = d.getUTCHours().toString().padStart(2,"0");
    const mm = d.getUTCMinutes().toString().padStart(2,"0");
    const isNight = item.sys?.pod === "n";
    const emoji = weatherEmoji(item.weather[0].id, isNight);
    const unitSym = units === "metric" ? "°" : "°F";
    const rain = item.pop ? Math.round(item.pop * 100) : 0;
    card.innerHTML = `
      <div class="h-time">${hh}:${mm}</div>
      <div class="h-icon">${emoji}</div>
      <div class="h-temp">${Math.round(item.main.temp)}${unitSym}</div>
      ${rain > 20 ? `<div class="h-rain">💧${rain}%</div>` : ""}
    `;
    card.addEventListener("click", () => {
      $$(".hour-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
    });
    hourlyScroll.appendChild(card);
  });
};

// ===== RENDER FORECAST =====
const renderForecast = (list, tzOffset) => {
  forecastGrid.innerHTML = "";
  const days = {};
  list.forEach(item => {
    const d = new Date((item.dt + tzOffset) * 1000);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (!days[key]) days[key] = { items: [], date: d };
    days[key].items.push(item);
  });
  const dayKeys = Object.keys(days).slice(0, 5);
  const dayNames = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  dayKeys.forEach((key, i) => {
    const day = days[key];
    const temps = day.items.map(i => i.main.temp);
    const maxT = Math.round(Math.max(...temps));
    const minT = Math.round(Math.min(...temps));
    const midItem = day.items[Math.floor(day.items.length/2)];
    const emoji = weatherEmoji(midItem.weather[0].id, false);
    const desc = midItem.weather[0].description;
    const rain = day.items.reduce((acc, i) => Math.max(acc, i.pop||0), 0);
    const unitSym = units === "metric" ? "°" : "°F";
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.style.animationDelay = (i * 0.08) + "s";
    const label = i === 0 ? "Hari Ini" : dayNames[day.date.getUTCDay()];
    card.innerHTML = `
      <div class="fc-day">${label}</div>
      <div class="fc-icon">${emoji}</div>
      <div class="fc-temps">
        <span class="fc-max">${maxT}${unitSym}</span>
        <span class="fc-min">${minT}${unitSym}</span>
      </div>
      <div class="fc-desc">${desc}</div>
      ${rain > 0.2 ? `<div class="fc-rain">💧 ${Math.round(rain*100)}%</div>` : ""}
    `;
    forecastGrid.appendChild(card);
  });
};

// ===== VISIBILITY FORMAT =====
const fmtVisibility = (m) => {
  if (!m && m !== 0) return "—";
  if (m >= 1000) return (m/1000).toFixed(1) + " km";
  return m + " m";
};

// ===== MAIN RENDER =====
const renderWeather = (wx, forecast) => {
  const w = wx.weather[0];
  const isNight = wx.dt < wx.sys.sunrise || wx.dt > wx.sys.sunset;
  const unitSym = units === "metric" ? "°C" : "°F";
  const windUnit = units === "metric" ? "km/j" : "mph";
  const windVal = units === "metric"
    ? (wx.wind.speed * 3.6).toFixed(1)
    : (wx.wind.speed * 2.237).toFixed(1);

  // Theme & brand
  applyWeatherTheme(w.id);
  brandEmoji.textContent = brandEmojiMap(w.id);

  // Location
  $("#cityName").textContent = wx.name;
  $("#countryBadge").textContent = wx.sys.country;
  startClock(wx.timezone);
  lastCity = wx.name;
  updateFavBtn();

  // Temp
  const iconEl = $("#weatherIcon");
  iconEl.src = ICON_URL(w.icon);
  iconEl.alt = w.description;

  // Glow color
  const glow = $("#iconGlow");
  if (w.id === 800) glow.style.background = "radial-gradient(circle, rgba(255,220,80,0.6) 0%, transparent 70%)";
  else if (w.id >= 300 && w.id < 600) glow.style.background = "radial-gradient(circle, rgba(100,160,255,0.5) 0%, transparent 70%)";
  else if (w.id >= 200 && w.id < 300) glow.style.background = "radial-gradient(circle, rgba(180,120,255,0.5) 0%, transparent 70%)";
  else glow.style.background = "radial-gradient(circle, rgba(200,220,255,0.4) 0%, transparent 70%)";

  $("#tempBig").textContent = `${Math.round(wx.main.temp)}${unitSym}`;
  $("#weatherDesc").textContent = w.description.replace(/^\w/, c => c.toUpperCase());
  $("#feelsLike").innerHTML = `<i class='bx bx-body'></i> Terasa ${Math.round(wx.main.feels_like)}${unitSym}`;

  // Mini stats
  $("#humidityVal").textContent = wx.main.humidity + "%";
  $("#windVal").textContent = windVal + " " + windUnit;
  $("#visibilityVal").textContent = fmtVisibility(wx.visibility);
  $("#pressureVal").textContent = wx.main.pressure + " hPa";

  // Sun
  const srStr = fmtTime(wx.sys.sunrise, wx.timezone);
  const ssStr = fmtTime(wx.sys.sunset, wx.timezone);
  $("#sunriseVal").textContent = srStr;
  $("#sunsetVal").textContent = ssStr;
  setTimeout(() => animateSunArc(wx.sys.sunrise, wx.sys.sunset, wx.dt, wx.timezone), 300);

  // Comfort
  const comfort = calcComfort(wx);
  const cFill = $("#comfortFill");
  const cEmoji = $("#comfortEmoji");
  const cVal = $("#comfortVal");
  setTimeout(() => {
    cFill.style.width = comfort + "%";
    cEmoji.style.left = comfort + "%";
    cEmoji.textContent = comfortEmoji(comfort);
  }, 400);
  cVal.textContent = comfort + "%";

  // UV (estimated from weather & time)
  const estimatedUV = isNight ? 0 : (w.id === 800 ? 8 : w.id > 800 && w.id <= 802 ? 4 : w.id > 802 ? 2 : 1);
  const uvInfo = uvLabel(estimatedUV);
  const uvBadge = $("#uvBadge");
  $("#uvVal").textContent = estimatedUV;
  uvBadge.textContent = uvInfo.text;
  uvBadge.className = "extra-badge " + uvInfo.cls;

  // Dew point (calculated)
  const tempC = units === "metric" ? wx.main.feels_like : (wx.main.feels_like - 32) * 5/9;
  const dewC = tempC - ((100 - wx.main.humidity) / 5);
  const dew = units === "metric" ? dewC.toFixed(1) + "°C" : (dewC * 9/5 + 32).toFixed(1) + "°F";
  $("#dewVal").textContent = dew;

  // Reco
  buildRecos(wx, isNight);

  // Forecast
  if (forecast) {
    renderHourly(forecast.list, wx.timezone);
    renderForecast(forecast.list, wx.timezone);
  }

  // Particles
  spawnParticles(w.id, isNight);
};

// ===== PARTICLES =====
const spawnParticles = (id, isNight) => {
  const container = $("#particles");
  container.innerHTML = "";
  let emojis = [], count = 8;
  if (id >= 200 && id < 300) { emojis = ["⚡","🌩️","☁️"]; count = 10; }
  else if (id >= 300 && id < 600) { emojis = ["💧","🌧️","☁️"]; count = 15; }
  else if (id >= 600 && id < 700) { emojis = ["❄️","🌨️","⛄"]; count = 14; }
  else if (id >= 700 && id < 800) { emojis = ["🌫️","💨"]; count = 6; }
  else if (id === 800 && !isNight) { emojis = ["☀️","✨","🌟"]; count = 6; }
  else if (id === 800 && isNight) { emojis = ["🌙","⭐","✨"]; count = 8; }
  else if (id > 800) { emojis = ["☁️","🌤️","⛅"]; count = 8; }
  else { emojis = ["✨","⭐"]; count = 6; }

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "particle";
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = Math.random() * 100 + "%";
    el.style.animationDuration = (8 + Math.random() * 14) + "s";
    el.style.animationDelay = (Math.random() * 8) + "s";
    el.style.fontSize = (0.8 + Math.random() * 0.9) + "rem";
    container.appendChild(el);
  }
};

// ===== AUTOCOMPLETE =====
const fetchSuggestions = async (q) => {
  if (q.length < 2) { acDrop.classList.remove("open"); return; }
  try {
    const url = `${GEO_URL}?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) { acDrop.classList.remove("open"); return; }
    acDrop.innerHTML = "";
    data.forEach(loc => {
      const item = document.createElement("div");
      item.className = "ac-item";
      const name = [loc.name, loc.state, loc.country].filter(Boolean).join(", ");
      item.innerHTML = `<i class='bx bx-map-pin'></i> ${name}`;
      item.addEventListener("click", () => {
        cityInput.value = loc.name;
        acDrop.classList.remove("open");
        fetchByCity(loc.name);
      });
      acDrop.appendChild(item);
    });
    acDrop.classList.add("open");
  } catch { acDrop.classList.remove("open"); }
};

// ===== FETCHERS =====
const fetchByCity = async (q) => {
  if (!q) { showToast("Masukkan nama kota dulu ya~ 🗺️"); return; }
  setLoading(true, `Mencari cuaca di ${q}…`);
  try {
    const [wxRes, fcRes] = await Promise.all([
      fetch(`${WX_URL}?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}&lang=id`),
      fetch(`${FC_URL}?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}&lang=id`)
    ]);
    const wxData = await wxRes.json();
    if (wxData.cod !== 200) throw new Error(wxData.message || "Kota tidak ditemukan");
    const fcData = fcRes.ok ? await fcRes.json() : null;
    renderWeather(wxData, fcData);
    saveRecent(wxData.name);
    cityInput.value = "";
    acDrop.classList.remove("open");
  } catch (err) {
    showToast("😅 " + (err.message || "Terjadi kesalahan, coba lagi!"));
  } finally {
    setLoading(false);
  }
};

const fetchByCoords = async (lat, lon) => {
  setLoading(true, "Mendeteksi lokasimu…");
  try {
    const [wxRes, fcRes] = await Promise.all([
      fetch(`${WX_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}&lang=id`),
      fetch(`${FC_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}&lang=id`)
    ]);
    if (!wxRes.ok) throw new Error("Gagal ambil cuaca");
    const wxData = await wxRes.json();
    const fcData = fcRes.ok ? await fcRes.json() : null;
    renderWeather(wxData, fcData);
    saveRecent(wxData.name);
    showToast("📍 Lokasi terdeteksi: " + wxData.name);
  } catch (err) {
    showToast("😅 " + (err.message || "Gagal ambil lokasi"));
  } finally {
    setLoading(false);
  }
};

// ===== EVENTS =====
searchBtn.addEventListener("click", () => fetchByCity(cityInput.value.trim()));
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchByCity(cityInput.value.trim());
});
cityInput.addEventListener("input", () => {
  clearTimeout(acTimeout);
  acTimeout = setTimeout(() => fetchSuggestions(cityInput.value.trim()), 350);
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) acDrop.classList.remove("open");
});

useLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) { showToast("Geolocation tidak didukung 😔"); return; }
  navigator.geolocation.getCurrentPosition(
    pos => fetchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showToast("Gagal mendapatkan lokasi 😓")
  );
});

toggleUnitsBtn.addEventListener("click", () => {
  units = units === "metric" ? "imperial" : "metric";
  unitLabel.textContent = units === "metric" ? "°C" : "°F";
  localStorage.setItem("skyla_units", units);
  if (lastCity) fetchByCity(lastCity);
});

toggleThemeBtn.addEventListener("click", () => {
  darkMode = !darkMode;
  applyDarkMode(darkMode);
});

favBtn.addEventListener("click", () => { if (lastCity) toggleFav(lastCity); });
clearFavBtn.addEventListener("click", () => {
  favs = [];
  localStorage.setItem("skyla_favs", JSON.stringify(favs));
  renderFavs();
  showToast("🗑️ Semua favorit dihapus");
});

// ===== BACKGROUND CANVAS =====
const initCanvas = () => {
  const canvas = $("#bgCanvas");
  const ctx = canvas.getContext("2d");
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener("resize", resize);

  const circles = Array.from({length: 5}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    r: 120 + Math.random() * 180,
    dx: (Math.random() - 0.5) * 0.3,
    dy: (Math.random() - 0.5) * 0.3,
    alpha: 0.05 + Math.random() * 0.08,
  }));

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    circles.forEach(c => {
      c.x += c.dx; c.y += c.dy;
      if (c.x < -c.r) c.x = canvas.width + c.r;
      if (c.x > canvas.width + c.r) c.x = -c.r;
      if (c.y < -c.r) c.y = canvas.height + c.r;
      if (c.y > canvas.height + c.r) c.y = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, `rgba(255,255,255,${c.alpha})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  };
  draw();
};

// ===== INIT =====
(function init() {
  applyDarkMode(darkMode);
  unitLabel.textContent = units === "metric" ? "°C" : "°F";
  renderRecent();
  renderFavs();
  initCanvas();

  // Auto-load
  if (recent.length > 0) {
    fetchByCity(recent[0]);
  } else {
    fetchByCity("Jakarta");
  }
})();
