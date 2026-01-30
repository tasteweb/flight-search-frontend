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
  return `${h ? h[1] + "h" : ""} ${m ? m[1] + "m" : ""}`;
}

function minutesBetween(a, b) {
  return (new Date(b) - new Date(a)) / 60000;
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
    layoverText += `Layover in ${segments[i].to}: ${Math.floor(mins / 60)}h ${mins % 60}m<br>`;
  }

  const baggage = raw.baggage
    .map(b => `Checked: ${b.checkedBags}, Cabin: ${b.cabinBags}`)
    .join(" | ");

  const price = Number(raw.price) + 75;

  const totalMinutes = raw.segments.reduce((a, s) => {
    const m = s.duration.match(/(\d+)H|(\d+)M/g) || [];
    let sum = 0;
    m.forEach(x => {
      if (x.endsWith("H")) sum += parseInt(x) * 60;
      if (x.endsWith("M")) sum += parseInt(x);
    });
    return a + sum;
  }, 0);

  return {
    title: raw.segments.map(s => s.airline + s.flightNumber).join(" + "),
    duration: dur(raw.totalDuration),
    stops: raw.stops,
    finalPrice: price.toFixed(2),
    baggage,
    layovers: layoverText,
    totalMinutes,
    raw
  };
}

form.onsubmit = async e => {
  e.preventDefault();
  currentPage = 1;
  await search();
};

async function search() {

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

  lastResults = data.results.map(normalize);

  document.getElementById("pageLabel").textContent =
    `Page ${data.page}`;

  render();
}

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

/* -------- booking -------- */

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
      : "Failed to send request.";
  };
}
