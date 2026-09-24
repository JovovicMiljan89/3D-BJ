// 3D-BJ — site interactions
// 1) Load site text + products from the backend API
// 2) Contact modal (phone / email / inquiry form -> backend)
// 3) Product detail lightbox
// 4) Footer year

(function () {
  "use strict";

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

  // ---------- Contact modal open ----------
  const modal = document.getElementById("contactModal");
  const form = document.getElementById("inquiryForm");
  const formError = document.getElementById("formError");
  const formSuccess = document.getElementById("formSuccess");

  document.querySelectorAll("[data-open-contact]").forEach((btn) =>
    btn.addEventListener("click", () => {
      form.hidden = false;
      formSuccess.hidden = true;
      openModal(modal);
    })
  );

  // ---------- Site text ----------
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  async function loadContent() {
    try {
      const res = await fetch("/api/content");
      if (!res.ok) return;
      const c = await res.json();

      setText("heroEyebrow", c.heroEyebrow);
      setText("heroHeadline", c.heroHeadline);
      setText("heroLead", c.heroLead);
      setText("aboutTag", c.aboutTag);
      setText("aboutName", c.aboutName);
      setText("aboutText", c.aboutText);
      setText("footerBusinessName", c.businessName);
      setText("footerNote", c.footerNote);
      setText("contactPhoneText", c.phone);
      setText("contactEmailText", c.email);

      if (c.phone) {
        const tel = `tel:${c.phone.replace(/[^+\d]/g, "")}`;
        document.getElementById("footerPhone").href = tel;
        document.getElementById("footerPhone").textContent = c.phone;
        document.getElementById("contactPhoneLink").href = tel;
      }
      if (c.email) {
        const mailto = `mailto:${c.email}?subject=3D%20print%20inquiry`;
        document.getElementById("footerEmail").href = `mailto:${c.email}`;
        document.getElementById("footerEmail").textContent = c.email;
        document.getElementById("contactEmailLink").href = mailto;
      }
      if (c.businessName) {
        document.title = document.title.replace(/^3D-BJ/, c.businessName);
      }
    } catch (err) {
      console.warn("Could not load site content, using defaults.", err);
    }
  }

  // ---------- Products ----------
  const productGrid = document.getElementById("productGrid");

  const detailModal = document.createElement("div");
  detailModal.className = "modal modal--image";
  detailModal.setAttribute("aria-hidden", "true");
  detailModal.innerHTML = `
    <div class="modal__backdrop" data-close-modal></div>
    <div class="modal__dialog" role="dialog" aria-modal="true">
      <button class="modal__close" aria-label="Close" data-close-modal>&times;</button>
      <img alt="" />
      <h3 style="margin-top:12px"></h3>
      <p class="muted" style="margin-top:4px"></p>
      <button class="btn" style="margin-top:16px" data-open-contact>Ask about this</button>
    </div>`;
  document.body.appendChild(detailModal);

  detailModal.querySelector("[data-open-contact]").addEventListener("click", () => {
    closeModal(detailModal);
    form.hidden = false;
    formSuccess.hidden = true;
    openModal(modal);
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to load products");
      const products = await res.json();

      if (!products.length) {
        productGrid.innerHTML = '<p class="muted">No products yet — check back soon.</p>';
        return;
      }

      productGrid.innerHTML = products
        .map(
          (p) => `
        <figure class="gallery__item" data-id="${p.id}">
          <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy" />
          <figcaption>${escapeHtml(p.title)}</figcaption>
        </figure>`
        )
        .join("");

      productGrid.querySelectorAll(".gallery__item").forEach((item) => {
        const id = item.dataset.id;
        const product = products.find((p) => p.id === id);
        item.addEventListener("click", () => {
          detailModal.querySelector("img").src = product.image;
          detailModal.querySelector("img").alt = product.title;
          detailModal.querySelector("h3").textContent = product.title;
          detailModal.querySelector("p").textContent = product.description || "";
          openModal(detailModal);
        });
      });
    } catch (err) {
      productGrid.innerHTML = '<p class="muted">Could not load products right now.</p>';
      console.warn(err);
    }
  }

  // ---------- Inquiry form -> backend API ----------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "");

    if (!data.name.trim() || !data.message.trim() || !emailOk) {
      formError.textContent = "Please fill in all fields with a valid email.";
      formError.hidden = false;
      return;
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not send your inquiry.");
      }

      formError.hidden = true;
      form.reset();
      form.hidden = true;
      formSuccess.hidden = false;
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    }
  });

  // ---------- Footer year ----------
  document.getElementById("year").textContent = new Date().getFullYear();

  loadContent();
  loadProducts();
})();
