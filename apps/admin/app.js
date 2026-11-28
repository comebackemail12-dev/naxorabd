import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDoc,
  getDocs,
  getDocFromServer,
  runTransaction,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

const OperationType = { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', LIST: 'list', GET: 'get', WRITE: 'write' };
const MAIN_ADMIN_EMAIL = 'comebackemail12@gmail.com';
const DEFAULT_LOGO = '/src/assets/images/naxora_bd_logo_1795288025158.jpg';

async function parseApiJson(res, silent = false) {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  let data = null;
  if (ct.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    const txt = await res.text().catch(() => '');
    if (txt.trim().startsWith('{') || txt.trim().startsWith('[')) {
      try { data = JSON.parse(txt); } catch {}
    }
  }
  if (!data) {
    if (silent) return null;
    throw new Error('এই সার্ভার ফিচারটির জন্য Node ব্যাকএন্ড (/api) প্রয়োজন; Firebase স্ট্যাটিক হোস্টিংয়ে কাজ করে না।');
  }
  return data;
}

const STUDIO_ASSETS = [
  { label: 'Naxora Bd Emblem Logo', url: '/src/assets/images/naxora_bd_logo_1795288025158.jpg' },
  { label: 'Levitating Lamp', url: '/src/assets/images/product_levitating_lamp_1795121290698.jpg' },
  { label: 'Cyber Keyboard', url: '/src/assets/images/product_cyber_keyboard_1795121291161.jpg' },
  { label: 'Beauty Mirror', url: '/src/assets/images/product_beauty_mirror_1795121291645.jpg' },
  { label: 'Streetwear Hoodie', url: '/src/assets/images/product_streetwear_hoodie_1795121291299.jpg' },
  { label: 'Thermal Printer', url: '/src/assets/images/product_thermal_printer_1795121291285.jpg' },
  { label: 'Cyber Setup Banner', url: '/src/assets/images/slider_cyber_setup_banner_1795203622505.jpg' },
  { label: 'Game Top-Up', url: '/src/assets/images/emarket_game_topup_1795203622838.jpg' },
  { label: 'App Subscriptions', url: '/src/assets/images/emarket_app_subs_1795203623557.jpg' },
  { label: 'Viral Drop Hero', url: '/src/assets/images/hero_viral_drop_1795121291627.jpg' }
];

const VIEW_META = {
  overview: { title: 'Operations Overview', sub: 'রিয়েলটাইম স্টোর ও অপারেশন সামারি' },
  products: { title: 'Products & Inventory', sub: 'প্রোডাক্ট, প্রাইস এবং স্টক ম্যানেজমেন্ট' },
  orders: { title: 'Order Fulfillment', sub: 'অর্ডার স্ট্যাটাস, পেমেন্ট ভেরিফিকেশন ও ট্র্যাকিং' },
  emarket: { title: 'E-Market Hub', sub: 'ডিজিটাল টপআপ, সাবস্ক্রিপশন ও রিডিম ডেলিভারি' },
  wallet: { title: 'Wallet Top-Up Requests', sub: 'কাস্টমারদের ম্যানুয়াল অ্যাড-মানি যাচাই ও ব্যালেন্স অনুমোদন' },
  sliders: { title: 'Hero Sliders', sub: 'স্টোরফ্রন্ট হোম স্লাইডার ব্যানার' },
  notices: { title: 'Notice Board', sub: 'কাস্টমারদের জন্য জরুরি ঘোষণা ও ব্যানার' },
  notifications: { title: 'Push Notifications', sub: 'কাস্টমারদের কাছে ইনস্ট্যান্ট অ্যালার্ট পাঠান' },
  categories: { title: 'Categories', sub: 'স্টোর ক্যাটাগরি এবং অর্ডারিং' },
  coupons: { title: 'Coupon Studio', sub: 'ডিসকাউন্ট কুপন তৈরি ও নিয়ন্ত্রণ' },
  returns: { title: 'Returns & Photo Disputes', sub: 'রিটার্ন, ড্যামেজ প্রুফ ও ওয়ালেট রিফান্ড অনুমোদন' },
  users: { title: 'Customers CRM & Wallets', sub: 'সকল ইউজারের NX-ID, ওয়ালেট (+/-), ব্যান ও রিসেলার কন্ট্রোল' },
  reels: { title: 'Viral Reels Studio', sub: 'প্রোডাক্ট ট্যাগসহ শপেবল ভার্টিক্যাল ভিডিও রিলস' },
  campaigns: { title: 'Scheduled Campaigns', sub: 'সময়সীমা-ভিত্তিক ফ্ল্যাশ সেল ও অটো ডিসকাউন্ট' },
  tournaments: { title: 'Gaming Tournaments', sub: 'টুর্নামেন্ট, এন্ট্রি ও প্রোটেক্টেড কাস্টম রুম আইডি/পাসওয়ার্ড' },
  blacklist: { title: 'Fake Order Shield', sub: 'ভুয়া অর্ডার ও ফোন/জিমেইল ব্ল্যাকলিস্ট ম্যানেজমেন্ট' },
  tickets: { title: 'Support Tickets', sub: 'কাস্টমার সাপোর্ট ও রিপ্লাই' }
};

let app, auth, db;
let currentUser = null;
let isGoogleSignInBusy = false;
let adminProfile = null;
let isOwner = false;
let currentView = 'overview';
let storeConfig = { brandName: 'Naxora Bd', brandLogoUrl: DEFAULT_LOGO, currencySymbol: '৳', adminAppEnabled: true, supportPhone: '', supportEmail: '', lowStockThreshold: 5, resellerDefaultDiscountPct: 8, deliveryInsideDhakaBdt: 60, deliveryOutsideDhakaBdt: 120, codAdvanceDeliveryOutsideDhaka: false, codAdvanceDeliveryAll: false };
let assetPickerTargetId = null;
let unsubAdmModalChat = null;
let activeAdmOrderLockKey = '';

const state = {
  products: [],
  orders: [],
  emarketItems: [],
  emarketOrders: [],
  emPinsVault: { total: 0, counts: {}, pins: [] },
  walletRequests: [],
  resellerWithdrawals: [],
  supportChats: [],
  faqs: [],
  sliders: [],
  notices: [],
  notifications: [],
  categories: [],
  coupons: [],
  tickets: [],
  users: [],
  returns: [],
  reels: [],
  campaigns: [],
  tournaments: [],
  blacklist: [],
  stockAlerts: [],
  expenses: [],
  creatorPromos: [],
  abandonedCarts: [],
  offers: []
};

const unsubs = {};
const liveReady = {};
let loggedSessionUid = '';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `${storeConfig.currencySymbol || '৳'}${Number(n || 0).toLocaleString('en-US')}`;
const fmtPayLabel = (o) => {
  const m = String(o?.paymentMethod || 'cod').toLowerCase();
  if (m === 'manual' && o?.manualApp) return `MANUAL (${String(o.manualApp).toUpperCase()})`;
  if (m === 'auto' && o?.manualApp) return `AUTO (${String(o.manualApp).toUpperCase()})`;
  return m.toUpperCase();
};
const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
};

function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified ?? null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

function showToast(msg) {
  const el = document.getElementById('admin-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function showAuthError(msg) {
  const err = document.getElementById('admin-auth-error');
  const note = document.getElementById('admin-auth-notice');
  if (note) note.classList.add('hidden');
  if (err) { err.textContent = msg; err.classList.remove('hidden'); }
}

function showAuthNotice(msg) {
  const err = document.getElementById('admin-auth-error');
  const note = document.getElementById('admin-auth-notice');
  if (err) err.classList.add('hidden');
  if (note) { note.textContent = msg; note.classList.remove('hidden'); }
}

function detectAndApplyDeviceLayout() {
  const w = window.innerWidth || document.documentElement.clientWidth || 1280;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
  const uaMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  let device = 'desktop';
  if (w <= 760 || (uaMobile && w <= 860)) device = 'mobile';
  else if (w <= 1080) device = 'tablet';
  document.documentElement.dataset.device = device;
  document.documentElement.dataset.touch = coarse ? 'true' : 'false';
  document.body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
  document.body.classList.add(`device-${device}`);
}

function toggleMobileSidebar(open) {
  const sb = document.getElementById('admin-sidebar');
  const bd = document.getElementById('admin-drawer-backdrop');
  if (!sb || !bd) return;
  const shouldOpen = typeof open === 'boolean' ? open : !sb.classList.contains('open');
  sb.classList.toggle('open', shouldOpen);
  bd.classList.toggle('hidden', !shouldOpen);
}

function hasPerm(permKey) {
  if (isOwner) return true;
  if (!adminProfile || adminProfile.status !== 'approved') return false;
  return adminProfile.permissions?.[permKey] === true;
}

function canSeeView(viewKey) {
  if (viewKey === 'overview') return true;
  if (viewKey === 'products') return hasPerm('canCreateProduct') || hasPerm('canEditProduct') || hasPerm('canDeleteProduct');
  if (viewKey === 'orders') return hasPerm('canManageOrders');
  if (viewKey === 'emarket') return hasPerm('canManageEMarket');
  if (viewKey === 'wallet') return hasPerm('canManageOrders');
  if (viewKey === 'sliders') return hasPerm('canManageSliders');
  if (viewKey === 'notices') return hasPerm('canManageNotices');
  if (viewKey === 'notifications') return hasPerm('canSendNotifications');
  if (viewKey === 'categories') return hasPerm('canManageCategories');
  if (viewKey === 'coupons') return hasPerm('canManageCoupons');
  if (viewKey === 'tickets') return hasPerm('canReplyTickets');
  if (viewKey === 'users') return hasPerm('canManageUsers') || hasPerm('canManageOrders');
  if (viewKey === 'returns') return hasPerm('canManageOrders');
  if (viewKey === 'blacklist') return hasPerm('canManageOrders');
  if (viewKey === 'reels') return hasPerm('canManageSliders') || hasPerm('canCreateProduct') || hasPerm('canEditProduct');
  if (viewKey === 'campaigns') return hasPerm('canManageCoupons');
  if (viewKey === 'tournaments') return hasPerm('canManageEMarket');
  return false;
}

function clearAllDataListeners() {
  if (unsubAdmModalChat) {
    try { unsubAdmModalChat(); } catch {}
    unsubAdmModalChat = null;
  }
  Object.keys(unsubs).forEach((k) => {
    try { unsubs[k]?.(); } catch {}
    delete unsubs[k];
  });
  Object.keys(liveReady).forEach((k) => delete liveReady[k]);
}

function syncBrandUI() {
  const logo = storeConfig.brandLogoUrl || DEFAULT_LOGO;
  const name = storeConfig.brandName || 'Naxora Bd';
  ['sidebar-brand-logo', 'auth-brand-logo'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.src = logo;
  });
  const fav = document.getElementById('admin-favicon');
  if (fav) fav.href = logo;
  ['sidebar-brand-name', 'auth-brand-name'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });
  if (typeof updatePfAdvDelivHint === 'function') updatePfAdvDelivHint();
}

function updatePfAdvDelivHint() {
  const hint = document.getElementById('pf-adv-deliv-hint');
  const dInEl = document.getElementById('pf-deliv-dhaka');
  const dOutEl = document.getElementById('pf-deliv-outside');
  const fallbackDhaka = Number(storeConfig.deliveryInsideDhakaBdt ?? 60);
  const fallbackOutside = Number(storeConfig.deliveryOutsideDhakaBdt ?? 120);
  if (dInEl) dInEl.placeholder = `অটো (সেটিংস: ${money(fallbackDhaka)})`;
  if (dOutEl) dOutEl.placeholder = `অটো (সেটিংস: ${money(fallbackOutside)})`;
  if (!hint) return;
  const dhakaFee = dInEl && String(dInEl.value).trim() !== '' ? Math.max(0, Number(dInEl.value) || 0) : fallbackDhaka;
  const outsideFee = dOutEl && String(dOutEl.value).trim() !== '' ? Math.max(0, Number(dOutEl.value) || 0) : fallbackOutside;
  const prodAdvOn = document.getElementById('pf-adv-deliv')?.checked || false;
  const customFee = Number(document.getElementById('pf-adv-deliv-fee')?.value || 0);
  if (customFee > 0 && !(dInEl && String(dInEl.value).trim() !== '') && !(dOutEl && String(dOutEl.value).trim() !== '')) {
    hint.textContent = `ফিক্সড অগ্রিম ${money(customFee)} (০ দিলে ঢাকা ${money(dhakaFee)} / বাইরে ${money(outsideFee)} নেবে)`;
  } else if (prodAdvOn || storeConfig.codAdvanceDeliveryAll) {
    hint.textContent = `✅ অটো অগ্রিম: ঢাকার ভেতরে ${money(dhakaFee)} · ঢাকার বাইরে ${money(outsideFee)}`;
  } else {
    hint.textContent = `ডেলিভারি: ঢাকার ভেতরে ${money(dhakaFee)} · ঢাকার বাইরে ${money(outsideFee)}`;
  }
}

function syncNavPermissions() {
  document.querySelectorAll('#admin-sidebar-nav .nav-item[data-nav-key]').forEach((btn) => {
    btn.classList.toggle('hidden', !canSeeView(btn.dataset.navKey));
  });

  const commerceGroup = document.getElementById('nav-group-commerce');
  if (commerceGroup) {
    commerceGroup.classList.toggle('hidden', !['products', 'orders', 'emarket', 'wallet', 'categories', 'coupons', 'returns', 'users'].some(canSeeView));
  }
  const engGroup = document.getElementById('nav-group-engagement');
  if (engGroup) {
    engGroup.classList.toggle('hidden', !['sliders', 'reels', 'campaigns', 'tournaments', 'notices', 'notifications', 'blacklist', 'tickets'].some(canSeeView));
  }

  const mobileNav = document.getElementById('admin-mobile-nav');
  if (mobileNav) {
    const visibleItems = Array.from(document.querySelectorAll('#admin-sidebar-nav .nav-item')).filter((b) => !b.classList.contains('hidden'));
    mobileNav.innerHTML = visibleItems.map((b) => `
      <button type="button" class="mobile-nav-btn ${b.dataset.view === currentView ? 'active' : ''}" data-view="${esc(b.dataset.view)}">
        ${esc(b.querySelector('span')?.textContent || b.dataset.view)}
      </button>
    `).join('');
  }

  const pfCard = document.getElementById('product-form-card');
  const editingId = document.getElementById('pf-id')?.value;
  if (pfCard) {
    const showForm = editingId ? hasPerm('canEditProduct') : hasPerm('canCreateProduct');
    pfCard.classList.toggle('hidden', !showForm);
  }

  if (!canSeeView(currentView)) switchView('overview');
}

function switchView(viewKey) {
  if (!canSeeView(viewKey)) viewKey = 'overview';
  currentView = viewKey;
  document.querySelectorAll('.view-section').forEach((s) => s.classList.add('hidden'));
  document.getElementById(`view-${viewKey}`)?.classList.remove('hidden');

  document.querySelectorAll('#admin-sidebar-nav .nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === viewKey));
  document.querySelectorAll('#admin-mobile-nav .mobile-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewKey));

  const meta = VIEW_META[viewKey] || VIEW_META.overview;
  document.getElementById('topbar-view-title').textContent = meta.title;
  document.getElementById('topbar-view-sub').textContent = meta.sub;
  toggleMobileSidebar(false);

  if (viewKey === 'overview' && (canSeeView('orders') || canSeeView('emarket'))) loadAdmExpenses();
  if (viewKey === 'orders') loadAdmAbandonedCarts();
  if (viewKey === 'coupons') { loadAdmCreators(); loadAdmOffers(); }
  if (viewKey === 'users') loadAdmResellerWithdrawals();
  if (viewKey === 'tickets') { loadAdmSupportChats(); loadAdmFaqs(); }
  if (viewKey === 'emarket') loadAdmEmPinsVault();
}

function syncDynamicListeners() {
  const ensureListener = (key, allowed, attachFn) => {
    if (allowed && !unsubs[key]) unsubs[key] = attachFn();
    else if (!allowed && unsubs[key]) {
      try { unsubs[key](); } catch {}
      delete unsubs[key];
      state[key] = [];
    }
  };

  ensureListener('categories', canSeeView('products') || canSeeView('categories'), () =>
    onSnapshot(query(collection(db, 'categories'), orderBy('sortOrder', 'asc')), (snap) => {
      state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCategories();
      renderProductCategoryOptions();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'categories'))
  );

  ensureListener('products', canSeeView('products') || canSeeView('reels') || canSeeView('sliders'), () =>
    onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), (snap) => {
      state.products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProducts();
      renderReels();
      renderSliders();
      renderOverview();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'products'))
  );

  ensureListener('orders', canSeeView('orders') || canSeeView('users'), () =>
    onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(250)), (snap) => {
      if (!liveReady.orders) liveReady.orders = true;
      else {
        snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
          const o = c.doc.data();
          showToast(`${(o.isResellerOrder || o.isDropship) ? '🤝 রিসেলার অর্ডার' : '🛍️ নতুন অর্ডার'} #${o.orderNumber || c.doc.id.slice(0, 6)} · ${money(o.totalBdt || 0)}`);
        });
      }
      state.orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderOrders();
      renderUsersCrm();
      renderOverview();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'orders'))
  );

  ensureListener('emarketItems', canSeeView('emarket'), () =>
    onSnapshot(query(collection(db, 'emarketItems'), orderBy('createdAt', 'desc')), (snap) => {
      state.emarketItems = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderEMarketItems();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'emarketItems'))
  );

  ensureListener('emarketOrders', canSeeView('emarket'), () =>
    onSnapshot(query(collection(db, 'emarketOrders'), orderBy('createdAt', 'desc'), limit(200)), (snap) => {
      if (!liveReady.emarketOrders) liveReady.emarketOrders = true;
      else {
        snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
          const eo = c.doc.data();
          showToast(`🎮 নতুন E-Market অর্ডার #${eo.orderNumber || c.doc.id.slice(0, 6)} · ${eo.itemTitle || ''}`);
        });
      }
      state.emarketOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderEMarketOrders();
      renderOverview();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'emarketOrders'))
  );

  ensureListener('walletRequests', canSeeView('wallet'), () =>
    onSnapshot(query(collection(db, 'walletRequests'), orderBy('createdAt', 'desc'), limit(200)), (snap) => {
      if (!liveReady.walletRequests) liveReady.walletRequests = true;
      else {
        snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
          const w = c.doc.data();
          showToast(`💰 ওয়ালেট অ্যাড-মানি রিকোয়েস্ট: ${money(w.amountBdt || 0)} (${w.userName || 'Customer'})`);
        });
      }
      state.walletRequests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderWalletRequests();
      renderOverview();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'walletRequests'))
  );

  ensureListener('sliders', canSeeView('sliders'), () =>
    onSnapshot(query(collection(db, 'sliders'), orderBy('sortOrder', 'asc')), (snap) => {
      state.sliders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderSliders();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'sliders'))
  );

  ensureListener('notices', canSeeView('notices'), () =>
    onSnapshot(query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(50)), (snap) => {
      state.notices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderNotices();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'notices'))
  );

  ensureListener('notifications', canSeeView('notifications'), () =>
    onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(60)), (snap) => {
      state.notifications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderNotifications();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'notifications'))
  );

  ensureListener('users', canSeeView('notifications') || canSeeView('users'), () =>
    onSnapshot(query(collection(db, 'users'), limit(300)), (snap) => {
      state.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderNotificationAudience();
      renderUsersCrm();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'users'))
  );

  ensureListener('coupons', canSeeView('coupons'), () =>
    onSnapshot(query(collection(db, 'coupons'), orderBy('createdAt', 'desc')), (snap) => {
      state.coupons = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCoupons();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'coupons'))
  );

  ensureListener('tickets', canSeeView('tickets'), () =>
    onSnapshot(query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      if (!liveReady.tickets) liveReady.tickets = true;
      else {
        snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
          const tk = c.doc.data();
          showToast(`🎫 নতুন সাপোর্ট টিকেট: ${tk.subject || 'Support'}`);
        });
      }
      state.tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTickets();
      renderOverview();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'tickets'))
  );

  ensureListener('returns', canSeeView('returns'), () =>
    onSnapshot(query(collection(db, 'returns'), orderBy('createdAt', 'desc'), limit(150)), (snap) => {
      if (!liveReady.returns) liveReady.returns = true;
      else {
        snap.docChanges().filter((c) => c.type === 'added').forEach((c) => {
          const r = c.doc.data();
          showToast(`↩ নতুন রিটার্ন রিকোয়েস্ট #${r.orderNumber || c.doc.id.slice(0, 6)}`);
        });
      }
      state.returns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderReturns();
      renderOverview();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'returns'))
  );

  ensureListener('reels', canSeeView('reels'), () =>
    onSnapshot(query(collection(db, 'reels'), orderBy('createdAt', 'desc'), limit(100)), (snap) => {
      state.reels = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderReels();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'reels'))
  );

  ensureListener('campaigns', canSeeView('campaigns'), () =>
    onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'), limit(60)), (snap) => {
      state.campaigns = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCampaigns();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'campaigns'))
  );

  ensureListener('tournaments', canSeeView('tournaments'), () =>
    onSnapshot(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(60)), (snap) => {
      state.tournaments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderTournaments();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'tournaments'))
  );

  ensureListener('blacklist', canSeeView('blacklist'), () =>
    onSnapshot(query(collection(db, 'blacklist'), orderBy('createdAt', 'desc'), limit(150)), (snap) => {
      state.blacklist = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderBlacklist();
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'blacklist'))
  );

  ensureListener('stockAlerts', canSeeView('products'), () =>
    onSnapshot(query(collection(db, 'stockAlerts'), limit(200)), (snap) => {
      state.stockAlerts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }, (e) => handleFirestoreError(e, OperationType.LIST, 'stockAlerts'))
  );
}

/* ==================== RENDERERS ==================== */

function renderOverview() {
  const kpiWrap = document.getElementById('overview-kpis');
  const emptyNotice = document.getElementById('overview-empty-notice');
  const lowStockPanel = document.getElementById('overview-low-stock-panel');
  const recentOrdersPanel = document.getElementById('overview-recent-orders-panel');

  const cards = [];
  if (canSeeView('orders')) {
    const pending = state.orders.filter((o) => o.status === 'pending').length;
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Active Orders</div>
        <div class="kpi-value">${state.orders.length}</div>
        <div class="kpi-sub">${pending} awaiting confirmation</div>
      </div>
    `);
    const badge = document.getElementById('nav-badge-orders');
    if (badge) { badge.textContent = String(pending); badge.classList.toggle('hidden', pending === 0); }
  }
  const threshold = Math.max(1, Number(storeConfig.lowStockThreshold ?? 5));
  if (canSeeView('products')) {
    const low = state.products.filter((p) => Number(p.stock || 0) <= threshold).length;
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Catalog Products</div>
        <div class="kpi-value">${state.products.length}</div>
        <div class="kpi-sub">${low} low stock items</div>
      </div>
    `);
  }
  if (canSeeView('emarket')) {
    const pendingEm = state.emarketOrders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
    const lowPinPacks = Object.values(state.emPinsVault?.counts || {}).filter((c) => Number(c) < 3).length;
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">E-Market Queue</div>
        <div class="kpi-value">${pendingEm}</div>
        <div class="kpi-sub">${state.emarketOrders.length} total orders${lowPinPacks > 0 ? ` · <span style="color:#fca5a5;">⚠ ${lowPinPacks} low PIN packs</span>` : ''}</div>
      </div>
    `);
    const badge = document.getElementById('nav-badge-emarket');
    if (badge) { badge.textContent = String(pendingEm); badge.classList.toggle('hidden', pendingEm === 0); }
  }
  if (canSeeView('returns')) {
    const pendingRet = state.returns.filter((r) => r.status === 'pending').length;
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Returns &amp; Disputes</div>
        <div class="kpi-value">${pendingRet}</div>
        <div class="kpi-sub">${state.returns.length} total requests</div>
      </div>
    `);
    const badgeRet = document.getElementById('nav-badge-returns');
    if (badgeRet) { badgeRet.textContent = String(pendingRet); badgeRet.classList.toggle('hidden', pendingRet === 0); }
  }
  if (canSeeView('tickets')) {
    const openTkt = state.tickets.filter((t) => t.status !== 'resolved').length;
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Open Tickets</div>
        <div class="kpi-value">${openTkt}</div>
        <div class="kpi-sub">${state.tickets.length} total threads</div>
      </div>
    `);
    const badge = document.getElementById('nav-badge-tickets');
    if (badge) { badge.textContent = String(openTkt); badge.classList.toggle('hidden', openTkt === 0); }
  }
  if (canSeeView('wallet')) {
    const pendingW = state.walletRequests.filter((r) => r.status === 'pending').length;
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">Wallet Top-Ups</div>
        <div class="kpi-value">${pendingW}</div>
        <div class="kpi-sub">${state.walletRequests.length} total requests</div>
      </div>
    `);
    const badgeW = document.getElementById('nav-badge-wallet');
    if (badgeW) { badgeW.textContent = String(pendingW); badgeW.classList.toggle('hidden', pendingW === 0); }
  }

  const profitPanel = document.getElementById('adm-profit-panel');
  const profitChart = document.getElementById('adm-profit-chart');
  const topMarginBody = document.getElementById('adm-top-margin-tbody');
  const canProfit = canSeeView('orders') || canSeeView('emarket');

  if (canProfit) {
    const prodCostMap = new Map(state.products.map((p) => [p.id, Number(p.costPriceBdt || 0)]));
    const emCostMap = new Map(state.emarketItems.map((it) => [it.id, Number(it.costPriceBdt || 0)]));
    let totalRev = 0;
    let totalCost = 0;
    const dayMap = new Map();
    for (let i = 9; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { key, label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), rev: 0, cost: 0 });
    }
    const prodPerf = new Map();

    if (canSeeView('orders')) {
      state.orders.forEach((o) => {
        if (o.status === 'cancelled') return;
        const rev = Number(o.totalBdt || 0);
        let cogs = 0;
        (o.items || []).forEach((it) => {
          const qty = Math.max(1, Number(it.qty || 1));
          const unitPrice = Number(it.priceBdt || 0);
          const unitCost = Number(it.costPriceBdt ?? prodCostMap.get(it.productId) ?? 0);
          const itemRev = unitPrice * qty;
          const itemCost = unitCost * qty;
          cogs += itemCost;
          const pk = it.productId || it.title || 'Product';
          const cur = prodPerf.get(pk) || { title: it.title || 'Product', qty: 0, rev: 0, cost: 0 };
          cur.qty += qty;
          cur.rev += itemRev;
          cur.cost += itemCost;
          prodPerf.set(pk, cur);
        });
        totalRev += rev;
        totalCost += cogs;
        const ms = toMillisSafe(o.createdAt);
        if (ms) {
          const dKey = new Date(ms).toISOString().slice(0, 10);
          if (dayMap.has(dKey)) {
            dayMap.get(dKey).rev += rev;
            dayMap.get(dKey).cost += cogs;
          }
        }
      });
    }

    if (canSeeView('emarket')) {
      state.emarketOrders.forEach((eo) => {
        if (eo.status === 'cancelled') return;
        const rev = Number(eo.totalBdt || eo.priceBdt || 0);
        const cogs = Number(eo.costPriceBdt ?? emCostMap.get(eo.itemId) ?? 0);
        totalRev += rev;
        totalCost += cogs;
        const pk = `em:${eo.itemId || eo.itemTitle}`;
        const cur = prodPerf.get(pk) || { title: `[E-Market] ${eo.itemTitle || 'Service'}`, qty: 0, rev: 0, cost: 0 };
        cur.qty += 1;
        cur.rev += rev;
        cur.cost += cogs;
        prodPerf.set(pk, cur);
        const ms = toMillisSafe(eo.createdAt);
        if (ms) {
          const dKey = new Date(ms).toISOString().slice(0, 10);
          if (dayMap.has(dKey)) {
            dayMap.get(dKey).rev += rev;
            dayMap.get(dKey).cost += cogs;
          }
        }
      });
    }

    const netProfit = totalRev - totalCost;
    const totalExpenses = (state.expenses || []).reduce((s, ex) => s + Number(ex.amountBdt || 0), 0);
    const trueNetProfit = netProfit - totalExpenses;
    const roiBase = totalCost + totalExpenses;
    const roiPct = roiBase > 0 ? ((trueNetProfit / roiBase) * 100).toFixed(1) : '0.0';
    const marginPct = totalRev > 0 ? ((netProfit / totalRev) * 100).toFixed(1) : '0.0';
    cards.push(`
      <div class="kpi-card">
        <div class="kpi-label">True Net Profit (ROI)</div>
        <div class="kpi-value">${money(trueNetProfit)}</div>
        <div class="kpi-sub">${roiPct}% ROI · ${marginPct}% gross margin · Exp ${money(totalExpenses)}</div>
      </div>
    `);

    const expPanel = document.getElementById('adm-expenses-panel');
    if (expPanel) expPanel.classList.remove('hidden');
    renderAdmExpenses();

    if (profitPanel && profitChart && topMarginBody) {
      profitPanel.classList.remove('hidden');
      const series = Array.from(dayMap.values()).map((d) => ({ ...d, profit: d.rev - d.cost }));
      profitChart.innerHTML = buildProfitSvgChart(series);
      const topRows = Array.from(prodPerf.values())
        .map((r) => ({ ...r, profit: r.rev - r.cost, margin: r.rev > 0 ? ((r.rev - r.cost) / r.rev) * 100 : 0 }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 8);
      topMarginBody.innerHTML = topRows.length
        ? topRows.map((r) => `
          <tr>
            <td><strong>${esc(r.title)}</strong></td>
            <td class="tabular-nums">${r.qty}</td>
            <td class="tabular-nums">${money(r.rev)}</td>
            <td class="tabular-nums">${money(r.cost)}</td>
            <td class="tabular-nums"><strong>${money(r.profit)}</strong></td>
            <td class="tabular-nums"><span class="status-pill ${r.margin >= 15 ? 'badge-delivered' : 'badge-pending'}">${r.margin.toFixed(1)}%</span></td>
          </tr>
        `).join('')
        : '<tr><td colspan="6" class="muted-note">No sales profit data yet.</td></tr>';
    }
  } else {
    if (profitPanel) profitPanel.classList.add('hidden');
    document.getElementById('adm-expenses-panel')?.classList.add('hidden');
  }

  kpiWrap.innerHTML = cards.join('');
  const hasAnyDomain = ['products', 'orders', 'emarket', 'wallet', 'categories', 'coupons', 'returns', 'users', 'sliders', 'reels', 'campaigns', 'tournaments', 'notices', 'notifications', 'blacklist', 'tickets'].some(canSeeView);
  emptyNotice.classList.toggle('hidden', hasAnyDomain);

  if (canSeeView('products')) {
    lowStockPanel.classList.remove('hidden');
    const lowItems = state.products.filter((p) => Number(p.stock || 0) <= threshold).slice(0, 6);
    document.getElementById('overview-low-stock-list').innerHTML = lowItems.length
      ? lowItems.map((p) => `
        <div class="mini-row">
          <div>
            <strong>${esc(p.title)}</strong>
            <div class="cell-sub">Remaining: <b class="tabular-nums">${Number(p.stock || 0)}</b></div>
          </div>
          ${hasPerm('canEditProduct') ? `<button type="button" class="btn btn-outline btn-xs" data-quick-stock="${esc(p.id)}" data-delta="10">+10 Stock</button>` : ''}
        </div>
      `).join('')
      : '<div class="muted-note">All inventory levels look healthy.</div>';
  } else {
    lowStockPanel.classList.add('hidden');
  }

  if (canSeeView('orders')) {
    recentOrdersPanel.classList.remove('hidden');
    const latest = state.orders.slice(0, 5);
    document.getElementById('overview-recent-orders-list').innerHTML = latest.length
      ? latest.map((o) => `
        <div class="mini-row">
          <div>
            <strong>#${esc(o.orderNumber || o.id.slice(0, 8))}</strong>
            <div class="cell-sub">${esc(o.customerName)} · ${money(o.totalBdt)}</div>
          </div>
          <div class="inline-actions">
            <span class="status-pill badge-${esc(o.status)}">${esc(o.status)}</span>
            <button type="button" class="btn btn-ghost btn-xs" data-inspect-order="${esc(o.id)}">Inspect</button>
          </div>
        </div>
      `).join('')
      : '<div class="muted-note">No orders yet.</div>';
  } else {
    recentOrdersPanel.classList.add('hidden');
  }
}

function renderProductCategoryOptions() {
  const pfCat = document.getElementById('pf-category');
  const filterCat = document.getElementById('prod-cat-filter');
  const cats = state.categories.length
    ? state.categories
    : [{ slug: 'tech-gadgets', nameEn: 'Tech Gadgets' }, { slug: 'home-desk', nameEn: 'Home & Desk' }, { slug: 'fashion-drip', nameEn: 'Fashion & Drip' }];

  if (pfCat) {
    const cur = pfCat.value;
    pfCat.innerHTML = cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.nameEn || c.slug)}</option>`).join('');
    if (cur) pfCat.value = cur;
  }
  if (filterCat) {
    const cur = filterCat.value;
    filterCat.innerHTML = '<option value="">All Categories</option>' + cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.nameEn || c.slug)}</option>`).join('');
    if (cur) filterCat.value = cur;
  }
}

function renderProducts() {
  const threshold = Math.max(1, Number(storeConfig.lowStockThreshold ?? 5));
  const lowItems = state.products.filter((p) => p.isActive !== false && Number(p.stock || 0) <= threshold);
  const lowPanel = document.getElementById('adm-low-stock-panel');
  const lowList = document.getElementById('adm-low-stock-list');
  if (lowPanel && lowList) {
    lowPanel.classList.toggle('hidden', lowItems.length === 0);
    lowList.innerHTML = lowItems.map((p) => `
      <div class="low-stock-chip">
        <span><strong>${esc(p.title)}</strong> (${Number(p.stock || 0)} left)</span>
        ${hasPerm('canEditProduct') ? `<button type="button" class="btn btn-primary btn-xs" data-quick-stock="${esc(p.id)}" data-delta="10">+10 Restock</button>` : ''}
      </div>
    `).join('');
  }

  const tbody = document.getElementById('admin-products-tbody');
  if (!tbody) return;
  const q = (document.getElementById('prod-search')?.value || '').trim().toLowerCase();
  const cat = document.getElementById('prod-cat-filter')?.value || '';

  const filtered = state.products.filter((p) => {
    if (cat && p.categoryId !== cat) return false;
    if (q && !`${p.title} ${p.subtitleBn || ''} ${p.id} ${p.categoryId}`.toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = filtered.length
    ? filtered.map((p) => `
      <tr>
        <td>
          <div class="thumb-cell">
            <img src="${esc(p.imageUrl)}" alt="" class="thumb-img" />
            <div>
              <strong>${esc(p.title)}</strong>
              <div class="cell-sub">${esc(p.viralSource || p.subtitleBn || 'Standard')}${p.isPreOrder ? ' · Pre-Order' : ''}${p.groupBuyEnabled ? ' · Group Buy' : ''}${(() => {
                const hasCustomZone = (p.deliveryInsideDhakaBdt !== undefined && p.deliveryInsideDhakaBdt !== null && Number(p.deliveryInsideDhakaBdt) >= 0) || (p.deliveryOutsideDhakaBdt !== undefined && p.deliveryOutsideDhakaBdt !== null && Number(p.deliveryOutsideDhakaBdt) >= 0);
                const inF = (p.deliveryInsideDhakaBdt !== undefined && p.deliveryInsideDhakaBdt !== null && Number(p.deliveryInsideDhakaBdt) >= 0) ? Number(p.deliveryInsideDhakaBdt) : Number(storeConfig.deliveryInsideDhakaBdt ?? 60);
                const outF = (p.deliveryOutsideDhakaBdt !== undefined && p.deliveryOutsideDhakaBdt !== null && Number(p.deliveryOutsideDhakaBdt) >= 0) ? Number(p.deliveryOutsideDhakaBdt) : Number(storeConfig.deliveryOutsideDhakaBdt ?? 120);
                if (p.requireAdvanceDelivery || storeConfig.codAdvanceDeliveryAll) {
                  return ` · 🚚 Adv Deliv: ${!hasCustomZone && p.requireAdvanceDelivery && Number(p.advanceDeliveryFeeBdt || 0) > 0 ? money(p.advanceDeliveryFeeBdt) : `ঢাকা ${money(inF)} / বাইরে ${money(outF)}`}`;
                }
                return hasCustomZone ? ` · 🚚 Deliv: ঢাকা ${money(inF)} / বাইরে ${money(outF)}` : '';
              })()}</div>
            </div>
          </div>
        </td>
        <td>${esc(p.categoryId)}</td>
        <td class="tabular-nums"><strong>${money(p.priceBdt)}</strong>${p.resellerPriceBdt ? `<div class="cell-sub">Reseller: ${money(p.resellerPriceBdt)}</div>` : ''}</td>
        <td>
          <div class="stock-adjust">
            ${hasPerm('canEditProduct') ? `<button type="button" class="btn btn-outline btn-xs" data-quick-stock="${esc(p.id)}" data-delta="-1">-1</button>` : ''}
            <strong class="tabular-nums">${Number(p.stock || 0)}</strong>
            ${hasPerm('canEditProduct') ? `<button type="button" class="btn btn-outline btn-xs" data-quick-stock="${esc(p.id)}" data-delta="5">+5</button>` : ''}
          </div>
        </td>
        <td><span class="status-pill ${p.isActive !== false ? 'badge-delivered' : 'badge-cancelled'}">${p.isActive !== false ? 'Active' : 'Hidden'}</span></td>
        <td>
          <div class="inline-actions">
            ${hasPerm('canEditProduct') ? `<button type="button" class="btn btn-outline btn-xs" data-edit-prod="${esc(p.id)}">Edit</button>` : ''}
            <button type="button" class="btn btn-ghost btn-xs" data-adm-reviews="${esc(p.id)}">Reviews</button>
            <button type="button" class="btn btn-ghost btn-xs" data-adm-qa="${esc(p.id)}">Q&amp;A</button>
            ${hasPerm('canDeleteProduct') ? `<button type="button" class="btn btn-danger btn-xs" data-del-prod="${esc(p.id)}">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="muted-note">No matching products found.</td></tr>';
}

function renderOrders() {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;
  const q = (document.getElementById('ord-search')?.value || '').trim().toLowerCase();
  const st = document.getElementById('ord-status-filter')?.value || '';

  const filtered = state.orders.filter((o) => {
    if (st && o.status !== st) return false;
    if (q && !`${o.orderNumber} ${o.customerName} ${o.phone} ${o.trxId || ''} ${o.manualApp || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = filtered.length
    ? filtered.map((o) => {
      const terminalLocked = !isOwner && ['delivered', 'cancelled'].includes(o.status);
      return `
        <tr>
          <td><strong class="tabular-nums">#${esc(o.orderNumber || o.id.slice(0, 8))}</strong><div class="cell-sub">${fmtTime(o.createdAt)}${(o.isDropship || o.isResellerOrder) ? ' · 🤝 Dropship' : ''}${o.isPreOrder ? ' · ⏳ Pre-Order' : ''}</div></td>
          <td><strong>${esc(o.customerName)}</strong><div class="cell-sub">${esc(o.phone)}</div></td>
          <td class="tabular-nums"><strong>${money(o.totalBdt)}</strong><div class="cell-sub">${esc(fmtPayLabel(o))}${o.paidAmountBdt ? ` · Sent ${money(o.paidAmountBdt)}` : ''}${o.trxId ? ` · ${esc(o.trxId)}` : ''}</div></td>
          <td>
            <select class="inline-select" data-order-pay="${esc(o.id)}" ${terminalLocked ? 'disabled' : ''}>
              ${['unpaid', 'pending_verify', 'paid', 'refunded'].map((ps) => `<option value="${ps}" ${o.paymentStatus === ps ? 'selected' : ''}>${ps}</option>`).join('')}
            </select>
          </td>
          <td>
            <select class="inline-select" data-order-status="${esc(o.id)}" ${terminalLocked ? 'disabled' : ''}>
              ${['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            ${terminalLocked ? '<div class="cell-sub">Finalized</div>' : ''}
          </td>
          <td>
            <div class="inline-actions">
              <input type="text" class="inline-input" style="width:110px" placeholder="Tracking #" value="${esc(o.courierTracking || '')}" data-track-input="${esc(o.id)}" ${terminalLocked ? 'disabled' : ''} />
              ${!terminalLocked ? `<button type="button" class="btn btn-outline btn-xs" data-save-track="${esc(o.id)}">Save</button>` : ''}
              <button type="button" class="btn btn-outline btn-xs" data-adm-label="${esc(o.id)}">🏷 4×6</button>
              <button type="button" class="btn btn-ghost btn-xs" data-inspect-order="${esc(o.id)}">Details</button>
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="6" class="muted-note">No orders matched.</td></tr>';
}

function populateAdmPinSelectors() {
  const itemSel = document.getElementById('adm-pin-item');
  const pkgSel = document.getElementById('adm-pin-pkg');
  if (!itemSel || !pkgSel) return;
  const curItem = itemSel.value;
  itemSel.innerHTML = state.emarketItems.length
    ? state.emarketItems.map((it) => `<option value="${esc(it.id)}">${esc(it.title)}</option>`).join('')
    : '<option value="">No E-Market items yet</option>';
  if (curItem && state.emarketItems.some((it) => it.id === curItem)) itemSel.value = curItem;

  const selected = state.emarketItems.find((it) => it.id === itemSel.value) || state.emarketItems[0];
  const curPkg = pkgSel.value;
  const pkgs = Array.isArray(selected?.packages) ? selected.packages : [];
  pkgSel.innerHTML = pkgs.length
    ? pkgs.map((pk) => `<option value="${esc(pk.label)}">${esc(pk.label)} (${money(pk.priceBdt)})</option>`).join('')
    : '<option value="">No packages</option>';
  if (curPkg && pkgs.some((pk) => pk.label === curPkg)) pkgSel.value = curPkg;
}

function renderAdmEmPinsVault() {
  const sumEl = document.getElementById('adm-em-pins-summary');
  const tbody = document.getElementById('adm-em-pins-tbody');
  if (!sumEl || !tbody) return;
  const counts = state.emPinsVault?.counts || {};
  const pins = state.emPinsVault?.pins || [];
  const itemById = new Map(state.emarketItems.map((it) => [it.id, it.title]));

  const entries = Object.entries(counts);
  sumEl.innerHTML = entries.length
    ? entries.map(([k, cnt]) => {
      const [itemId, pkg] = k.split('::');
      const n = Number(cnt);
      const isLow = n < 3;
      return `<span class="pin-chip ${isLow ? 'low-stock' : ''}">${isLow ? '⚠ Low · ' : ''}${esc(itemById.get(itemId) || itemId)} · ${esc(pkg)}: <strong>${n}</strong></span>`;
    }).join('')
    : '<span class="muted-note">No PINs stocked yet. Add voucher/PIN codes above for instant auto-delivery.</span>';

  tbody.innerHTML = pins.length
    ? pins.map((p) => `
      <tr>
        <td><strong>${esc(itemById.get(p.itemId) || p.itemId)}</strong><div class="cell-sub">${esc(p.packageLabel)}</div></td>
        <td><code>${esc(p.code)}</code></td>
        <td class="cell-sub">${fmtTime(p.createdAt)}</td>
        <td><button type="button" class="btn btn-danger btn-xs" data-adm-del-pin="${esc(p.id)}">Remove</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">PIN vault is empty.</td></tr>';
}

async function loadAdmEmPinsVault() {
  if (!currentUser || !hasPerm('canManageEMarket')) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/emarket/pins', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.emPinsVault = {
      total: Number(data.total || 0),
      counts: data.counts || {},
      pins: Array.isArray(data.pins) ? data.pins : []
    };
    renderAdmEmPinsVault();
  } catch {}
}

function renderEMarketItems() {
  populateAdmPinSelectors();
  renderAdmEmPinsVault();
  const tbody = document.getElementById('admin-em-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.emarketItems.length
    ? state.emarketItems.map((it) => `
      <tr>
        <td><div class="thumb-cell"><img src="${esc(it.imageUrl)}" alt="" class="thumb-img" /><div><strong>${esc(it.title)}</strong><div class="cell-sub">${esc(it.subtitleBn || '')}${it.costPriceBdt ? ` · Cost ${money(it.costPriceBdt)}` : ''}</div></div></div></td>
        <td>${esc(it.category)}</td>
        <td class="cell-sub">${(it.packages || []).map((p) => `${esc(p.label)} (${money(p.priceBdt)})`).join(', ')}</td>
        <td>${esc(it.deliveryEta)}</td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-edit-em="${esc(it.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-em="${esc(it.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No E-Market services yet.</td></tr>';
}

function renderEMarketOrders() {
  const tbody = document.getElementById('admin-em-orders-tbody');
  if (!tbody) return;
  const q = (document.getElementById('em-ord-search')?.value || '').trim().toLowerCase();
  const filtered = state.emarketOrders.filter((eo) => !q || `${eo.orderNumber} ${eo.itemTitle} ${eo.targetAccount} ${eo.playerNickname || ''} ${eo.trxId || ''}`.toLowerCase().includes(q));

  tbody.innerHTML = filtered.length
    ? filtered.map((eo) => {
      const locked = !isOwner && ['completed', 'cancelled'].includes(eo.status);
      return `
        <tr>
          <td><strong class="tabular-nums">#${esc(eo.orderNumber || eo.id.slice(0, 8))}</strong><div class="cell-sub">${fmtTime(eo.createdAt)}</div></td>
          <td><strong>${esc(eo.itemTitle)} · ${esc(eo.packageLabel)}</strong><div class="cell-sub">Target: ${esc(eo.targetAccount)}${eo.playerNickname ? ` · <b>IGN: ${esc(eo.playerNickname)}</b>` : ''}</div></td>
          <td class="tabular-nums"><strong>${money(eo.totalBdt)}</strong><div class="cell-sub">${esc(fmtPayLabel(eo))}${eo.paidAmountBdt ? ` · Sent ${money(eo.paidAmountBdt)}` : ''} · ${esc(eo.trxId || '—')}</div></td>
          <td>
            <div class="inline-actions">
              <input type="text" class="inline-input" style="width:135px" placeholder="Redeem / PIN" value="${esc(eo.deliveryCode || '')}" data-em-code-input="${esc(eo.id)}" ${locked ? 'disabled' : ''} />
              ${!locked ? `<button type="button" class="btn btn-outline btn-xs" data-save-em-code="${esc(eo.id)}">Save</button>` : ''}
            </div>
          </td>
          <td>
            <div class="inline-actions">
              <select class="inline-select" data-em-status="${esc(eo.id)}" ${locked ? 'disabled' : ''}>
                ${['pending', 'processing', 'completed', 'cancelled'].map((s) => `<option value="${s}" ${eo.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-ghost btn-xs" data-inspect-em="${esc(eo.id)}">Details</button>
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="5" class="muted-note">No E-Market orders found.</td></tr>';
}

function renderWalletRequests() {
  const pendingCount = state.walletRequests.filter((r) => r.status === 'pending').length;
  const badge = document.getElementById('nav-badge-wallet');
  if (badge) { badge.textContent = String(pendingCount); badge.classList.toggle('hidden', pendingCount === 0); }

  const tbody = document.getElementById('admin-wallet-tbody');
  if (!tbody) return;
  const q = (document.getElementById('adm-wallet-search')?.value || '').trim().toLowerCase();
  const st = document.getElementById('adm-wallet-status')?.value || '';
  const list = state.walletRequests.filter((r) => {
    if (st && r.status !== st) return false;
    if (q && !`${r.userName} ${r.userEmail} ${r.walletApp} ${r.senderNumber} ${r.trxId}`.toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = list.length
    ? list.map((r) => `
      <tr>
        <td><strong class="tabular-nums">#${esc(r.id.slice(0, 8))}</strong><div class="cell-sub">${fmtTime(r.createdAt)}</div></td>
        <td><strong>${esc(r.userName)}</strong><div class="cell-sub">${esc(r.userEmail || r.userId)}</div></td>
        <td><strong>${esc(String(r.paymentMode || 'manual').toUpperCase())}</strong><div class="cell-sub">${esc(String(r.walletApp || '—').toUpperCase())}</div></td>
        <td class="tabular-nums"><strong>${money(r.amountBdt)}</strong><div class="cell-sub">Sent: ${money(r.paidAmountBdt ?? r.amountBdt)}</div></td>
        <td><span class="tabular-nums">${esc(r.senderNumber || '—')}</span><div class="cell-sub">${esc(r.trxId || '—')}</div></td>
        <td><span class="status-pill badge-${esc(r.status)}">${esc(r.status)}</span></td>
        <td>
          ${r.status === 'pending' ? `
            <div class="inline-actions">
              <input type="text" class="inline-input" style="width:115px" placeholder="Note (optional)" data-adm-wnote="${esc(r.id)}" />
              <button type="button" class="btn btn-primary btn-xs" data-adm-wapprove="${esc(r.id)}">Approve</button>
              <button type="button" class="btn btn-danger btn-xs" data-adm-wreject="${esc(r.id)}">Reject</button>
            </div>
          ` : `<div class="cell-sub">${esc(r.adminNote || 'Reviewed')}</div>`}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="muted-note">No wallet top-up requests found.</td></tr>';
}

function renderSliders() {
  const slProdSel = document.getElementById('adm-sl-prod');
  if (slProdSel) {
    const curSl = slProdSel.value;
    slProdSel.innerHTML = '<option value="">— কোনো নির্দিষ্ট প্রোডাক্ট নয় (Page লিংক) —</option>' +
      state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.title)} (${money(p.priceBdt)})</option>`).join('');
    if (curSl) slProdSel.value = curSl;
  }
  const tbody = document.getElementById('admin-sliders-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.sliders.length
    ? state.sliders.map((sl) => {
      const lp = sl.linkPage === 'product' && sl.linkTarget ? state.products.find((p) => p.id === sl.linkTarget) : null;
      const routeLabel = sl.linkPage === 'product' ? `📦 ${lp ? lp.title : (sl.linkTarget || 'Product')}` : sl.linkPage;
      return `
      <tr>
        <td><img src="${esc(sl.imageUrl)}" alt="" class="banner-thumb" /></td>
        <td><strong>${esc(sl.title)}</strong><div class="cell-sub">${esc(sl.ctaLabel || 'Explore')} → ${esc(routeLabel)}</div></td>
        <td><span class="status-pill ${sl.isActive !== false ? 'badge-delivered' : 'badge-cancelled'}">${sl.isActive !== false ? 'Active' : 'Paused'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-toggle-slider="${esc(sl.id)}">${sl.isActive !== false ? 'Pause' : 'Enable'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-slider="${esc(sl.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
    }).join('')
    : '<tr><td colspan="4" class="muted-note">No sliders published yet.</td></tr>';
}

function renderNotices() {
  const tbody = document.getElementById('admin-notices-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.notices.length
    ? state.notices.map((nt) => `
      <tr>
        <td><strong>${esc(nt.title)}</strong><div class="cell-sub">${esc(nt.messageBn)}</div></td>
        <td><span class="status-pill badge-confirmed">${esc(nt.priority)}</span></td>
        <td>${nt.isActive !== false ? 'Active' : 'Hidden'}</td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-toggle-notice="${esc(nt.id)}">${nt.isActive !== false ? 'Hide' : 'Show'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-notice="${esc(nt.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">No notices posted.</td></tr>';
}

function renderNotificationAudience() {
  const sel = document.getElementById('adm-nf-target');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = ['<option value="ALL">All Customers (Broadcast)</option>']
    .concat(state.users.map((u) => `<option value="${esc(u.id)}">${esc(u.displayName || u.email || u.id)}</option>`)).join('');
  if (cur) sel.value = cur;
}

function renderNotifications() {
  const tbody = document.getElementById('admin-notifs-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.notifications.length
    ? state.notifications.map((nf) => `
      <tr>
        <td><strong>${esc(nf.title)}</strong><div class="cell-sub">${esc(nf.body)}</div></td>
        <td>${esc(nf.targetUid === 'ALL' ? 'All Users' : nf.targetUid)}</td>
        <td><span class="status-pill badge-confirmed">${esc(nf.type)}</span></td>
        <td class="cell-sub">${fmtTime(nf.createdAt)}</td>
        <td><button type="button" class="btn btn-danger btn-xs" data-del-notif="${esc(nf.id)}">Delete</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No notifications sent.</td></tr>';
}

const ADMIN_VEC_ICONS = {
  smartphone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  headphones: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  watch: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><polyline points="12 10 12 12 13 13"/><path d="M16.13 7.66l-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="M7.88 16.36l.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/></svg>',
  gamepad: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="3"/></svg>',
  laptop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>',
  shirt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
  shoes: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-3a2 2 0 0 1 2-2h2l3-4 2 2 4 2a4 4 0 0 1 3 3.8V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><line x1="4" y1="15" x2="20" y2="15"/></svg>',
  bag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  lamp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  camera: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  sparkles: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 4.8L18.6 9.6l-4.8 1.8L12 16.2l-1.8-4.8L5.4 9.6l4.8-1.8L12 3z"/><path d="M5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9L5 17z"/><path d="M19 3l.7 1.5L21.2 5l-1.5.7L19 7.2l-.7-1.5L16.8 5l1.5-.7L19 3z"/></svg>',
  gift: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H4v4"/><path d="M4 12v8h16v-8"/><path d="M12 8v12"/><path d="M12 8c-1.5-2.5-5-2-5 0h5z"/><path d="M12 8c1.5-2.5 5-2 5 0h-5z"/></svg>',
  gem: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 18 3 22 9 12 21 2 9 6 3"/><line x1="2" y1="9" x2="22" y2="9"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  zap: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  tv: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  book: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  dumbbell: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11"/><path d="M21 21l-1-1"/><path d="M3 3l1 1"/><path d="M18 22l4-4"/><path d="M2 6l4-4"/><path d="M3 10l7-7"/><path d="M14 21l7-7"/></svg>',
  coffee: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  crown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><line x1="4" y1="20" x2="20" y2="20"/></svg>',
  glasses: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="14" r="4"/><circle cx="18" cy="14" r="4"/><line x1="10" y1="14" x2="14" y2="14"/></svg>',
  flame: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  package: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5"/><path d="M12 12v9"/><path d="M12 12L4 7.5"/></svg>'
};
const ADMIN_EMOJI_TO_VEC = { '📱': 'smartphone', '📲': 'smartphone', '🎧': 'headphones', '🎙️': 'headphones', '🎤': 'headphones', '⌚': 'watch', '⏱️': 'watch', '🎮': 'gamepad', '🕹️': 'gamepad', '💻': 'laptop', '🖥️': 'laptop', '👕': 'shirt', '👔': 'shirt', '👗': 'shirt', '👟': 'shoes', '👠': 'shoes', '🎒': 'bag', '🛍️': 'bag', '🛒': 'bag', '💡': 'lamp', '🏠': 'home', '🏡': 'home', '📷': 'camera', '🎥': 'camera', '💄': 'sparkles', '✨': 'sparkles', '🎁': 'gift', '🧸': 'gift', '💍': 'gem', '💎': 'gem', '🔌': 'zap', '⚡': 'zap', '🎵': 'music', '📺': 'tv', '📚': 'book', '🏋️': 'dumbbell', '☕': 'coffee', '❤️': 'heart', '👑': 'crown', '🕶️': 'glasses', '👓': 'glasses', '🔥': 'flame', '📦': 'package' };

function formatCatIconPreview(iconVal) {
  const v = String(iconVal || '').trim();
  if (!v) return `<span class="cat-icon-preview">${ADMIN_VEC_ICONS.package}</span>`;
  const cleanKey = v.startsWith('icon:') ? v.slice(5).trim().toLowerCase() : v.toLowerCase();
  if (ADMIN_VEC_ICONS[cleanKey]) return `<span class="cat-icon-preview">${ADMIN_VEC_ICONS[cleanKey]}</span>`;
  for (const [emo, vecKey] of Object.entries(ADMIN_EMOJI_TO_VEC)) {
    if (v.includes(emo) && ADMIN_VEC_ICONS[vecKey]) return `<span class="cat-icon-preview">${ADMIN_VEC_ICONS[vecKey]}</span>`;
  }
  if (/^(https?:\/\/|\/|data:image\/)/i.test(v)) return `<span class="cat-icon-preview"><img src="${esc(v)}" alt="" /></span>`;
  return `<span class="cat-icon-preview">${esc(v)}</span>`;
}

function renderCategories() {
  const tbody = document.getElementById('admin-cats-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.categories.length
    ? state.categories.map((c) => `
      <tr>
        <td>${formatCatIconPreview(c.icon)}</td>
        <td><strong>${esc(c.slug)}</strong></td>
        <td>${esc(c.nameBn)}</td>
        <td>${esc(c.nameEn)}</td>
        <td class="tabular-nums">${Number(c.sortOrder || 0)}</td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-edit-cat="${esc(c.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-cat="${esc(c.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="muted-note">No categories configured.</td></tr>';
}

function renderCoupons() {
  const tbody = document.getElementById('admin-coupons-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.coupons.length
    ? state.coupons.map((c) => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td class="tabular-nums">${c.discountType === 'percent' ? `${Number(c.discountValue)}%` : money(c.discountValue)}</td>
        <td class="tabular-nums">${money(c.minOrderBdt)}</td>
        <td><span class="status-pill ${c.isActive !== false ? 'badge-delivered' : 'badge-cancelled'}">${c.isActive !== false ? 'Active' : 'Disabled'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-toggle-coupon="${esc(c.id)}">${c.isActive !== false ? 'Disable' : 'Enable'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-del-coupon="${esc(c.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No coupons created.</td></tr>';
}

function renderAdmExpenses() {
  const tbody = document.getElementById('adm-expenses-tbody');
  if (!tbody) return;
  const list = state.expenses || [];
  tbody.innerHTML = list.length
    ? list.map((ex) => `
      <tr>
        <td><span class="status-pill badge-confirmed">${esc(ex.category || 'ops')}</span></td>
        <td><strong>${esc(ex.title)}</strong>${ex.note ? `<div class="cell-sub">${esc(ex.note)}</div>` : ''}</td>
        <td class="cell-sub tabular-nums">${esc(ex.date || fmtTime(ex.createdAt))}</td>
        <td class="tabular-nums"><strong>${money(ex.amountBdt)}</strong></td>
        <td><button type="button" class="btn btn-danger btn-xs" data-del-exp="${esc(ex.id)}">Remove</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No expenses logged yet.</td></tr>';
}

async function loadAdmExpenses() {
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    renderAdmExpenses();
    renderOverview();
  } catch {}
}

function renderAdmAbandonedCarts() {
  const tbody = document.getElementById('adm-abandoned-tbody');
  if (!tbody) return;
  const list = state.abandonedCarts || [];
  tbody.innerHTML = list.length
    ? list.map((c) => {
      const digits = String(c.phone || '').replace(/[^0-9]/g, '');
      const waNum = digits.length >= 10 ? (digits.startsWith('88') ? digits : `88${digits.replace(/^0+/, '')}`) : '';
      const waText = encodeURIComponent(`হ্যালো ${c.name || ''}! ${storeConfig.brandName || 'Naxora Bd'}-এ আপনার কার্টে ${money(c.totalBdt)} মূল্যের পণ্য অপেক্ষা করছে। অর্ডার কনফার্ম করতে ভিজিট করুন: ${location.origin}/user/`);
      const itemsText = (c.items || []).map((i) => `${i.title} ×${i.qty || 1}`).join(', ');
      return `
        <tr>
          <td><strong>${esc(c.name || 'Guest Customer')}</strong><div class="cell-sub">${esc(c.phone || c.email || c.uid || '—')}</div></td>
          <td><strong>${money(c.totalBdt)}</strong><div class="cell-sub">${esc(itemsText || 'Items in cart')}</div></td>
          <td class="cell-sub">${fmtTime(c.updatedAt)}</td>
          <td>
            <div class="inline-actions">
              ${waNum ? `<a target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc(waNum)}?text=${waText}" class="btn btn-outline btn-xs">WhatsApp</a>` : ''}
              ${c.uid ? `<button type="button" class="btn btn-primary btn-xs" data-adm-remind-cart="${esc(c.key)}" data-remind-uid="${esc(c.uid)}">${c.remindedAt ? 'Resend Push' : 'Send Reminder'}</button>` : '<span class="cell-sub">Guest</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="4" class="muted-note">No abandoned carts right now.</td></tr>';
}

async function loadAdmAbandonedCarts() {
  if (!currentUser || !hasPerm('canManageOrders')) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/carts/abandoned', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.abandonedCarts = Array.isArray(data.carts) ? data.carts : [];
    renderAdmAbandonedCarts();
  } catch {}
}

function renderAdmCreators() {
  const tbody = document.getElementById('adm-creators-tbody');
  if (!tbody) return;
  const list = state.creatorPromos || [];
  tbody.innerHTML = list.length
    ? list.map((c) => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td><strong>${esc(c.creatorName)}</strong><div class="cell-sub">${esc(c.creatorPhone || '—')}</div></td>
        <td class="tabular-nums">${Number(c.commissionPct || 0)}%</td>
        <td class="tabular-nums">${Number(c.usesCount || 0)} uses · ${money(c.totalSalesBdt || 0)}</td>
        <td class="tabular-nums"><strong>${money(c.earnedBdt || 0)}</strong></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No creator promo codes linked yet.</td></tr>';
}

async function loadAdmCreators() {
  if (!currentUser || !hasPerm('canManageCoupons')) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/coupons/creators', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.creatorPromos = Array.isArray(data.creators) ? data.creators : [];
    renderAdmCreators();
  } catch {}
}

function renderAdmOffers() {
  const tbody = document.getElementById('adm-offers-tbody');
  if (!tbody) return;
  const list = state.offers || [];
  tbody.innerHTML = list.length
    ? list.map((o) => `
      <tr>
        <td><strong>${esc(o.title)}</strong></td>
        <td><span class="status-pill badge-confirmed">${esc(o.type)}</span></td>
        <td class="cell-sub">Min Qty: ${Number(o.minQty || 2)} · Off: ${Number(o.discountPct || 0)}%${o.targetCategory ? ` · Cat: ${esc(o.targetCategory)}` : ''}</td>
        <td><button type="button" class="btn btn-danger btn-xs" data-del-offer="${esc(o.id)}">Remove</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">No auto offers active.</td></tr>';
}

async function loadAdmOffers() {
  try {
    const res = await fetch('/api/offers');
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.offers = Array.isArray(data.offers) ? data.offers : [];
    renderAdmOffers();
  } catch {}
}

function renderTickets() {
  const wrap = document.getElementById('admin-tickets-list');
  if (!wrap) return;
  const st = document.getElementById('tkt-status-filter')?.value || '';
  const list = state.tickets.filter((t) => !st || t.status === st);

  wrap.innerHTML = list.length
    ? list.map((t) => `
      <div class="ticket-card">
        <div class="ticket-head">
          <div>
            <strong>${esc(t.subject)}</strong>
            <div class="cell-sub">Order #${esc(t.orderNumber || t.orderId)} · ${fmtTime(t.createdAt)}</div>
          </div>
          <span class="status-pill badge-${esc(t.status)}">${esc(t.status)}</span>
        </div>
        <div style="font-size:13px;line-height:1.5;margin-bottom:8px;">${esc(t.message)}</div>
        <div class="ticket-reply-row">
          <input type="text" class="inline-input" style="flex:1;min-width:190px" placeholder="Write reply to customer..." value="${esc(t.adminReply || '')}" data-tkt-reply="${esc(t.id)}" />
          <select class="inline-select" style="width:135px" data-tkt-status="${esc(t.id)}">
            ${['open', 'in_progress', 'resolved'].map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-primary btn-sm" data-save-tkt="${esc(t.id)}">Send Reply</button>
        </div>
      </div>
    `).join('')
    : '<div class="muted-note">No support tickets found.</div>';
}

function deriveClientNxId(uid) {
  let hash = 2166136261;
  const s = String(uid || 'NX');
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = (hash >>> 0) % 900000 + 100000;
  return `NX-${num}`;
}

function renderUsersCrm() {
  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;
  const q = (document.getElementById('adm-u-search')?.value || '').trim().toLowerCase();
  const flt = document.getElementById('adm-u-filter')?.value || '';
  const list = state.users.filter((u) => {
    if (flt === 'banned' && !u.isBanned) return false;
    if (flt === 'reseller' && !u.isReseller) return false;
    if (flt === 'reseller_pending' && u.resellerStatus !== 'pending') return false;
    const cid = u.customerId || deriveClientNxId(u.id);
    if (q && !`${u.displayName} ${u.email} ${u.savedPhone} ${cid} ${u.id}`.toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = list.length
    ? list.map((u) => {
      const uOrders = state.orders.filter((o) => o.userId === u.id);
      const spent = uOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.totalBdt || 0), 0);
      const cid = u.customerId || deriveClientNxId(u.id);
      const tierBadge = u.isBanned
        ? '<span class="status-pill badge-cancelled">BANNED</span>'
        : u.isReseller
          ? `<span class="status-pill badge-approved">Reseller (${Number(u.resellerDiscountPct || storeConfig.resellerDefaultDiscountPct || 8)}%)</span>`
          : u.resellerStatus === 'pending'
            ? '<span class="status-pill badge-pending">Reseller Req</span>'
            : '<span class="status-pill badge-confirmed">Active</span>';
      return `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <strong>${esc(u.displayName || 'Customer')}</strong>
              <span class="nx-id-chip">${esc(cid)}</span>
            </div>
            <div class="cell-sub">${esc(u.email)}</div>
          </td>
          <td>${esc(u.savedPhone || '—')}<div class="cell-sub">${esc(u.savedZone || 'inside_dhaka')}</div></td>
          <td class="tabular-nums"><strong>${money(u.walletBalanceBdt || 0)}</strong><div class="cell-sub">${tierBadge}</div></td>
          <td class="tabular-nums"><strong>${uOrders.length} orders · ${money(spent)}</strong><div class="cell-sub">${fmtTime(u.createdAt)}</div></td>
          <td>
            <div class="inline-actions">
              <button type="button" class="btn btn-primary btn-xs" data-adm-manage-user="${esc(u.id)}">Manage User</button>
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="5" class="muted-note">No customers matched.</td></tr>';
}

function renderReturns() {
  const pendingRet = state.returns.filter((r) => r.status === 'pending').length;
  const br = document.getElementById('nav-badge-returns');
  if (br) { br.textContent = String(pendingRet); br.classList.toggle('hidden', pendingRet === 0); }

  const tbody = document.getElementById('admin-returns-tbody');
  if (!tbody) return;
  const flt = document.getElementById('adm-ret-filter')?.value || '';
  const list = state.returns.filter((r) => !flt || r.status === flt);

  tbody.innerHTML = list.length
    ? list.map((r) => `
      <tr>
        <td><strong class="tabular-nums">#${esc(r.orderNumber || r.orderId?.slice(0, 8))}</strong><div class="cell-sub">${esc(r.userName || r.userEmail || r.userId)}</div></td>
        <td><strong>${esc(String(r.requestType || 'return').toUpperCase())}</strong><div class="cell-sub">${esc(r.reason)}</div></td>
        <td>${r.photoUrl ? `<a href="${esc(r.photoUrl)}" target="_blank" rel="noopener"><img src="${esc(r.photoUrl)}" alt="Proof" class="return-photo-thumb" /></a>` : '<span class="cell-sub">No photo</span>'}</td>
        <td class="tabular-nums"><strong>${money(r.refundAmountBdt || 0)}</strong></td>
        <td>
          <span class="status-pill badge-${esc(r.status)}">${esc(r.status)}</span>
          ${r.status === 'pending' ? `
            <div class="inline-actions" style="margin-top:6px;">
              <button type="button" class="btn btn-primary btn-xs" data-adm-ret-app="${esc(r.id)}">Approve &amp; Refund</button>
              <button type="button" class="btn btn-outline btn-xs" data-adm-ret-rep="${esc(r.id)}">Replace</button>
              <button type="button" class="btn btn-danger btn-xs" data-adm-ret-rej="${esc(r.id)}">Reject</button>
            </div>
          ` : `<div class="cell-sub">${esc(r.adminNote || 'Reviewed')}</div>`}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No return or dispute requests.</td></tr>';
}

function renderReels() {
  const rlProdSel = document.getElementById('adm-rl-prod');
  if (rlProdSel) {
    const curRl = rlProdSel.value;
    rlProdSel.innerHTML = '<option value="">None (Browse Store)</option>' + state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.title)} (${money(p.priceBdt)})</option>`).join('');
    if (curRl) rlProdSel.value = curRl;
  }
  const tbody = document.getElementById('admin-reels-tbody');
  if (!tbody) return;
  const prodMap = new Map(state.products.map((p) => [p.id, p.title]));
  tbody.innerHTML = state.reels.length
    ? state.reels.map((r) => `
      <tr>
        <td><div class="thumb-cell"><img src="${esc(r.posterUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" /><div><strong>${esc(r.title)}</strong><div class="cell-sub">${esc(r.badgeText || 'Reel')}</div></div></div></td>
        <td>${esc(prodMap.get(r.productId) || r.productTitle || 'General')}</td>
        <td class="tabular-nums">${Number(r.likesCount || 0)}</td>
        <td><span class="status-pill ${r.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${r.isActive !== false ? 'Active' : 'Paused'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-adm-rl-tgl="${esc(r.id)}">${r.isActive !== false ? 'Pause' : 'Enable'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-adm-rl-del="${esc(r.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No reels published yet.</td></tr>';
}

function renderCampaigns() {
  const tbody = document.getElementById('admin-campaigns-tbody');
  if (!tbody) return;
  const now = Date.now();
  tbody.innerHTML = state.campaigns.length
    ? state.campaigns.map((c) => {
      const sMs = new Date(c.startIso || 0).getTime();
      const eMs = new Date(c.endIso || 0).getTime();
      const live = c.isActive !== false && now >= sMs && now <= eMs;
      return `
        <tr>
          <td><strong>${esc(c.title)}</strong><div class="cell-sub">${esc(c.bannerNoteBn || '')}</div></td>
          <td class="tabular-nums"><strong>${Number(c.discountPercent || 0)}% OFF</strong><div class="cell-sub">Min ${money(c.minOrderBdt || 0)}</div></td>
          <td class="cell-sub">${fmtTime(c.startIso)} → ${fmtTime(c.endIso)}</td>
          <td><span class="status-pill ${live ? 'badge-approved' : c.isActive === false ? 'badge-cancelled' : 'badge-pending'}">${live ? 'LIVE NOW' : c.isActive === false ? 'Paused' : 'Scheduled'}</span></td>
          <td>
            <div class="inline-actions">
              <button type="button" class="btn btn-outline btn-xs" data-adm-cmp-tgl="${esc(c.id)}">${c.isActive !== false ? 'Pause' : 'Enable'}</button>
              <button type="button" class="btn btn-danger btn-xs" data-adm-cmp-del="${esc(c.id)}">Del</button>
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="5" class="muted-note">No campaigns scheduled yet.</td></tr>';
}

function renderTournaments() {
  const tbody = document.getElementById('admin-tournaments-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.tournaments.length
    ? state.tournaments.map((t) => `
      <tr>
        <td><div class="thumb-cell"><img src="${esc(t.imageUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" /><div><strong>${esc(t.title)}</strong><div class="cell-sub">${esc(t.game)} · <span style="text-transform:uppercase;">${esc(t.mode || 'solo')}</span> · ${fmtTime(t.startTimeIso)}</div></div></div></td>
        <td class="tabular-nums">Entry: <strong>${money(t.entryFeeBdt || 0)}</strong><div class="cell-sub">Prize: ${money(t.prizePoolBdt || 0)}${t.prizesDistributed ? ' · ✔ Paid' : ''}</div></td>
        <td class="tabular-nums">${Number(t.filledSlots || 0)} / ${Number(t.maxSlots || 48)}</td>
        <td><span class="status-pill badge-${esc(t.status === 'open' ? 'confirmed' : t.status === 'live' ? 'approved' : 'pending')}">${esc(t.status)}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-primary btn-xs" data-adm-tr-lb="${esc(t.id)}">🏆 Leaderboard</button>
            <button type="button" class="btn btn-outline btn-xs" data-adm-tr-edit="${esc(t.id)}">Edit / Room</button>
            <button type="button" class="btn btn-danger btn-xs" data-adm-tr-del="${esc(t.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No tournaments created yet.</td></tr>';
}

function renderBlacklist() {
  const tbody = document.getElementById('admin-blacklist-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.blacklist.length
    ? state.blacklist.map((b) => `
      <tr>
        <td><strong>${esc(b.phone || b.email || b.id)}</strong>${b.email && b.phone ? `<div class="cell-sub">${esc(b.email)}</div>` : ''}</td>
        <td>${esc(b.reason || 'Blocked')}</td>
        <td class="cell-sub">${fmtTime(b.createdAt)}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-adm-bl-del="${esc(b.id)}">Unblock</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">Blacklist shield is clean.</td></tr>';
}

/* ==================== MODALS & CSV ==================== */

function closeOrderDetailModal() {
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  releaseAdmOrderLock();
  document.body.classList.remove('printing-label');
  document.getElementById('order-detail-modal')?.classList.add('hidden');
}

function attachAdminOrderChat(order) {
  const msgBox = document.getElementById('adm-order-chat-msgs');
  const form = document.getElementById('adm-order-chat-form');
  if (!msgBox || !form || !order?.id) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }

  unsubAdmModalChat = onSnapshot(
    query(collection(db, 'orders', order.id, 'messages'), orderBy('createdAt', 'asc'), limit(100)),
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      msgBox.innerHTML = msgs.length
        ? msgs.map((m) => `
          <div class="chat-bubble ${m.senderRole !== 'user' ? 'staff' : ''}">
            <div class="chat-meta">${esc(m.senderName || m.senderRole)} · ${fmtTime(m.createdAt)}</div>
            <div>${esc(m.text)}</div>
          </div>
        `).join('')
        : '<div class="muted-note">No messages yet. Start conversation with the customer below.</div>';
      msgBox.scrollTop = msgBox.scrollHeight;
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `orders/${order.id}/messages`);
      msgBox.innerHTML = '<div class="muted-note">Could not load chat messages.</div>';
    }
  );

  form.onsubmit = async (e) => {
    e.preventDefault();
    const inp = document.getElementById('adm-order-chat-input');
    const text = String(inp?.value || '').trim().slice(0, 800);
    if (!text || !currentUser || !hasPerm('canManageOrders')) return;
    inp.value = '';
    try {
      await addDoc(collection(db, 'orders', order.id, 'messages'), {
        orderId: order.id,
        orderOwnerUid: order.userId || '',
        senderUid: currentUser.uid,
        senderRole: isOwner ? 'main_admin' : 'admin',
        senderName: adminProfile?.displayName || currentUser.displayName || (isOwner ? 'Main Admin' : 'Support Admin'),
        text,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${order.id}/messages`);
      showToast(err.message || 'Failed to send message.');
    }
  };
}

function openOrderInspectModal(order, isEMarket = false) {
  const modal = document.getElementById('order-detail-modal');
  const title = document.getElementById('odm-title');
  const body = document.getElementById('odm-body');
  if (!order || !modal) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  acquireAdmOrderLock(`${isEMarket ? 'em:' : 'ord:'}${order.id}`, 'acquire');

  const canRefundAmt = order.paymentStatus !== 'refunded' && Boolean(order.userId) && Number(order.totalBdt || order.priceBdt || 0) > 0;

  if (isEMarket) {
    const emLocked = !isOwner && ['completed', 'cancelled'].includes(order.status);
    const allowEmRefund = canRefundAmt && hasPerm('canManageEMarket') && !emLocked;
    title.textContent = `E-Market Order #${order.orderNumber || order.id.slice(0, 8)}`;
    body.innerHTML = `
      <div class="invoice-brand-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${esc(storeConfig.brandLogoUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" />
          <div>
            <strong>${esc(storeConfig.brandName || 'Naxora Bd')}</strong>
            <div class="cell-sub">${esc(storeConfig.supportPhone || '')}${storeConfig.supportEmail ? ` · ${esc(storeConfig.supportEmail)}` : ''}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <strong>DIGITAL INVOICE</strong>
          <div class="cell-sub">#${esc(order.orderNumber || order.id.slice(0, 8))} · ${fmtTime(order.createdAt)}</div>
        </div>
      </div>
      <div class="detail-kv"><span>Service</span><strong>${esc(order.itemTitle)} (${esc(order.packageLabel)})</strong></div>
      <div class="detail-kv"><span>Category</span><span>${esc(order.category)}</span></div>
      <div class="detail-kv"><span>Target Account</span><strong>${esc(order.targetAccount)}</strong></div>
      ${order.playerNickname ? `<div class="detail-kv"><span>Player IGN / Nickname</span><strong>${esc(order.playerNickname)}</strong></div>` : ''}
      <div class="detail-kv"><span>Note / Server</span><span>${esc(order.serverOrNote || '—')}</span></div>
      <div class="detail-kv"><span>Customer Email</span><span>${esc(order.userEmail || '—')}</span></div>
      <div class="detail-kv"><span>Payment</span><span>${esc(fmtPayLabel(order))} (${esc(order.paymentStatus)})</span></div>
      <div class="detail-kv"><span>Sender / TrxID</span><span>${esc(order.senderNumber || '—')} / ${esc(order.trxId || '—')}</span></div>
      <div class="detail-kv"><span>Total Paid</span><strong>${order.paidAmountBdt ? `${money(order.paidAmountBdt)} sent · ` : ''}${money(order.totalBdt)}</strong></div>
      <div class="detail-kv"><span>Delivery Code</span><strong>${esc(order.deliveryCode || 'Pending')}</strong></div>
      <div class="detail-kv"><span>Created</span><span>${fmtTime(order.createdAt)}</span></div>
      ${(hasPerm('canManageEMarket')) ? `
        <div class="ops-action-box no-print">
          <div>
            <strong>One-Click Refund → Customer Wallet</strong>
            <div class="cell-sub">ক্রেডিট হবে ${money(order.totalBdt || order.priceBdt)} এবং অর্ডার রিফান্ডেড হবে</div>
          </div>
          ${allowEmRefund
            ? `<button type="button" class="btn btn-danger btn-sm" data-adm-refund-em="${esc(order.id)}">Refund ${money(order.totalBdt || order.priceBdt)} → Wallet</button>`
            : `<span class="status-pill badge-refunded">${esc(order.paymentStatus === 'refunded' ? 'Already Refunded' : emLocked ? 'Finalized (Owner Only)' : 'Not Eligible')}</span>`}
        </div>
      ` : ''}
    `;
  } else {
    const terminalLocked = !isOwner && ['delivered', 'cancelled'].includes(order.status);
    const allowOrdOps = hasPerm('canManageOrders') && !terminalLocked;
    title.textContent = `Order #${order.orderNumber || order.id.slice(0, 8)}`;
    const itemsHtml = (order.items || []).map((i) => `
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;">
        <span>${esc(i.title)} ${i.variant ? `(${esc(i.variant)})` : ''} × ${Number(i.qty)}</span>
        <strong class="tabular-nums">${money(Number(i.priceBdt) * Number(i.qty))}</strong>
      </div>
    `).join('');
    body.innerHTML = `
      <div class="invoice-brand-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${esc(storeConfig.brandLogoUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" />
          <div>
            <strong>${esc(storeConfig.brandName || 'Naxora Bd')}</strong>
            <div class="cell-sub">${esc(storeConfig.supportPhone || '')}${storeConfig.supportEmail ? ` · ${esc(storeConfig.supportEmail)}` : ''}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <strong>TAX / SALES INVOICE</strong>
          <div class="cell-sub">#${esc(order.orderNumber || order.id.slice(0, 8))} · ${fmtTime(order.createdAt)}</div>
        </div>
      </div>
      <div class="detail-kv"><span>Customer</span><strong>${esc(order.customerName)}</strong></div>
      <div class="detail-kv"><span>Phone / Email</span><span>${esc(order.phone)} · ${esc(order.userEmail || '—')}</span></div>
      <div class="detail-kv"><span>Address</span><span>${esc(order.address)} (${esc(order.deliveryZone || '—')})</span></div>
      <div class="detail-kv"><span>Payment</span><span>${esc(fmtPayLabel(order))} (${esc(order.paymentStatus)})</span></div>
      <div class="detail-kv"><span>Sender / TrxID</span><span>${esc(order.senderNumber || '—')} / ${esc(order.trxId || '—')}</span></div>
      ${order.paidAmountBdt ? `<div class="detail-kv"><span>Customer Sent</span><strong>${money(order.paidAmountBdt)}</strong></div>` : ''}
      <div class="detail-kv"><span>Coupon</span><span>${esc(order.couponCode || 'None')} (-${money(order.discountBdt)})</span></div>
      ${order.comboDiscountBdt ? `<div class="detail-kv"><span>Combo Deal</span><span>-${money(order.comboDiscountBdt)}</span></div>` : ''}
      <div class="detail-kv"><span>Delivery Fee</span><span>${money(order.deliveryFeeBdt)}</span></div>
      <div class="detail-kv"><span>Courier</span><span>${esc(order.courierProvider || '—')} · ${esc(order.courierTracking || 'Not assigned')}</span></div>
      <div class="detail-kv"><span>Grand Total</span><strong>${money(order.totalBdt)}</strong></div>
      <div style="margin-top:12px;">
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">ITEMIZED BREAKDOWN</div>
        ${itemsHtml}
      </div>
      ${(order.isResellerOrder || Number(order.resellerProfitBdt || 0) > 0) ? `
        <div class="ops-action-box no-print" style="margin-bottom:10px;">
          <div>
            <strong>🤝 Reseller Order Profit Payout</strong>
            <div class="cell-sub">Reseller Profit: <strong>${money(order.resellerProfitBdt || 0)}</strong> · ${order.resellerProfitCredited ? 'Already Credited' : 'Pending Credit'}</div>
          </div>
          ${order.resellerProfitCredited
            ? `<span class="status-pill badge-approved">Credited (${money(order.resellerCreditedBdt ?? order.resellerProfitBdt ?? 0)})</span>`
            : `<button type="button" class="btn btn-primary btn-sm" data-adm-credit-reseller="${esc(order.id)}" ${hasPerm('canManageOrders') ? '' : 'disabled'}>Credit Reseller Profit</button>`}
        </div>
      ` : ''}
      ${hasPerm('canManageOrders') ? `
        <div class="ops-action-box no-print">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <select id="adm-courier-book-prov" class="inline-select" style="width:auto;" ${allowOrdOps ? '' : 'disabled'}>
              <option value="">Default Configured</option>
              <option value="steadfast">Steadfast</option>
              <option value="pathao">Pathao</option>
              <option value="redx">RedX</option>
              <option value="sandbox">Sandbox</option>
            </select>
            <button type="button" class="btn btn-primary btn-sm" data-adm-book-courier="${esc(order.id)}" ${allowOrdOps ? '' : 'disabled'}>🚚 Book Courier &amp; Ship</button>
          </div>
          ${(canRefundAmt && allowOrdOps)
            ? `<button type="button" class="btn btn-danger btn-sm" data-adm-refund-order="${esc(order.id)}">Refund ${money(order.totalBdt)} → Wallet</button>`
            : `<span class="status-pill badge-refunded">${esc(order.paymentStatus === 'refunded' ? 'Refunded' : terminalLocked ? 'Finalized' : 'No Refund')}</span>`}
        </div>
        <div class="chat-panel no-print">
          <strong style="font-size:13px;">Live Order Chat (Customer ↔ Admin)</strong>
          <div id="adm-order-chat-msgs" class="chat-messages"><div class="muted-note">Loading chat...</div></div>
          <form id="adm-order-chat-form" class="chat-form">
            <input type="text" id="adm-order-chat-input" required maxlength="800" placeholder="Write live message to customer..." />
            <button type="submit" class="btn btn-primary btn-sm">Send</button>
          </form>
        </div>
      ` : ''}
    `;
    if (hasPerm('canManageOrders')) attachAdminOrderChat(order);
  }
  document.body.classList.remove('printing-label');
  document.getElementById('odm-print-btn')?.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function openThermalLabelModal(order) {
  const modal = document.getElementById('order-detail-modal');
  const title = document.getElementById('odm-title');
  const body = document.getElementById('odm-body');
  if (!order || !modal) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  releaseAdmOrderLock();
  document.body.classList.add('printing-label');
  document.getElementById('odm-print-btn')?.classList.remove('hidden');
  const ordCode = String(order.orderNumber || order.id.slice(0, 8));
  const codCollect = order.paymentStatus === 'paid' ? 0 : Number(order.remainingPayableBdt ?? order.totalBdt ?? 0);
  title.textContent = `4×6 Thermal Label — #${ordCode}`;
  body.innerHTML = `
    <div class="thermal-label">
      <div class="thermal-label-head">
        <div>
          <strong style="font-size:17px;">${esc(storeConfig.brandName || 'Naxora Bd')}</strong>
          <div style="font-size:11px;">${esc(storeConfig.supportPhone || '')}</div>
        </div>
        <div style="text-align:right;font-size:12px;">
          <strong>#${esc(ordCode)}</strong>
          <div>${esc(String(order.deliveryZone || 'inside_dhaka').toUpperCase())}</div>
        </div>
      </div>
      <div style="font-size:12px;margin-bottom:8px;">
        <div style="font-size:10px;font-weight:700;color:#475569;">DELIVER TO:</div>
        <strong style="font-size:15px;">${esc(order.customerName)}</strong><br/>
        <strong>📞 ${esc(order.phone)}</strong><br/>
        <span>${esc(order.address)}</span>
      </div>
      <div class="thermal-cod-box">
        ${codCollect > 0 ? `COD COLLECT: ${money(codCollect)}` : 'PREPAID / VERIFIED PAID (৳0 DUE)'}
      </div>
      <div style="font-size:11.5px;border-top:1px solid #cbd5e1;padding-top:6px;">
        ${(order.items || []).map((i) => `${esc(i.title)} ${i.variant ? `(${esc(i.variant)})` : ''} × ${Number(i.qty)}`).join(' · ')}
      </div>
      <div style="margin-top:10px;text-align:center;">
        <svg width="240" height="38" viewBox="0 0 240 38" style="max-width:100%;height:auto;">
          <rect x="0" y="0" width="240" height="38" fill="#fff"/>
          ${Array.from({ length: 34 }, (_, idx) => `<rect x="${8 + idx * 6.6}" y="2" width="${(idx % 3) + 1.5}" height="28" fill="#000"/>`).join('')}
        </svg>
        <div style="font-family:monospace;font-size:11px;letter-spacing:2px;">${esc(order.courierTracking || ordCode)}</div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

async function openManageUserModal(uid) {
  const u = state.users.find((x) => x.id === uid);
  const modal = document.getElementById('order-detail-modal');
  const title = document.getElementById('odm-title');
  const body = document.getElementById('odm-body');
  if (!u || !modal) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  releaseAdmOrderLock();
  document.body.classList.remove('printing-label');
  document.getElementById('odm-print-btn')?.classList.add('hidden');

  const cid = u.customerId || deriveClientNxId(u.id);
  const uOrders = state.orders.filter((o) => o.userId === uid);
  const spent = uOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.totalBdt || 0), 0);
  const fsBal = Number(u.walletBalanceBdt || 0);
  let autoBal = 0;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/wallet-summary`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const ws = await parseApiJson(res, true);
      if (ws) autoBal = Number(ws.autoWalletBalanceBdt || 0);
    }
  } catch {}
  const totalBal = Math.round((fsBal + autoBal) * 100) / 100;

  title.textContent = `Manage Customer — ${u.displayName || 'Customer'} (${cid})`;
  body.innerHTML = `
    <div class="detail-kv"><span>Customer ID</span><span><span class="nx-id-chip">${esc(cid)}</span> <span class="cell-sub">(UID: ${esc(uid.slice(0, 12))}…)</span></span></div>
    <div class="detail-kv"><span>Email &amp; Phone</span><span>${esc(u.email)} · ${esc(u.savedPhone || '—')}</span></div>
    <div class="detail-kv"><span>Unified Wallet</span><strong class="tabular-nums">${money(totalBal)} <span class="cell-sub">(Firestore: ${money(fsBal)} + Auto: ${money(autoBal)})</span></strong></div>
    <div class="detail-kv"><span>Orders &amp; Tier</span><span>${uOrders.length} orders · ${money(spent)} spent · ${u.isBanned ? 'BANNED' : u.isReseller ? 'Reseller' : 'Standard'}</span></div>

    <div class="manage-user-grid">
      <div class="manage-box">
        <h4>💰 Wallet Add / Deduct (৳)</h4>
        <input type="number" id="mu-wal-amt" class="inline-input" min="1" placeholder="Amount (৳)" style="margin-bottom:6px;" />
        <input type="text" id="mu-wal-reason" class="inline-input" placeholder="Reason (e.g. Bonus / Penalty)" style="margin-bottom:8px;" />
        <div class="inline-actions">
          <button type="button" class="btn btn-primary btn-xs" data-adm-mu-wal="add" data-mu-uid="${esc(uid)}">+ Add Money</button>
          <button type="button" class="btn btn-danger btn-xs" data-adm-mu-wal="deduct" data-mu-uid="${esc(uid)}">- Deduct Money</button>
        </div>
      </div>

      <div class="manage-box">
        <h4>🚫 Ban / Unban Account</h4>
        <input type="text" id="mu-ban-reason" class="inline-input" value="${esc(u.banReason || '')}" placeholder="Ban reason (optional)" style="margin-bottom:8px;" />
        <div class="inline-actions">
          ${u.isBanned
            ? `<button type="button" class="btn btn-primary btn-xs" data-adm-mu-ban="unban" data-mu-uid="${esc(uid)}">Unban Customer</button>`
            : `<button type="button" class="btn btn-danger btn-xs" data-adm-mu-ban="ban" data-mu-uid="${esc(uid)}">Ban Customer</button>`}
          <button type="button" class="btn btn-outline btn-xs" data-adm-mu-bl="${esc(uid)}">Add to Order Shield</button>
        </div>
      </div>

      <div class="manage-box">
        <h4>🤝 Reseller / Dropship Tier</h4>
        <input type="number" id="mu-reseller-pct" class="inline-input" min="0" max="50" value="${Number(u.resellerDiscountPct ?? storeConfig.resellerDefaultDiscountPct ?? 8)}" placeholder="Discount %" style="margin-bottom:8px;" />
        <div class="inline-actions">
          <button type="button" class="btn btn-primary btn-xs" data-adm-mu-res="approve" data-mu-uid="${esc(uid)}">Approve Reseller</button>
          <button type="button" class="btn btn-danger btn-xs" data-adm-mu-res="revoke" data-mu-uid="${esc(uid)}">Revoke</button>
        </div>
      </div>

      <div class="manage-box">
        <h4>📝 Admin CRM Note</h4>
        <input type="text" id="mu-admin-note" class="inline-input" value="${esc(u.adminNote || '')}" placeholder="VIP, trusted buyer, etc." style="margin-bottom:8px;" />
        <button type="button" class="btn btn-outline btn-xs" data-adm-mu-note="${esc(uid)}">Save Note</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

async function openQaModal(productId) {
  const p = state.products.find((x) => x.id === productId);
  const modal = document.getElementById('order-detail-modal');
  const title = document.getElementById('odm-title');
  const body = document.getElementById('odm-body');
  if (!modal || !title || !body) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  releaseAdmOrderLock();
  document.getElementById('odm-print-btn')?.classList.add('hidden');
  title.textContent = `Customer Q&A — ${p?.title || productId}`;
  body.innerHTML = '<div class="muted-note">Loading Q&amp;A...</div>';
  modal.classList.remove('hidden');

  try {
    const snap = await getDocs(collection(db, 'products', productId, 'questions'));
    const qs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    body.innerHTML = qs.length
      ? qs.map((q) => `
        <div class="ticket-card" style="margin-bottom:10px;">
          <div class="ticket-head">
            <div><strong>${esc(q.userName || 'Customer')}</strong>: ${esc(q.question)}</div>
            <button type="button" class="btn btn-danger btn-xs" data-adm-del-qa="${esc(productId)}::${esc(q.id)}">Del</button>
          </div>
          <div class="ticket-reply-row">
            <input type="text" class="inline-input" style="flex:1" value="${esc(q.answer || '')}" placeholder="Write answer..." data-adm-qa-inp="${esc(productId)}::${esc(q.id)}" />
            <button type="button" class="btn btn-primary btn-xs" data-adm-qa-save="${esc(productId)}::${esc(q.id)}">Reply</button>
          </div>
        </div>
      `).join('')
      : '<div class="muted-note">No customer questions on this product yet.</div>';
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `products/${productId}/questions`);
    body.innerHTML = '<div class="alert-box alert-error">Failed to load questions.</div>';
  }
}

async function openReviewsModal(productId) {
  const p = state.products.find((x) => x.id === productId);
  const modal = document.getElementById('order-detail-modal');
  const title = document.getElementById('odm-title');
  const body = document.getElementById('odm-body');
  if (!modal || !title || !body) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  releaseAdmOrderLock();
  document.getElementById('odm-print-btn')?.classList.add('hidden');
  title.textContent = `Reviews — ${p?.title || productId}`;
  body.innerHTML = '<div class="muted-note">Loading reviews...</div>';
  modal.classList.remove('hidden');

  try {
    const snap = await getDocs(collection(db, 'products', productId, 'reviews'));
    const revs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    body.innerHTML = revs.length
      ? revs.map((r) => `
        <div class="ticket-card" style="margin-bottom:10px;">
          <div class="ticket-head">
            <div><strong>${esc(r.userName)}</strong> <span class="cell-sub">(${'★'.repeat(Number(r.rating || 5))})${r.isVerifiedBuyer ? ' · ✔ Verified Buyer' : ''}</span></div>
            <button type="button" class="btn btn-danger btn-xs" data-adm-del-rev="${esc(productId)}::${esc(r.id)}">Delete</button>
          </div>
          <div style="font-size:13px;">${esc(r.comment)}</div>
          ${r.photoUrl ? `<a href="${esc(r.photoUrl)}" target="_blank" rel="noopener"><img src="${esc(r.photoUrl)}" alt="Review photo" class="return-photo-thumb" style="margin-top:6px;" /></a>` : ''}
          <div class="cell-sub" style="margin-top:4px;">${fmtTime(r.createdAt)}</div>
        </div>
      `).join('')
      : '<div class="muted-note">No customer reviews for this product yet.</div>';
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `products/${productId}/reviews`);
    body.innerHTML = '<div class="alert-box alert-error">Failed to load reviews.</div>';
  }
}

function openAssetPicker(targetInputId) {
  assetPickerTargetId = targetInputId;
  const modal = document.getElementById('asset-picker-modal');
  document.getElementById('apm-grid').innerHTML = STUDIO_ASSETS.map((a) => `
    <button type="button" class="asset-item" data-choose-asset="${esc(a.url)}">
      <img src="${esc(a.url)}" alt="${esc(a.label)}" />
      <span>${esc(a.label)}</span>
    </button>
  `).join('');
  modal.classList.remove('hidden');
}

function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function parseCsvRows(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function toMillisSafe(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function buildProfitSvgChart(series) {
  if (!series.length) return '<div class="muted-note">No chart data available.</div>';
  const maxVal = Math.max(100, ...series.map((d) => Math.max(d.rev, d.cost, Math.abs(d.profit))));
  const barGroupW = 54;
  const padL = 16;
  const padB = 28;
  const chartH = 140;
  const svgW = Math.max(540, padL * 2 + series.length * barGroupW);
  const svgH = chartH + padB + 26;
  const bars = series.map((d, idx) => {
    const gx = padL + idx * barGroupW;
    const revH = Math.round((Math.max(0, d.rev) / maxVal) * chartH);
    const costH = Math.round((Math.max(0, d.cost) / maxVal) * chartH);
    const profH = Math.round((Math.max(0, d.profit) / maxVal) * chartH);
    return `
      <g>
        <rect x="${gx + 4}" y="${16 + chartH - revH}" width="11" height="${revH}" rx="2" fill="#38bdf8"><title>${esc(d.label)} Rev: ${money(d.rev)}</title></rect>
        <rect x="${gx + 17}" y="${16 + chartH - costH}" width="11" height="${costH}" rx="2" fill="#f59e0b"><title>${esc(d.label)} COGS: ${money(d.cost)}</title></rect>
        <rect x="${gx + 30}" y="${16 + chartH - profH}" width="11" height="${profH}" rx="2" fill="#22c55e"><title>${esc(d.label)} Profit: ${money(d.profit)}</title></rect>
        <text x="${gx + 22}" y="${16 + chartH + 14}" fill="#94a3b8" font-size="9" text-anchor="middle">${esc(d.label)}</text>
      </g>
    `;
  }).join('');
  return `
    <div style="display:flex;gap:14px;font-size:11.5px;margin-bottom:6px;flex-wrap:wrap;">
      <span><span style="display:inline-block;width:9px;height:9px;background:#38bdf8;border-radius:2px;margin-right:4px;"></span>Revenue</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#f59e0b;border-radius:2px;margin-right:4px;"></span>COGS</span>
      <span><span style="display:inline-block;width:9px;height:9px;background:#22c55e;border-radius:2px;margin-right:4px;"></span>Net Profit</span>
    </div>
    <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH}" style="min-width:480px;display:block;">
      <line x1="${padL}" y1="${16 + chartH}" x2="${svgW - padL}" y2="${16 + chartH}" stroke="rgba(148,163,184,0.28)" stroke-width="1" />
      ${bars}
    </svg>
  `;
}

function renderAdmOrderLockBanner(data) {
  const banner = document.getElementById('adm-order-lock-banner');
  if (!banner) return;
  if (!data || !activeAdmOrderLockKey) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  if (data.lockedByOther) {
    const holder = data.lock?.lockedByName || data.lock?.lockedByEmail || 'Another Admin';
    banner.className = 'lock-banner warning no-print';
    banner.innerHTML = `
      <span>🔒 Currently locked by <strong>${esc(holder)}</strong> to prevent duplicate processing.</span>
      <button type="button" class="btn btn-outline btn-xs" id="adm-takeover-lock-btn">Take Over Lock</button>
    `;
  } else {
    banner.className = 'lock-banner self no-print';
    banner.innerHTML = '<span>🟢 Order Lock Active (You) · Safe from concurrent edits</span>';
  }
}

async function acquireAdmOrderLock(orderKey, action = 'acquire') {
  if (!currentUser || !orderKey) return;
  if (activeAdmOrderLockKey && activeAdmOrderLockKey !== orderKey && action === 'acquire') {
    await releaseAdmOrderLock();
  }
  activeAdmOrderLockKey = orderKey;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/orders/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderKey, action })
    });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    if (activeAdmOrderLockKey === orderKey) renderAdmOrderLockBanner(data);
  } catch {}
}

async function releaseAdmOrderLock() {
  const key = activeAdmOrderLockKey;
  activeAdmOrderLockKey = '';
  renderAdmOrderLockBanner(null);
  if (!key || !currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    await fetch('/api/orders/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderKey: key, action: 'release' })
    });
  } catch {}
}

async function loadAdmResellerWithdrawals() {
  if (!currentUser || !canSeeView('users')) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/reseller/withdrawals', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.resellerWithdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
    renderAdmResellerWithdrawals();
  } catch {}
}

function renderAdmResellerWithdrawals() {
  const tbody = document.getElementById('adm-reseller-withdrawals-tbody');
  if (!tbody) return;
  const list = state.resellerWithdrawals || [];
  tbody.innerHTML = list.length
    ? list.map((wd) => `
      <tr>
        <td>
          <strong>${esc(wd.name || 'Reseller')}</strong>
          <div class="cell-sub">${esc(wd.email || wd.uid)} · ${fmtTime(wd.createdAt)}</div>
        </td>
        <td class="tabular-nums"><strong>${money(wd.amountBdt || 0)}</strong></td>
        <td><strong>${esc(String(wd.method || '').toUpperCase())}</strong><div class="cell-sub">${esc(wd.accountNumber || '—')}</div></td>
        <td><span class="status-pill badge-${esc(wd.status || 'pending')}">${esc(wd.status || 'pending')}</span></td>
        <td>
          ${wd.status === 'pending' ? `
            <div class="inline-actions">
              <input type="text" class="inline-input" style="width:110px" placeholder="Note..." data-adm-rwd-note="${esc(wd.id)}" />
              <button type="button" class="btn btn-primary btn-xs" data-adm-rwd-act="approve" data-rwd-id="${esc(wd.id)}">Approve</button>
              <button type="button" class="btn btn-danger btn-xs" data-adm-rwd-act="reject" data-rwd-id="${esc(wd.id)}">Reject</button>
            </div>
          ` : `<div class="cell-sub">${esc(wd.adminNote || 'Reviewed')}</div>`}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No reseller withdrawal requests yet.</td></tr>';
}

async function loadAdmSupportChats() {
  if (!currentUser || !canSeeView('tickets')) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch('/api/support/chat?scope=all', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.supportChats = Array.isArray(data.threads) ? data.threads : [];
    renderAdmSupportChats();
  } catch {}
}

function renderAdmSupportChats() {
  const wrap = document.getElementById('adm-support-chats-list');
  if (!wrap) return;
  const list = state.supportChats || [];
  wrap.innerHTML = list.length
    ? list.map((th) => `
      <div class="chat-thread-card">
        <div class="ticket-head">
          <div>
            <strong>${esc(th.customerName || 'Guest Customer')}</strong>
            <div class="cell-sub">${esc(th.customerEmail || th.threadKey)} · ${fmtTime(th.updatedAt)}</div>
          </div>
          <span class="status-pill badge-confirmed">${(th.messages || []).length} msgs</span>
        </div>
        <div class="chat-thread-msgs">
          ${(th.messages || []).slice(-12).map((m) => `
            <div class="chat-bubble ${m.senderRole && m.senderRole !== 'customer' && m.senderRole !== 'user' ? 'staff' : ''}">
              <div class="chat-meta">${esc(m.senderName || m.senderRole || 'User')} · ${fmtTime(m.createdAt)}</div>
              <div>${esc(m.text)}</div>
            </div>
          `).join('') || '<div class="muted-note">No messages yet.</div>'}
        </div>
        <div class="ticket-reply-row">
          <input type="text" class="inline-input" style="flex:1;min-width:190px;" placeholder="Reply to customer..." data-adm-chat-inp="${esc(th.threadKey)}" />
          <button type="button" class="btn btn-primary btn-sm" data-adm-chat-send="${esc(th.threadKey)}">Send Reply</button>
        </div>
      </div>
    `).join('')
    : '<div class="muted-note">No pre-purchase live support conversations yet.</div>';
}

async function loadAdmFaqs() {
  try {
    const res = await fetch('/api/support/faq');
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.faqs = Array.isArray(data.faqs) ? data.faqs : [];
    renderAdmFaqs();
  } catch {}
}

function renderAdmFaqs() {
  const wrap = document.getElementById('adm-faqs-list');
  if (!wrap) return;
  const list = state.faqs || [];
  wrap.innerHTML = list.length
    ? list.map((f) => `
      <div class="faq-row">
        <div>
          <span class="status-pill badge-confirmed" style="margin-bottom:4px;">${esc(f.category || 'General')}</span>
          <div><strong>${esc(f.question)}</strong></div>
          <div class="cell-sub" style="margin-top:4px;white-space:pre-wrap;">${esc(f.answer)}</div>
        </div>
        <div class="inline-actions">
          <button type="button" class="btn btn-outline btn-xs" data-adm-faq-edit="${esc(f.id)}">Edit</button>
          <button type="button" class="btn btn-danger btn-xs" data-adm-faq-del="${esc(f.id)}">Del</button>
        </div>
      </div>
    `).join('')
    : '<div class="muted-note">No FAQ entries published yet.</div>';
}

function makeAdmLbRowHtml(row = {}) {
  return `
    <div class="lb-row">
      <input type="number" class="inline-input" data-lb-rank min="1" max="50" value="${Number(row.rank || 1)}" placeholder="#" />
      <input type="text" class="inline-input" data-lb-uid list="adm-tr-users-dl" value="${esc(row.uid || '')}" placeholder="User UID" />
      <input type="text" class="inline-input" data-lb-name value="${esc(row.name || '')}" placeholder="Player / Team Name" />
      <input type="text" class="inline-input" data-lb-gameuid value="${esc(row.gameUid || '')}" placeholder="In-Game UID" />
      <input type="number" class="inline-input" data-lb-kills min="0" value="${Number(row.kills || 0)}" placeholder="Kills" />
      <input type="number" class="inline-input" data-lb-prize min="0" value="${Number(row.prizeBdt || 0)}" placeholder="Prize ৳" />
      <button type="button" class="btn btn-danger btn-xs" data-adm-lb-rm>×</button>
    </div>
  `;
}

function openAdmTournamentLeaderboardModal(tournamentId) {
  const t = state.tournaments.find((x) => x.id === tournamentId);
  const modal = document.getElementById('order-detail-modal');
  const title = document.getElementById('odm-title');
  const body = document.getElementById('odm-body');
  if (!t || !modal || !title || !body) return;
  if (unsubAdmModalChat) { try { unsubAdmModalChat(); } catch {} unsubAdmModalChat = null; }
  releaseAdmOrderLock();
  document.body.classList.remove('printing-label');
  document.getElementById('odm-print-btn')?.classList.add('hidden');

  const joined = Array.isArray(t.joinedUids) ? t.joinedUids : [];
  const joinedUsers = state.users.filter((u) => joined.includes(u.id));
  const otherUsers = state.users.filter((u) => !joined.includes(u.id)).slice(0, 80);
  const dlOpts = [...joinedUsers, ...otherUsers].map((u) => {
    const cid = u.customerId || deriveClientNxId(u.id);
    const tag = joined.includes(u.id) ? '★ JOINED · ' : '';
    return `<option value="${esc(u.id)}">${esc(tag + (u.displayName || u.email || u.id))} (${esc(cid)})</option>`;
  }).join('');

  const rows = Array.isArray(t.leaderboard) && t.leaderboard.length
    ? t.leaderboard
    : [{ rank: 1, uid: joined[0] || '', name: '', gameUid: '', kills: 0, prizeBdt: Number(t.prizePoolBdt || 0) }];

  title.textContent = `🏆 Leaderboard & Prize Payout — ${t.title}`;
  body.innerHTML = `
    <datalist id="adm-tr-users-dl">${dlOpts}</datalist>
    <div class="detail-kv"><span>Mode &amp; Game</span><span>${esc(t.game)} · <strong style="text-transform:uppercase;">${esc(t.mode || 'solo')}</strong></span></div>
    <div class="detail-kv"><span>Prize Pool &amp; Joined</span><span>${money(t.prizePoolBdt || 0)} · ${joined.length} joined players ${t.prizesDistributed ? '· ✔ Prizes Paid' : ''}</span></div>
    <div style="margin:12px 0 6px;font-size:11.5px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;">
      <span>Rank | User UID | Winner Name | Game UID | Kills | Prize (৳)</span>
      <button type="button" id="adm-tr-lb-add" class="btn btn-outline btn-xs">+ Add Winner Row</button>
    </div>
    <div id="adm-tr-lb-rows">${rows.map((r) => makeAdmLbRowHtml(r)).join('')}</div>
    <div class="ops-action-box no-print" style="margin-top:14px;">
      <button type="button" id="adm-tr-lb-save" data-tr-id="${esc(t.id)}" class="btn btn-outline btn-sm">Save Leaderboard</button>
      <button type="button" id="adm-tr-lb-payout" data-tr-id="${esc(t.id)}" class="btn btn-primary btn-sm" ${t.prizesDistributed ? 'disabled' : ''}>
        ${t.prizesDistributed ? '✔ Prizes Already Distributed' : '💸 1-Click Distribute Prizes → Wallets'}
      </button>
    </div>
    <div id="adm-tr-proofs-wrap" class="chat-panel no-print" style="margin-top:14px;">
      <div class="panel-head" style="margin-bottom:6px;">
        <h4 style="margin:0;">📸 Match Result Screenshot Proofs</h4>
      </div>
      <div id="adm-tr-proofs-list" class="muted-note">Loading proofs...</div>
    </div>
  `;
  modal.classList.remove('hidden');
  loadAdmTournamentProofs(t.id);
}

async function loadAdmTournamentProofs(tournamentId) {
  const wrap = document.getElementById('adm-tr-proofs-list');
  if (!wrap || !currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`/api/tournaments/proofs?tournamentId=${encodeURIComponent(tournamentId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await parseApiJson(res, true);
    const proofs = Array.isArray(data?.proofs) ? data.proofs : [];
    if (!proofs.length) {
      wrap.innerHTML = '<div class="muted-note">No player result proofs submitted yet.</div>';
      return;
    }
    wrap.innerHTML = `<div class="proof-grid">${proofs.map((p) => `
      <div class="proof-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <strong>${esc(p.playerName || p.uid?.slice(0, 8))}</strong>
          <span class="status-pill ${p.status === 'approved' ? 'badge-delivered' : p.status === 'rejected' ? 'badge-cancelled' : 'badge-pending'}">${esc(p.status || 'pending')}</span>
        </div>
        <div class="cell-sub">IGN/UID: ${esc(p.gameUid || '—')} · Claimed: #${Number(p.rankClaimed || 1)} (${Number(p.kills || 0)} kills)</div>
        ${p.screenshotUrl ? `<a href="${esc(p.screenshotUrl)}" target="_blank" rel="noopener noreferrer"><img src="${esc(p.screenshotUrl)}" alt="Proof" class="proof-thumb" /></a>` : ''}
        ${p.note ? `<div class="cell-sub">${esc(p.note)}</div>` : ''}
        <div class="inline-actions" style="margin-top:4px;">
          <button type="button" class="btn btn-primary btn-xs" data-adm-proof-review="${esc(p.id)}::approve" data-proof-uid="${esc(p.uid)}" data-proof-tr="${esc(tournamentId)}">Approve</button>
          <button type="button" class="btn btn-danger btn-xs" data-adm-proof-review="${esc(p.id)}::reject" data-proof-uid="${esc(p.uid)}" data-proof-tr="${esc(tournamentId)}">Reject</button>
        </div>
      </div>
    `).join('')}</div>`;
  } catch {
    wrap.innerHTML = '<div class="muted-note">Could not load proofs.</div>';
  }
}

function collectAdmLbRows() {
  return Array.from(document.querySelectorAll('#adm-tr-lb-rows .lb-row')).map((row, idx) => {
    const rank = Math.max(1, parseInt(row.querySelector('[data-lb-rank]')?.value || String(idx + 1), 10));
    const uid = (row.querySelector('[data-lb-uid]')?.value || '').trim().slice(0, 128);
    const matched = state.users.find((u) => u.id === uid);
    const name = (row.querySelector('[data-lb-name]')?.value || matched?.displayName || '').trim().slice(0, 80);
    const gameUid = (row.querySelector('[data-lb-gameuid]')?.value || '').trim().slice(0, 60);
    const kills = Math.max(0, parseInt(row.querySelector('[data-lb-kills]')?.value || '0', 10));
    const prizeBdt = Math.max(0, Number(row.querySelector('[data-lb-prize]')?.value || 0));
    return { rank, uid, name, gameUid, kills, prizeBdt, points: kills * 2 + Math.max(0, 12 - rank) };
  }).filter((r) => r.name || r.uid || r.gameUid);
}

function exportOrdersCsv() {
  if (!state.orders.length) return showToast('No orders to export.');
  const rows = [['OrderNumber', 'Customer', 'Phone', 'Total', 'Method', 'PayStatus', 'Status', 'Tracking']];
  state.orders.forEach((o) => {
    rows.push([o.orderNumber || o.id, o.customerName || '', o.phone || '', o.totalBdt || 0, o.paymentMethod || '', o.paymentStatus || '', o.status || '', o.courierTracking || '']);
  });
  const csv = rows.map((r) => r.map((v) => csvCell(v)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `naxora-bd-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportProductsCsv() {
  if (!state.products.length) return showToast('No products to export.');
  const rows = [['title', 'subtitleBn', 'categoryId', 'priceBdt', 'compareAtBdt', 'costPriceBdt', 'stock', 'imageUrl', 'emiEligible', 'isFeatured', 'isActive']];
  state.products.forEach((p) => {
    rows.push([
      p.title || '',
      p.subtitleBn || '',
      p.categoryId || 'tech-gadgets',
      Number(p.priceBdt || 0),
      Number(p.compareAtBdt || 0),
      Number(p.costPriceBdt || 0),
      Number(p.stock || 0),
      p.imageUrl || '',
      p.emiEligible ? 'true' : 'false',
      p.isFeatured ? 'true' : 'false',
      p.isActive !== false ? 'true' : 'false'
    ]);
  });
  const csv = rows.map((r) => r.map((v) => csvCell(v)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `naxora-bd-products-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function pushAutoNotification(targetUid, title, body, type = 'order_update', refId = '') {
  if (!targetUid) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      targetUid,
      title: title.slice(0, 120),
      body: body.slice(0, 600),
      type,
      refId: String(refId || '').slice(0, 128),
      isRead: false,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp()
    });
  } catch (e) { handleFirestoreError(e, OperationType.CREATE, 'notifications'); }
}

function parsePackagesInput(raw) {
  return String(raw || '')
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((chunk) => {
      const idx = chunk.lastIndexOf(':');
      if (idx === -1) return { label: chunk.slice(0, 80), priceBdt: 100 };
      const label = chunk.slice(0, idx).trim().slice(0, 80) || 'Standard';
      const priceBdt = Math.max(1, Number(chunk.slice(idx + 1).trim()) || 100);
      return { label, priceBdt };
    });
}

function parseVariantDetailsInput(raw) {
  return String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 12).map((line) => {
    const [name, pr, st, img] = line.split('|').map((s) => s.trim());
    if (!name) return null;
    return {
      name: name.slice(0, 60),
      priceBdt: Math.max(0, Number(pr) || 0),
      stock: Math.max(0, parseInt(st || '0', 10) || 0),
      imageUrl: (img || '').slice(0, 500)
    };
  }).filter(Boolean);
}

async function notifyStockAlertsForProduct(productId, title, oldStock, newStock, oldPrice, newPrice) {
  const restocked = Number(oldStock || 0) <= 0 && Number(newStock || 0) > 0;
  const priceDropped = Number(oldPrice || 0) > 0 && Number(newPrice || 0) > 0 && Number(newPrice) < Number(oldPrice);
  if (!restocked && !priceDropped) return;
  const matching = state.stockAlerts.filter((a) => a.productId === productId && !a.notified);
  for (const al of matching) {
    if (!al.userId) continue;
    try {
      await pushAutoNotification(
        al.userId,
        restocked ? `🔔 Back in Stock: ${title}` : `🔥 Price Dropped: ${title}`,
        restocked ? `${title} এখন আবার স্টকে এসেছে! দ্রুত অর্ডার করুন।` : `${title} এর দাম কমে এখন ${money(newPrice)} হয়েছে!`,
        'stock_alert',
        productId
      );
      await updateDoc(doc(db, 'stockAlerts', al.id), { notified: true, updatedAt: serverTimestamp() });
    } catch {}
  }
}

/* ==================== EVENT BINDINGS ==================== */

function bindEvents() {
  document.getElementById('admin-menu-btn').addEventListener('click', () => toggleMobileSidebar(true));
  document.getElementById('admin-sidebar-close').addEventListener('click', () => toggleMobileSidebar(false));
  document.getElementById('admin-drawer-backdrop').addEventListener('click', () => toggleMobileSidebar(false));

  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-login-email').value.trim();
    const pass = document.getElementById('admin-login-password').value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      if (err.code === 'auth/operation-not-allowed') {
        showAuthError('Email/Password সাইন-ইন Firebase Console-এ চালু করা নেই। নিচে "Continue with Google" বাটনে ক্লিক করুন।');
      } else {
        showAuthError(err.message || 'Sign in failed.');
      }
    }
  });

  const runAdminGooglePopup = async (switchFirst = false) => {
    if (isGoogleSignInBusy) {
      showAuthNotice('Google Sign-In পপআপটি চালু আছে, অনুগ্রহ করে অপেক্ষা করুন।');
      return;
    }
    isGoogleSignInBusy = true;
    const gBtn = document.getElementById('admin-google-btn');
    const sBtn = document.getElementById('admin-switch-acct-btn');
    if (gBtn) gBtn.disabled = true;
    if (sBtn) sBtn.disabled = true;
    try {
      if (switchFirst && auth.currentUser) {
        await signOut(auth);
      }
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        showAuthNotice('Google সাইন-ইন পপআপ বন্ধ করা হয়েছে। লগইন করতে আবার বাটনে ক্লিক করুন।');
      } else if (code === 'auth/cancelled-popup-request') {
        showAuthNotice('আগের সাইন-ইন পপআপটি এখনো চালু আছে, একটু অপেক্ষা করুন।');
      } else if (code === 'auth/popup-blocked') {
        showAuthError('ব্রাউজার পপআপ ব্লক করেছে। পপআপ Allow করুন অথবা নতুন ট্যাবে ওপেন করে সাইন ইন করুন।');
      } else if (code === 'auth/unauthorized-domain') {
        showAuthError('এই ডোমেইনে Google Sign-In অনুমোদিত নয়। অনুগ্রহ করে নতুন ট্যাবে ওপেন করুন।');
      } else {
        showAuthError(err?.message || 'Google sign in failed.');
      }
    } finally {
      isGoogleSignInBusy = false;
      if (gBtn) gBtn.disabled = false;
      if (sBtn) sBtn.disabled = false;
    }
  };

  document.getElementById('admin-google-btn').addEventListener('click', () => runAdminGooglePopup(false));
  document.getElementById('admin-switch-acct-btn')?.addEventListener('click', () => runAdminGooglePopup(true));

  document.getElementById('admin-resend-verify-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      showAuthNotice('আপনার জিমেইল ইনবক্সে ভেরিফিকেশন লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে "I Verified — Continue" চাপুন।');
    } catch (err) { showAuthError(err.message); }
  });

  document.getElementById('admin-recheck-verify-btn').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    window.location.reload();
  });

  document.getElementById('admin-logout-btn').addEventListener('click', () => signOut(auth));

  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) { switchView(navBtn.dataset.view); return; }
    const jumpBtn = e.target.closest('[data-jump-view]');
    if (jumpBtn) { switchView(jumpBtn.dataset.jumpView); return; }
    const pickBtn = e.target.closest('[data-pick-asset]');
    if (pickBtn) { openAssetPicker(pickBtn.dataset.pickAsset); return; }
    const chooseAsset = e.target.closest('[data-choose-asset]');
    if (chooseAsset && assetPickerTargetId) {
      const target = document.getElementById(assetPickerTargetId);
      if (target) target.value = chooseAsset.dataset.chooseAsset;
      document.getElementById('asset-picker-modal').classList.add('hidden');
      assetPickerTargetId = null;
      return;
    }
    const inspOrd = e.target.closest('[data-inspect-order]');
    if (inspOrd) {
      const ord = state.orders.find((o) => o.id === inspOrd.dataset.inspectOrder);
      if (ord) openOrderInspectModal(ord, false);
      return;
    }
    const inspEm = e.target.closest('[data-inspect-em]');
    if (inspEm) {
      const eo = state.emarketOrders.find((o) => o.id === inspEm.dataset.inspectEm);
      if (eo) openOrderInspectModal(eo, true);
      return;
    }
  });

  document.getElementById('odm-close').addEventListener('click', closeOrderDetailModal);
  document.getElementById('odm-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('apm-close').addEventListener('click', () => document.getElementById('asset-picker-modal').classList.add('hidden'));

  document.getElementById('prod-search').addEventListener('input', renderProducts);
  document.getElementById('prod-cat-filter').addEventListener('change', renderProducts);
  document.getElementById('ord-search').addEventListener('input', renderOrders);
  document.getElementById('ord-status-filter').addEventListener('change', renderOrders);
  document.getElementById('ord-export-csv').addEventListener('click', exportOrdersCsv);
  document.getElementById('em-ord-search').addEventListener('input', renderEMarketOrders);
  document.getElementById('adm-wallet-search')?.addEventListener('input', renderWalletRequests);
  document.getElementById('adm-wallet-status')?.addEventListener('change', renderWalletRequests);
  document.getElementById('adm-u-search')?.addEventListener('input', renderUsersCrm);
  document.getElementById('adm-u-filter')?.addEventListener('change', renderUsersCrm);
  document.getElementById('adm-ret-filter')?.addEventListener('change', renderReturns);
  document.getElementById('tkt-status-filter').addEventListener('change', renderTickets);

  document.getElementById('adm-u-sync-ids')?.addEventListener('click', async () => {
    if (!currentUser || !canSeeView('users')) return;
    try {
      const token = await currentUser.getIdToken();
      const payloadUsers = state.users.map((u) => ({
        uid: u.id,
        email: u.email || '',
        displayName: u.displayName || '',
        customerId: u.customerId || ''
      }));
      const res = await fetch('/api/admin/users/sync-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ users: payloadUsers })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Sync failed.');
      const assignedMap = data.customerIds || {};
      let updatedCount = 0;
      for (const u of state.users) {
        const cid = assignedMap[u.id] || deriveClientNxId(u.id);
        if (!u.customerId || u.customerId !== cid) {
          await updateDoc(doc(db, 'users', u.id), { customerId: cid, updatedAt: serverTimestamp() }).catch(() => {});
          updatedCount++;
        }
      }
      showToast(`Assigned NX-IDs (${Object.keys(assignedMap).length} synced, ${updatedCount} updated)!`);
    } catch (err) { showToast(err.message || 'Sync error.'); }
  });

  document.getElementById('adm-pin-item')?.addEventListener('change', () => {
    const pkgSel = document.getElementById('adm-pin-pkg');
    const selected = state.emarketItems.find((it) => it.id === document.getElementById('adm-pin-item').value);
    const pkgs = Array.isArray(selected?.packages) ? selected.packages : [];
    if (pkgSel) {
      pkgSel.innerHTML = pkgs.length
        ? pkgs.map((pk) => `<option value="${esc(pk.label)}">${esc(pk.label)} (${money(pk.priceBdt)})</option>`).join('')
        : '<option value="">No packages</option>';
    }
  });
  document.getElementById('adm-pin-refresh')?.addEventListener('click', loadAdmEmPinsVault);
  document.getElementById('adm-prod-export-csv')?.addEventListener('click', exportProductsCsv);
  document.getElementById('adm-prod-import-btn')?.addEventListener('click', () => {
    if (!hasPerm('canCreateProduct')) return showToast('Product creation permission required.');
    document.getElementById('adm-prod-csv-file')?.click();
  });
  document.getElementById('adm-prod-csv-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !hasPerm('canCreateProduct')) return;
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (rows.length < 2) return showToast('CSV requires header + at least 1 product row.');
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const col = (r, name, def = '') => {
        const i = headers.indexOf(name.toLowerCase());
        return i >= 0 && r[i] !== undefined ? r[i] : def;
      };
      const parseBool = (val, defVal = false) => {
        const s = String(val ?? '').trim().toLowerCase();
        if (!s) return defVal;
        return ['true', '1', 'yes', 'y'].includes(s);
      };
      let imported = 0;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const title = col(r, 'title').trim().slice(0, 120);
        if (title.length < 2) continue;
        await addDoc(collection(db, 'products'), {
          title,
          subtitleBn: col(r, 'subtitlebn').trim().slice(0, 160),
          categoryId: col(r, 'categoryid', 'tech-gadgets').trim() || 'tech-gadgets',
          viralSource: '',
          priceBdt: Math.max(1, Number(col(r, 'pricebdt', '100')) || 100),
          compareAtBdt: Math.max(0, Number(col(r, 'compareatbdt', '0')) || 0),
          costPriceBdt: Math.max(0, Number(col(r, 'costpricebdt', '0')) || 0),
          stock: Math.max(0, parseInt(col(r, 'stock', '10'), 10) || 0),
          imageUrl: (col(r, 'imageurl') || DEFAULT_LOGO).trim().slice(0, 500),
          description: col(r, 'description').trim().slice(0, 1500),
          variants: [],
          variantDetails: [],
          fbtProductIds: [],
          emiEligible: parseBool(col(r, 'emieligible'), false),
          isFeatured: parseBool(col(r, 'isfeatured'), false),
          isFlashDrop: false,
          isActive: parseBool(col(r, 'isactive'), true),
          salesCount: 0,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        imported++;
      }
      showToast(`Imported ${imported} product(s) from CSV!`);
    } catch (err) { showToast(err.message || 'Product CSV import failed.'); }
  });

  document.getElementById('adm-pin-import-csv-btn')?.addEventListener('click', () => {
    if (!hasPerm('canManageEMarket')) return showToast('E-Market permission required.');
    document.getElementById('adm-pin-csv-file')?.click();
  });
  document.getElementById('adm-pin-csv-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentUser || !hasPerm('canManageEMarket')) return;
    try {
      const text = await file.text();
      const rows = parseCsvRows(text);
      if (rows.length < 2) return showToast('CSV requires header + at least 1 PIN row.');
      const headers = rows[0].map((h) => h.trim().toLowerCase());
      const iIdx = headers.indexOf('itemid');
      const pIdx = headers.indexOf('packagelabel');
      const cIdx = headers.indexOf('code');
      if (iIdx < 0 || pIdx < 0 || cIdx < 0) return showToast('CSV columns must include itemId,packageLabel,code');
      const batches = new Map();
      for (let i = 1; i < rows.length; i++) {
        const itemId = String(rows[i][iIdx] || '').trim();
        const packageLabel = String(rows[i][pIdx] || '').trim();
        const code = String(rows[i][cIdx] || '').trim();
        if (!itemId || !packageLabel || !code) continue;
        const k = `${itemId}:::${packageLabel}`;
        if (!batches.has(k)) batches.set(k, { itemId, packageLabel, codes: [] });
        batches.get(k).codes.push(code);
      }
      if (!batches.size) return showToast('No valid PIN rows found in CSV.');
      const token = await currentUser.getIdToken();
      let totalAdded = 0;
      for (const b of batches.values()) {
        const res = await fetch('/api/emarket/pins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ itemId: b.itemId, packageLabel: b.packageLabel, codes: b.codes.join('\n') })
        });
        const data = await parseApiJson(res);
        if (res.ok) totalAdded += Number(data.added || 0);
      }
      await loadAdmEmPinsVault();
      showToast(`Imported ${totalAdded} PIN(s) into vault!`);
    } catch (err) { showToast(err.message || 'PIN CSV import failed.'); }
  });

  document.getElementById('adm-rwd-refresh-btn')?.addEventListener('click', loadAdmResellerWithdrawals);
  document.getElementById('adm-chat-refresh-btn')?.addEventListener('click', loadAdmSupportChats);
  document.getElementById('adm-faq-reset')?.addEventListener('click', () => {
    document.getElementById('adm-faq-id').value = '';
    document.getElementById('adm-faq-form').reset();
    document.getElementById('adm-faq-reset').classList.add('hidden');
  });
  document.getElementById('adm-faq-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || (!canSeeView('tickets') && !hasPerm('canManageNotices'))) return showToast('Permission required.');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/support/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'upsert',
          id: document.getElementById('adm-faq-id').value.trim(),
          category: document.getElementById('adm-faq-cat').value.trim() || 'General',
          question: document.getElementById('adm-faq-q').value.trim(),
          answer: document.getElementById('adm-faq-a').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to save FAQ.');
      state.faqs = Array.isArray(data.faqs) ? data.faqs : state.faqs;
      renderAdmFaqs();
      document.getElementById('adm-faq-id').value = '';
      e.target.reset();
      document.getElementById('adm-faq-reset').classList.add('hidden');
      showToast('FAQ saved!');
    } catch (err) { showToast(err.message || 'FAQ save failed.'); }
  });

  document.getElementById('adm-em-pin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !hasPerm('canManageEMarket')) return showToast('Action not allowed.');
    const itemId = document.getElementById('adm-pin-item')?.value;
    const packageLabel = document.getElementById('adm-pin-pkg')?.value;
    const codes = document.getElementById('adm-pin-codes')?.value.trim();
    if (!itemId || !packageLabel || !codes) return showToast('Select service, package, and enter PIN codes.');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/emarket/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, packageLabel, codes })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to add PINs.');
      document.getElementById('adm-pin-codes').value = '';
      await loadAdmEmPinsVault();
      showToast(`Added ${data.added} PIN(s) to vault!`);
    } catch (err) { showToast(err.message || 'PIN upload failed.'); }
  });

  const resetProdForm = () => {
    document.getElementById('pf-id').value = '';
    document.getElementById('product-form').reset();
    document.getElementById('pf-form-title').textContent = 'Create New Product';
    document.getElementById('pf-reset-btn').classList.add('hidden');
    updatePfAdvDelivHint();
    syncNavPermissions();
  };
  ['pf-adv-deliv', 'pf-adv-deliv-fee', 'pf-deliv-dhaka', 'pf-deliv-outside'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', updatePfAdvDelivHint);
  });
  updatePfAdvDelivHint();
  document.getElementById('pf-reset-btn').addEventListener('click', resetProdForm);

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('pf-id').value;
    const prev = id ? state.products.find((x) => x.id === id) : null;
    const galleryUrls = String(document.getElementById('pf-gallery')?.value || '')
      .split(/[\n,]+/)
      .map((s) => s.trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 6);
    const variantDetails = parseVariantDetailsInput(document.getElementById('pf-variant-details')?.value || '');
    const variantsRaw = document.getElementById('pf-variants').value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
    const variants = variantsRaw.length ? variantsRaw : variantDetails.map((v) => v.name);
    const fbtProductIds = String(document.getElementById('pf-fbt')?.value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    const base = {
      title: document.getElementById('pf-title').value.trim().slice(0, 120),
      subtitleBn: document.getElementById('pf-subtitle').value.trim().slice(0, 160),
      categoryId: document.getElementById('pf-category').value || 'tech-gadgets',
      viralSource: document.getElementById('pf-source').value.trim().slice(0, 60),
      priceBdt: Math.max(1, Number(document.getElementById('pf-price').value) || 1),
      compareAtBdt: Math.max(0, Number(document.getElementById('pf-compare').value) || 0),
      costPriceBdt: Math.max(0, Number(document.getElementById('pf-cost')?.value) || 0),
      resellerPriceBdt: Math.max(0, Number(document.getElementById('pf-reseller-price')?.value) || 0),
      stock: Math.max(0, parseInt(document.getElementById('pf-stock').value, 10) || 0),
      salesCount: Math.max(0, parseInt(document.getElementById('pf-sales')?.value, 10) || 0),
      variants,
      variantDetails,
      fbtProductIds,
      emiEligible: document.getElementById('pf-emi')?.checked || false,
      requireAdvanceDelivery: document.getElementById('pf-adv-deliv')?.checked || false,
      advanceDeliveryFeeBdt: Math.min(50000, Math.max(0, Number(document.getElementById('pf-adv-deliv-fee')?.value) || 0)),
      deliveryInsideDhakaBdt: (() => { const v = String(document.getElementById('pf-deliv-dhaka')?.value ?? '').trim(); return v === '' ? -1 : Math.min(50000, Math.max(0, Number(v) || 0)); })(),
      deliveryOutsideDhakaBdt: (() => { const v = String(document.getElementById('pf-deliv-outside')?.value ?? '').trim(); return v === '' ? -1 : Math.min(50000, Math.max(0, Number(v) || 0)); })(),
      isPreOrder: document.getElementById('pf-preorder')?.checked || false,
      preOrderDepositPct: Math.min(100, Math.max(10, parseInt(document.getElementById('pf-preorder-pct')?.value, 10) || 30)),
      preOrderEta: (document.getElementById('pf-preorder-eta')?.value || '').trim().slice(0, 60),
      groupBuyEnabled: document.getElementById('pf-groupbuy')?.checked || false,
      groupBuyPriceBdt: Math.max(0, Number(document.getElementById('pf-groupbuy-price')?.value) || 0),
      groupBuySize: Math.min(10, Math.max(2, parseInt(document.getElementById('pf-groupbuy-size')?.value, 10) || 2)),
      imageUrl: document.getElementById('pf-image').value.trim().slice(0, 500),
      galleryUrls,
      videoUrl: String(document.getElementById('pf-video')?.value || '').trim().slice(0, 500),
      description: document.getElementById('pf-desc').value.trim().slice(0, 1500),
      isFeatured: document.getElementById('pf-featured').checked,
      isFlashDrop: document.getElementById('pf-flash').checked,
      isActive: document.getElementById('pf-active').checked,
      updatedAt: serverTimestamp()
    };

    try {
      if (id) {
        if (!hasPerm('canEditProduct')) return showToast('Action not allowed.');
        await updateDoc(doc(db, 'products', id), base);
        if (prev) {
          await notifyStockAlertsForProduct(id, base.title, prev.stock, base.stock, prev.priceBdt, base.priceBdt);
        }
        showToast('Product updated.');
      } else {
        if (!hasPerm('canCreateProduct')) return showToast('Action not allowed.');
        await addDoc(collection(db, 'products'), {
          ...base,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp()
        });
        showToast('Product created.');
      }
      resetProdForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
      showToast(err.message);
    }
  });

  document.addEventListener('click', async (e) => {
    const qs = e.target.closest('[data-quick-stock]');
    if (qs && hasPerm('canEditProduct')) {
      const prod = state.products.find((p) => p.id === qs.dataset.quickStock);
      if (!prod) return;
      const oldStock = Number(prod.stock || 0);
      const nextStock = Math.max(0, oldStock + parseInt(qs.dataset.delta, 10));
      try {
        await updateDoc(doc(db, 'products', prod.id), { stock: nextStock, updatedAt: serverTimestamp() });
        await notifyStockAlertsForProduct(prod.id, prod.title, oldStock, nextStock, prod.priceBdt, prod.priceBdt);
        showToast(`Stock updated: ${nextStock}`);
      } catch (err) { showToast(err.message); }
      return;
    }

    const editProd = e.target.closest('[data-edit-prod]');
    if (editProd && hasPerm('canEditProduct')) {
      const p = state.products.find((x) => x.id === editProd.dataset.editProd);
      if (!p) return;
      document.getElementById('pf-id').value = p.id;
      document.getElementById('pf-title').value = p.title || '';
      document.getElementById('pf-subtitle').value = p.subtitleBn || '';
      document.getElementById('pf-category').value = p.categoryId || '';
      document.getElementById('pf-source').value = p.viralSource || '';
      document.getElementById('pf-price').value = p.priceBdt || 1;
      document.getElementById('pf-compare').value = p.compareAtBdt || 0;
      if (document.getElementById('pf-cost')) document.getElementById('pf-cost').value = p.costPriceBdt || 0;
      if (document.getElementById('pf-reseller-price')) document.getElementById('pf-reseller-price').value = p.resellerPriceBdt || 0;
      if (document.getElementById('pf-preorder-eta')) document.getElementById('pf-preorder-eta').value = p.preOrderEta || '';
      if (document.getElementById('pf-preorder-pct')) document.getElementById('pf-preorder-pct').value = p.preOrderDepositPct || 30;
      if (document.getElementById('pf-groupbuy-price')) document.getElementById('pf-groupbuy-price').value = p.groupBuyPriceBdt || 0;
      if (document.getElementById('pf-groupbuy-size')) document.getElementById('pf-groupbuy-size').value = p.groupBuySize || 2;
      if (document.getElementById('pf-variant-details')) {
        document.getElementById('pf-variant-details').value = Array.isArray(p.variantDetails)
          ? p.variantDetails.map((vd) => `${vd.name} | ${vd.priceBdt} | ${vd.stock} | ${vd.imageUrl || ''}`).join('\n')
          : '';
      }
      if (document.getElementById('pf-preorder')) document.getElementById('pf-preorder').checked = !!p.isPreOrder;
      if (document.getElementById('pf-groupbuy')) document.getElementById('pf-groupbuy').checked = !!p.groupBuyEnabled;
      document.getElementById('pf-stock').value = p.stock || 0;
      if (document.getElementById('pf-sales')) document.getElementById('pf-sales').value = Number(p.salesCount || 0);
      document.getElementById('pf-variants').value = (p.variants || []).join(', ');
      document.getElementById('pf-image').value = p.imageUrl || '';
      if (document.getElementById('pf-gallery')) document.getElementById('pf-gallery').value = Array.isArray(p.galleryUrls) ? p.galleryUrls.join(', ') : '';
      if (document.getElementById('pf-video')) document.getElementById('pf-video').value = p.videoUrl || '';
      document.getElementById('pf-desc').value = p.description || '';
      if (document.getElementById('pf-fbt')) document.getElementById('pf-fbt').value = Array.isArray(p.fbtProductIds) ? p.fbtProductIds.join(', ') : '';
      if (document.getElementById('pf-emi')) document.getElementById('pf-emi').checked = !!p.emiEligible;
      if (document.getElementById('pf-adv-deliv')) document.getElementById('pf-adv-deliv').checked = !!p.requireAdvanceDelivery;
      if (document.getElementById('pf-adv-deliv-fee')) document.getElementById('pf-adv-deliv-fee').value = Number(p.advanceDeliveryFeeBdt || 0);
      if (document.getElementById('pf-deliv-dhaka')) document.getElementById('pf-deliv-dhaka').value = (p.deliveryInsideDhakaBdt !== undefined && p.deliveryInsideDhakaBdt !== null && Number(p.deliveryInsideDhakaBdt) >= 0) ? Number(p.deliveryInsideDhakaBdt) : '';
      if (document.getElementById('pf-deliv-outside')) document.getElementById('pf-deliv-outside').value = (p.deliveryOutsideDhakaBdt !== undefined && p.deliveryOutsideDhakaBdt !== null && Number(p.deliveryOutsideDhakaBdt) >= 0) ? Number(p.deliveryOutsideDhakaBdt) : '';
      document.getElementById('pf-featured').checked = !!p.isFeatured;
      document.getElementById('pf-flash').checked = !!p.isFlashDrop;
      document.getElementById('pf-active').checked = p.isActive !== false;
      document.getElementById('pf-form-title').textContent = `Edit: ${p.title}`;
      document.getElementById('pf-reset-btn').classList.remove('hidden');
      updatePfAdvDelivHint();
      syncNavPermissions();
      switchView('products');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const delProd = e.target.closest('[data-del-prod]');
    if (delProd && hasPerm('canDeleteProduct')) {
      try { await deleteDoc(doc(db, 'products', delProd.dataset.delProd)); showToast('Product deleted.'); } catch (err) { showToast(err.message); }
      return;
    }

    const saveTrack = e.target.closest('[data-save-track]');
    if (saveTrack && hasPerm('canManageOrders')) {
      const id = saveTrack.dataset.saveTrack;
      const inp = document.querySelector(`[data-track-input="${id}"]`);
      const tracking = (inp?.value.trim() || '').slice(0, 80);
      try {
        await updateDoc(doc(db, 'orders', id), { courierTracking: tracking, handledBy: currentUser.uid, handledByEmail: currentUser.email || '', updatedAt: serverTimestamp() });
        const ord = state.orders.find((o) => o.id === id);
        if (ord) {
          fetch('/api/orders/sync-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify({ orderNumber: ord.orderNumber || id.slice(0, 8), phone: ord.phone, status: ord.status, paymentStatus: ord.paymentStatus, courierTracking: tracking, totalBdt: ord.totalBdt })
          }).catch(() => {});
        }
        showToast('Tracking updated.');
      } catch (err) { showToast(err.message); }
      return;
    }

    const labelOrd = e.target.closest('[data-adm-label]');
    if (labelOrd && hasPerm('canManageOrders')) {
      const ord = state.orders.find((o) => o.id === labelOrd.dataset.admLabel);
      if (ord) openThermalLabelModal(ord);
      return;
    }

    const revBtn = e.target.closest('[data-adm-reviews]');
    if (revBtn && canSeeView('products')) { openReviewsModal(revBtn.dataset.admReviews); return; }

    const qaBtn = e.target.closest('[data-adm-qa]');
    if (qaBtn && canSeeView('products')) { openQaModal(qaBtn.dataset.admQa); return; }

    const saveQa = e.target.closest('[data-adm-qa-save]');
    if (saveQa && hasPerm('canEditProduct')) {
      const [prodId, qId] = saveQa.dataset.admQaSave.split('::');
      const ans = (document.querySelector(`[data-adm-qa-inp="${prodId}::${qId}"]`)?.value.trim() || '').slice(0, 800);
      if (!ans) return showToast('Enter an answer first.');
      try {
        await updateDoc(doc(db, 'products', prodId, 'questions', qId), {
          answer: ans,
          answeredBy: String(currentUser.email || currentUser.uid).slice(0, 128),
          answeredAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showToast('Q&A reply published!');
        openQaModal(prodId);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `products/${prodId}/questions/${qId}`);
        showToast(err.message || 'Q&A reply failed.');
      }
      return;
    }

    const delQa = e.target.closest('[data-adm-del-qa]');
    if (delQa && hasPerm('canEditProduct')) {
      const [prodId, qId] = delQa.dataset.admDelQa.split('::');
      await deleteDoc(doc(db, 'products', prodId, 'questions', qId));
      showToast('Question removed.');
      openQaModal(prodId);
      return;
    }

    const delRev = e.target.closest('[data-adm-del-rev]');
    if (delRev && hasPerm('canEditProduct')) {
      const [prodId, revId] = delRev.dataset.admDelRev.split('::');
      await deleteDoc(doc(db, 'products', prodId, 'reviews', revId));
      showToast('Review removed.');
      openReviewsModal(prodId);
      return;
    }

    const saveEmCode = e.target.closest('[data-save-em-code]');
    if (saveEmCode && hasPerm('canManageEMarket')) {
      const id = saveEmCode.dataset.saveEmCode;
      const inp = document.querySelector(`[data-em-code-input="${id}"]`);
      try {
        await updateDoc(doc(db, 'emarketOrders', id), { deliveryCode: (inp?.value.trim() || '').slice(0, 300), handledBy: currentUser.uid, handledByEmail: currentUser.email || '', updatedAt: serverTimestamp() });
        showToast('Delivery code saved.');
      } catch (err) { showToast(err.message); }
      return;
    }

    const editEm = e.target.closest('[data-edit-em]');
    if (editEm && hasPerm('canManageEMarket')) {
      const it = state.emarketItems.find((x) => x.id === editEm.dataset.editEm);
      if (!it) return;
      document.getElementById('adm-em-id').value = it.id;
      document.getElementById('adm-em-title').value = it.title || '';
      document.getElementById('adm-em-cat').value = it.category || 'game_topup';
      document.getElementById('adm-em-sub').value = it.subtitleBn || '';
      document.getElementById('adm-em-eta').value = it.deliveryEta || '';
      if (document.getElementById('adm-em-cost')) document.getElementById('adm-em-cost').value = it.costPriceBdt || 0;
      if (document.getElementById('adm-em-renewal-days')) document.getElementById('adm-em-renewal-days').value = it.renewalDays || 0;
      if (document.getElementById('adm-em-sales')) document.getElementById('adm-em-sales').value = Number(it.salesCount || 0);
      document.getElementById('adm-em-prompt').value = it.inputLabel || '';
      document.getElementById('adm-em-placeholder').value = it.inputPlaceholder || '';
      document.getElementById('adm-em-packages').value = (it.packages || []).map((p) => `${p.label}:${p.priceBdt}`).join(', ');
      document.getElementById('adm-em-img').value = it.imageUrl || '';
      document.getElementById('adm-em-desc').value = it.description || '';
      document.getElementById('adm-em-active').checked = it.isActive !== false;
      document.getElementById('adm-em-reset').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const delEm = e.target.closest('[data-del-em]');
    if (delEm && hasPerm('canManageEMarket')) {
      try { await deleteDoc(doc(db, 'emarketItems', delEm.dataset.delEm)); showToast('Service deleted.'); } catch (err) { showToast(err.message); }
      return;
    }

    const delPin = e.target.closest('[data-adm-del-pin]');
    if (delPin && currentUser && hasPerm('canManageEMarket')) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/emarket/pins/${encodeURIComponent(delPin.dataset.admDelPin)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Failed to delete PIN.');
        await loadAdmEmPinsVault();
        showToast('PIN removed from vault.');
      } catch (err) { showToast(err.message || 'Delete failed.'); }
      return;
    }

    const bookCourier = e.target.closest('[data-adm-book-courier]');
    if (bookCourier && currentUser && hasPerm('canManageOrders')) {
      const orderId = bookCourier.dataset.admBookCourier;
      const existingOrd = state.orders.find((o) => o.id === orderId);
      if (!isOwner && existingOrd && ['delivered', 'cancelled'].includes(existingOrd.status)) {
        return showToast('Finalized orders can only be updated by Main Admin.');
      }
      const prov = document.getElementById('adm-courier-book-prov')?.value || '';
      bookCourier.disabled = true;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/courier/book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderId, provider: prov })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Courier booking failed.');
        await updateDoc(doc(db, 'orders', orderId), {
          courierProvider: String(data.provider || prov || 'courier').slice(0, 40),
          courierTracking: String(data.trackingCode || '').slice(0, 80),
          status: 'shipped',
          updatedAt: serverTimestamp()
        });
        if (existingOrd?.userId) {
          await pushAutoNotification(
            existingOrd.userId,
            `Order #${existingOrd.orderNumber || orderId.slice(0, 8)} Shipped`,
            `আপনার অর্ডারটি ${String(data.provider || 'Courier').toUpperCase()} এর মাধ্যমে পাঠানো হয়েছে। Tracking: ${data.trackingCode}`,
            'order_update',
            orderId
          );
        }
        try {
          await addDoc(collection(db, 'auditLogs'), {
            actorUid: currentUser.uid,
            actorEmail: currentUser.email || '',
            actorRole: isOwner ? 'main_admin' : 'admin',
            action: 'BOOK_COURIER',
            target: `${orderId} · ${data.provider}:${data.trackingCode}`,
            createdAt: serverTimestamp()
          });
        } catch {}
        showToast(`Courier booked (${data.mode}): ${data.trackingCode}`);
        if (existingOrd) openOrderInspectModal({ ...existingOrd, courierProvider: data.provider, courierTracking: data.trackingCode, status: 'shipped' }, false);
      } catch (err) {
        showToast(err.message || 'Courier booking error.');
      } finally {
        bookCourier.disabled = false;
      }
      return;
    }

    const refundOrd = e.target.closest('[data-adm-refund-order]');
    if (refundOrd && currentUser && hasPerm('canManageOrders')) {
      const orderId = refundOrd.dataset.admRefundOrder;
      refundOrd.disabled = true;
      try {
        const res = await runTransaction(db, async (tx) => {
          const oRef = doc(db, 'orders', orderId);
          const oSnap = await tx.get(oRef);
          if (!oSnap.exists()) throw new Error('Order not found.');
          const oData = oSnap.data();
          if (!isOwner && ['delivered', 'cancelled'].includes(oData.status)) throw new Error('Finalized order cannot be modified.');
          if (oData.paymentStatus === 'refunded') throw new Error('Order already refunded.');
          const amt = Math.max(0, Number(oData.totalBdt || 0));
          if (!oData.userId || amt <= 0) throw new Error('No customer account or amount to refund.');
          const uRef = doc(db, 'users', oData.userId);
          const uSnap = await tx.get(uRef);
          if (!uSnap.exists()) throw new Error('Customer profile not found.');
          const nextBal = Math.min(5000000, Math.round((Number(uSnap.data()?.walletBalanceBdt || 0) + amt) * 100) / 100);
          tx.update(uRef, { walletBalanceBdt: nextBal, updatedAt: serverTimestamp() });
          tx.update(oRef, { status: 'cancelled', paymentStatus: 'refunded', updatedAt: serverTimestamp() });
          return { userId: oData.userId, amt, nextBal, orderNumber: oData.orderNumber || orderId.slice(0, 8) };
        });
        await pushAutoNotification(
          res.userId,
          `অর্ডার #${res.orderNumber} ওয়ালেটে রিফান্ড (+${money(res.amt)})`,
          `আপনার ${money(res.amt)} কাস্টমার ওয়ালেটে রিফান্ড করা হয়েছে। নতুন ব্যালেন্স: ${money(res.nextBal)}।`,
          'wallet_refund',
          orderId
        );
        try {
          await addDoc(collection(db, 'auditLogs'), {
            actorUid: currentUser.uid,
            actorEmail: currentUser.email || '',
            actorRole: isOwner ? 'main_admin' : 'admin',
            action: 'REFUND_ORDER_TO_WALLET',
            target: `${orderId} (+${res.amt})`,
            createdAt: serverTimestamp()
          });
        } catch {}
        showToast(`Refunded ${money(res.amt)} to customer wallet!`);
        const updatedOrd = state.orders.find((o) => o.id === orderId);
        if (updatedOrd) openOrderInspectModal({ ...updatedOrd, status: 'cancelled', paymentStatus: 'refunded' }, false);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
        showToast(err.message || 'Refund failed.');
      } finally {
        refundOrd.disabled = false;
      }
      return;
    }

    const refundEm = e.target.closest('[data-adm-refund-em]');
    if (refundEm && currentUser && hasPerm('canManageEMarket')) {
      const orderId = refundEm.dataset.admRefundEm;
      refundEm.disabled = true;
      try {
        const res = await runTransaction(db, async (tx) => {
          const oRef = doc(db, 'emarketOrders', orderId);
          const oSnap = await tx.get(oRef);
          if (!oSnap.exists()) throw new Error('E-Market order not found.');
          const oData = oSnap.data();
          if (!isOwner && ['completed', 'cancelled'].includes(oData.status)) throw new Error('Finalized E-Market order cannot be modified.');
          if (oData.paymentStatus === 'refunded') throw new Error('Order already refunded.');
          const amt = Math.max(0, Number(oData.totalBdt || oData.priceBdt || 0));
          if (!oData.userId || amt <= 0) throw new Error('No customer account or amount to refund.');
          const uRef = doc(db, 'users', oData.userId);
          const uSnap = await tx.get(uRef);
          if (!uSnap.exists()) throw new Error('Customer profile not found.');
          const nextBal = Math.min(5000000, Math.round((Number(uSnap.data()?.walletBalanceBdt || 0) + amt) * 100) / 100);
          tx.update(uRef, { walletBalanceBdt: nextBal, updatedAt: serverTimestamp() });
          tx.update(oRef, { status: 'cancelled', paymentStatus: 'refunded', updatedAt: serverTimestamp() });
          return { userId: oData.userId, amt, nextBal, orderNumber: oData.orderNumber || orderId.slice(0, 8) };
        });
        await pushAutoNotification(
          res.userId,
          `E-Market #${res.orderNumber} ওয়ালেটে রিফান্ড (+${money(res.amt)})`,
          `আপনার ${money(res.amt)} কাস্টমার ওয়ালেটে রিফান্ড করা হয়েছে। নতুন ব্যালেন্স: ${money(res.nextBal)}।`,
          'wallet_refund',
          orderId
        );
        try {
          await addDoc(collection(db, 'auditLogs'), {
            actorUid: currentUser.uid,
            actorEmail: currentUser.email || '',
            actorRole: isOwner ? 'main_admin' : 'admin',
            action: 'REFUND_EMARKET_TO_WALLET',
            target: `${orderId} (+${res.amt})`,
            createdAt: serverTimestamp()
          });
        } catch {}
        showToast(`Refunded ${money(res.amt)} to customer wallet!`);
        const updatedEo = state.emarketOrders.find((o) => o.id === orderId);
        if (updatedEo) openOrderInspectModal({ ...updatedEo, status: 'cancelled', paymentStatus: 'refunded' }, true);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `emarketOrders/${orderId}`);
        showToast(err.message || 'Refund failed.');
      } finally {
        refundEm.disabled = false;
      }
      return;
    }

    const tglSlider = e.target.closest('[data-toggle-slider]');
    if (tglSlider && hasPerm('canManageSliders')) {
      const s = state.sliders.find((x) => x.id === tglSlider.dataset.toggleSlider);
      if (s) {
        await updateDoc(doc(db, 'sliders', s.id), { isActive: s.isActive === false, updatedAt: serverTimestamp() });
        showToast('Slider updated.');
      }
      return;
    }
    const delSlider = e.target.closest('[data-del-slider]');
    if (delSlider && hasPerm('canManageSliders')) {
      await deleteDoc(doc(db, 'sliders', delSlider.dataset.delSlider));
      showToast('Slider deleted.');
      return;
    }

    const tglNotice = e.target.closest('[data-toggle-notice]');
    if (tglNotice && hasPerm('canManageNotices')) {
      const n = state.notices.find((x) => x.id === tglNotice.dataset.toggleNotice);
      if (n) {
        await updateDoc(doc(db, 'notices', n.id), { isActive: n.isActive === false, updatedAt: serverTimestamp() });
        showToast('Notice updated.');
      }
      return;
    }
    const delNotice = e.target.closest('[data-del-notice]');
    if (delNotice && hasPerm('canManageNotices')) {
      await deleteDoc(doc(db, 'notices', delNotice.dataset.delNotice));
      showToast('Notice deleted.');
      return;
    }

    const delNotif = e.target.closest('[data-del-notif]');
    if (delNotif && hasPerm('canSendNotifications')) {
      await deleteDoc(doc(db, 'notifications', delNotif.dataset.delNotif));
      showToast('Notification deleted.');
      return;
    }

    const pickIconBtn = e.target.closest('[data-pick-icon]');
    if (pickIconBtn) {
      const wrap = pickIconBtn.closest('[data-icon-target]');
      const inp = wrap ? document.getElementById(wrap.dataset.iconTarget) : null;
      if (inp) {
        inp.value = pickIconBtn.dataset.pickIcon || '';
        wrap.querySelectorAll('.icon-preset-btn').forEach((b) => b.classList.toggle('active', b === pickIconBtn));
        inp.focus();
      }
      return;
    }

    const editCat = e.target.closest('[data-edit-cat]');
    if (editCat && hasPerm('canManageCategories')) {
      const c = state.categories.find((x) => x.id === editCat.dataset.editCat);
      if (!c) return;
      document.getElementById('adm-cat-slug').value = c.slug || c.id || '';
      document.getElementById('adm-cat-en').value = c.nameEn || '';
      document.getElementById('adm-cat-bn').value = c.nameBn || '';
      document.getElementById('adm-cat-order').value = Number(c.sortOrder || 1);
      const iconInp = document.getElementById('adm-cat-icon');
      if (iconInp) iconInp.value = c.icon || '';
      document.querySelectorAll('[data-icon-target="adm-cat-icon"] .icon-preset-btn').forEach((b) => b.classList.toggle('active', (c.icon || '') === b.dataset.pickIcon));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const delCat = e.target.closest('[data-del-cat]');
    if (delCat && hasPerm('canManageCategories')) {
      await deleteDoc(doc(db, 'categories', delCat.dataset.delCat));
      showToast('Category deleted.');
      return;
    }

    const tglCoupon = e.target.closest('[data-toggle-coupon]');
    if (tglCoupon && hasPerm('canManageCoupons')) {
      const c = state.coupons.find((x) => x.id === tglCoupon.dataset.toggleCoupon);
      if (c) {
        await updateDoc(doc(db, 'coupons', c.id), { isActive: c.isActive === false, updatedAt: serverTimestamp() });
        showToast('Coupon updated.');
      }
      return;
    }
    const delCoupon = e.target.closest('[data-del-coupon]');
    if (delCoupon && hasPerm('canManageCoupons')) {
      await deleteDoc(doc(db, 'coupons', delCoupon.dataset.delCoupon));
      showToast('Coupon deleted.');
      return;
    }

    const saveTkt = e.target.closest('[data-save-tkt]');
    if (saveTkt && hasPerm('canReplyTickets')) {
      const id = saveTkt.dataset.saveTkt;
      const tkt = state.tickets.find((x) => x.id === id);
      const replyInp = document.querySelector(`[data-tkt-reply="${id}"]`);
      const stSel = document.querySelector(`[data-tkt-status="${id}"]`);
      try {
        await updateDoc(doc(db, 'tickets', id), {
          adminReply: (replyInp?.value.trim() || '').slice(0, 1000),
          status: stSel?.value || 'in_progress',
          updatedAt: serverTimestamp()
        });
        if (tkt?.userId) {
          await pushAutoNotification(tkt.userId, `Support Reply: ${tkt.subject}`, replyInp?.value.trim() || 'আপনার সাপোর্ট টিকিটে উত্তর দেওয়া হয়েছে।', 'ticket_reply', id);
        }
        showToast('Ticket reply sent.');
      } catch (err) { showToast(err.message); }
      return;
    }

    const wApprove = e.target.closest('[data-adm-wapprove]');
    if (wApprove && hasPerm('canManageOrders')) {
      const reqId = wApprove.dataset.admWapprove;
      const noteInp = document.querySelector(`[data-adm-wnote="${reqId}"]`);
      const adminNote = (noteInp?.value.trim() || 'Verified & Credited by Admin').slice(0, 240);
      try {
        const credited = await runTransaction(db, async (tx) => {
          const reqRef = doc(db, 'walletRequests', reqId);
          const rSnap = await tx.get(reqRef);
          if (!rSnap.exists()) throw new Error('Wallet request not found.');
          const rData = rSnap.data();
          if (rData.status !== 'pending') throw new Error('Request already reviewed.');
          const uRef = doc(db, 'users', rData.userId);
          const uSnap = await tx.get(uRef);
          if (!uSnap.exists()) throw new Error('Customer profile not found.');
          const curBal = Number(uSnap.data()?.walletBalanceBdt || 0);
          const nextBal = Math.min(5000000, Math.round((curBal + Number(rData.amountBdt || 0)) * 100) / 100);
          tx.update(uRef, { walletBalanceBdt: nextBal, updatedAt: serverTimestamp() });
          tx.update(reqRef, { status: 'approved', adminNote, reviewedBy: currentUser.uid, updatedAt: serverTimestamp() });
          return { userId: rData.userId, amountBdt: rData.amountBdt, nextBal };
        });
        await pushAutoNotification(
          credited.userId,
          `ওয়ালেট অ্যাড-মানি অনুমোদিত (+${money(credited.amountBdt)})`,
          `আপনার ${money(credited.amountBdt)} অ্যাড-মানি রিকোয়েস্ট অনুমোদিত হয়েছে। নতুন ওয়ালেট ব্যালেন্স: ${money(credited.nextBal)}।`,
          'wallet_approved',
          reqId
        );
        try {
          await addDoc(collection(db, 'auditLogs'), {
            actorUid: currentUser.uid,
            actorEmail: currentUser.email || '',
            actorRole: isOwner ? 'main_admin' : 'admin',
            action: 'APPROVE_WALLET_TOPUP',
            target: `${reqId} (+${credited.amountBdt})`,
            createdAt: serverTimestamp()
          });
        } catch {}
        showToast(`Approved! Credited ${money(credited.amountBdt)} to customer wallet.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `walletRequests/${reqId}`);
        showToast(err.message || 'Approval failed.');
      }
      return;
    }

    const wReject = e.target.closest('[data-adm-wreject]');
    if (wReject && hasPerm('canManageOrders')) {
      const reqId = wReject.dataset.admWreject;
      const reqItem = state.walletRequests.find((r) => r.id === reqId);
      const noteInp = document.querySelector(`[data-adm-wnote="${reqId}"]`);
      const adminNote = (noteInp?.value.trim() || 'TrxID / Amount could not be verified').slice(0, 240);
      try {
        await updateDoc(doc(db, 'walletRequests', reqId), {
          status: 'rejected',
          adminNote,
          reviewedBy: currentUser.uid,
          updatedAt: serverTimestamp()
        });
        if (reqItem?.userId) {
          await pushAutoNotification(
            reqItem.userId,
            'ওয়ালেট অ্যাড-মানি রিকোয়েস্ট বাতিল',
            `আপনার ${money(reqItem.amountBdt)} অ্যাড-মানি রিকোয়েস্টটি অনুমোদিত হয়নি। কারণ: ${adminNote}`,
            'wallet_rejected',
            reqId
          );
        }
        try {
          await addDoc(collection(db, 'auditLogs'), {
            actorUid: currentUser.uid,
            actorEmail: currentUser.email || '',
            actorRole: isOwner ? 'main_admin' : 'admin',
            action: 'REJECT_WALLET_TOPUP',
            target: reqId,
            createdAt: serverTimestamp()
          });
        } catch {}
        showToast('Wallet request rejected.');
      } catch (err) {
        showToast(err.message || 'Reject failed.');
      }
      return;
    }

    // Manage Customer CRM Handlers
    const mngUserBtn = e.target.closest('[data-adm-manage-user]');
    if (mngUserBtn && canSeeView('users')) { openManageUserModal(mngUserBtn.dataset.admManageUser); return; }

    const muWal = e.target.closest('[data-adm-mu-wal]');
    if (muWal && currentUser && canSeeView('users')) {
      const uid = muWal.dataset.muUid;
      const mode = muWal.dataset.admMuWal === 'deduct' ? 'deduct' : 'add';
      const amt = Math.max(0, Number(document.getElementById('mu-wal-amt')?.value || 0));
      const reason = (document.getElementById('mu-wal-reason')?.value.trim() || (mode === 'add' ? 'Added by Admin' : 'Deducted by Admin')).slice(0, 160);
      if (amt <= 0) return showToast('Enter a valid amount > 0.');
      muWal.disabled = true;
      try {
        const uRef = doc(db, 'users', uid);
        const uSnap = await getDoc(uRef);
        if (!uSnap.exists()) throw new Error('User not found.');
        const fsBal = Number(uSnap.data()?.walletBalanceBdt || 0);
        if (mode === 'add') {
          const nextFs = Math.min(5000000, Math.round((fsBal + amt) * 100) / 100);
          await updateDoc(uRef, { walletBalanceBdt: nextFs, updatedAt: serverTimestamp() });
        } else {
          const deductFs = Math.min(fsBal, amt);
          const remAuto = Math.round((amt - deductFs) * 100) / 100;
          if (deductFs > 0) {
            await updateDoc(uRef, { walletBalanceBdt: Math.max(0, Math.round((fsBal - deductFs) * 100) / 100), updatedAt: serverTimestamp() });
          }
          if (remAuto > 0) {
            const token = await currentUser.getIdToken();
            const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/wallet-adjust`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ target: 'auto', mode: 'deduct', amountBdt: remAuto, note: reason })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Auto wallet deduction failed.');
          }
        }
        await pushAutoNotification(uid, mode === 'add' ? `ওয়ালেটে +${money(amt)} যোগ হয়েছে` : `ওয়ালেট থেকে -${money(amt)} সমন্বয় করা হয়েছে`, `${reason} (${mode === 'add' ? '+' : '-'}${money(amt)})`, mode === 'add' ? 'wallet_approved' : 'wallet_rejected', uid);
        showToast(mode === 'add' ? `Added ${money(amt)} to user wallet!` : `Deducted ${money(amt)} from user wallet!`);
        openManageUserModal(uid);
      } catch (err) { showToast(err.message || 'Wallet adjustment failed.'); }
      finally { muWal.disabled = false; }
      return;
    }

    const muBan = e.target.closest('[data-adm-mu-ban]');
    if (muBan && currentUser && canSeeView('users')) {
      const uid = muBan.dataset.muUid;
      const shouldBan = muBan.dataset.admMuBan === 'ban';
      const banReason = (document.getElementById('mu-ban-reason')?.value.trim() || (shouldBan ? 'Violation of store policy' : '')).slice(0, 200);
      await updateDoc(doc(db, 'users', uid), { isBanned: shouldBan, banReason: shouldBan ? banReason : '', updatedAt: serverTimestamp() });
      await pushAutoNotification(uid, shouldBan ? 'অ্যাকাউন্ট সাসপেন্ড করা হয়েছে' : 'অ্যাকাউন্ট সচল করা হয়েছে', shouldBan ? `কারণ: ${banReason}` : 'আপনার অ্যাকাউন্ট পুনরায় সচল করা হয়েছে।', 'system', uid);
      showToast(shouldBan ? 'Customer BANNED.' : 'Customer UNBANNED.');
      openManageUserModal(uid);
      return;
    }

    const muBl = e.target.closest('[data-adm-mu-bl]');
    if (muBl && currentUser && canSeeView('users')) {
      const uid = muBl.dataset.admMuBl;
      const u = state.users.find((x) => x.id === uid);
      if (!u) return;
      await addDoc(collection(db, 'blacklist'), {
        phone: u.savedPhone || '',
        email: (u.email || '').toLowerCase(),
        reason: document.getElementById('mu-ban-reason')?.value.trim() || 'Blocked from Customer CRM',
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      showToast('Added to Fake Order Shield.');
      return;
    }

    const muRes = e.target.closest('[data-adm-mu-res]');
    if (muRes && currentUser && canSeeView('users')) {
      const uid = muRes.dataset.muUid;
      const approve = muRes.dataset.admMuRes === 'approve';
      const pct = Math.min(50, Math.max(0, Number(document.getElementById('mu-reseller-pct')?.value || 8)));
      await updateDoc(doc(db, 'users', uid), {
        isReseller: approve,
        resellerStatus: approve ? 'approved' : 'none',
        resellerDiscountPct: approve ? pct : 0,
        updatedAt: serverTimestamp()
      });
      await pushAutoNotification(uid, approve ? `🤝 Reseller Mode অনুমোদিত (${pct}% Off)` : 'Reseller স্ট্যাটাস বাতিল', approve ? `অভিনন্দন! সব প্রোডাক্টে ${pct}% ডিসকাউন্ট পাবেন।` : 'আপনার রিসেলার সুবিধা বন্ধ করা হয়েছে।', 'system', uid);
      showToast(approve ? `Reseller approved (${pct}% off)!` : 'Reseller revoked.');
      openManageUserModal(uid);
      return;
    }

    const muNote = e.target.closest('[data-adm-mu-note]');
    if (muNote && currentUser && canSeeView('users')) {
      const uid = muNote.dataset.admMuNote;
      await updateDoc(doc(db, 'users', uid), { adminNote: (document.getElementById('mu-admin-note')?.value.trim() || '').slice(0, 300), updatedAt: serverTimestamp() });
      showToast('CRM note saved.');
      return;
    }

    // Returns Handlers
    const retApp = e.target.closest('[data-adm-ret-app]');
    if (retApp && currentUser && canSeeView('returns')) {
      const retId = retApp.dataset.admRetApp;
      retApp.disabled = true;
      try {
        const res = await runTransaction(db, async (tx) => {
          const rRef = doc(db, 'returns', retId);
          const rSnap = await tx.get(rRef);
          if (!rSnap.exists()) throw new Error('Return not found.');
          const rData = rSnap.data();
          if (rData.status !== 'pending') throw new Error('Already reviewed.');
          const amt = Math.max(0, Number(rData.refundAmountBdt ?? rData.refundBdt ?? 0));
          let nextBal = 0;
          if (rData.userId && amt > 0) {
            const uRef = doc(db, 'users', rData.userId);
            const uSnap = await tx.get(uRef);
            if (uSnap.exists()) {
              nextBal = Math.min(5000000, Math.round((Number(uSnap.data()?.walletBalanceBdt || 0) + amt) * 100) / 100);
              tx.update(uRef, { walletBalanceBdt: nextBal, updatedAt: serverTimestamp() });
            }
          }
          tx.update(rRef, { status: 'approved', adminNote: 'Approved & Refunded to Wallet', reviewedBy: currentUser.uid, updatedAt: serverTimestamp() });
          return { userId: rData.userId, amt, orderNumber: rData.orderNumber || '' };
        });
        if (res.userId) await pushAutoNotification(res.userId, `রিটার্ন অনুমোদিত (+${money(res.amt)})`, `অর্ডার #${res.orderNumber} রিফান্ড ওয়ালেটে ক্রেডিট হয়েছে।`, 'wallet_refund', retId);
        showToast(`Return approved & refunded ${money(res.amt)}!`);
      } catch (err) { showToast(err.message || 'Approve failed.'); }
      finally { retApp.disabled = false; }
      return;
    }

    const retRep = e.target.closest('[data-adm-ret-rep]');
    if (retRep && currentUser && canSeeView('returns')) {
      const retId = retRep.dataset.admRetRep;
      const item = state.returns.find((r) => r.id === retId);
      await updateDoc(doc(db, 'returns', retId), { status: 'replacement', adminNote: 'Replacement approved', reviewedBy: currentUser.uid, updatedAt: serverTimestamp() });
      if (item?.userId) await pushAutoNotification(item.userId, `রিপ্লেসমেন্ট অনুমোদিত (#${item.orderNumber || ''})`, 'নতুন রিপ্লেসমেন্ট পার্সেল শীঘ্রই পাঠানো হবে।', 'order_update', retId);
      showToast('Replacement approved!');
      return;
    }

    const retRej = e.target.closest('[data-adm-ret-rej]');
    if (retRej && currentUser && canSeeView('returns')) {
      const retId = retRej.dataset.admRetRej;
      const item = state.returns.find((r) => r.id === retId);
      await updateDoc(doc(db, 'returns', retId), { status: 'rejected', adminNote: 'Rejected by Admin', reviewedBy: currentUser.uid, updatedAt: serverTimestamp() });
      if (item?.userId) await pushAutoNotification(item.userId, `রিটার্ন বাতিল (#${item.orderNumber || ''})`, 'আপনার রিটার্ন রিকোয়েস্টটি অনুমোদিত হয়নি।', 'system', retId);
      showToast('Return rejected.');
      return;
    }

    // Reels, Campaigns, Tournaments, Blacklist handlers
    const rlTgl = e.target.closest('[data-adm-rl-tgl]');
    if (rlTgl && canSeeView('reels')) {
      const r = state.reels.find((x) => x.id === rlTgl.dataset.admRlTgl);
      if (r) await updateDoc(doc(db, 'reels', r.id), { isActive: r.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const rlDel = e.target.closest('[data-adm-rl-del]');
    if (rlDel && canSeeView('reels')) { await deleteDoc(doc(db, 'reels', rlDel.dataset.admRlDel)); showToast('Reel deleted.'); return; }

    const cmpTgl = e.target.closest('[data-adm-cmp-tgl]');
    if (cmpTgl && canSeeView('campaigns')) {
      const c = state.campaigns.find((x) => x.id === cmpTgl.dataset.admCmpTgl);
      if (c) await updateDoc(doc(db, 'campaigns', c.id), { isActive: c.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const cmpDel = e.target.closest('[data-adm-cmp-del]');
    if (cmpDel && canSeeView('campaigns')) { await deleteDoc(doc(db, 'campaigns', cmpDel.dataset.admCmpDel)); showToast('Campaign deleted.'); return; }

    const trEdit = e.target.closest('[data-adm-tr-edit]');
    if (trEdit && canSeeView('tournaments')) {
      const t = state.tournaments.find((x) => x.id === trEdit.dataset.admTrEdit);
      if (!t) return;
      document.getElementById('adm-tr-id').value = t.id;
      document.getElementById('adm-tr-title').value = t.title || '';
      document.getElementById('adm-tr-game').value = t.game || 'Free Fire';
      if (document.getElementById('adm-tr-mode')) document.getElementById('adm-tr-mode').value = t.mode || 'solo';
      document.getElementById('adm-tr-fee').value = t.entryFeeBdt || 0;
      document.getElementById('adm-tr-prize').value = t.prizePoolBdt || 0;
      document.getElementById('adm-tr-slots').value = t.maxSlots || 48;
      if (t.startTimeIso) {
        const d = new Date(t.startTimeIso);
        if (!Number.isNaN(d.getTime())) {
          document.getElementById('adm-tr-time').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
      }
      document.getElementById('adm-tr-status').value = t.status || 'open';
      document.getElementById('adm-tr-img').value = t.imageUrl || '';
      try {
        const sec = await getDoc(doc(db, 'tournaments', t.id, 'secrets', 'room'));
        if (sec.exists()) {
          document.getElementById('adm-tr-room-id').value = sec.data()?.roomId || '';
          document.getElementById('adm-tr-room-pass').value = sec.data()?.roomPass || '';
        }
      } catch {}
      document.getElementById('adm-tr-reset')?.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const trLb = e.target.closest('[data-adm-tr-lb]');
    if (trLb && canSeeView('tournaments')) {
      openAdmTournamentLeaderboardModal(trLb.dataset.admTrLb);
      return;
    }

    if (e.target.closest('#adm-tr-lb-add')) {
      const box = document.getElementById('adm-tr-lb-rows');
      if (box) {
        const nextRank = box.querySelectorAll('.lb-row').length + 1;
        box.insertAdjacentHTML('beforeend', makeAdmLbRowHtml({ rank: nextRank }));
      }
      return;
    }

    const rmLbRow = e.target.closest('[data-adm-lb-rm]');
    if (rmLbRow) {
      rmLbRow.closest('.lb-row')?.remove();
      return;
    }

    const lbSaveBtn = e.target.closest('#adm-tr-lb-save');
    if (lbSaveBtn && currentUser && canSeeView('tournaments')) {
      const tourId = lbSaveBtn.dataset.trId;
      const leaderboard = collectAdmLbRows();
      await updateDoc(doc(db, 'tournaments', tourId), { leaderboard, updatedAt: serverTimestamp() });
      showToast('Tournament leaderboard saved!');
      return;
    }

    const lbPayoutBtn = e.target.closest('#adm-tr-lb-payout');
    if (lbPayoutBtn && currentUser && canSeeView('tournaments')) {
      const tourId = lbPayoutBtn.dataset.trId;
      const t = state.tournaments.find((x) => x.id === tourId);
      const leaderboard = collectAdmLbRows();
      const winners = leaderboard.filter((w) => w.uid && w.prizeBdt > 0).map((w) => ({ uid: w.uid, name: w.name, rank: w.rank, prizeBdt: w.prizeBdt }));
      if (!winners.length) return showToast('Enter at least 1 winner with valid UID & Prize > 0.');
      lbPayoutBtn.disabled = true;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/tournaments/prize-payout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tournamentId: tourId, title: t?.title || 'Tournament', winners })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Prize payout failed.');
        await updateDoc(doc(db, 'tournaments', tourId), { prizesDistributed: true, leaderboard, updatedAt: serverTimestamp() });
        for (const p of (data.payouts || [])) {
          if (p.uid) {
            await pushAutoNotification(p.uid, `🏆 Tournament Prize Won! (+${money(p.prizeBdt)})`, `"${t?.title || 'Tournament'}" এ #${p.rank} স্থান অর্জনের জন্য ${money(p.prizeBdt)} আপনার ওয়ালেটে যোগ হয়েছে!`, 'wallet_approved', tourId);
          }
        }
        showToast(`Distributed ${money(data.totalPaidBdt)} to ${data.paidCount} winner(s)!`);
        closeOrderDetailModal();
      } catch (err) {
        showToast(err.message || 'Prize distribution failed.');
        lbPayoutBtn.disabled = false;
      }
      return;
    }

    const takeLockBtn = e.target.closest('#adm-takeover-lock-btn');
    if (takeLockBtn && activeAdmOrderLockKey) {
      await acquireAdmOrderLock(activeAdmOrderLockKey, 'override');
      showToast('Lock overridden.');
      return;
    }

    const creditResBtn = e.target.closest('[data-adm-credit-reseller]');
    if (creditResBtn && currentUser && hasPerm('canManageOrders')) {
      const orderId = creditResBtn.dataset.admCreditReseller;
      creditResBtn.disabled = true;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/reseller/credit-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orderId })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Reseller credit failed.');
        await updateDoc(doc(db, 'orders', orderId), {
          resellerProfitCredited: true,
          resellerCreditedBdt: Number(data.creditedBdt || 0),
          updatedAt: serverTimestamp()
        });
        if (data.targetUid) {
          await pushAutoNotification(data.targetUid, `🤝 Reseller Profit Credited (+${money(data.creditedBdt)})`, `অর্ডার #${data.orderNumber} থেকে ${money(data.creditedBdt)} রিসেলার প্রফিট আপনার ব্যালেন্সে যোগ হয়েছে।`, 'wallet_approved', orderId);
        }
        showToast(`Credited ${money(data.creditedBdt)} reseller profit!`);
        const ord = state.orders.find((o) => o.id === orderId);
        if (ord) openOrderInspectModal({ ...ord, resellerProfitCredited: true, resellerCreditedBdt: data.creditedBdt }, false);
      } catch (err) {
        showToast(err.message || 'Credit failed.');
        creditResBtn.disabled = false;
      }
      return;
    }

    const rwdActBtn = e.target.closest('[data-adm-rwd-act]');
    if (rwdActBtn && currentUser && canSeeView('users')) {
      const withdrawalId = rwdActBtn.dataset.rwdId;
      const action = rwdActBtn.dataset.admRwdAct;
      const adminNote = (document.querySelector(`[data-adm-rwd-note="${withdrawalId}"]`)?.value || '').trim();
      rwdActBtn.disabled = true;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/reseller/withdrawals/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ withdrawalId, action, adminNote })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Review failed.');
        if (data.withdrawal?.uid) {
          await pushAutoNotification(
            data.withdrawal.uid,
            action === 'approve' ? `💸 Reseller Withdrawal Approved (${money(data.withdrawal.amountBdt)})` : 'Reseller Withdrawal Rejected',
            action === 'approve' ? `আপনার ${money(data.withdrawal.amountBdt)} পে-আউট পাঠানো হয়েছে।` : `উইথড্রয়াল বাতিল হয়েছে: ${adminNote || 'Rejected'}`,
            action === 'approve' ? 'wallet_approved' : 'wallet_rejected',
            withdrawalId
          );
        }
        await loadAdmResellerWithdrawals();
        showToast(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}.`);
      } catch (err) {
        showToast(err.message || 'Action failed.');
        rwdActBtn.disabled = false;
      }
      return;
    }

    const chatSendBtn = e.target.closest('[data-adm-chat-send]');
    if (chatSendBtn && currentUser && canSeeView('tickets')) {
      const threadKey = chatSendBtn.dataset.admChatSend;
      const inp = document.querySelector(`[data-adm-chat-inp="${threadKey}"]`);
      const text = (inp?.value || '').trim();
      if (!text) return showToast('Enter a reply message first.');
      chatSendBtn.disabled = true;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/support/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ asStaff: true, threadKey, text })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Send failed.');
        inp.value = '';
        await loadAdmSupportChats();
        showToast('Reply sent to live chat!');
      } catch (err) {
        showToast(err.message || 'Send failed.');
      } finally {
        chatSendBtn.disabled = false;
      }
      return;
    }

    const faqEditBtn = e.target.closest('[data-adm-faq-edit]');
    if (faqEditBtn && canSeeView('tickets')) {
      const faq = state.faqs.find((f) => f.id === faqEditBtn.dataset.admFaqEdit);
      if (!faq) return;
      document.getElementById('adm-faq-id').value = faq.id;
      document.getElementById('adm-faq-cat').value = faq.category || 'General';
      document.getElementById('adm-faq-q').value = faq.question || '';
      document.getElementById('adm-faq-a').value = faq.answer || '';
      document.getElementById('adm-faq-reset')?.classList.remove('hidden');
      return;
    }

    const faqDelBtn = e.target.closest('[data-adm-faq-del]');
    if (faqDelBtn && currentUser && (canSeeView('tickets') || hasPerm('canManageNotices'))) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/support/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'delete', id: faqDelBtn.dataset.admFaqDel })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Delete failed.');
        state.faqs = Array.isArray(data.faqs) ? data.faqs : [];
        renderAdmFaqs();
        showToast('FAQ deleted.');
      } catch (err) { showToast(err.message || 'FAQ delete failed.'); }
      return;
    }

    const trDel = e.target.closest('[data-adm-tr-del]');
    if (trDel && canSeeView('tournaments')) { await deleteDoc(doc(db, 'tournaments', trDel.dataset.admTrDel)); showToast('Tournament deleted.'); return; }

    const proofBtn = e.target.closest('[data-adm-proof-review]');
    if (proofBtn && currentUser && canSeeView('tournaments')) {
      const [proofId, action] = String(proofBtn.dataset.admProofReview || '').split('::');
      const targetUid = proofBtn.dataset.proofUid;
      const tourId = proofBtn.dataset.proofTr;
      proofBtn.disabled = true;
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch('/api/tournaments/proofs/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ proofId, action, adminNote: action === 'approve' ? 'Match proof verified' : 'Invalid proof' })
        });
        if (!res.ok) throw new Error('Review failed');
        if (targetUid) {
          await pushAutoNotification(
            targetUid,
            action === 'approve' ? '✅ Tournament Proof Verified' : '❌ Tournament Proof Rejected',
            action === 'approve' ? 'আপনার ম্যাচ রেজাল্ট প্রুফ অ্যাপ্রুভ হয়েছে।' : 'আপনার ম্যাচ রেজাল্ট প্রুফ বাতিল করা হয়েছে।',
            'order_update',
            tourId
          );
        }
        showToast(`Proof ${action}d!`);
        loadAdmTournamentProofs(tourId);
      } catch (err) {
        showToast(err.message || 'Review failed.');
        proofBtn.disabled = false;
      }
      return;
    }

    const delExpBtn = e.target.closest('[data-del-exp]');
    if (delExpBtn && currentUser) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/expenses/${encodeURIComponent(delExpBtn.dataset.delExp)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          await loadAdmExpenses();
          showToast('Expense removed.');
        }
      } catch {}
      return;
    }

    if (e.target.closest('#adm-abandoned-refresh')) { await loadAdmAbandonedCarts(); showToast('Abandoned carts refreshed.'); return; }
    if (e.target.closest('#adm-creators-refresh')) { await loadAdmCreators(); showToast('Creator tracker refreshed.'); return; }

    const remindBtn = e.target.closest('[data-adm-remind-cart]');
    if (remindBtn && currentUser && hasPerm('canManageOrders')) {
      const key = remindBtn.dataset.admRemindCart;
      const targetUid = remindBtn.dataset.remindUid;
      remindBtn.disabled = true;
      try {
        if (targetUid) {
          await pushAutoNotification(
            targetUid,
            '🛒 আপনার কার্টে পণ্য অপেক্ষা করছে!',
            'আপনার পছন্দের পণ্যগুলো স্টক শেষ হওয়ার আগেই অর্ডার কনফার্ম করুন।',
            'promo',
            key
          );
        }
        const token = await currentUser.getIdToken();
        await fetch('/api/carts/abandoned/remind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key })
        });
        await loadAdmAbandonedCarts();
        showToast('Recovery push notification sent!');
      } catch (err) {
        showToast(err.message || 'Reminder failed.');
        remindBtn.disabled = false;
      }
      return;
    }

    const delOfferBtn = e.target.closest('[data-del-offer]');
    if (delOfferBtn && currentUser && hasPerm('canManageCoupons')) {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`/api/offers/${encodeURIComponent(delOfferBtn.dataset.delOffer)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          await loadAdmOffers();
          showToast('Auto offer removed.');
        }
      } catch {}
      return;
    }

    const blDel = e.target.closest('[data-adm-bl-del]');
    if (blDel && canSeeView('blacklist')) { await deleteDoc(doc(db, 'blacklist', blDel.dataset.admBlDel)); showToast('Removed from blacklist.'); return; }
  });

  document.addEventListener('change', async (e) => {
    const ordStatus = e.target.closest('[data-order-status]');
    if (ordStatus && hasPerm('canManageOrders')) {
      const id = ordStatus.dataset.orderStatus;
      const nextStatus = ordStatus.value;
      const ord = state.orders.find((o) => o.id === id);
      try {
        await updateDoc(doc(db, 'orders', id), { status: nextStatus, handledBy: currentUser.uid, handledByEmail: currentUser.email || '', updatedAt: serverTimestamp() });
        if (ord) {
          fetch('/api/orders/sync-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify({ orderNumber: ord.orderNumber || id.slice(0, 8), phone: ord.phone, status: nextStatus, paymentStatus: ord.paymentStatus, courierTracking: ord.courierTracking || '', totalBdt: ord.totalBdt })
          }).catch(() => {});
        }
        if (ord?.userId) {
          const notifType = nextStatus === 'delivered' ? 'order_completed' : nextStatus === 'cancelled' ? 'order_cancelled' : 'order_update';
          await pushAutoNotification(ord.userId, `Order #${ord.orderNumber || id.slice(0, 8)} ${nextStatus}`, `আপনার অর্ডারটি এখন "${nextStatus}" পর্যায়ে রয়েছে।`, notifType, id);
        }
        showToast(`Order marked ${nextStatus}.`);
      } catch (err) { showToast(err.message); }
      return;
    }

    const ordPay = e.target.closest('[data-order-pay]');
    if (ordPay && hasPerm('canManageOrders')) {
      const id = ordPay.dataset.orderPay;
      const ord = state.orders.find((o) => o.id === id);
      try {
        await updateDoc(doc(db, 'orders', id), { paymentStatus: ordPay.value, handledBy: currentUser.uid, handledByEmail: currentUser.email || '', updatedAt: serverTimestamp() });
        if (ord) {
          fetch('/api/orders/sync-track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await currentUser.getIdToken()}` },
            body: JSON.stringify({ orderNumber: ord.orderNumber || id.slice(0, 8), phone: ord.phone, status: ord.status, paymentStatus: ordPay.value, courierTracking: ord.courierTracking || '', totalBdt: ord.totalBdt })
          }).catch(() => {});
        }
        showToast('Payment status updated.');
      } catch (err) { showToast(err.message); }
      return;
    }

    const emStatus = e.target.closest('[data-em-status]');
    if (emStatus && hasPerm('canManageEMarket')) {
      const id = emStatus.dataset.emStatus;
      const nextStatus = emStatus.value;
      const eo = state.emarketOrders.find((o) => o.id === id);
      try {
        await updateDoc(doc(db, 'emarketOrders', id), { status: nextStatus, handledBy: currentUser.uid, handledByEmail: currentUser.email || '', updatedAt: serverTimestamp() });
        if (eo?.userId) {
          const nType = nextStatus === 'completed' ? 'emarket_completed' : nextStatus === 'cancelled' ? 'emarket_cancelled' : 'order_update';
          await pushAutoNotification(eo.userId, `E-Market #${eo.orderNumber || id.slice(0, 8)} ${nextStatus}`, `${eo.itemTitle} অর্ডারটি "${nextStatus}" হয়েছে।`, nType, id);
        }
        showToast(`E-Market order marked ${nextStatus}.`);
      } catch (err) { showToast(err.message); }
      return;
    }
  });

  // E-Market Item Form
  document.getElementById('adm-em-reset').addEventListener('click', () => {
    document.getElementById('adm-em-id').value = '';
    document.getElementById('adm-em-form').reset();
    document.getElementById('adm-em-reset').classList.add('hidden');
  });

  document.getElementById('adm-em-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasPerm('canManageEMarket')) return showToast('Action not allowed.');
    const id = document.getElementById('adm-em-id').value;
    const packages = parsePackagesInput(document.getElementById('adm-em-packages').value);
    if (!packages.length) return showToast('Enter at least 1 package: "Label:Price"');
    const payload = {
      title: document.getElementById('adm-em-title').value.trim().slice(0, 120),
      subtitleBn: document.getElementById('adm-em-sub').value.trim().slice(0, 180),
      category: document.getElementById('adm-em-cat').value,
      inputLabel: document.getElementById('adm-em-prompt').value.trim().slice(0, 80),
      inputPlaceholder: document.getElementById('adm-em-placeholder').value.trim().slice(0, 100),
      packages,
      costPriceBdt: Math.max(0, Number(document.getElementById('adm-em-cost')?.value) || 0),
      renewalDays: Math.min(365, Math.max(0, parseInt(document.getElementById('adm-em-renewal-days')?.value, 10) || 0)),
      salesCount: Math.max(0, parseInt(document.getElementById('adm-em-sales')?.value, 10) || 0),
      imageUrl: document.getElementById('adm-em-img').value.trim().slice(0, 500) || DEFAULT_LOGO,
      description: document.getElementById('adm-em-desc').value.trim().slice(0, 1000),
      deliveryEta: document.getElementById('adm-em-eta').value.trim().slice(0, 60),
      isActive: document.getElementById('adm-em-active').checked,
      updatedAt: serverTimestamp()
    };
    try {
      if (id) {
        await updateDoc(doc(db, 'emarketItems', id), payload);
        showToast('E-Market service updated.');
      } else {
        await addDoc(collection(db, 'emarketItems'), { ...payload, createdBy: currentUser.uid, createdAt: serverTimestamp() });
        showToast('E-Market service published.');
      }
      document.getElementById('adm-em-id').value = '';
      document.getElementById('adm-em-form').reset();
      document.getElementById('adm-em-reset').classList.add('hidden');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'emarketItems');
      showToast(err.message);
    }
  });

  // Reels, Campaigns, Tournaments, Blacklist Forms
  document.getElementById('adm-reel-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canSeeView('reels')) return showToast('Action not allowed.');
    const prodId = document.getElementById('adm-rl-prod')?.value || '';
    const prod = state.products.find((p) => p.id === prodId);
    try {
      await addDoc(collection(db, 'reels'), {
        title: document.getElementById('adm-rl-title').value.trim(),
        badgeText: document.getElementById('adm-rl-badge').value.trim() || 'Viral Reel',
        videoUrl: document.getElementById('adm-rl-video').value.trim(),
        posterUrl: document.getElementById('adm-rl-poster').value.trim(),
        productId: prodId,
        productTitle: prod?.title || '',
        likesCount: 0,
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Viral Reel published!');
    } catch (err) { showToast(err.message || 'Reel publish failed.'); }
  });

  document.getElementById('adm-campaign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canSeeView('campaigns')) return showToast('Action not allowed.');
    try {
      await addDoc(collection(db, 'campaigns'), {
        title: document.getElementById('adm-cmp-title').value.trim(),
        discountPercent: Math.min(50, Math.max(1, Number(document.getElementById('adm-cmp-pct').value) || 10)),
        startIso: new Date(document.getElementById('adm-cmp-start').value).toISOString(),
        endIso: new Date(document.getElementById('adm-cmp-end').value).toISOString(),
        minOrderBdt: Math.max(0, Number(document.getElementById('adm-cmp-min').value) || 0),
        bannerNoteBn: document.getElementById('adm-cmp-note').value.trim(),
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Campaign scheduled!');
    } catch (err) { showToast(err.message || 'Campaign schedule failed.'); }
  });

  document.getElementById('adm-tr-reset')?.addEventListener('click', () => {
    document.getElementById('adm-tr-id').value = '';
    document.getElementById('adm-tournament-form').reset();
    document.getElementById('adm-tr-reset').classList.add('hidden');
  });

  document.getElementById('adm-tournament-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canSeeView('tournaments')) return showToast('Action not allowed.');
    const id = document.getElementById('adm-tr-id').value.trim();
    const tRaw = document.getElementById('adm-tr-time').value;
    const payload = {
      title: document.getElementById('adm-tr-title').value.trim(),
      game: document.getElementById('adm-tr-game').value.trim(),
      mode: document.getElementById('adm-tr-mode')?.value || 'solo',
      entryFeeBdt: Math.max(0, Number(document.getElementById('adm-tr-fee').value) || 0),
      prizePoolBdt: Math.max(0, Number(document.getElementById('adm-tr-prize').value) || 0),
      maxSlots: Math.min(200, Math.max(2, parseInt(document.getElementById('adm-tr-slots').value, 10) || 48)),
      startTimeIso: tRaw ? new Date(tRaw).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      status: document.getElementById('adm-tr-status').value,
      imageUrl: document.getElementById('adm-tr-img').value.trim() || DEFAULT_LOGO,
      isActive: true,
      updatedAt: serverTimestamp()
    };
    try {
      let tourId = id;
      if (id) {
        await updateDoc(doc(db, 'tournaments', id), payload);
      } else {
        const ref = await addDoc(collection(db, 'tournaments'), { ...payload, filledSlots: 0, joinedUids: [], createdBy: currentUser.uid, createdAt: serverTimestamp() });
        tourId = ref.id;
      }
      const roomId = document.getElementById('adm-tr-room-id').value.trim();
      const roomPass = document.getElementById('adm-tr-room-pass').value.trim();
      await setDoc(doc(db, 'tournaments', tourId, 'secrets', 'room'), { roomId, roomPass, updatedAt: serverTimestamp() });
      document.getElementById('adm-tr-id').value = '';
      e.target.reset();
      document.getElementById('adm-tr-reset').classList.add('hidden');
      showToast('Tournament & protected room credentials saved!');
    } catch (err) { showToast(err.message || 'Tournament save failed.'); }
  });

  document.getElementById('adm-blacklist-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!canSeeView('blacklist')) return showToast('Action not allowed.');
    const phone = document.getElementById('adm-bl-phone').value.trim();
    const email = document.getElementById('adm-bl-email').value.trim().toLowerCase();
    const reason = document.getElementById('adm-bl-reason').value.trim();
    if (!phone && !email) return showToast('Enter phone number or email to blacklist.');
    try {
      await addDoc(collection(db, 'blacklist'), { phone, email, reason, createdBy: currentUser.uid, createdAt: serverTimestamp() });
      e.target.reset();
      showToast('Added to Fake Order Shield blacklist!');
    } catch (err) { showToast(err.message || 'Blacklist save failed.'); }
  });

  // Slider Form
  document.getElementById('adm-sl-prod')?.addEventListener('change', (ev) => {
    if (ev.target.value) {
      const sel = document.getElementById('adm-sl-target');
      if (sel) sel.value = 'product';
    }
  });
  document.getElementById('adm-slider-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasPerm('canManageSliders')) return showToast('Action not allowed.');
    try {
      const prodId = document.getElementById('adm-sl-prod')?.value || '';
      const rawPage = document.getElementById('adm-sl-target').value;
      const linkPage = prodId ? 'product' : rawPage;
      const linkTarget = prodId ? prodId.slice(0, 120) : '';
      await addDoc(collection(db, 'sliders'), {
        title: document.getElementById('adm-sl-title').value.trim().slice(0, 120),
        subtitleBn: document.getElementById('adm-sl-sub').value.trim().slice(0, 220),
        badgeText: document.getElementById('adm-sl-badge').value.trim().slice(0, 40),
        imageUrl: document.getElementById('adm-sl-img').value.trim().slice(0, 500),
        ctaLabel: (document.getElementById('adm-sl-cta').value.trim() || 'Explore Now').slice(0, 50),
        linkPage,
        linkTarget,
        sortOrder: state.sliders.length + 1,
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Hero slider added.');
    } catch (err) { showToast(err.message); }
  });

  // Notice Form
  document.getElementById('adm-notice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasPerm('canManageNotices')) return showToast('Action not allowed.');
    try {
      await addDoc(collection(db, 'notices'), {
        title: document.getElementById('adm-nt-title').value.trim().slice(0, 120),
        messageBn: document.getElementById('adm-nt-body').value.trim().slice(0, 600),
        messageEn: document.getElementById('adm-nt-body-en').value.trim().slice(0, 600),
        priority: document.getElementById('adm-nt-type').value,
        isActive: true,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Notice posted.');
    } catch (err) { showToast(err.message); }
  });

  // Push Notification Form
  document.getElementById('adm-notif-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasPerm('canSendNotifications')) return showToast('Action not allowed.');
    try {
      await addDoc(collection(db, 'notifications'), {
        targetUid: document.getElementById('adm-nf-target').value,
        type: document.getElementById('adm-nf-type').value,
        title: document.getElementById('adm-nf-title').value.trim().slice(0, 120),
        body: document.getElementById('adm-nf-body').value.trim().slice(0, 600),
        refId: '',
        isRead: false,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Push notification sent.');
    } catch (err) { showToast(err.message); }
  });

  // Category Form
  document.getElementById('adm-cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasPerm('canManageCategories')) return showToast('Action not allowed.');
    const slug = document.getElementById('adm-cat-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
    const nameEn = document.getElementById('adm-cat-en').value.trim().slice(0, 60);
    const nameBn = document.getElementById('adm-cat-bn').value.trim().slice(0, 80);
    const sortOrder = parseInt(document.getElementById('adm-cat-order').value, 10) || 1;
    const icon = String(document.getElementById('adm-cat-icon')?.value || '').trim().slice(0, 500);
    if (!slug) return;
    try {
      const ref = doc(db, 'categories', slug);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        await updateDoc(ref, { slug, nameEn, nameBn, icon, sortOrder, isActive: true, updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, { slug, nameEn, nameBn, icon, sortOrder, isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      e.target.reset();
      document.querySelectorAll('[data-icon-target="adm-cat-icon"] .icon-preset-btn').forEach((b) => b.classList.remove('active'));
      showToast('Category saved.');
    } catch (err) { showToast(err.message); }
  });

  // Coupon Form
  document.getElementById('adm-coupon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!hasPerm('canManageCoupons')) return showToast('Action not allowed.');
    const code = document.getElementById('adm-cp-code').value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const discountType = document.getElementById('adm-cp-type').value;
    const discountValue = Math.max(1, Number(document.getElementById('adm-cp-val').value));
    const minOrderBdt = Math.max(0, Number(document.getElementById('adm-cp-min').value || 0));
    if (!code) return;
    try {
      const ref = doc(db, 'coupons', code);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        await updateDoc(ref, { code, discountType, discountValue, minOrderBdt, isActive: true, updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, {
          code, discountType, discountValue, minOrderBdt, isActive: true,
          createdBy: currentUser.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }
      const creatorName = (document.getElementById('adm-cp-creator-name')?.value || '').trim();
      if (creatorName) {
        const creatorPhone = (document.getElementById('adm-cp-creator-phone')?.value || '').trim();
        const commissionPct = Math.max(0, Number(document.getElementById('adm-cp-creator-pct')?.value || 5));
        const token = await currentUser.getIdToken();
        await fetch('/api/coupons/creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code, creatorName, creatorPhone, commissionPct })
        });
        loadAdmCreators();
      }
      e.target.reset();
      showToast('Coupon saved.');
    } catch (err) { showToast(err.message); }
  });

  // Daily Expense Form
  document.getElementById('adm-expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: document.getElementById('adm-exp-cat').value,
          title: document.getElementById('adm-exp-title').value.trim(),
          amountBdt: Number(document.getElementById('adm-exp-amount').value),
          date: document.getElementById('adm-exp-date').value || new Date().toISOString().slice(0, 10),
          note: document.getElementById('adm-exp-note').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Expense save failed.');
      e.target.reset();
      await loadAdmExpenses();
      showToast('Expense added to ledger.');
    } catch (err) { showToast(err.message || 'Expense failed.'); }
  });

  // Auto Offer Builder Form
  document.getElementById('adm-offer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !hasPerm('canManageCoupons')) return showToast('Action not allowed.');
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: document.getElementById('adm-ofr-title').value.trim(),
          type: document.getElementById('adm-ofr-type').value,
          minQty: Number(document.getElementById('adm-ofr-qty').value || 2),
          discountPct: Number(document.getElementById('adm-ofr-pct').value || 0),
          targetCategory: document.getElementById('adm-ofr-cat').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Offer save failed.');
      e.target.reset();
      await loadAdmOffers();
      showToast('Auto offer published!');
    } catch (err) { showToast(err.message || 'Offer failed.'); }
  });
}

/* ==================== BOOTSTRAP ==================== */

async function bootstrap() {
  detectAndApplyDeviceLayout();
  window.addEventListener('resize', detectAndApplyDeviceLayout);
  window.addEventListener('orientationchange', detectAndApplyDeviceLayout);
  bindEvents();

  const firebaseConfig = await (async () => {
    if (typeof window !== 'undefined' && window.__NAXORA_FIREBASE_CONFIG__) return window.__NAXORA_FIREBASE_CONFIG__;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch('/api/firebase-config', { cache: 'no-store' });
        if (r.ok) return await r.json();
      } catch {}
      await new Promise((res) => setTimeout(res, 350 * (attempt + 1)));
    }
    return null;
  })();
  if (!firebaseConfig) {
    showAuthError('Firebase configuration লোড করা যায়নি। পেজটি রিলোড করুন।');
    return;
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

  // Startup connection validation
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }

  onSnapshot(doc(db, 'storeConfig', 'global'), (snap) => {
    if (snap.exists()) {
      const raw = { ...snap.data() };
      if (raw.brandName === 'ViralDrop BD') raw.brandName = 'Naxora Bd';
      if (raw.brandLogoUrl === '/src/assets/images/brand_emblem_logo_1795204970933.jpg') raw.brandLogoUrl = DEFAULT_LOGO;
      storeConfig = { ...storeConfig, ...raw };
      syncBrandUI();
    }
  }, () => {});

  onSnapshot(doc(db, 'storeConfig', 'codeOverrides'), (snap) => {
    if (!snap.exists()) return;
    const css = snap.data().adminCustomCss || '';
    let styleTag = document.getElementById('admin-custom-css');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'admin-custom-css';
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = css;
  }, () => {});

  let unsubAdminDoc = null;

  onAuthStateChanged(auth, async (user) => {
    if (unsubAdminDoc) { unsubAdminDoc(); unsubAdminDoc = null; }
    clearAllDataListeners();
    currentUser = user;
    adminProfile = null;
    isOwner = false;

    const verifyBox = document.getElementById('admin-verify-box');
    if (verifyBox) verifyBox.classList.add('hidden');

    const switchBtn = document.getElementById('admin-switch-acct-btn');
    if (switchBtn) switchBtn.classList.toggle('hidden', !user);

    if (!user) {
      loggedSessionUid = '';
      document.getElementById('admin-app-shell').classList.add('hidden');
      document.getElementById('admin-mobile-nav').classList.add('hidden');
      document.getElementById('admin-auth-gate').classList.remove('hidden');
      return;
    }

    const emailLower = (user.email || '').trim().toLowerCase();
    isOwner = user.emailVerified === true && emailLower === MAIN_ADMIN_EMAIL.toLowerCase();

    if (!user.emailVerified && !isOwner) {
      document.getElementById('admin-app-shell').classList.add('hidden');
      document.getElementById('admin-mobile-nav').classList.add('hidden');
      document.getElementById('admin-auth-gate').classList.remove('hidden');
      if (verifyBox) verifyBox.classList.remove('hidden');
      showAuthError(`আপনার ইমেইল (${user.email}) এখনো ভেরিফাইড নয়।`);
      return;
    }

    const enterWorkspace = () => {
      if (!isOwner && storeConfig.adminAppEnabled === false) {
        clearAllDataListeners();
        document.getElementById('admin-app-shell').classList.add('hidden');
        document.getElementById('admin-auth-gate').classList.remove('hidden');
        showAuthError('মেইন অ্যাডমিন সাময়িকভাবে অ্যাডমিন কনসোল বন্ধ রেখেছেন।');
        return;
      }
      document.getElementById('admin-auth-gate').classList.add('hidden');
      document.getElementById('admin-app-shell').classList.remove('hidden');
      document.getElementById('admin-mobile-nav').classList.remove('hidden');
      document.getElementById('admin-display-name').textContent = adminProfile?.displayName || user.displayName || 'Admin';
      document.getElementById('admin-user-email').textContent = user.email || user.uid;
      document.getElementById('admin-avatar-pill').textContent = (user.email || 'A').charAt(0).toUpperCase();
      document.getElementById('admin-role-chip').textContent = isOwner ? 'OWNER PREVIEW' : 'ADMIN CONSOLE';
      const topActions = document.getElementById('admin-topbar-actions');
      if (topActions) {
        const existingVaultBtn = document.getElementById('admin-owner-vault-link');
        if (isOwner && !existingVaultBtn) {
          const a = document.createElement('a');
          a.id = 'admin-owner-vault-link';
          a.href = '/main-admin/';
          a.className = 'btn btn-primary btn-sm';
          a.textContent = 'Main Admin Vault ↗';
          topActions.prepend(a);
        } else if (!isOwner && existingVaultBtn) {
          existingVaultBtn.remove();
        }
      }
      syncNavPermissions();
      syncDynamicListeners();
      renderOverview();
      if (hasPerm('canManageEMarket')) loadAdmEmPinsVault();
      if (canSeeView('orders') || canSeeView('emarket')) loadAdmExpenses();
      if (canSeeView('orders')) loadAdmAbandonedCarts();
      if (canSeeView('coupons')) { loadAdmCreators(); loadAdmOffers(); }
      if (canSeeView('users')) loadAdmResellerWithdrawals();
      if (canSeeView('tickets')) { loadAdmSupportChats(); loadAdmFaqs(); }
      if (loggedSessionUid !== user.uid) {
        loggedSessionUid = user.uid;
        addDoc(collection(db, 'auditLogs'), {
          actorUid: user.uid,
          actorEmail: user.email || '',
          actorRole: isOwner ? 'main_admin' : 'admin',
          action: 'ADMIN_LOGIN',
          target: `${adminProfile?.displayName || user.email || 'Admin'} (${isOwner ? 'Owner' : 'Staff'})`,
          createdAt: serverTimestamp()
        }).catch(() => {});
        user.getIdToken().then((tk) => fetch('/api/alerts/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
          body: JSON.stringify({ role: isOwner ? 'main_admin' : 'admin', panel: 'admin' })
        })).catch(() => {});
      }
    };

    if (isOwner) {
      adminProfile = { status: 'approved', displayName: 'Main Owner', permissions: {} };
      enterWorkspace();
      return;
    }

    // Sync admins/{uid} from Main-Admin-issued adminInvites/{emailLower} on create OR update
    const adminRef = doc(db, 'admins', user.uid);
    try {
      const [existingSnap, inviteSnap] = await Promise.all([
        getDoc(adminRef),
        emailLower ? getDoc(doc(db, 'adminInvites', emailLower)) : Promise.resolve(null)
      ]);
      if (inviteSnap && inviteSnap.exists()) {
        const inv = inviteSnap.data();
        if (!existingSnap.exists()) {
          await setDoc(adminRef, {
            uid: user.uid,
            email: user.email || emailLower,
            displayName: inv.displayName || user.displayName || 'Admin',
            status: inv.status,
            permissions: inv.permissions,
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          const cur = existingSnap.data();
          const normPerms = {};
          const keysToSync = PERM_KEYS.filter((k) => k !== 'canManageUsers' || (inv.permissions && 'canManageUsers' in inv.permissions));
          keysToSync.forEach((k) => { normPerms[k] = Boolean(inv.permissions && inv.permissions[k]); });
          const permsDiffer = JSON.stringify(cur.permissions || {}) !== JSON.stringify(normPerms);
          if (cur.status !== inv.status || permsDiffer) {
            await updateDoc(adminRef, {
              displayName: inv.displayName || cur.displayName || 'Admin',
              status: inv.status,
              permissions: normPerms,
              updatedAt: serverTimestamp()
            });
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `adminInvites/${emailLower}`);
    }

    unsubAdminDoc = onSnapshot(adminRef, (snap) => {
      if (!snap.exists() || snap.data().status !== 'approved') {
        clearAllDataListeners();
        document.getElementById('admin-app-shell').classList.add('hidden');
        document.getElementById('admin-mobile-nav').classList.add('hidden');
        document.getElementById('admin-auth-gate').classList.remove('hidden');
        showAuthError('এই জিমেইলটি এখনো অ্যাডমিন হিসেবে অনুমোদিত নয়। মেইন অ্যাডমিন প্যানেল থেকে এই জিমেইল অ্যাড করে Approve করুন।');
        return;
      }
      adminProfile = snap.data();
      enterWorkspace();
    }, (e) => {
      handleFirestoreError(e, OperationType.GET, `admins/${user.uid}`);
      showAuthError('অ্যাডমিন প্রোফাইল যাচাই করা যায়নি।');
    });
  });
}

bootstrap().catch((err) => showAuthError(err.message || 'Initialization failed'));
