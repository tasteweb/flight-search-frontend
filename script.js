const API = "https://flight-search-backend-jgmb.onrender.com";

let currentPage = 1;
let lastResults = [];

const form = document.getElementById("searchForm");
const resultsDiv = document.getElementById("results");

const tripType = document.getElementById("tripType");
const returnBox = document.getElementById("returnDateContainer");

tripType.onchange = () => {
  returnBox.classList.toggle("hidden", tripType.value !== "roundtrip");
};

function dur(iso) {
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  return `${h ? h[1] + "h" : ""} ${m ? h && m ? " " : ""}${m ? m[1] + "m" : ""}`;
}

function minutesBetween(a, b) {
  return (new Date(b) - new Date(a)) / 60000;
}

form.onsubmit = async e => {
  e.preventDefault();
  currentPage = 1;
  await search();
};

async function search() {

  resultsDiv.innerHTML = "Searching...";

  const res = await fetch(API + "/api/search-flights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: origin.value,
      destination: destination.value,
      date: date.value,
      returnDate: returnDate.value,
      adults: adults.value,
      children: children.value,
      tripType: tripType.value,
      page: currentPage
    })
  });

  const data = await res.json();

  if (!res.ok || !data.results) {
    resultsDiv.innerHTML =
      data.error || "No results found.";
    return;
  }

  lastResults = data.results.map(normalize);

  document.getElementById("pageLabel").textContent =
    `Page ${data.page}`;

  render();
}

function render() {

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

  if (!data.length) {
    resultsDiv.textContent = "No flights match your filters.";
    return;
  }

  data.forEach(f => {
    const d = document.createElement("div");
    d.className = "flight";

    d.innerHTML = `
      <b>${f.title}</b><br>
      Price: ${f.finalPrice} SAR (includes 75 SAR fee)<br>
      Duration: ${f.duration}<br>
      Stops: ${f.stops}<br>
      Baggage: ${f.baggage}<br>
      ${f.layovers}
      <button class="select-btn">Request booking</button>
    `;

    d.querySelector("button").onclick = () => showBooking(f.raw, d);

    resultsDiv.appendChild(d);
  });
}

function normalize(raw) {

  const segments = raw.segments;

  let layoverText = "";

  for (let i = 0; i < segments.length - 1; i++) {
    const mins = minutesBetween(
      segments[i].arrive,
      segments[i + 1].depart
    );
    layoverText += `Layover in ${segments[i].to}: ${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m<br>`;
  }

  const baggage = raw.baggage.length
    ? raw.baggage.map(b => `Checked ${b.checkedBags}, Cabin ${b.cabinBags}`).join(" | ")
    : "Baggage information not available";

  const basePrice = Number(raw.price);
  const finalPrice = basePrice + 75;

  let totalMinutes = 0;

  raw.segments.forEach(s => {
    const h = s.duration.match(/(\d+)H/);
    const m = s.duration.match(/(\d+)M/);
    if (h) totalMinutes += parseInt(h[1]) * 60;
    if (m) totalMinutes += parseInt(m[1]);
  });

  return {
    title: raw.segments.map(s => s.airline + s.flightNumber).join(" + "),
    duration: dur(raw.totalDuration),
    stops: raw.stops,
    finalPrice: finalPrice.toFixed(2),
    baggage,
    layovers: layoverText,
    totalMinutes,
    raw
  };
}

/* ---------- paging ---------- */

prevPage.onclick = async () => {
  if (currentPage > 1) {
    currentPage--;
    await search();
  }
};

nextPage.onclick = async () => {
  currentPage++;
  await search();
};

document.getElementById("stopFilter").onchange = render;
document.getElementById("sortBy").onchange = render;

/* ---------- booking ---------- */

function showBooking(flight, parent) {

  document.querySelector(".booking-form")?.remove();

  const d = document.createElement("div");
  d.className = "card booking-form";

  d.innerHTML = `
    <h3>Booking request</h3>
    <input id="bn" placeholder="Name"><br>
    <input id="be" placeholder="Email"><br>
    <input id="bp" placeholder="Phone"><br>
    <textarea id="bno" placeholder="Notes"></textarea><br>
    <button id="sendReq">Send</button>
    <div id="bs"></div>
  `;

  parent.after(d);

  sendReq.onclick = async () => {

    bs.textContent = "Sending...";

    const r = await fetch(API + "/api/booking-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bn.value,
        email: be.value,
        phone: bp.value,
        notes: bno.value,
        flight
      })
    });

    const j = await r.json();

    bs.textContent = j.success
      ? "Request sent. Check your email."
      : j.error || "Failed to send request.";
  };
}
