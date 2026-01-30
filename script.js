document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("searchForm");
  const resultsDiv = document.getElementById("results");
  const tripTypeSelect = document.getElementById("tripType");
  const returnDateContainer = document.getElementById("returnDateContainer");

  let selectedFlight = null;

  /* ---------- Helpers ---------- */
  function formatDuration(iso) {
    if (!iso) return "";
    const h = iso.match(/(\d+)H/);
    const m = iso.match(/(\d+)M/);
    return `${h ? h[1] + "h" : ""} ${m ? m[1] + "m" : ""}`.trim();
  }

  function formatDateTime(value) {
    return new Date(value).toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function updateReturnDateVisibility() {
    if (tripTypeSelect.value === "roundtrip") {
      returnDateContainer.classList.remove("hidden");
    } else {
      returnDateContainer.classList.add("hidden");
    }
  }

  tripTypeSelect.addEventListener("change", updateReturnDateVisibility);
  updateReturnDateVisibility();

  /* ---------- Search Flights ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    resultsDiv.innerHTML = "Searching flights...";

    const body = {
      origin: document.getElementById("origin").value.trim().toUpperCase(),
      destination: document.getElementById("destination").value.trim().toUpperCase(),
      date: document.getElementById("date").value,
      returnDate: document.getElementById("returnDate").value,
      adults: document.getElementById("adults").value,
      tripType: tripTypeSelect.value
    };

    const res = await fetch(
      "https://flight-search-backend-jgmb.onrender.com/api/search-flights",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    const flights = await res.json();
    resultsDiv.innerHTML = "";

    flights.forEach((flight, index) => {
      const div = document.createElement("div");
      div.className = "flight";

      const route = flight.segments
        .map(s => s.from)
        .concat(flight.segments[flight.segments.length - 1].to)
        .join(" → ");

      const flightNums = flight.segments
        .map(s => `${s.airline}${s.flightNumber}`)
        .join(" + ");

      div.innerHTML = `
        <div class="flight-header">
          <div>
            <strong>Option ${index + 1}: ${flightNums}</strong><br />
            <span class="flight-details">
              ${route}<br />
              Stops: ${flight.stops} · Duration: ${formatDuration(flight.totalDuration)}
            </span>
          </div>
          <div class="flight-price">
            ${flight.price} ${flight.currency}
          </div>
        </div>

        <div class="flight-details">
          ${flight.segments.map((s, i) => `
            <div style="margin-bottom: 8px;">
              <strong>Segment ${i + 1}: ${s.airline}${s.flightNumber}</strong><br />
              ${s.from} → ${s.to}<br />
              <small>
                ${formatDateTime(s.depart)} – ${formatDateTime(s.arrive)}
                · ${formatDuration(s.duration)}
              </small>
            </div>
          `).join("")}
        </div>

        <button class="select-btn">Request Booking</button>
      `;

      div.querySelector(".select-btn").addEventListener("click", () => {
        selectedFlight = flight;
        showBookingForm(div);
      });

      resultsDiv.appendChild(div);
    });
  });

  /* ---------- Booking Form ---------- */
  function showBookingForm(parentDiv) {
    const old = document.querySelector(".booking-form");
    if (old) old.remove();

    const formDiv = document.createElement("div");
    formDiv.className = "card booking-form";

    formDiv.innerHTML = `
      <h2>Request Booking Assistance</h2>
      <p>Our travel agent will confirm availability and contact you.</p>

      <div class="row">
        <div>
          <label>Full Name</label>
          <input id="custName" />
        </div>
        <div>
          <label>Email</label>
          <input id="custEmail" type="email" />
        </div>
        <div>
          <label>Phone (optional)</label>
          <input id="custPhone" />
        </div>
      </div>

      <label>Notes (optional)</label>
      <textarea id="custNotes" rows="3"></textarea>

      <button class="primary-btn" id="sendBooking">Send Booking Request</button>
    `;

    parentDiv.insertAdjacentElement("afterend", formDiv);
    document.getElementById("sendBooking").addEventListener("click", sendBooking);
  }

  async function sendBooking() {
    const payload = {
      name: document.getElementById("custName").value,
      email: document.getElementById("custEmail").value,
      phone: document.getElementById("custPhone").value,
      notes: document.getElementById("custNotes").value,
      flight: selectedFlight
    };

    const res = await fetch(
      "https://flight-search-backend-jgmb.onrender.com/api/booking-request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const result = await res.json();
    if (result.success) {
      alert("Booking request sent. The agency will contact you.");
    } else {
      alert(result.error || "Booking failed. Check backend logs.");
    }
  }
});
