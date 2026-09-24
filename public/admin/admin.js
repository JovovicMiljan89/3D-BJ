// 3D-BJ — Admin panel
(function () {
  "use strict";

  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const whoami = document.getElementById("whoami");
  const logoutBtn = document.getElementById("logoutBtn");

  async function api(path, options = {}) {
    const opts = { credentials: "same-origin", ...options };
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(`/api${path}`, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* no body */
    }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  function show(el, visible) {
    el.hidden = !visible;
  }

  // ---------- Auth ----------
  async function checkSession() {
    const me = await api("/auth/me");
    if (me.authenticated) {
      whoami.textContent = me.username;
      show(loginView, false);
      show(dashboardView, true);
      loadAll();
    } else {
      show(loginView, true);
      show(dashboardView, false);
    }
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    show(loginError, false);
    const data = Object.fromEntries(new FormData(loginForm));
    try {
      await api("/auth/login", { method: "POST", body: data });
      loginForm.reset();
      checkSession();
    } catch (err) {
      loginError.textContent = err.message;
      show(loginError, true);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" });
    checkSession();
  });

  // ---------- Tabs ----------
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("is-active"));
      document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelector(`.admin-panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
    });
  });

  function loadAll() {
    loadProducts();
    loadContent();
    loadMessages();
  }

  // ---------- Products ----------
  const productForm = document.getElementById("productForm");
  const productList = document.getElementById("productList");
  const productError = document.getElementById("productError");
  const productSubmitBtn = document.getElementById("productSubmitBtn");
  const productCancelBtn = document.getElementById("productCancelBtn");
  const productImageInput = document.getElementById("productImageInput");
  const productImagePreview = document.getElementById("productImagePreview");

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function resetProductForm() {
    productForm.reset();
    productForm.id.value = "";
    productSubmitBtn.textContent = "Add product";
    show(productCancelBtn, false);
    show(productImagePreview, false);
    productImageInput.required = true;
  }

  productImageInput.addEventListener("change", () => {
    const file = productImageInput.files[0];
    if (!file) return show(productImagePreview, false);
    productImagePreview.src = URL.createObjectURL(file);
    show(productImagePreview, true);
  });

  productCancelBtn.addEventListener("click", resetProductForm);

  async function loadProducts() {
    const products = await api("/products");
    if (!products.length) {
      productList.innerHTML = '<p class="admin-empty">No products yet — add your first one above.</p>';
      return;
    }
    productList.innerHTML = products
      .map(
        (p) => `
      <article class="admin-product" data-id="${p.id}">
        <img src="${p.image}" alt="${escapeHtml(p.title)}" />
        <div class="admin-product__body">
          <strong>${escapeHtml(p.title)}</strong>
          <p>${escapeHtml(p.description || "")}</p>
          <div class="admin-product__actions">
            <button type="button" class="edit-btn">Edit</button>
            <button type="button" class="danger delete-btn">Delete</button>
          </div>
        </div>
      </article>`
      )
      .join("");

    productList.querySelectorAll(".edit-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        const id = btn.closest(".admin-product").dataset.id;
        const p = products.find((x) => x.id === id);
        productForm.id.value = p.id;
        productForm.title.value = p.title;
        productForm.description.value = p.description;
        productImageInput.required = false;
        productImagePreview.src = p.image;
        show(productImagePreview, true);
        productSubmitBtn.textContent = "Save changes";
        show(productCancelBtn, true);
        productForm.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );

    productList.querySelectorAll(".delete-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        const id = btn.closest(".admin-product").dataset.id;
        try {
          await api(`/products/${id}`, { method: "DELETE" });
          loadProducts();
        } catch (err) {
          alert(err.message);
        }
      })
    );
  }

  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    show(productError, false);
    const id = productForm.id.value;
    const formData = new FormData(productForm);
    formData.delete("id");

    try {
      if (id) {
        await api(`/products/${id}`, { method: "PUT", body: formData });
      } else {
        await api("/products", { method: "POST", body: formData });
      }
      resetProductForm();
      loadProducts();
    } catch (err) {
      productError.textContent = err.message;
      show(productError, true);
    }
  });

  // ---------- Site content ----------
  const contentForm = document.getElementById("contentForm");
  const contentSuccess = document.getElementById("contentSuccess");
  const contentError = document.getElementById("contentError");

  async function loadContent() {
    const content = await api("/content");
    Object.entries(content).forEach(([key, value]) => {
      if (contentForm.elements[key]) contentForm.elements[key].value = value;
    });
  }

  contentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    show(contentSuccess, false);
    show(contentError, false);
    const data = Object.fromEntries(new FormData(contentForm));
    try {
      await api("/content", { method: "PUT", body: data });
      show(contentSuccess, true);
    } catch (err) {
      contentError.textContent = err.message;
      show(contentError, true);
    }
  });

  // ---------- Messages ----------
  const messageList = document.getElementById("messageList");
  const unreadBadge = document.getElementById("unreadBadge");

  async function loadMessages() {
    const messages = await api("/contact");
    const unread = messages.filter((m) => !m.read).length;
    unreadBadge.textContent = unread;
    show(unreadBadge, unread > 0);

    if (!messages.length) {
      messageList.innerHTML = '<p class="admin-empty">No inquiries yet.</p>';
      return;
    }

    messageList.innerHTML = messages
      .map(
        (m) => `
      <article class="admin-message ${m.read ? "" : "is-unread"}" data-id="${m.id}">
        <div class="admin-message__head">
          <strong>${escapeHtml(m.name)}</strong>
          <span class="admin-message__meta">${escapeHtml(m.email)}</span>
          <span class="admin-message__meta">${escapeHtml(m.service || "")} · ${escapeHtml(m.material || "")}</span>
          <span class="admin-message__meta">${new Date(m.createdAt).toLocaleString()}</span>
        </div>
        <div class="admin-message__body">${escapeHtml(m.message)}</div>
        <div class="admin-message__actions">
          <button type="button" class="toggle-read-btn">${m.read ? "Mark unread" : "Mark read"}</button>
          <button type="button" class="delete-msg-btn">Delete</button>
        </div>
      </article>`
      )
      .join("");

    messageList.querySelectorAll(".toggle-read-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const el = btn.closest(".admin-message");
        const id = el.dataset.id;
        const read = el.classList.contains("is-unread");
        await api(`/contact/${id}`, { method: "PATCH", body: { read } });
        loadMessages();
      })
    );

    messageList.querySelectorAll(".delete-msg-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this message?")) return;
        const id = btn.closest(".admin-message").dataset.id;
        await api(`/contact/${id}`, { method: "DELETE" });
        loadMessages();
      })
    );
  }

  // ---------- Account / password ----------
  const passwordForm = document.getElementById("passwordForm");
  const passwordSuccess = document.getElementById("passwordSuccess");
  const passwordError = document.getElementById("passwordError");

  passwordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    show(passwordSuccess, false);
    show(passwordError, false);
    const data = Object.fromEntries(new FormData(passwordForm));
    try {
      await api("/auth/change-password", { method: "POST", body: data });
      passwordForm.reset();
      show(passwordSuccess, true);
    } catch (err) {
      passwordError.textContent = err.message;
      show(passwordError, true);
    }
  });

  checkSession();
})();
