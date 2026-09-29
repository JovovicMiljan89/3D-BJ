// Site interactions
// 1) Mobile hamburger nav                      [#2]
// 2) CTA -> scroll to #kontakt + focus name     [#3]
//    (+ prefill service/message for the spare-parts CTA)
// 3) Copy-email button                          [#3]
// 4) Inquiry form -> Web3Forms                  [#4]
// 5) Gallery lightbox (keyboard + focus-return) [#13]
// 6) FAQ accordion: one answer open at a time
//
// Everything the page needs (labels, options, messages, the Web3Forms access key)
// is already rendered into the static HTML at build time — this file never fetches
// content/site.json at runtime.

(function () {
  "use strict";

  const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function openModal(el) {
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(el) {
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ---------- Mobile hamburger nav [#2] ----------
  const navToggle = document.getElementById("navToggle");
  const siteNav = document.getElementById("siteNav");

  function closeNav() {
    siteNav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
  function openNav() {
    siteNav.classList.add("is-open");
    navToggle.setAttribute("aria-expanded", "true");
  }

  navToggle.addEventListener("click", () => {
    if (siteNav.classList.contains("is-open")) closeNav();
    else openNav();
  });
  siteNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));

  // ---------- CTA -> contact section [#3] ----------
  const kontaktSection = document.getElementById("kontakt");
  const nameField = document.getElementById("f-name");

  function focusContactForm(field = nameField) {
    if (!kontaktSection) return;
    closeNav();
    kontaktSection.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    const delay = prefersReducedMotion() ? 0 : 450;
    window.setTimeout(() => {
      if (!field) return;
      field.focus({ preventScroll: true });
      if (field.setSelectionRange) field.setSelectionRange(field.value.length, field.value.length);
    }, delay);
  }

  document.querySelectorAll("[data-focus-form]").forEach((btn) => btn.addEventListener("click", () => focusContactForm()));

  // Spare-parts CTA: pre-selects a service (only if that option exists) and
  // starts the message with a prefix, then focuses the message at its end.
  const serviceField = document.getElementById("f-service");
  const messageField = document.getElementById("f-message");

  document.querySelectorAll("[data-prefill-message]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const service = btn.dataset.prefillService || "";
      if (serviceField && service && Array.from(serviceField.options).some((o) => o.value === service)) {
        serviceField.value = service;
      }
      // The CMS may trim the trailing space, so always end the prefix with exactly one.
      const raw = (btn.dataset.prefillMessage || "").trimEnd();
      const prefix = raw ? raw + " " : "";
      if (messageField && prefix && !messageField.value.startsWith(prefix)) {
        messageField.value = prefix + messageField.value;
      }
      focusContactForm(messageField || nameField);
    })
  );

  // ---------- Copy-email button ----------
  document.querySelectorAll(".copy-btn").forEach((btn) => {
    const label = btn.querySelector("span");
    const originalLabel = label ? label.textContent : "";
    const copiedLabel = btn.dataset.copiedLabel || originalLabel;
    const text = btn.dataset.copyText || "";

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.warn("Clipboard copy failed:", err);
        return;
      }
      btn.classList.add("is-copied");
      if (label) label.textContent = copiedLabel;
      window.setTimeout(() => {
        btn.classList.remove("is-copied");
        if (label) label.textContent = originalLabel;
      }, 2000);
    });
  });

  document.addEventListener("click", (e) => {
    if (e.target.matches("[data-close-modal]")) {
      closeModal(e.target.closest(".modal"));
    }
  });

  // ---------- Inquiry form -> Web3Forms [#4] ----------
  const form = document.getElementById("inquiryForm");
  const formError = document.getElementById("formError");
  const formNetworkError = document.getElementById("formNetworkError");
  const formSuccess = document.getElementById("formSuccess");
  const submitBtn = document.getElementById("submitBtn");
  const submitLabel = submitBtn.textContent;
  const sendingLabel = form.dataset.sendingLabel || submitLabel;
  const brandName = form.dataset.brandName || "";

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
          subject: `${brandName} upit: ${data.name}`,
          from_name: `${brandName} sajt`,
          name: data.name,
          // Must stay "email": Web3Forms uses this field as the Reply-To.
          email: data.email,
          service: data.service,
          material: data.material,
          file_link: data.file_link.trim() || "—",
          message: data.message,
          botcheck: false,
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.success !== true) {
        throw new Error(result.message || `Request failed (${res.status})`);
      }

      form.reset();
      formSuccess.hidden = false;
    } catch (err) {
      console.warn("Web3Forms submit failed:", err);
      formNetworkError.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });

  // ---------- Gallery lightbox [#13] ----------
  // Prev/next buttons, arrow keys and swipe cycle through the gallery (last ->
  // first); Tab stays inside the dialog; closing returns focus to the clicked item.
  const galleryItems = Array.from(document.querySelectorAll(".gallery__item"));
  const lightbox = document.createElement("div");
  lightbox.className = "modal modal--image";
  lightbox.setAttribute("aria-hidden", "true");
  lightbox.innerHTML = `
    <div class="modal__backdrop" data-close-modal></div>
    <div class="modal__dialog" role="dialog" aria-modal="true" aria-label="Uvećana slika">
      <button type="button" class="modal__close" aria-label="Zatvori" data-close-modal>&times;</button>
      <div class="lightbox__stage">
        <img alt="" />
        <button type="button" class="btn lightbox__nav lightbox__nav--prev" aria-label="Prethodna slika" data-step="-1">&larr;</button>
        <button type="button" class="btn lightbox__nav lightbox__nav--next" aria-label="Sledeća slika" data-step="1">&rarr;</button>
      </div>
      <div class="lightbox__footer">
        <p class="muted"></p>
        <span class="lightbox__counter" aria-live="polite"></span>
      </div>
    </div>`;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector("img");
  const lightboxCaption = lightbox.querySelector(".lightbox__footer p");
  const lightboxCounter = lightbox.querySelector(".lightbox__counter");
  if (galleryItems.length < 2) lightbox.classList.add("modal--single");

  let lastGalleryTrigger = null;
  let currentIndex = 0;

  function isLightboxOpen() {
    return lightbox.classList.contains("is-open");
  }

  function showImage(index) {
    const count = galleryItems.length;
    currentIndex = (index + count) % count;
    const item = galleryItems[currentIndex];
    const img = item.querySelector(".gallery__img");
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    lightboxCaption.textContent = item.querySelector("figcaption").textContent;
    lightboxCounter.textContent = `${currentIndex + 1} / ${count}`;
  }

  function openLightbox(item) {
    lastGalleryTrigger = item;
    showImage(galleryItems.indexOf(item));
    openModal(lightbox);
    lightbox.querySelector(".modal__close").focus();
  }

  function closeLightbox() {
    closeModal(lightbox);
    if (lastGalleryTrigger) {
      lastGalleryTrigger.focus();
      lastGalleryTrigger = null;
    }
  }

  lightbox.querySelectorAll("[data-close-modal]").forEach((el) =>
    el.addEventListener("click", closeLightbox)
  );
  lightbox.querySelectorAll("[data-step]").forEach((btn) =>
    btn.addEventListener("click", () => showImage(currentIndex + Number(btn.dataset.step)))
  );

  document.addEventListener("keydown", (e) => {
    if (!isLightboxOpen()) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      showImage(currentIndex + (e.key === "ArrowRight" ? 1 : -1));
    } else if (e.key === "Tab") {
      const focusable = Array.from(lightbox.querySelectorAll("button")).filter((b) => b.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!lightbox.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // Swipe: a mostly-horizontal drag of 40px+ moves one image.
  const stage = lightbox.querySelector(".lightbox__stage");
  let touchStart = null;
  stage.addEventListener("touchstart", (e) => {
    touchStart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (!touchStart || galleryItems.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) showImage(currentIndex + (dx < 0 ? 1 : -1));
  });

  // ---------- FAQ: only one answer open at a time ----------
  // name="faq" on the <details> does this natively; this covers older browsers.
  const faqItems = document.querySelectorAll(".faq__item");
  faqItems.forEach((item) =>
    item.addEventListener("toggle", () => {
      if (!item.open) return;
      faqItems.forEach((other) => {
        if (other !== item) other.open = false;
      });
    })
  );

  // ---------- Escape: close the lightbox if open, otherwise close the mobile nav ----------
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (lightbox.classList.contains("is-open")) closeLightbox();
    else closeNav();
  });

  galleryItems.forEach((item) => {
    item.addEventListener("click", () => openLightbox(item));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        openLightbox(item);
      }
    });
  });
})();
