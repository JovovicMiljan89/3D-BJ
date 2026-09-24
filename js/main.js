// 3D-BJ — mockup interactions
// 1) Contact modal (phone / email / inquiry form)
// 2) Gallery image lightbox
// 3) Footer year

(function () {
  const CONTACT_EMAIL = "hello@3d-bj.example"; // mock data

  // ---------- Contact modal ----------
  const modal = document.getElementById("contactModal");
  const form = document.getElementById("inquiryForm");
  const formError = document.getElementById("formError");
  const formSuccess = document.getElementById("formSuccess");

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

  // ---------- Inquiry form -> mailto ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "");

    if (!data.name.trim() || !data.message.trim() || !emailOk) {
      formError.hidden = false;
      return;
    }
    formError.hidden = true;

    const subject = encodeURIComponent(`3D print inquiry from ${data.name}`);
    const body = encodeURIComponent(
      `Name: ${data.name}\nEmail: ${data.email}\nService: ${data.service}\nMaterial: ${data.material}\n\n${data.message}`
    );

    // Mockup: no backend — open the user's mail client with a prefilled message.
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

    form.reset();
    form.hidden = true;
    formSuccess.hidden = false;
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

  // ---------- Footer year ----------
  document.getElementById("year").textContent = new Date().getFullYear();
})();
