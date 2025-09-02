/* ========================
   Weather App – Tegar Satria
   ======================== */

// 1) CONFIG
const API_KEY = "274ff4cdd0124b21316d86ae8282a4e0"; 
const API_BASE = "https://api.openweathermap.org/data/2.5/weather";
const ICON_URL = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

const $ = (sel) => document.querySelector(sel);
const cityInput = $("#cityInput");
const searchBtn = $("#searchBtn");
const suggestions = $("#suggestions");
const useLocationBtn = $("#useLocation");
const toggleUnitsBtn = $("#toggleUnits");
const clearStorageBtn = $("#clearStorage");
const toast = $("#toast");

// weather fields
const cityName = $("#cityName");
const country = $("#country");
const localTime = $("#localTime");
const temp = $("#temp");
const desc = $("#desc");
const feels = $("#feels");
const wind = $("#wind");
const humidity = $("#humidity");
const sunrise = $("#sunrise");
const sunset = $("#sunset");
const icon = $("#icon");
const comfortBar = $("#comfortBar");
const comfortPct = $("#comfortPct");
const recoList = $("#recoList");

// 2) STATE
const STORAGE_KEYS = {
  RECENT: "wx_recent_cities",
  UNITS: "wx_units" // "metric" | "imperial"
};
let units = localStorage.getItem(STORAGE_KEYS.UNITS) || "metric"; // default °C

// 3) HELPERS
const showToast = (msg) => {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
};

const saveRecent = (city) => {
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || "[]");
  const exists = arr.find(c => c.toLowerCase() === city.toLowerCase());
  const next = [city, ...(exists ? arr.filter(c => c.toLowerCase() !== city.toLowerCase()) : arr)].slice(0, 8);
  localStorage.setItem(STORAGE_KEYS.RECENT, JSON.stringify(next));
  renderChips();
};

const renderChips = () => {
  const arr = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || "[]");
  suggestions.innerHTML = "";
  arr.forEach(city => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = city;
    chip.addEventListener("click", () => fetchByCity(city));
    suggestions.appendChild(chip);
  });
};

const k2c = (k) => (k - 273.15).toFixed(1); // not used, but handy
const msToKmH = (ms) => (ms * 3.6).toFixed(1);
const msToMph = (ms) => (ms * 2.23694).toFixed(1);
const fmtTime = (unix, tzOffsetSeconds) => {
  const d = new Date((unix + tzOffsetSeconds) * 1000);
  return d.toUTCString().match(/\d{2}:\d{2}/)[0] + " " + d.toUTCString().match(/[A-Z]{3}/)[0];
};
const fmtLocalClock = (tzOffsetSeconds) => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + tzOffsetSeconds * 1000);
  return local.toLocaleString([], { weekday: "long", hour: "2-digit", minute: "2-digit" });
};

const setThemeByWeather = (id, isNight) => {
  // remove all
  document.body.classList.remove("theme-clear","theme-clouds","theme-rain","theme-thunder","theme-snow","theme-fog","theme-night");
  let theme = "theme-clear";
  if (id >= 200 && id < 300) theme = "theme-thunder";
  else if (id >= 300 && id < 600) theme = "theme-rain";
  else if (id >= 600 && id < 700) theme = "theme-snow";
  else if (id >= 700 && id < 800) theme = "theme-fog";
  else if (id === 800) theme = "theme-clear";
  else if (id > 800) theme = "theme-clouds";
  document.body.classList.add(theme);
  if (isNight) document.body.classList.add("theme-night");
};

const calcComfort = ({ main, wind }) => {
  // simple comfort index based on feels_like, humidity, wind
  let score = 100;
  const feels = main.feels_like;
  const humidity = main.humidity;
  const windMs = wind.speed;
  // penalty for too hot or too cold
  const ideal = units === "metric" ? 24 : 75;
  score -= Math.min(40, Math.abs(feels - ideal) * 2.2);
  // humidity penalty
  score -= Math.min(25, Math.max(0, humidity - 50) * 0.5);
  // wind penalty
  score -= Math.min(15, windMs * 1.5);
  score = Math.max(0, Math.min(100, Math.round(score)));
  return score;
};

const buildRecommendations = (wx, isNight) => {
  const out = [];
  const t = Math.round(wx.main.temp);
  const h = wx.main.humidity;
  const id = wx.weather[0].id;
  const windy = wx.wind.speed > (units === "metric" ? 7 : 15);
  const raining = id >= 300 && id < 600;
  const thunder = id >= 200 && id < 300;
  const snow = id >= 600 && id < 700;
  const foggy = id >= 700 && id < 800;
  const clear = id === 800;

  if (raining) out.push({ text: "Bawa payung atau jas hujan ya 🌧️", level: "warn" });
  if (thunder) out.push({ text: "Waspada petir, hindari ruang terbuka ⛈️", level: "danger" });
  if (snow) out.push({ text: "Gunakan jaket tebal & alas kaki anti-slip ❄️", level: "warn" });
  if (foggy) out.push({ text: "Jarak pandang rendah, nyalakan lampu kabut 🚗🌫️", level: "warn" });
  if (windy) out.push({ text: "Angin kencang, hati-hati saat berkendara 💨", level: "warn" });

  if (!isNight && clear && t >= (units==="metric"?28:82)) out.push({ text: "Pakai sunscreen & minum cukup air, okay?☀️", level: "ok" });
  if (!isNight && t <= (units==="metric"?22:71)) out.push({ text: "Bawa outer tipis biar nyaman 🧥", level: "ok" });
  if (h >= 80) out.push({ text: "Lembap tinggi, pilih pakaian yang breathable 👕", level: "ok" });
  if (out.length === 0) out.push({ text: "Cuaca bersahabat. Have a productive day yaa Ayaa!  ", level: "ok" });

  // render
  recoList.innerHTML = "";
  out.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item.text;
    if (item.level === "warn") li.classList.add("warn");
    if (item.level === "danger") li.classList.add("danger");
    recoList.appendChild(li);
  });
};

// 4) FETCHERS
const fetchByCity = async (q) => {
  if (!q) return showToast("Masukkan nama kota dulu ya");
  try {
    setLoading(true);
    const url = `${API_BASE}?q=${encodeURIComponent(q)}&appid=${API_KEY}&units=${units}&lang=id`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.cod !== 200) {
      throw new Error(data.message || "Kota tidak ditemukan");
    }

    renderWeather(data);
    saveRecent(data.name);
  } catch (err) {
    showToast(err.message || "Terjadi kesalahan");
  } finally {
    setLoading(false);
  }
};

const fetchByCoords = async (lat, lon) => {
  try{
    setLoading(true);
    const url = `${API_BASE}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${units}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Gagal ambil cuaca lokasi");
    const data = await res.json();
    renderWeather(data);
    saveRecent(`${data.name}`);
  }catch(err){
    showToast(err.message || "Terjadi kesalahan");
  }finally{
    setLoading(false);
  }
};

// 5) RENDER
const renderWeather = (wx) => {
  const w = wx.weather[0];
  const isNight = !(wx.dt > wx.sys.sunrise && wx.dt < wx.sys.sunset);
  setThemeByWeather(w.id, isNight);

  cityName.textContent = wx.name || "—";
  country.textContent = wx.sys.country || "";
  localTime.textContent = fmtLocalClock(wx.timezone);

  icon.src = ICON_URL(w.icon);
  icon.alt = w.description;

  const unitSymbol = units === "metric" ? "°C" : "°F";
  temp.textContent = `${Math.round(wx.main.temp)}${unitSymbol}`;
  desc.textContent = w.description.replace(/^\w/, c => c.toUpperCase());
  feels.textContent = `Terasa: ${Math.round(wx.main.feels_like)}${unitSymbol}`;

  const windVal = units === "metric" ? `${msToKmH(wx.wind.speed)} km/j` : `${msToMph(wx.wind.speed)} mph`;
  wind.textContent = windVal;
  humidity.textContent = `${wx.main.humidity}%`;
  sunrise.textContent = fmtTime(wx.sys.sunrise, wx.timezone);
  sunset.textContent = fmtTime(wx.sys.sunset, wx.timezone);

  // comfort
  const comfort = calcComfort(wx);
  comfortPct.textContent = `${comfort}%`;
  comfortBar.style.width = `${comfort}%`;

  // recos
  buildRecommendations(wx, isNight);
};

// 6) LOADING STATE (skeleton-ish)
let loadingOverlay;
const setLoading = (v) => {
  if (v){
    if (!loadingOverlay){
      loadingOverlay = document.createElement("div");
      loadingOverlay.style.position = "fixed";
      loadingOverlay.style.inset = "0";
      loadingOverlay.style.background = "rgba(0,0,0,.25)";
      loadingOverlay.style.backdropFilter = "blur(2px)";
      loadingOverlay.style.display = "grid";
      loadingOverlay.style.placeItems = "center";
      loadingOverlay.style.zIndex = "9";
      const spinner = document.createElement("div");
      spinner.style.width = "48px";
      spinner.style.height = "48px";
      spinner.style.border = "4px solid rgba(255,255,255,.25)";
      spinner.style.borderTopColor = "white";
      spinner.style.borderRadius = "50%";
      spinner.style.animation = "spin .8s linear infinite";
      loadingOverlay.appendChild(spinner);
      const style = document.createElement("style");
      style.textContent = "@keyframes spin{to{transform:rotate(360deg)}}";
      document.head.appendChild(style);
    }
    document.body.appendChild(loadingOverlay);
  }else{
    loadingOverlay?.remove();
  }
};

// 7) EVENTS
searchBtn.addEventListener("click", () => fetchByCity(cityInput.value.trim()));
cityInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchByCity(cityInput.value.trim());
});

// geolocation
useLocationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) return showToast("Geolocation tidak didukung");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      fetchByCoords(latitude, longitude);
    },
    () => showToast("Gagal mengambil lokasi")
  );
});

// units toggle
const updateUnitsUI = () => {
  toggleUnitsBtn.textContent = (units === "metric") ? "°C" : "°F";
};
toggleUnitsBtn.addEventListener("click", () => {
  units = (units === "metric") ? "imperial" : "metric";
  localStorage.setItem(STORAGE_KEYS.UNITS, units);
  updateUnitsUI();
  // re-fetch last city if any
  const recent = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || "[]");
  if (recent[0]) fetchByCity(recent[0]);
});

// clear localStorage
clearStorageBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.RECENT);
  localStorage.removeItem(STORAGE_KEYS.UNITS);
  renderChips();
  showToast("LocalStorage dibersihkan ✨");
});

// INIT
(function init(){
  updateUnitsUI();
  renderChips();
  const recent = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT) || "[]");
  if (recent[0]) {
    fetchByCity(recent[0]);
  } else {
    // default: coba Jakarta
    fetchByCity("Jakarta");
  }
})();
