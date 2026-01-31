const API = "https://flight-search-backend-jgmb.onrender.com";

let currentPage = 1;
let lastResults = [];

const form = document.getElementById("searchForm");
const resultsDiv = document.getElementById("results");
const pager = document.getElementById("pager");

const originInput = document.getElementById("origin");
const destinationInput = document.getElementById("destination");
const dateInput = document.getElementById("date");
const returnDateInput = document.getElementById("returnDate");
const adultsInput = document.getElementById("adults");
const childrenInput = document.getElementById("children");

const tripTypeSelect = document.getElementById("tripType");
const returnBox = document.getElementById("returnDateContainer");

tripTypeSelect.addEventListener("change", () => {
  returnBox.classList.toggle("hidden", tripTypeSelect.value !== "roundtrip");
});

function formatDuration(iso) {
  if (!iso) return "";
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  let out = "";
  if (h) out += h[1] + "h ";
  if (m) out += m[1] + "m";
  return out.trim();
}

function minutesBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 60000);
}

/* ---------------- SEARCH ---------------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  currentPage = 1;
  await search();
});

async function search() {

  pager.classList.add("hidden");
  resultsDiv.textContent = "Searching...";

  const response = await fetch(API + "/api/search-flights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: originInput.value.trim(),
      destination: destinationInput.value.trim(),
      date: dateInput.value,
      returnDate: returnDateInput.value,
      adults: adultsInput.value,
      children: childrenInput.value,
      tripType: tripTypeSelect.value,
      page: currentPage
    })
  });

  const data = await response.json();

  if (!response.ok || !data.results) {
    resultsDiv.textContent = data.error || "No results found.";
    pager.classList.add("hidden");
    return;
  }

  lastResults = data.results.map(normalizeFlight);

  document.getElementById("pageLabel").textContent =
    "Page " + data.page;

  renderResults();

  pager.classList.remove("hidden");
}

/* ---------------- RENDER ---------------- */

function renderResults() {

  let data = [...lastResults];

  const stopFilter = document.getElementById("stopFilter").value;
  const sortBy = document.getElementById("sortBy").value;

  if (stopFilter === "direct") data = data.filter(f => f.stops === 0);
  if (stopFilter === "layover") data = data.filter(f => f.stops > 0);

  if (sortBy === "price") {
    data.sort((a, b) => a.finalPrice - b.finalPrice);
  } else {
    data.sort((a, b) => a.totalMinutes - b.totalMinutes);
  }

  resultsDiv.innerHTML = "";

  if (data.length === 0) {
    resultsDiv.textContent = "No flights match your filters.";
    return;
  }

  data.forEach(f => {

    const d = document.createElement("div");
    d.className = "flight";

    d.innerHTML = `
      <strong>${f.title}</strong>
      Price: ${f.finalPrice.toFixed(2)} SAR (includes 75 SAR service fee)<br>
      Duration: ${f.duration}<br>
      Stops: ${f.stops}<br>
      Baggage: ${f.baggage}<br>
      ${f.layovers}
      <button class="select-btn">Request booking</button>
    `;

    d.querySelector("button").addEventListener("click", () => {
      showBookingForm(f.raw, d);
    });

    resultsDiv.appendChild(d);
  });
}

/* ---------------- NORMALIZE ---------------- */

function normalizeFlight(raw) {

  const segments = raw.segments;

  let layoverText = "";

  for (let i = 0; i < segments.length - 1; i++) {

    const mins = minutesBetween(
      segments[i].arrive,
      segments[i + 1].depart
    );

    const h = Math.floor(mins / 60);
    const m = mins % 60;

    layoverText += `Layover in ${segments[i].to}: ${h}h ${m}m<br>`;
  }

  let baggageText = "Baggage information not available";

  if (raw.baggage && raw.baggage.length) {
    baggageText = raw.baggage
      .map(b => `Checked ${b.checkedBags}, Cabin ${b.cabinBags}`)
      .join(" | ");
  }

  let totalMinutes = 0;

  segments.forEach(s => {
    const h = s.duration.match(/(\d+)H/);
    const m = s.duration.match(/(\d+)M/);
    if (h) totalMinutes += parseInt(h[1]) * 60;
    if (m) totalMinutes += parseInt(m[1]);
  });

  const basePrice = Number(raw.price);
  const finalPrice = basePrice + 75;

  return {
    title: segments.map(s => s.airline + s.flightNumber).join(" + "),
    duration: formatDuration(raw.totalDuration),
    stops: raw.stops,
    finalPrice,
    baggage: baggageText,
    layovers: layoverText,
    totalMinutes,
    raw
  };
}

/* ---------------- PAGINATION ---------------- */

document.getElementById("prevPage").addEventListener("click", async () => {
  if (currentPage > 1) {
    currentPage--;
    await search();
  }
});

document.getElementById("nextPage").addEventListener("click", async () => {
  currentPage++;
  await search();
});

document.getElementById("stopFilter").addEventListener("change", renderResults);
document.getElementById("sortBy").addEventListener("change", renderResults);

/* ---------------- BOOKING ---------------- */

function showBookingForm(flight, parent) {

  const old = document.querySelector(".booking-form");
  if (old) old.remove();

  const d = document.createElement("div");
  d.className = "card booking-form";

  d.innerHTML = `
    <h3>Booking request</h3>
    <input id="bn" placeholder="Name">
    <input id="be" placeholder="Email">
    <input id="bp" placeholder="Phone">
    <textarea id="bno" placeholder="Notes"></textarea>
    <button id="sendReq">Send</button>
    <div id="bs"></div>
  `;

  parent.after(d);

  document.getElementById("sendReq").addEventListener("click", async () => {

    const status = document.getElementById("bs");
    status.textContent = "Sending...";
    status.className = "";

    const r = await fetch(API + "/api/booking-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("bn").value,
        email: document.getElementById("be").value,
        phone: document.getElementById("bp").value,
        notes: document.getElementById("bno").value,
        flight
      })
    });

    const j = await r.json();

    if (j.success) {
      status.textContent = "Request sent. Please check your email.";
      status.className = "status-message";
    } else {
      status.textContent = j.error || "Failed to send request.";
      status.className = "";
    }

  });
}
