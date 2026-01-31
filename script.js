const API = "https://flight-search-backend-jgmb.onrender.com";

let currentPage = 1;
let lastResults = [];

const originInput = document.getElementById("origin");
const destInput = document.getElementById("destination");
const originList = document.getElementById("originList");
const destList = document.getElementById("destinationList");

const form = document.getElementById("searchForm");
const resultsDiv = document.getElementById("results");

const tripType = document.getElementById("tripType");
const returnBox = document.getElementById("returnDateContainer");

tripType.onchange = () => {
  returnBox.classList.toggle("hidden", tripType.value !== "roundtrip");
};

/* ---------- AUTOCOMPLETE ---------- */

async function fetchLocations(q) {
  const r = await fetch(API + "/api/locations?q=" + encodeURIComponent(q));
  return r.json();
}

function bindAutocomplete(input, box) {

  input.addEventListener("input", async () => {

    const q = input.value.trim();
    box.innerHTML = "";

    if (q.length < 2) return;

    const data = await fetchLocations(q);

    data.forEach(l => {
      const d = document.createElement("div");
      d.textContent = `${l.name} (${l.code})`;
      d.onclick = () => {
        input.value = l.code;
        box.innerHTML = "";
      };
      box.appendChild(d);
    });
  });

  document.addEventListener("click", e => {
    if (!box.contains(e.target) && e.target !== input) {
      box.innerHTML = "";
    }
  });
}

bindAutocomplete(originInput, originList);
bindAutocomplete(destInput, destList);

/* ---------- helpers ---------- */

function dur(iso) {
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  return `${h ? h[1] + "h" : ""} ${m ? m[1] + "m" : ""}`.trim();
}

function minutesBetween(a, b) {
  return (new Date(b) - new Date(a)) / 60000;
}

/* ---------- SEARCH ---------- */

form.onsubmit = async e => {
  e.preventDefault();

  if (!originInput.value || !destInput.value || !date.value) {
    alert("Please fill From, To and Departure date.");
    return;
  }

  if (tripType.value === "roundtrip" && !returnDate.value) {
    alert("Please select return date.");
    return;
  }

  currentPage = 1;
  await search();
};

async function search() {

  resultsDiv.textContent = "Searching...";

  const r = await fetch(API + "/api/search-flights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: originInput.value,
      destination: destInput.value,
      date: date.value,
      returnDate: returnDate.value,
      adults: adults.value,
      children: children.value,
      tripType: tripType.value,
      page: currentPage
    })
  });

  const data = await r.json();

  if (!r.ok || !data.results) {
    resultsDiv.textContent = data.error || "No results";
    return;
  }

  lastResults = data.results.map(normalize);
  pageLabel.textContent = "Page " + data.page;

  render();
}

/* ---------- NORMALIZE ---------- */

function normalize(raw) {

  let lay = "";
  for (let i = 0; i < raw.segments.length - 1; i++) {
    const m = minutesBetween(
      raw.segments[i].arrive,
      raw.segments[i + 1].depart
    );
    lay += `Layover in ${raw.segments[i].to}: ${Math.floor(m / 60)}h ${m % 60}m<br>`;
  }

  const baggage =
    raw.baggage.length
      ? raw.baggage.map(b => `Checked ${b.checkedBags}, Cabin ${b.cabinBags}`).join(" | ")
      : "Not available";

  let minutes = 0;
  raw.segments.forEach(s => {
    const h = s.duration.match(/(\d+)H/);
    const m = s.duration.match(/(\d+)M/);
    if (h) minutes += parseInt(h[1]) * 60;
    if (m) minutes += parseInt(m[1]);
  });

  return {
    title: raw.segments.map(s => s.airline + s.flightNumber).join(" + "),
    duration: dur(raw.totalDuration),
    stops: raw.stops,
    baggage,
    layovers: lay,
    totalMinutes: minutes,
    finalPrice: Number(raw.price) + 75,
    raw
  };
}

/* ---------- RENDER ---------- */

function render() {

  let data = [...lastResults];

  if (stopFilter.value === "direct") data = data.filter(f => f.stops === 0);
  if (stopFilter.value === "layover") data = data.filter(f => f.stops > 0);

  if (sortBy.value === "price") {
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
      Price: ${f.finalPrice.toFixed(2)} SAR<br>
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

/* ---------- PAGING ---------- */

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

stopFilter.onchange = render;
sortBy.onchange = render;

/* ---------- BOOKING + MODAL ---------- */

function showBooking(flight, parent) {

  document.querySelector(".booking-form")?.remove();

  const d = document.createElement("div");
  d.className = "card booking-form";

  d.innerHTML = `
    <h3>Booking request</h3>
    <input id="bn" placeholder="Full name">
    <input id="be" placeholder="Email">
    <input id="bp" placeholder="Phone">
    <textarea id="bno" placeholder="Notes"></textarea>
    <button id="sendReq">Send request</button>
    <div id="bs"></div>
  `;

  parent.after(d);

  sendReq.onclick = async () => {

    if (!bn.value || !be.value || !be.value.includes("@")) {
      bs.textContent = "Please enter valid name and email.";
      return;
    }

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

    if (j.success) {
      document.getElementById("modal").classList.remove("hidden");
    } else {
      bs.textContent = j.error || "Failed to send.";
    }
  };
}

closeModal.onclick = () => {
  modal.classList.add("hidden");
};
