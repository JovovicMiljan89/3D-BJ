// 3D-BJ — site interactions
// 1) Contact modal (phone / email / inquiry form -> Web3Forms)
// 2) Gallery image lightbox
// 3) Footer year is baked in at build time (see scripts/build.mjs) — no JS needed for it.
//
// Everything the page needs (labels, options, messages, the Web3Forms access key)
// is already rendered into the static HTML at build time — this file never fetches
// content/site.json at runtime.

(function () {
  const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

  // ---------- Contact modal ----------
  const modal = document.getElementById("contactModal");
  const form = document.getElementById("inquiryForm");
  const formError = document.getElementById("formError");
  const formNetworkError = document.getElementById("formNetworkError");
  const formSuccess = document.getElementById("formSuccess");
  const submitBtn = document.getElementById("submitBtn");
  const submitLabel = submitBtn.textContent;
  const sendingLabel = form.dataset.sendingLabel || submitLabel;

  function openModal(el) {
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const firstInput = el.querySelector("input, button");
    if (firstInput) firstInput.focus();
  }

  function closeModal(el) {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-open-contact]").forEach((btn) =>
    btn.addEventListener("click", () => {
      form.hidden = false;
      formSuccess.hidden = true;
      openModal(modal);
    })
  );

  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) {
      closeModal(e.target.closest(".modal"));
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.is-open").forEach(closeModal);
    }
  });

  // ---------- Inquiry form -> Web3Forms ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "");

    formError.hidden = true;
    formNetworkError.hidden = true;

    if (!data.name.trim() || !data.message.trim() || !emailOk) {
      formError.hidden = false;
      return;
    }

    // Honeypot: real visitors never fill this hidden field. If it's filled,
    // silently pretend to succeed instead of telling a bot what tripped it.
    if (data.botcheck) {
      form.reset();
      form.hidden = true;
      formSuccess.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = sendingLabel;

    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: data.access_key,
          subject: `3D-BJ upit: ${data.name}`,
          name: data.name,
          email: data.email,
          service: data.service,
          material: data.material,
          message: data.message,
          botcheck: false,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || `Request failed (${res.status})`);
      }

      form.reset();
      form.hidden = true;
      formSuccess.hidden = false;
    } catch (err) {
      console.warn("Web3Forms submit failed:", err);
      formNetworkError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });

  // ---------- Gallery lightbox ----------
  const lightbox = document.createElement("div");
  lightbox.className = "modal modal--image";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="modal__backdrop" data-close-modal></div>
    <div class="modal__dialog" role="dialog" aria-modal="true">
      <button class="modal__close" aria-label="Close" data-close-modal>&times;</button>
      <img alt="" />
      <p class="muted" style="margin-top:8px"></p>
    </div>`;
  document.body.appendChild(lightbox);

  document.querySelectorAll(".gallery__item").forEach((item) =>
    item.addEventListener("click", () => {
      const img = item.querySelector("img");
      lightbox.querySelector("img").src = img.src;
      lightbox.querySelector("img").alt = img.alt;
      lightbox.querySelector("p").textContent = item.querySelector("figcaption").textContent;
      openModal(lightbox);
    })
  );
})();
