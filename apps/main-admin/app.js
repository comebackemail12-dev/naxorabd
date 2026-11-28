import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
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
  getDocFromServer,
  getDocs,
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

const PERM_KEYS = [
  'canCreateProduct', 'canEditProduct', 'canDeleteProduct',
  'canManageOrders', 'canManageCoupons', 'canManageCategories', 'canReplyTickets',
  'canManageSliders', 'canManageNotices', 'canSendNotifications', 'canManageEMarket',
  'canManageUsers'
];

const DEFAULT_STORE_CONFIG = {
  brandName: 'Naxora Bd',
  brandLogoUrl: DEFAULT_LOGO,
  brandTaglineBn: 'বাংলাদেশের সেরা ভাইরাল ড্রপ ও গেমিং স্টোর',
  brandTaglineEn: 'Bangladesh Viral Drops & Digital Store',
  footerTagBn: 'সারা বাংলাদেশে দ্রুত ডেলিভারি ও ইনস্ট্যান্ট ডিজিটাল টপ-আপ',
  footerTagEn: 'Nationwide Express Delivery & Instant E-Market',
  metaTitle: 'Naxora Bd — Viral Tech, Lifestyle & E-Market',
  metaDescription: 'Shop trending gadgets, streetwear, and instant game top-ups across Bangladesh.',
  currencySymbol: '৳',
  defaultLang: 'bn',
  supportPhone: '+8801700-000000',
  supportWhatsapp: '+8801700-000000',
  supportEmail: 'support@naxorabd.com',
  announcementBn: 'সারা বাংলাদেশে দ্রুত হোম ডেলিভারি ও ইনস্ট্যান্ট ই-মার্কেট টপআপ!',
  announcementEn: 'Fast nationwide delivery & instant E-Market top-up across Bangladesh!',
  heroTitle: 'Viral Tech & Drops',
  heroSubtitle: 'Trending picks with fast courier delivery and instant digital top-up.',
  accentColor: '#ff2e63',
  secondaryColor: '#08d9d6',
  gridColsDesktop: 5,
  cardCompactMode: true,
  sliderAutoPlayMs: 5000,
  showAnnouncementBar: true,
  showHeaderSearch: true,
  showHeaderNotices: true,
  showHeaderNotifs: true,
  showLangToggle: true,
  showBottomNav: true,
  showHomeCategories: true,
  showRecentlyViewed: true,
  showFooter: true,
  allowOrderCancel: true,
  userAppEnabled: true,
  adminAppEnabled: true,
  maintenanceMessage: 'Storefront is undergoing scheduled maintenance.',
  flashDropEnabled: true,
  flashDropEndIso: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
  reviewsEnabled: true,
  couponsEnabled: true,
  wishlistEnabled: true,
  ticketsEnabled: true,
  slidersEnabled: true,
  noticesEnabled: true,
  eMarketEnabled: true,
  codEnabled: true,
  codMinOrderBdt: 100,
  codMaxOrderBdt: 30000,
  codAdvanceDeliveryOutsideDhaka: false,
  codAdvanceDeliveryAll: false,
  deliveryInsideDhakaBdt: 70,
  deliveryOutsideDhakaBdt: 130,
  deliveryExpressBdt: 180,
  freeDeliveryThresholdBdt: 2500,
  heavenPayEnabled: true,
  manualPayEnabled: true,
  autoPayEnabled: true,
  autoPayProvider: 'SSLCommerz / UddoktaPay Auto',
  autoPaySandbox: true,
  walletEnabled: true,
  bkashEnabled: true,
  bkashNumber: '01700-000001',
  nagadEnabled: true,
  nagadNumber: '01700-000002',
  rocketEnabled: true,
  rocketNumber: '01700-000003',
  upayEnabled: true,
  upayNumber: '01700-000004',
  cardGatewayEnabled: true,
  gatewayFeePercent: 0,
  gatewayInstructions: 'Send money to the selected merchant/personal wallet and enter TrxID.',
  cashbackPercent: 2,
  referralBonusBdt: 50,
  comboMinQty: 3,
  comboDiscountPercent: 10,
  ffLookupEnabled: true,
  reelsEnabled: true,
  spinWheelEnabled: true,
  dailyCheckInBdt: 5,
  preOrderEnabled: true,
  groupBuyEnabled: true,
  giftCardsEnabled: true,
  tournamentsEnabled: true,
  vipEnabled: true,
  emiEnabled: true,
  otpRequiredForOrder: false,
  reviewBonusBdt: 20,
  resellerCommissionPct: 10,
  resellerDefaultDiscountPct: 8,
  lowStockThreshold: 5
};

const STORE_CONFIG_FIELDS = [
  'brandName', 'brandLogoUrl', 'brandTaglineBn', 'brandTaglineEn', 'footerTagBn', 'footerTagEn',
  'metaTitle', 'metaDescription', 'currencySymbol', 'defaultLang',
  'supportPhone', 'supportWhatsapp', 'supportEmail',
  'announcementBn', 'announcementEn', 'heroTitle', 'heroSubtitle',
  'accentColor', 'secondaryColor', 'gridColsDesktop', 'cardCompactMode', 'sliderAutoPlayMs',
  'showAnnouncementBar', 'showHeaderSearch', 'showHeaderNotices', 'showHeaderNotifs',
  'showLangToggle', 'showBottomNav', 'showHomeCategories', 'showRecentlyViewed',
  'showFooter', 'allowOrderCancel',
  'userAppEnabled', 'adminAppEnabled', 'maintenanceMessage',
  'flashDropEnabled', 'flashDropEndIso',
  'reviewsEnabled', 'couponsEnabled', 'wishlistEnabled', 'ticketsEnabled',
  'slidersEnabled', 'noticesEnabled', 'eMarketEnabled',
  'codEnabled', 'codMinOrderBdt', 'codMaxOrderBdt', 'codAdvanceDeliveryOutsideDhaka', 'codAdvanceDeliveryAll',
  'deliveryInsideDhakaBdt', 'deliveryOutsideDhakaBdt', 'deliveryExpressBdt',
  'freeDeliveryThresholdBdt', 'heavenPayEnabled',
  'manualPayEnabled', 'autoPayEnabled', 'autoPayProvider', 'autoPaySandbox', 'walletEnabled',
  'bkashEnabled', 'bkashNumber',
  'nagadEnabled', 'nagadNumber', 'rocketEnabled', 'rocketNumber',
  'upayEnabled', 'upayNumber', 'cardGatewayEnabled', 'gatewayFeePercent',
  'gatewayInstructions',
  'cashbackPercent', 'referralBonusBdt', 'comboMinQty', 'comboDiscountPercent', 'ffLookupEnabled',
  'reelsEnabled', 'spinWheelEnabled', 'dailyCheckInBdt', 'preOrderEnabled',
  'groupBuyEnabled', 'giftCardsEnabled', 'tournamentsEnabled',
  'vipEnabled', 'emiEnabled', 'otpRequiredForOrder', 'reviewBonusBdt', 'resellerCommissionPct',
  'resellerDefaultDiscountPct', 'lowStockThreshold'
];

const VIEW_META = {
  analytics: { title: 'Executive Analytics', sub: 'লাইভ রেভিনিউ, পেমেন্ট চ্যানেল ও অর্ডার পাইপলাইন' },
  settings: { title: 'Owner Master Settings', sub: 'অ্যাপের নাম, লোগো, থিম, কালার, পেমেন্ট গেটওয়ে এবং লাইভ CSS/JS নিয়ন্ত্রণ' },
  orders: { title: 'Orders Hub', sub: 'সকল ফিজিক্যাল অর্ডার নিয়ন্ত্রণ, ৪×৬ লেবেল ও এক্সপোর্ট' },
  products: { title: 'Products, Q&A & Low Stock', sub: 'ক্যাটালগ, ভ্যারিয়েন্ট প্রাইসিং, Q&A এবং স্টক ওয়ার্নিং' },
  emarket: { title: 'E-Market Hub', sub: 'গেম টপআপ, অ্যাপ সাবস্ক্রিপশন ও রিডিম ডেলিভারি' },
  wallet: { title: 'Wallet Add-Money Requests', sub: 'কাস্টমারদের ম্যানুয়াল অ্যাড-মানি যাচাই, ব্যালেন্স ক্রেডিট ও ওয়ালেট ইতিহাস' },
  coupons: { title: 'Coupon Studio', sub: 'ডিসকাউন্ট কোড ও অফার নিয়ন্ত্রণ' },
  categories: { title: 'Categories', sub: 'স্টোর ক্যাটাগরি ও ডিসপ্লে সর্টিং' },
  sliders: { title: 'Hero Sliders', sub: 'হোমপেজ স্লাইডার ব্যানার' },
  notices: { title: 'Notice Board', sub: 'স্টোরফ্রন্ট নোটিশ বোর্ড' },
  notifications: { title: 'Push Notifications', sub: 'ব্রডকাস্ট এবং পার্সোনালাইজড পুশ অ্যালার্ট' },
  reels: { title: 'Viral Reels Studio', sub: 'সপেবল ভাইরাল ভিডিও রিলস তৈরি ও পরিচালনা' },
  campaigns: { title: 'Campaigns & Flash Sales', sub: 'সিডিউলড মেগা সেলস ও অটো ডিসকাউন্ট' },
  tournaments: { title: 'Tournaments & Custom Rooms', sub: 'ইস্পোর্টস টুর্নামেন্ট ও প্রটেক্টেড রুম আইডি/পাসওয়ার্ড' },
  admins: { title: 'Admins & Performance Tracker', sub: 'নরমাল অ্যাডমিন তৈরি, পারমিশন বণ্টন এবং পারফরম্যান্স লিডারবোর্ড' },
  users: { title: 'Customers CRM & Wallet Control', sub: 'NX-ID, ওয়ালেট অ্যাড/মাইনাস, ব্যান/আনব্যান এবং রিসেলার অনুমোদন' },
  returns: { title: 'Returns & Photo Disputes', sub: 'রিটার্ন, রিপ্লেসমেন্ট ও আনবক্সিং প্রুফ রিভিউ' },
  blacklist: { title: 'Fake Order Shield & Blacklist', sub: 'ভুয়া অর্ডার প্রতিরোধ ও ফোন/ইমেইল ব্ল্যাকলিস্ট' },
  tickets: { title: 'Support Inbox', sub: 'কাস্টমার সাপোর্ট টিকিট ও রিপ্লাই' },
  audit: { title: 'Owner Audit Log', sub: 'সিস্টেম অ্যাকশন হিস্টোরি' },
  studio: { title: 'Code Studio & Seed', sub: 'লাইভ সোর্স কোড এডিটর, ডাউনলোড ও স্টোর সিড' }
};

let app, auth, db, firebaseCfgGlobal = null;
let currentOwner = null;
let isGoogleSignInBusy = false;
let currentView = 'analytics';
let storeConfig = { ...DEFAULT_STORE_CONFIG };
let codeOverrides = { userCustomCss: '', userCustomJs: '', adminCustomCss: '', adminCustomJs: '' };
let assetPickerTargetId = null;
let unsubModalChat = null;
let activeAnalyticsSnapshot = null;
let activeVaultOrderLockKey = '';

const state = {
  products: [],
  orders: [],
  emarketItems: [],
  emarketOrders: [],
  walletRequests: [],
  resellerWithdrawals: [],
  supportChats: [],
  faqs: [],
  sliders: [],
  notices: [],
  notifications: [],
  categories: [],
  coupons: [],
  admins: [],
  adminInvites: [],
  users: [],
  returns: [],
  reels: [],
  campaigns: [],
  tournaments: [],
  blacklist: [],
  stockAlerts: [],
  tickets: [],
  auditLogs: [],
  emPinsVault: { total: 0, counts: {}, pins: [] },
  analyticsRange: { from: '', to: '' },
  expenses: [],
  creatorPromos: [],
  abandonedCarts: [],
  offers: []
};

const unsubs = {};
const vLiveReady = {};
let loggedOwnerUid = '';

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
const validHex = (val, fallback) => /^#[0-9a-fA-F]{6}$/.test(String(val || '').trim()) ? String(val).trim() : fallback;

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
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

function showToast(msg) {
  const el = document.getElementById('vault-toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 3400);
}

function showAuthError(msg) {
  const err = document.getElementById('vault-auth-error');
  const note = document.getElementById('vault-auth-notice');
  if (note) note.classList.add('hidden');
  if (err) { err.textContent = msg; err.classList.remove('hidden'); }
}

function showAuthNotice(msg) {
  const err = document.getElementById('vault-auth-error');
  const note = document.getElementById('vault-auth-notice');
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
  const sb = document.getElementById('vault-sidebar');
  const bd = document.getElementById('vault-drawer-backdrop');
  if (!sb || !bd) return;
  const shouldOpen = typeof open === 'boolean' ? open : !sb.classList.contains('open');
  sb.classList.toggle('open', shouldOpen);
  bd.classList.toggle('hidden', !shouldOpen);
}

async function logAudit(action, target) {
  if (!currentOwner) return;
  try {
    await addDoc(collection(db, 'auditLogs'), {
      actorUid: currentOwner.uid,
      actorEmail: currentOwner.email || '',
      actorRole: 'main_admin',
      action: String(action || 'ACTION').slice(0, 120),
      target: String(target || '').slice(0, 160),
      createdAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'auditLogs');
  }
}

async function saveStoreConfigPartial(patch = {}) {
  const merged = { ...DEFAULT_STORE_CONFIG, ...storeConfig, ...patch };
  const payload = {};
  STORE_CONFIG_FIELDS.forEach((k) => {
    payload[k] = merged[k] !== undefined ? merged[k] : DEFAULT_STORE_CONFIG[k];
  });
  const clampStr = (v, max, fb = '') => String(v ?? fb).trim().slice(0, max);
  const safeNum = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };
  const safeInt = (v, fb = 0) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fb;
  };

  payload.brandName = clampStr(payload.brandName, 60, 'Naxora Bd') || 'Naxora Bd';
  payload.brandLogoUrl = clampStr(payload.brandLogoUrl, 500, DEFAULT_LOGO);
  payload.brandTaglineBn = clampStr(payload.brandTaglineBn, 160);
  payload.brandTaglineEn = clampStr(payload.brandTaglineEn, 160);
  payload.footerTagBn = clampStr(payload.footerTagBn, 240);
  payload.footerTagEn = clampStr(payload.footerTagEn, 240);
  payload.metaTitle = clampStr(payload.metaTitle, 120);
  payload.metaDescription = clampStr(payload.metaDescription, 240);
  payload.currencySymbol = clampStr(payload.currencySymbol, 8, '৳') || '৳';
  payload.defaultLang = payload.defaultLang === 'en' ? 'en' : 'bn';
  payload.supportPhone = clampStr(payload.supportPhone, 30);
  payload.supportWhatsapp = clampStr(payload.supportWhatsapp, 30);
  payload.supportEmail = clampStr(payload.supportEmail, 160);
  payload.announcementBn = clampStr(payload.announcementBn, 200);
  payload.announcementEn = clampStr(payload.announcementEn, 200);
  payload.heroTitle = clampStr(payload.heroTitle, 140, 'Viral Tech & Drops') || 'Viral Tech & Drops';
  payload.heroSubtitle = clampStr(payload.heroSubtitle, 300);
  payload.accentColor = validHex(payload.accentColor, '#ff2e63');
  payload.secondaryColor = validHex(payload.secondaryColor, '#08d9d6');
  payload.gridColsDesktop = Math.min(6, Math.max(3, safeInt(payload.gridColsDesktop, 5)));
  payload.cardCompactMode = Boolean(payload.cardCompactMode);
  payload.sliderAutoPlayMs = Math.min(20000, Math.max(2000, safeInt(payload.sliderAutoPlayMs, 5000)));
  [
    'showAnnouncementBar', 'showHeaderSearch', 'showHeaderNotices', 'showHeaderNotifs',
    'showLangToggle', 'showBottomNav', 'showHomeCategories', 'showRecentlyViewed',
    'showFooter', 'allowOrderCancel', 'userAppEnabled', 'adminAppEnabled',
    'flashDropEnabled', 'reviewsEnabled', 'couponsEnabled', 'wishlistEnabled',
    'ticketsEnabled', 'slidersEnabled', 'noticesEnabled', 'eMarketEnabled',
    'codEnabled', 'codAdvanceDeliveryOutsideDhaka', 'codAdvanceDeliveryAll', 'heavenPayEnabled',
    'bkashEnabled', 'nagadEnabled', 'rocketEnabled', 'upayEnabled', 'cardGatewayEnabled'
  ].forEach((bk) => { payload[bk] = Boolean(payload[bk]); });
  payload.maintenanceMessage = clampStr(payload.maintenanceMessage, 300);
  payload.flashDropEndIso = clampStr(payload.flashDropEndIso, 40);
  payload.codMinOrderBdt = Math.max(0, safeNum(payload.codMinOrderBdt, 0));
  payload.codMaxOrderBdt = Math.max(0, safeNum(payload.codMaxOrderBdt, 0));
  payload.deliveryInsideDhakaBdt = Math.max(0, safeNum(payload.deliveryInsideDhakaBdt, 70));
  payload.deliveryOutsideDhakaBdt = Math.max(0, safeNum(payload.deliveryOutsideDhakaBdt, 130));
  payload.deliveryExpressBdt = Math.max(0, safeNum(payload.deliveryExpressBdt, 180));
  payload.freeDeliveryThresholdBdt = Math.max(0, safeNum(payload.freeDeliveryThresholdBdt, 0));
  payload.bkashNumber = clampStr(payload.bkashNumber, 30);
  payload.nagadNumber = clampStr(payload.nagadNumber, 30);
  payload.rocketNumber = clampStr(payload.rocketNumber, 30);
  payload.upayNumber = clampStr(payload.upayNumber, 30);
  payload.gatewayFeePercent = Math.min(25, Math.max(0, safeNum(payload.gatewayFeePercent, 0)));
  payload.gatewayInstructions = clampStr(payload.gatewayInstructions, 400);
  payload.manualPayEnabled = payload.manualPayEnabled !== false;
  payload.autoPayEnabled = payload.autoPayEnabled !== false;
  payload.autoPayProvider = clampStr(payload.autoPayProvider, 60, 'SSLCommerz / UddoktaPay Auto');
  payload.autoPaySandbox = payload.autoPaySandbox !== false;
  payload.walletEnabled = payload.walletEnabled !== false;
  payload.cashbackPercent = Math.min(25, Math.max(0, safeNum(payload.cashbackPercent ?? 2, 2)));
  payload.referralBonusBdt = Math.min(5000, Math.max(0, safeNum(payload.referralBonusBdt ?? 50, 50)));
  payload.comboMinQty = Math.min(20, Math.max(2, safeInt(payload.comboMinQty ?? 3, 3)));
  payload.comboDiscountPercent = Math.min(50, Math.max(0, safeNum(payload.comboDiscountPercent ?? 10, 10)));
  payload.ffLookupEnabled = payload.ffLookupEnabled !== false;
  payload.reelsEnabled = payload.reelsEnabled !== false;
  payload.spinWheelEnabled = payload.spinWheelEnabled !== false;
  payload.dailyCheckInBdt = Math.min(500, Math.max(0, safeNum(payload.dailyCheckInBdt ?? 5, 5)));
  payload.preOrderEnabled = payload.preOrderEnabled !== false;
  payload.groupBuyEnabled = payload.groupBuyEnabled !== false;
  payload.giftCardsEnabled = payload.giftCardsEnabled !== false;
  payload.tournamentsEnabled = payload.tournamentsEnabled !== false;
  payload.vipEnabled = payload.vipEnabled !== false;
  payload.emiEnabled = payload.emiEnabled !== false;
  payload.otpRequiredForOrder = Boolean(payload.otpRequiredForOrder);
  payload.reviewBonusBdt = Math.min(500, Math.max(0, safeNum(payload.reviewBonusBdt ?? 20, 20)));
  payload.resellerCommissionPct = Math.min(50, Math.max(0, safeNum(payload.resellerCommissionPct ?? 10, 10)));
  payload.resellerDefaultDiscountPct = Math.min(50, Math.max(0, safeNum(payload.resellerDefaultDiscountPct ?? 8, 8)));
  payload.lowStockThreshold = Math.min(100, Math.max(1, safeInt(payload.lowStockThreshold ?? 5, 5)));
  payload.updatedAt = serverTimestamp();

  await setDoc(doc(db, 'storeConfig', 'global'), payload, { merge: true });
  storeConfig = { ...payload };
  syncBrandHeader();
}

function syncBrandHeader() {
  const logo = storeConfig.brandLogoUrl || DEFAULT_LOGO;
  const name = storeConfig.brandName || 'Naxora Bd';
  ['vault-brand-logo', 'auth-vault-logo', 'pl-logo-preview'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.src = logo;
  });
  const fav = document.getElementById('vault-favicon');
  if (fav) fav.href = logo;
  ['vault-brand-title', 'auth-vault-title'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });
}

function populateSettingsForms() {
  const c = storeConfig;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  // Basic
  setVal('pl-brand-name', c.brandName);
  setVal('pl-currency', c.currencySymbol);
  setVal('pl-logo-url', c.brandLogoUrl);
  const lp = document.getElementById('pl-logo-preview');
  if (lp) lp.src = c.brandLogoUrl || DEFAULT_LOGO;
  setVal('pl-tagline-bn', c.brandTaglineBn);
  setVal('pl-tagline-en', c.brandTaglineEn);
  setVal('pl-footer-bn', c.footerTagBn);
  setVal('pl-footer-en', c.footerTagEn);
  setVal('pl-meta-title', c.metaTitle);
  setVal('pl-meta-desc', c.metaDescription);
  setVal('pl-default-lang', c.defaultLang === 'en' ? 'en' : 'bn');
  setVal('pl-sup-phone', c.supportPhone);
  setVal('pl-sup-wa', c.supportWhatsapp);
  setVal('pl-sup-email', c.supportEmail);
  setVal('pl-ann-bn', c.announcementBn);
  setVal('pl-ann-en', c.announcementEn);
  setVal('pl-hero-title', c.heroTitle);
  setVal('pl-hero-sub', c.heroSubtitle);

  // Theme & Toggles
  setVal('pl-accent', validHex(c.accentColor, '#ff2e63'));
  setVal('pl-secondary', validHex(c.secondaryColor, '#08d9d6'));
  setVal('pl-grid-cols', c.gridColsDesktop || 5);
  setVal('pl-slider-ms', c.sliderAutoPlayMs || 5000);
  setVal('pl-combo-min-qty', c.comboMinQty ?? 3);
  setVal('pl-combo-discount-pct', c.comboDiscountPercent ?? 10);
  setVal('pl-cashback-pct', c.cashbackPercent ?? 2);
  setVal('pl-referral-bonus', c.referralBonusBdt ?? 50);
  setVal('pl-maint-msg', c.maintenanceMessage);
  setVal('pl-daily-checkin-bdt', c.dailyCheckInBdt ?? 5);
  setVal('pl-reseller-disc', c.resellerDefaultDiscountPct ?? 8);
  setVal('pl-low-stock', c.lowStockThreshold ?? 5);
  setVal('pl-review-bonus', c.reviewBonusBdt ?? 20);
  setVal('pl-reseller-comm', c.resellerCommissionPct ?? 10);

  if (c.flashDropEndIso) {
    const d = new Date(c.flashDropEndIso);
    if (!Number.isNaN(d.getTime())) {
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setVal('pl-flash-end', local);
    }
  }

  setChk('pl-compact-mode', c.cardCompactMode !== false);
  setChk('pl-show-ann', c.showAnnouncementBar !== false);
  setChk('pl-show-search', c.showHeaderSearch !== false);
  setChk('pl-show-notices', c.showHeaderNotices !== false);
  setChk('pl-show-notifs', c.showHeaderNotifs !== false);
  setChk('pl-show-lang', c.showLangToggle !== false);
  setChk('pl-show-bnav', c.showBottomNav !== false);
  setChk('pl-show-cats', c.showHomeCategories !== false);
  setChk('pl-show-recent', c.showRecentlyViewed !== false);
  setChk('pl-show-footer', c.showFooter !== false);
  setChk('pl-allow-cancel', c.allowOrderCancel !== false);
  setChk('pl-user-app', c.userAppEnabled !== false);
  setChk('pl-admin-app', c.adminAppEnabled !== false);
  setChk('pl-flash-enabled', c.flashDropEnabled !== false);
  setChk('pl-emarket-enabled', c.eMarketEnabled !== false);
  setChk('pl-ff-lookup-enabled', c.ffLookupEnabled !== false);
  setChk('pl-sliders-enabled', c.slidersEnabled !== false);
  setChk('pl-notices-enabled', c.noticesEnabled !== false);
  setChk('pl-coupons-enabled', c.couponsEnabled !== false);
  setChk('pl-reviews-enabled', c.reviewsEnabled !== false);
  setChk('pl-wishlist-enabled', c.wishlistEnabled !== false);
  setChk('pl-tickets-enabled', c.ticketsEnabled !== false);
  setChk('pl-reels-enabled', c.reelsEnabled !== false);
  setChk('pl-spin-enabled', c.spinWheelEnabled !== false);
  setChk('pl-preorder-enabled', c.preOrderEnabled !== false);
  setChk('pl-groupbuy-enabled', c.groupBuyEnabled !== false);
  setChk('pl-giftcards-enabled', c.giftCardsEnabled !== false);
  setChk('pl-tournaments-enabled', c.tournamentsEnabled !== false);
  setChk('pl-vip-enabled', c.vipEnabled !== false);
  setChk('pl-emi-enabled', c.emiEnabled !== false);
  setChk('pl-otp-required', !!c.otpRequiredForOrder);

  // Payment Gateways
  setVal('gw-dhaka', c.deliveryInsideDhakaBdt);
  setVal('gw-outside', c.deliveryOutsideDhakaBdt);
  setVal('gw-express', c.deliveryExpressBdt);
  setVal('gw-free-over', c.freeDeliveryThresholdBdt);
  setVal('gw-cod-min', c.codMinOrderBdt);
  setVal('gw-cod-max', c.codMaxOrderBdt);
  setVal('gw-bkash-num', c.bkashNumber);
  setVal('gw-nagad-num', c.nagadNumber);
  setVal('gw-rocket-num', c.rocketNumber);
  setVal('gw-upay-num', c.upayNumber);
  setVal('gw-auto-provider', c.autoPayProvider);
  setVal('gw-fee-pct', c.gatewayFeePercent);
  setVal('gw-instructions', c.gatewayInstructions);

  setChk('gw-manual-on', c.manualPayEnabled !== false);
  setChk('gw-auto-on', c.autoPayEnabled !== false);
  setChk('gw-auto-sandbox', c.autoPaySandbox !== false);
  setChk('gw-wallet-on', c.walletEnabled !== false);
  setChk('gw-cod-on', c.codEnabled !== false);
  setChk('gw-cod-adv', !!c.codAdvanceDeliveryOutsideDhaka);
  setChk('gw-cod-adv-all', !!c.codAdvanceDeliveryAll);
  setChk('gw-heaven-on', c.heavenPayEnabled !== false);
  setChk('gw-bkash-on', c.bkashEnabled !== false);
  setChk('gw-nagad-on', c.nagadEnabled !== false);
  setChk('gw-rocket-on', c.rocketEnabled !== false);
  setChk('gw-upay-on', c.upayEnabled !== false);
  setChk('gw-card-on', c.cardGatewayEnabled !== false);

  // Code overrides
  setVal('co-user-css', codeOverrides.userCustomCss || '');
  setVal('co-user-js', codeOverrides.userCustomJs || '');
  setVal('co-admin-css', codeOverrides.adminCustomCss || '');
  setVal('co-admin-js', codeOverrides.adminCustomJs || '');
  if (typeof updateVpAdvDelivHint === 'function') updateVpAdvDelivHint();
}

function updateVpAdvDelivHint() {
  const hint = document.getElementById('vp-adv-deliv-hint');
  const dhakaEl = document.getElementById('gw-dhaka');
  const outsideEl = document.getElementById('gw-outside');
  const fallbackDhaka = dhakaEl && dhakaEl.value !== '' ? Number(dhakaEl.value || 0) : Number(storeConfig.deliveryInsideDhakaBdt ?? 70);
  const fallbackOutside = outsideEl && outsideEl.value !== '' ? Number(outsideEl.value || 0) : Number(storeConfig.deliveryOutsideDhakaBdt ?? 130);
  const dInEl = document.getElementById('vp-deliv-dhaka');
  const dOutEl = document.getElementById('vp-deliv-outside');
  if (dInEl) dInEl.placeholder = `অটো (সেটিংস: ${money(fallbackDhaka)})`;
  if (dOutEl) dOutEl.placeholder = `অটো (সেটিংস: ${money(fallbackOutside)})`;
  if (!hint) return;
  const dhakaFee = dInEl && String(dInEl.value).trim() !== '' ? Math.max(0, Number(dInEl.value) || 0) : fallbackDhaka;
  const outsideFee = dOutEl && String(dOutEl.value).trim() !== '' ? Math.max(0, Number(dOutEl.value) || 0) : fallbackOutside;
  const prodAdvOn = document.getElementById('vp-adv-deliv')?.checked || false;
  const globalAdvOn = document.getElementById('gw-cod-adv-all')?.checked ?? !!storeConfig.codAdvanceDeliveryAll;
  const customFee = Number(document.getElementById('vp-adv-deliv-fee')?.value || 0);
  if (customFee > 0 && !(dInEl && String(dInEl.value).trim() !== '') && !(dOutEl && String(dOutEl.value).trim() !== '')) {
    hint.textContent = `ফিক্সড অগ্রিম ${money(customFee)} (০ দিলে ঢাকা ${money(dhakaFee)} / বাইরে ${money(outsideFee)} নেবে)`;
  } else if (prodAdvOn || globalAdvOn) {
    hint.textContent = `✅ অটো অগ্রিম: ঢাকার ভেতরে ${money(dhakaFee)} · ঢাকার বাইরে ${money(outsideFee)}`;
  } else {
    hint.textContent = `ডেলিভারি: ঢাকার ভেতরে ${money(dhakaFee)} · ঢাকার বাইরে ${money(outsideFee)}`;
  }
}

function buildMobileNav() {
  const mobile = document.getElementById('vault-mobile-nav');
  if (!mobile) return;
  const items = Array.from(document.querySelectorAll('#vault-sidebar-nav .nav-item'));
  mobile.innerHTML = items.map((b) => `
    <button type="button" class="mobile-nav-btn ${b.dataset.view === currentView ? 'active' : ''}" data-view="${esc(b.dataset.view)}">
      ${esc(b.querySelector('span')?.textContent || b.dataset.view)}
    </button>
  `).join('');
}

function switchView(viewKey) {
  currentView = viewKey;
  document.querySelectorAll('.view-section').forEach((s) => s.classList.add('hidden'));
  document.getElementById(`view-${viewKey}`)?.classList.remove('hidden');
  document.querySelectorAll('#vault-sidebar-nav .nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === viewKey));
  document.querySelectorAll('#vault-mobile-nav .mobile-nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewKey));
  const meta = VIEW_META[viewKey] || VIEW_META.analytics;
  document.getElementById('v-topbar-title').textContent = meta.title;
  document.getElementById('v-topbar-sub').textContent = meta.sub;
  toggleMobileSidebar(false);

  if (viewKey === 'analytics') loadVaultExpenses();
  if (viewKey === 'orders') loadVaultAbandonedCarts();
  if (viewKey === 'coupons') { loadVaultCreators(); loadVaultOffers(); }
  if (viewKey === 'users') loadResellerWithdrawals();
  if (viewKey === 'tickets') { loadSupportChats(); loadFaqs(); }
  if (viewKey === 'emarket') loadEmPinsVault();
}

function switchSettingsTab(tabKey) {
  document.querySelectorAll('.settings-tab').forEach((b) => b.classList.toggle('active', b.dataset.settingsTab === tabKey));
  document.querySelectorAll('.settings-panel').forEach((p) => p.classList.add('hidden'));
  document.getElementById(`stab-${tabKey}`)?.classList.remove('hidden');
}

/* ==================== RENDERERS ==================== */

function toDateObj(ts) {
  if (!ts) return null;
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inAnalyticsDateRange(ts) {
  const { from, to } = state.analyticsRange;
  if (!from && !to) return true;
  const d = toDateObj(ts);
  if (!d) return false;
  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (d < start) return false;
  }
  if (to) {
    const end = new Date(`${to}T23:59:59.999`);
    if (d > end) return false;
  }
  return true;
}

function renderAnalytics() {
  const ordersInRange = state.orders.filter((o) => inAnalyticsDateRange(o.createdAt));
  const emOrdersInRange = state.emarketOrders.filter((o) => inAnalyticsDateRange(o.createdAt));

  const validPhys = ordersInRange.filter((o) => o.status !== 'cancelled' && o.paymentStatus !== 'refunded');
  const validEm = emOrdersInRange.filter((o) => o.status !== 'cancelled' && o.paymentStatus !== 'refunded');

  const prodCostById = new Map();
  const prodCostByTitle = new Map();
  state.products.forEach((p) => {
    const c = Math.max(0, Number(p.costPriceBdt || 0));
    prodCostById.set(p.id, c);
    if (p.title) prodCostByTitle.set(String(p.title).toLowerCase(), c);
  });
  const emCostById = new Map();
  state.emarketItems.forEach((it) => emCostById.set(it.id, Math.max(0, Number(it.costPriceBdt || 0))));

  let physRev = 0;
  let physCost = 0;
  const topMap = new Map();
  const dayMap = new Map();
  const endRef = state.analyticsRange.to ? new Date(`${state.analyticsRange.to}T12:00:00`) : new Date();
  for (let i = 9; i >= 0; i--) {
    const d = new Date(endRef.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dayMap.set(key, { key, label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), rev: 0, cost: 0 });
  }

  validPhys.forEach((o) => {
    const oRev = Number(o.totalBdt || 0);
    let oCogs = 0;
    (o.items || []).forEach((it) => {
      const qty = Math.max(1, Number(it.qty || 1));
      const unitCost = Number(it.costPriceBdt ?? prodCostById.get(it.productId) ?? prodCostByTitle.get(String(it.title || '').toLowerCase()) ?? 0);
      const iCost = unitCost * qty;
      const iRev = Number(it.priceBdt || 0) * qty;
      oCogs += iCost;
      const key = it.title || 'Product';
      const cur = topMap.get(key) || { name: key, qty: 0, rev: 0, cost: 0 };
      cur.qty += qty;
      cur.rev += iRev;
      cur.cost += iCost;
      topMap.set(key, cur);
    });
    physRev += oRev;
    physCost += oCogs;
    const dObj = toDateObj(o.createdAt);
    if (dObj) {
      const dk = dObj.toISOString().slice(0, 10);
      if (dayMap.has(dk)) {
        dayMap.get(dk).rev += oRev;
        dayMap.get(dk).cost += oCogs;
      }
    }
  });

  let emRev = 0;
  let emCost = 0;
  validEm.forEach((o) => {
    const r = Number(o.totalBdt || o.priceBdt || 0);
    const c = Number(o.costPriceBdt ?? emCostById.get(o.itemId) ?? 0);
    emRev += r;
    emCost += c;
    const key = o.itemTitle || 'E-Market';
    const cur = topMap.get(key) || { name: key, qty: 0, rev: 0, cost: 0 };
    cur.qty += 1;
    cur.rev += r;
    cur.cost += c;
    topMap.set(key, cur);
    const dObj = toDateObj(o.createdAt);
    if (dObj) {
      const dk = dObj.toISOString().slice(0, 10);
      if (dayMap.has(dk)) {
        dayMap.get(dk).rev += r;
        dayMap.get(dk).cost += c;
      }
    }
  });

  const totalRev = physRev + emRev;
  const totalCost = physCost + emCost;
  const netProfit = totalRev - totalCost;
  const totalExpenses = (state.expenses || []).reduce((s, ex) => s + Number(ex.amountBdt || 0), 0);
  const trueNetProfit = netProfit - totalExpenses;
  const roiBase = totalCost + totalExpenses;
  const roiPct = roiBase > 0 ? Math.round((trueNetProfit / roiBase) * 1000) / 10 : 0;
  const marginPct = totalRev > 0 ? Math.round((netProfit / totalRev) * 1000) / 10 : 0;

  activeAnalyticsSnapshot = {
    from: state.analyticsRange.from || 'All',
    to: state.analyticsRange.to || 'All',
    physRev,
    emRev,
    totalRev,
    physCost,
    emCost,
    totalCost,
    totalExpenses,
    netProfit: trueNetProfit,
    roiPct,
    marginPct,
    orderCount: ordersInRange.length + emOrdersInRange.length,
    topItems: Array.from(topMap.values()).sort((a, b) => b.rev - a.rev).slice(0, 10)
  };

  const pendingOrders = state.orders.filter((o) => o.status === 'pending').length;
  const pendingEm = state.emarketOrders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  const lowPinPacks = Object.values(state.emPinsVault?.counts || {}).filter((c) => Number(c) < 3).length;

  document.getElementById('kpi-revenue').textContent = money(totalRev);
  document.getElementById('kpi-revenue-sub').textContent = `Physical ${money(physRev)} · E-Market ${money(emRev)}`;
  const costEl = document.getElementById('kpi-cost');
  if (costEl) costEl.textContent = money(totalCost);
  const costSub = document.getElementById('kpi-cost-sub');
  if (costSub) costSub.textContent = `Physical ${money(physCost)} · E-Market ${money(emCost)} · Exp ${money(totalExpenses)}`;
  const profEl = document.getElementById('kpi-profit');
  if (profEl) profEl.textContent = money(trueNetProfit);
  const profSub = document.getElementById('kpi-profit-sub');
  if (profSub) profSub.textContent = `ROI ${roiPct}% · Gross Margin ${marginPct}% (${validPhys.length + validEm.length} active)`;
  renderVaultExpenses();

  document.getElementById('kpi-orders').textContent = String(ordersInRange.length + emOrdersInRange.length);
  document.getElementById('kpi-orders-sub').textContent = `${pendingOrders} physical · ${pendingEm} E-Market${lowPinPacks > 0 ? ` · ⚠ ${lowPinPacks} low PINs` : ''}`;
  document.getElementById('kpi-catalog').textContent = String(state.products.length + state.emarketItems.length);
  document.getElementById('kpi-catalog-sub').textContent = `${state.products.length} products · ${state.emarketItems.length} E-Market`;
  document.getElementById('kpi-users').textContent = String(state.users.length);
  document.getElementById('kpi-users-sub').textContent = `Approved admins: ${state.admins.filter((a) => a.status === 'approved').length}`;

  const bo = document.getElementById('v-badge-orders');
  if (bo) { bo.textContent = String(pendingOrders); bo.classList.toggle('hidden', pendingOrders === 0); }
  const bem = document.getElementById('v-badge-emarket');
  if (bem) { bem.textContent = String(pendingEm); bem.classList.toggle('hidden', pendingEm === 0); }

  const makeBar = (label, val, max, valText) => {
    const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
    return `
      <div class="bar-row">
        <div class="bar-row-head"><span>${esc(label)}</span><strong class="tabular-nums">${esc(valText)} (${pct}%)</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  };

  document.getElementById('ana-revenue-split').innerHTML =
    makeBar('Physical Storefront', physRev, totalRev, money(physRev)) +
    makeBar('E-Market Digital Hub', emRev, totalRev, money(emRev));

  const chMap = {};
  ordersInRange.forEach((o) => { const m = (o.paymentMethod || 'cod').toUpperCase(); chMap[m] = (chMap[m] || 0) + 1; });
  emOrdersInRange.forEach((o) => { const m = (o.paymentMethod || 'bkash').toUpperCase(); chMap[m] = (chMap[m] || 0) + 1; });
  const totalTx = Object.values(chMap).reduce((a, b) => a + b, 0);
  document.getElementById('ana-payment-channels').innerHTML = totalTx
    ? Object.entries(chMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => makeBar(k, v, totalTx, `${v} orders`)).join('')
    : '<div class="muted-note">No payment data in selected range.</div>';

  const stMap = {};
  ordersInRange.forEach((o) => { const s = o.status || 'pending'; stMap[s] = (stMap[s] || 0) + 1; });
  const totOrd = ordersInRange.length;
  document.getElementById('ana-status-pipeline').innerHTML = totOrd
    ? Object.entries(stMap).map(([k, v]) => makeBar(k, v, totOrd, `${v}`)).join('')
    : '<div class="muted-note">No orders in selected range.</div>';

  const topWrap = document.getElementById('ana-top-products');
  if (topWrap) {
    const top5 = activeAnalyticsSnapshot.topItems.slice(0, 5);
    const maxTop = top5.length ? top5[0].rev : 0;
    topWrap.innerHTML = top5.length
      ? top5.map((t) => makeBar(`${t.name} (${t.qty})`, t.rev, maxTop, money(t.rev))).join('')
      : '<div class="muted-note">No sales recorded in selected range.</div>';
  }

  const profitChartEl = document.getElementById('v-profit-chart');
  if (profitChartEl) {
    const series = Array.from(dayMap.values()).map((d) => ({ ...d, profit: d.rev - d.cost }));
    profitChartEl.innerHTML = buildProfitSvgChart(series);
  }
  const marginTbody = document.getElementById('v-top-margin-tbody');
  if (marginTbody) {
    const topMargin = Array.from(topMap.values())
      .map((r) => ({ ...r, profit: r.rev - r.cost, margin: r.rev > 0 ? ((r.rev - r.cost) / r.rev) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
    marginTbody.innerHTML = topMargin.length
      ? topMargin.map((r) => `
        <tr>
          <td><strong>${esc(r.name)}</strong></td>
          <td class="tabular-nums">${r.qty}</td>
          <td class="tabular-nums">${money(r.rev)}</td>
          <td class="tabular-nums">${money(r.cost)}</td>
          <td class="tabular-nums"><strong>${money(r.profit)}</strong></td>
          <td class="tabular-nums"><span class="status-pill ${r.margin >= 15 ? 'badge-delivered' : 'badge-pending'}">${r.margin.toFixed(1)}%</span></td>
        </tr>
      `).join('')
      : '<tr><td colspan="6" class="muted-note">No sales profit data in selected range.</td></tr>';
  }

  const queueTbody = document.getElementById('v-pending-payments-tbody');
  const pendingPay = state.orders.filter((o) => o.paymentStatus === 'pending_verify' && o.status !== 'cancelled').slice(0, 8);
  queueTbody.innerHTML = pendingPay.length
    ? pendingPay.map((o) => `
      <tr>
        <td><strong class="tabular-nums">#${esc(o.orderNumber || o.id.slice(0, 8))}</strong></td>
        <td>${esc(o.customerName)}<div class="cell-sub">${esc(o.phone)}</div></td>
        <td>${esc(fmtPayLabel(o))}<div class="cell-sub">${esc(o.senderNumber || '—')} · ${esc(o.trxId || '—')}</div></td>
        <td class="tabular-nums"><strong>${money(o.totalBdt)}</strong>${o.paidAmountBdt ? `<div class="cell-sub">Sent: ${money(o.paidAmountBdt)}</div>` : ''}</td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-primary btn-xs" data-verify-pay="${esc(o.id)}">Mark Paid</button>
            <button type="button" class="btn btn-outline btn-xs" data-v-inspect-order="${esc(o.id)}">Inspect</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">All wallet payments verified.</td></tr>';
}

function renderOrders() {
  const tbody = document.getElementById('v-orders-tbody');
  if (!tbody) return;
  const q = (document.getElementById('vo-search')?.value || '').trim().toLowerCase();
  const st = document.getElementById('vo-status-filter')?.value || '';
  const filtered = state.orders.filter((o) => {
    if (st && o.status !== st) return false;
    if (q && !`${o.orderNumber} ${o.customerName} ${o.phone} ${o.trxId || ''} ${o.manualApp || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = filtered.length
    ? filtered.map((o) => `
      <tr>
        <td><strong class="tabular-nums">#${esc(o.orderNumber || o.id.slice(0, 8))}</strong><div class="cell-sub">${fmtTime(o.createdAt)}</div></td>
        <td><strong>${esc(o.customerName)}</strong><div class="cell-sub">${esc(o.phone)}</div></td>
        <td class="tabular-nums"><strong>${money(o.totalBdt)}</strong><div class="cell-sub">${esc(fmtPayLabel(o))}${o.paidAmountBdt ? ` · Sent ${money(o.paidAmountBdt)}` : ''} · ${esc(o.trxId || '—')}</div></td>
        <td>
          <select class="inline-select" data-vo-pay="${esc(o.id)}">
            ${['unpaid', 'pending_verify', 'paid', 'refunded'].map((ps) => `<option value="${ps}" ${o.paymentStatus === ps ? 'selected' : ''}>${ps}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="inline-select" data-vo-status="${esc(o.id)}">
            ${['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'].map((s) => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>
          <div class="inline-actions">
            <input type="text" class="inline-input" style="width:110px" placeholder="Tracking #" value="${esc(o.courierTracking || '')}" data-vo-track="${esc(o.id)}" />
            <button type="button" class="btn btn-outline btn-xs" data-vo-save-track="${esc(o.id)}">Save</button>
            <button type="button" class="btn btn-ghost btn-xs" data-v-inspect-order="${esc(o.id)}">Details</button>
            <button type="button" class="btn btn-outline btn-xs" data-v-label-order="${esc(o.id)}">🏷️ 4×6</button>
            <button type="button" class="btn btn-danger btn-xs" data-vo-del="${esc(o.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="muted-note">No matching orders found.</td></tr>';
}

function renderProducts() {
  const catSel = document.getElementById('vp-cat');
  const cats = state.categories.length
    ? state.categories
    : [{ slug: 'gadgets', nameEn: 'Smart Gadgets' }, { slug: 'gaming', nameEn: 'Gaming Gear' }, { slug: 'fashion', nameEn: 'Streetwear' }, { slug: 'lifestyle', nameEn: 'Lifestyle' }];
  if (catSel) {
    const cur = catSel.value;
    catSel.innerHTML = cats.map((c) => `<option value="${esc(c.slug)}">${esc(c.nameEn || c.slug)}</option>`).join('');
    if (cur && cats.some((c) => c.slug === cur)) catSel.value = cur;
  }

  const rlProdSel = document.getElementById('v-rl-prod');
  if (rlProdSel) {
    const curRl = rlProdSel.value;
    rlProdSel.innerHTML = '<option value="">None (Browse Store)</option>' + state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.title)} (${money(p.priceBdt)})</option>`).join('');
    if (curRl) rlProdSel.value = curRl;
  }

  const slProdSel = document.getElementById('v-sl-prod');
  if (slProdSel) {
    const curSl = slProdSel.value;
    slProdSel.innerHTML = '<option value="">— কোনো নির্দিষ্ট প্রোডাক্ট নয় —</option>' + state.products.map((p) => `<option value="${esc(p.id)}">${esc(p.title)} (${money(p.priceBdt)})</option>`).join('');
    if (curSl) slProdSel.value = curSl;
  }

  const threshold = Math.max(1, Number(storeConfig.lowStockThreshold ?? 5));
  const lowItems = state.products.filter((p) => p.isActive !== false && Number(p.stock || 0) <= threshold);
  const lowPanel = document.getElementById('v-low-stock-panel');
  const lowList = document.getElementById('v-low-stock-list');
  if (lowPanel && lowList) {
    lowPanel.classList.toggle('hidden', lowItems.length === 0);
    lowList.innerHTML = lowItems.map((p) => `
      <div class="low-stock-chip">
        <span><strong>${esc(p.title)}</strong> (${Number(p.stock || 0)} left)</span>
        <button type="button" class="btn btn-primary btn-xs" data-vp-stock="${esc(p.id)}" data-delta="10">+10 Restock</button>
      </div>
    `).join('');
  }

  const tbody = document.getElementById('v-products-tbody');
  if (!tbody) return;
  const q = (document.getElementById('vp-search')?.value || '').trim().toLowerCase();
  const list = state.products.filter((p) => !q || `${p.title} ${p.subtitleBn} ${p.categoryId} ${p.id}`.toLowerCase().includes(q));

  tbody.innerHTML = list.length
    ? list.map((p) => `
      <tr>
        <td>
          <div class="thumb-cell">
            <img src="${esc(p.imageUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" />
            <div><strong>${esc(p.title)}</strong><div class="cell-sub">${esc(p.viralSource || p.subtitleBn || 'Standard')}${p.isPreOrder ? ' · Pre-Order' : ''}${p.groupBuyEnabled ? ' · Group Buy' : ''}${(() => {
              const hasCustomZone = (p.deliveryInsideDhakaBdt !== undefined && p.deliveryInsideDhakaBdt !== null && Number(p.deliveryInsideDhakaBdt) >= 0) || (p.deliveryOutsideDhakaBdt !== undefined && p.deliveryOutsideDhakaBdt !== null && Number(p.deliveryOutsideDhakaBdt) >= 0);
              const inF = (p.deliveryInsideDhakaBdt !== undefined && p.deliveryInsideDhakaBdt !== null && Number(p.deliveryInsideDhakaBdt) >= 0) ? Number(p.deliveryInsideDhakaBdt) : Number(storeConfig.deliveryInsideDhakaBdt ?? 70);
              const outF = (p.deliveryOutsideDhakaBdt !== undefined && p.deliveryOutsideDhakaBdt !== null && Number(p.deliveryOutsideDhakaBdt) >= 0) ? Number(p.deliveryOutsideDhakaBdt) : Number(storeConfig.deliveryOutsideDhakaBdt ?? 130);
              if (p.requireAdvanceDelivery || storeConfig.codAdvanceDeliveryAll) {
                return ` · 🚚 Adv Deliv: ${!hasCustomZone && p.requireAdvanceDelivery && Number(p.advanceDeliveryFeeBdt || 0) > 0 ? money(p.advanceDeliveryFeeBdt) : `ঢাকা ${money(inF)} / বাইরে ${money(outF)}`}`;
              }
              return hasCustomZone ? ` · 🚚 Deliv: ঢাকা ${money(inF)} / বাইরে ${money(outF)}` : '';
            })()}</div></div>
          </div>
        </td>
        <td>${esc(p.categoryId)}</td>
        <td class="tabular-nums"><strong>${money(p.priceBdt)}</strong>${p.resellerPriceBdt ? `<div class="cell-sub">Reseller: ${money(p.resellerPriceBdt)}</div>` : ''}</td>
        <td>
          <div class="stock-adjust">
            <button type="button" class="btn btn-outline btn-xs" data-vp-stock="${esc(p.id)}" data-delta="-1">-1</button>
            <strong class="tabular-nums">${Number(p.stock || 0)}</strong>
            <button type="button" class="btn btn-outline btn-xs" data-vp-stock="${esc(p.id)}" data-delta="5">+5</button>
          </div>
        </td>
        <td><span class="status-pill ${p.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${p.isActive !== false ? 'Active' : 'Hidden'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-vp-edit="${esc(p.id)}">Edit</button>
            <button type="button" class="btn btn-ghost btn-xs" data-vp-reviews="${esc(p.id)}">Reviews</button>
            <button type="button" class="btn btn-ghost btn-xs" data-vp-qa="${esc(p.id)}">Q&amp;A</button>
            <button type="button" class="btn btn-danger btn-xs" data-vp-del="${esc(p.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="muted-note">No products yet.</td></tr>';
}

function populateEmPinSelectors() {
  const itemSel = document.getElementById('vem-pin-item');
  const pkgSel = document.getElementById('vem-pin-pkg');
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

function renderEmPinsVault() {
  const sumEl = document.getElementById('v-em-pins-summary');
  const tbody = document.getElementById('v-em-pins-tbody');
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
        <td><button type="button" class="btn btn-danger btn-xs" data-v-del-pin="${esc(p.id)}">Remove</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">PIN vault is empty.</td></tr>';
}

function renderEMarket() {
  populateEmPinSelectors();
  renderEmPinsVault();
  const itBody = document.getElementById('v-em-items-tbody');
  if (itBody) {
    itBody.innerHTML = state.emarketItems.length
      ? state.emarketItems.map((it) => {
        const pkgs = Array.isArray(it.packages) ? it.packages : [];
        return `
          <tr>
            <td><div class="thumb-cell"><img src="${esc(it.imageUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" /><div><strong>${esc(it.title)}</strong><div class="cell-sub">${esc(it.subtitleBn || it.deliveryEta)}${it.costPriceBdt ? ` · Cost ${money(it.costPriceBdt)}` : ''}</div></div></div></td>
            <td>${esc(it.category)}</td>
            <td class="cell-sub">${pkgs.map((pk) => `${esc(pk.label)} (${money(pk.priceBdt)})`).join(' · ') || '—'}</td>
            <td><span class="status-pill ${it.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${it.isActive !== false ? 'Active' : 'Hidden'}</span></td>
            <td>
              <div class="inline-actions">
                <button type="button" class="btn btn-outline btn-xs" data-vem-edit="${esc(it.id)}">Edit</button>
                <button type="button" class="btn btn-danger btn-xs" data-vem-del="${esc(it.id)}">Del</button>
              </div>
            </td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="5" class="muted-note">No E-Market services yet.</td></tr>';
  }

  const ordBody = document.getElementById('v-em-orders-tbody');
  if (ordBody) {
    ordBody.innerHTML = state.emarketOrders.length
      ? state.emarketOrders.map((eo) => `
        <tr>
          <td><strong class="tabular-nums">#${esc(eo.orderNumber || eo.id.slice(0, 8))}</strong><div class="cell-sub">${fmtTime(eo.createdAt)}</div></td>
          <td>
            <strong>${esc(eo.itemTitle)} — ${esc(eo.packageLabel)}</strong>
            <div class="cell-sub">Target: ${esc(eo.targetAccount)}${eo.playerNickname ? ` · <b>IGN: ${esc(eo.playerNickname)}</b>` : ''}</div>
          </td>
          <td class="tabular-nums"><strong>${money(eo.totalBdt)}</strong><div class="cell-sub">${esc(fmtPayLabel(eo))}${eo.paidAmountBdt ? ` · Sent ${money(eo.paidAmountBdt)}` : ''} · ${esc(eo.trxId || '—')}</div></td>
          <td>
            <div class="inline-actions">
              <input type="text" class="inline-input" style="width:125px" placeholder="Redeem / PIN" value="${esc(eo.deliveryCode || '')}" data-vem-code="${esc(eo.id)}" />
              <button type="button" class="btn btn-outline btn-xs" data-vem-save-code="${esc(eo.id)}">Save</button>
            </div>
          </td>
          <td>
            <div class="inline-actions">
              <select class="inline-select" data-vem-status="${esc(eo.id)}">
                ${['pending', 'processing', 'completed', 'cancelled'].map((s) => `<option value="${s}" ${eo.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-ghost btn-xs" data-v-inspect-em="${esc(eo.id)}">Details</button>
              <button type="button" class="btn btn-danger btn-xs" data-vem-ord-del="${esc(eo.id)}">Del</button>
            </div>
          </td>
        </tr>
      `).join('')
      : '<tr><td colspan="5" class="muted-note">No E-Market orders yet.</td></tr>';
  }
}

function renderWalletRequests() {
  const pendingCount = state.walletRequests.filter((r) => r.status === 'pending').length;
  const bw = document.getElementById('v-badge-wallet');
  if (bw) { bw.textContent = String(pendingCount); bw.classList.toggle('hidden', pendingCount === 0); }

  const tbody = document.getElementById('v-wallet-tbody');
  if (!tbody) return;
  const q = (document.getElementById('vw-search')?.value || '').trim().toLowerCase();
  const st = document.getElementById('vw-status-filter')?.value || '';
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
              <input type="text" class="inline-input" style="width:120px" placeholder="Note (optional)" data-vw-note="${esc(r.id)}" />
              <button type="button" class="btn btn-primary btn-xs" data-vw-approve="${esc(r.id)}">Approve &amp; Credit</button>
              <button type="button" class="btn btn-danger btn-xs" data-vw-reject="${esc(r.id)}">Reject</button>
            </div>
          ` : `<div class="cell-sub">${esc(r.adminNote || 'Reviewed')}</div>`}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="muted-note">No wallet top-up requests found.</td></tr>';
}

function renderSliders() {
  const tbody = document.getElementById('v-sliders-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.sliders.length
    ? state.sliders.map((s) => {
      const lp = s.linkPage === 'product' && s.linkTarget ? state.products.find((p) => p.id === s.linkTarget) : null;
      const routeLabel = s.linkPage === 'product' ? `📦 ${lp ? lp.title : (s.linkTarget || 'Product')}` : s.linkPage;
      return `
      <tr>
        <td><img src="${esc(s.imageUrl)}" alt="" class="banner-thumb" /></td>
        <td><strong>${esc(s.title)}</strong><div class="cell-sub">${esc(s.ctaLabel)} → ${esc(routeLabel)}</div></td>
        <td><span class="status-pill ${s.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${s.isActive !== false ? 'Active' : 'Paused'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-v-tgl-sl="${esc(s.id)}">${s.isActive !== false ? 'Pause' : 'Enable'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-v-del-sl="${esc(s.id)}">Del</button>
          </div>
        </td>
      </tr>
    `;
    }).join('')
    : '<tr><td colspan="4" class="muted-note">No sliders yet.</td></tr>';
}

function renderNotices() {
  const tbody = document.getElementById('v-notices-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.notices.length
    ? state.notices.map((n) => `
      <tr>
        <td><strong>${esc(n.title)}</strong><div class="cell-sub">${esc(n.messageBn)}</div></td>
        <td><span class="status-pill badge-confirmed">${esc(n.priority)}</span></td>
        <td><span class="status-pill ${n.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${n.isActive !== false ? 'Active' : 'Hidden'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-v-tgl-nt="${esc(n.id)}">${n.isActive !== false ? 'Hide' : 'Show'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-v-del-nt="${esc(n.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">No notices yet.</td></tr>';
}

function renderNotifications() {
  const sel = document.getElementById('v-nf-target');
  if (sel) {
    const cur = sel.value || 'ALL';
    sel.innerHTML = ['<option value="ALL">All Customers (Broadcast)</option>']
      .concat(state.users.map((u) => `<option value="${esc(u.id)}">${esc(u.displayName || u.email || u.id)}</option>`)).join('');
    sel.value = cur;
  }

  const tbody = document.getElementById('v-notifs-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.notifications.length
    ? state.notifications.map((n) => `
      <tr>
        <td><strong>${esc(n.title)}</strong><div class="cell-sub">${esc(n.body)}</div></td>
        <td>${esc(n.targetUid === 'ALL' ? 'All Users' : n.targetUid)}</td>
        <td><span class="status-pill badge-confirmed">${esc(n.type)}</span></td>
        <td class="cell-sub">${fmtTime(n.createdAt)}</td>
        <td><button type="button" class="btn btn-danger btn-xs" data-v-del-nf="${esc(n.id)}">Del</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No notifications sent.</td></tr>';
}

function renderCoupons() {
  const tbody = document.getElementById('v-coupons-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.coupons.length
    ? state.coupons.map((c) => `
      <tr>
        <td><strong>${esc(c.code)}</strong></td>
        <td class="tabular-nums">${c.discountType === 'percent' ? `${Number(c.discountValue)}%` : money(c.discountValue)}</td>
        <td class="tabular-nums">${money(c.minOrderBdt)}</td>
        <td><span class="status-pill ${c.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${c.isActive !== false ? 'Active' : 'Disabled'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-v-tgl-cp="${esc(c.id)}">${c.isActive !== false ? 'Disable' : 'Enable'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-v-del-cp="${esc(c.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No coupons yet.</td></tr>';
}

function renderVaultExpenses() {
  const tbody = document.getElementById('v-expenses-tbody');
  if (!tbody) return;
  const list = state.expenses || [];
  tbody.innerHTML = list.length
    ? list.map((ex) => `
      <tr>
        <td><span class="status-pill badge-confirmed">${esc(ex.category || 'ops')}</span></td>
        <td><strong>${esc(ex.title)}</strong>${ex.note ? `<div class="cell-sub">${esc(ex.note)}</div>` : ''}</td>
        <td class="cell-sub tabular-nums">${esc(ex.date || fmtTime(ex.createdAt))}</td>
        <td class="tabular-nums"><strong>${money(ex.amountBdt)}</strong></td>
        <td><button type="button" class="btn btn-danger btn-xs" data-v-del-exp="${esc(ex.id)}">Remove</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No expenses logged yet.</td></tr>';
}

async function loadVaultExpenses() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.expenses = Array.isArray(data.expenses) ? data.expenses : [];
    renderVaultExpenses();
    renderAnalytics();
  } catch {}
}

function renderVaultAbandonedCarts() {
  const tbody = document.getElementById('v-abandoned-tbody');
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
              ${c.uid ? `<button type="button" class="btn btn-primary btn-xs" data-v-remind-cart="${esc(c.key)}" data-remind-uid="${esc(c.uid)}">${c.remindedAt ? 'Resend Push' : 'Send Reminder'}</button>` : '<span class="cell-sub">Guest</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="4" class="muted-note">No abandoned carts right now.</td></tr>';
}

async function loadVaultAbandonedCarts() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/carts/abandoned', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.abandonedCarts = Array.isArray(data.carts) ? data.carts : [];
    renderVaultAbandonedCarts();
  } catch {}
}

function renderVaultCreators() {
  const tbody = document.getElementById('v-creators-tbody');
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

async function loadVaultCreators() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/coupons/creators', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.creatorPromos = Array.isArray(data.creators) ? data.creators : [];
    renderVaultCreators();
  } catch {}
}

function renderVaultOffers() {
  const tbody = document.getElementById('v-offers-tbody');
  if (!tbody) return;
  const list = state.offers || [];
  tbody.innerHTML = list.length
    ? list.map((o) => `
      <tr>
        <td><strong>${esc(o.title)}</strong></td>
        <td><span class="status-pill badge-confirmed">${esc(o.type)}</span></td>
        <td class="cell-sub">Min Qty: ${Number(o.minQty || 2)} · Off: ${Number(o.discountPct || 0)}%${o.targetCategory ? ` · Cat: ${esc(o.targetCategory)}` : ''}</td>
        <td><button type="button" class="btn btn-danger btn-xs" data-v-del-offer="${esc(o.id)}">Remove</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">No auto offers active.</td></tr>';
}

async function loadVaultOffers() {
  try {
    const res = await fetch('/api/offers');
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.offers = Array.isArray(data.offers) ? data.offers : [];
    renderVaultOffers();
  } catch {}
}

const V_VEC_ICONS = {
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
const V_EMOJI_TO_VEC = { '📱': 'smartphone', '📲': 'smartphone', '🎧': 'headphones', '🎙️': 'headphones', '🎤': 'headphones', '⌚': 'watch', '⏱️': 'watch', '🎮': 'gamepad', '🕹️': 'gamepad', '💻': 'laptop', '🖥️': 'laptop', '👕': 'shirt', '👔': 'shirt', '👗': 'shirt', '👟': 'shoes', '👠': 'shoes', '🎒': 'bag', '🛍️': 'bag', '🛒': 'bag', '💡': 'lamp', '🏠': 'home', '🏡': 'home', '📷': 'camera', '🎥': 'camera', '💄': 'sparkles', '✨': 'sparkles', '🎁': 'gift', '🧸': 'gift', '💍': 'gem', '💎': 'gem', '🔌': 'zap', '⚡': 'zap', '🎵': 'music', '📺': 'tv', '📚': 'book', '🏋️': 'dumbbell', '☕': 'coffee', '❤️': 'heart', '👑': 'crown', '🕶️': 'glasses', '👓': 'glasses', '🔥': 'flame', '📦': 'package' };

function formatCatIconPreview(iconVal) {
  const v = String(iconVal || '').trim();
  if (!v) return `<span class="cat-icon-preview">${V_VEC_ICONS.package}</span>`;
  const cleanKey = v.startsWith('icon:') ? v.slice(5).trim().toLowerCase() : v.toLowerCase();
  if (V_VEC_ICONS[cleanKey]) return `<span class="cat-icon-preview">${V_VEC_ICONS[cleanKey]}</span>`;
  for (const [emo, vecKey] of Object.entries(V_EMOJI_TO_VEC)) {
    if (v.includes(emo) && V_VEC_ICONS[vecKey]) return `<span class="cat-icon-preview">${V_VEC_ICONS[vecKey]}</span>`;
  }
  if (/^(https?:\/\/|\/|data:image\/)/i.test(v)) return `<span class="cat-icon-preview"><img src="${esc(v)}" alt="" /></span>`;
  return `<span class="cat-icon-preview">${esc(v)}</span>`;
}

function renderCategories() {
  const tbody = document.getElementById('v-cats-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.categories.length
    ? state.categories.map((c) => `
      <tr>
        <td>${formatCatIconPreview(c.icon)}</td>
        <td><strong>${esc(c.slug)}</strong></td>
        <td>${esc(c.nameBn)}</td>
        <td>${esc(c.nameEn)}</td>
        <td class="tabular-nums">${Number(c.sortOrder || 0)}</td>
        <td><span class="status-pill ${c.isActive !== false ? 'badge-approved' : 'badge-cancelled'}">${c.isActive !== false ? 'Active' : 'Hidden'}</span></td>
        <td>
          <div class="inline-actions">
            <button type="button" class="btn btn-outline btn-xs" data-v-edit-cat="${esc(c.id)}">Edit</button>
            <button type="button" class="btn btn-danger btn-xs" data-v-del-cat="${esc(c.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="muted-note">No categories yet.</td></tr>';
}

function renderAdmins() {
  const invBody = document.getElementById('v-invites-tbody');
  if (invBody) {
    invBody.innerHTML = state.adminInvites.length
      ? state.adminInvites.map((inv) => {
        const enabled = Object.entries(inv.permissions || {}).filter(([, v]) => v === true).map(([k]) => k.replace(/^can/, ''));
        return `
          <tr>
            <td><strong>${esc(inv.displayName || 'Admin')}</strong><div class="cell-sub">${esc(inv.email)}</div></td>
            <td><span class="status-pill badge-${esc(inv.status)}">${esc(inv.status)}</span></td>
            <td class="cell-sub">${enabled.length ? esc(enabled.join(', ')) : 'None'}</td>
            <td>
              <div class="inline-actions">
                <button type="button" class="btn btn-outline btn-xs" data-v-load-invite="${esc(inv.id)}">Edit</button>
                <button type="button" class="btn btn-danger btn-xs" data-v-del-invite="${esc(inv.id)}">Remove</button>
              </div>
            </td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="4" class="muted-note">No pre-authorized email invites yet. Add one above with Gmail (and optional password).</td></tr>';
  }

  const tbody = document.getElementById('v-admins-tbody');
  if (tbody) {
    tbody.innerHTML = state.admins.length
      ? state.admins.map((a) => {
        const enabled = Object.entries(a.permissions || {}).filter(([, v]) => v === true).map(([k]) => k.replace(/^can/, ''));
        return `
          <tr>
            <td><strong>${esc(a.displayName)}</strong><div class="cell-sub">${esc(a.email)} · ${esc((a.uid || a.id).slice(0, 10))}…</div></td>
            <td><span class="status-pill badge-${esc(a.status)}">${esc(a.status)}</span></td>
            <td class="cell-sub">${enabled.length ? esc(enabled.join(', ')) : 'None'}</td>
            <td>
              <div class="inline-actions">
                <button type="button" class="btn btn-outline btn-xs" data-v-load-admin="${esc(a.id)}">Edit Perms</button>
                <button type="button" class="btn btn-danger btn-xs" data-v-del-admin="${esc(a.id)}">Remove</button>
              </div>
            </td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="4" class="muted-note">No registered sub-admins signed in yet.</td></tr>';
  }

  const perfBody = document.getElementById('v-admin-perf-tbody');
  if (perfBody) {
    perfBody.innerHTML = state.admins.length
      ? state.admins.map((a) => {
        const uid = a.uid || a.id;
        const emailLower = String(a.email || '').toLowerCase();
        const ordCnt = state.orders.filter((o) => o.handledBy === uid || String(o.handledByEmail || '').toLowerCase() === emailLower).length;
        const emCnt = state.emarketOrders.filter((o) => o.handledBy === uid || String(o.handledByEmail || '').toLowerCase() === emailLower).length;
        const walCnt = state.walletRequests.filter((w) => w.reviewedBy === uid).length;
        const actCnt = state.auditLogs.filter((l) => l.actorUid === uid || String(l.actorEmail || '').toLowerCase() === emailLower).length;
        return `
          <tr>
            <td><strong>${esc(a.displayName || 'Admin')}</strong><div class="cell-sub">${esc(a.email)}</div></td>
            <td class="tabular-nums"><strong>${ordCnt}</strong></td>
            <td class="tabular-nums"><strong>${emCnt}</strong></td>
            <td class="tabular-nums"><strong>${walCnt}</strong></td>
            <td class="tabular-nums">${actCnt}</td>
          </tr>
        `;
      }).join('')
      : '<tr><td colspan="5" class="muted-note">No staff performance metrics recorded yet.</td></tr>';
  }
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
  const tbody = document.getElementById('v-users-tbody');
  if (!tbody) return;
  const q = (document.getElementById('vu-search')?.value || '').trim().toLowerCase();
  const flt = document.getElementById('vu-filter')?.value || '';
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
              <button type="button" class="btn btn-primary btn-xs" data-v-manage-user="${esc(u.id)}">Manage User</button>
              <button type="button" class="btn btn-outline btn-xs" data-msg-user="${esc(u.id)}">Notify</button>
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="5" class="muted-note">No customers matched.</td></tr>';
}

function renderReturns() {
  const pendingRet = state.returns.filter((r) => r.status === 'pending').length;
  const br = document.getElementById('v-badge-returns');
  if (br) { br.textContent = String(pendingRet); br.classList.toggle('hidden', pendingRet === 0); }

  const tbody = document.getElementById('v-returns-tbody');
  if (!tbody) return;
  const flt = document.getElementById('vret-filter')?.value || '';
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
              <button type="button" class="btn btn-primary btn-xs" data-vret-approve="${esc(r.id)}">Approve &amp; Refund Wallet</button>
              <button type="button" class="btn btn-outline btn-xs" data-vret-replace="${esc(r.id)}">Approve Replace</button>
              <button type="button" class="btn btn-danger btn-xs" data-vret-reject="${esc(r.id)}">Reject</button>
            </div>
          ` : `<div class="cell-sub">${esc(r.adminNote || 'Reviewed')}</div>`}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No return or dispute requests.</td></tr>';
}

function renderReels() {
  const tbody = document.getElementById('v-reels-tbody');
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
            <button type="button" class="btn btn-outline btn-xs" data-vrl-tgl="${esc(r.id)}">${r.isActive !== false ? 'Pause' : 'Enable'}</button>
            <button type="button" class="btn btn-danger btn-xs" data-vrl-del="${esc(r.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No reels published yet.</td></tr>';
}

function renderCampaigns() {
  const tbody = document.getElementById('v-campaigns-tbody');
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
              <button type="button" class="btn btn-outline btn-xs" data-vcmp-tgl="${esc(c.id)}">${c.isActive !== false ? 'Pause' : 'Enable'}</button>
              <button type="button" class="btn btn-danger btn-xs" data-vcmp-del="${esc(c.id)}">Del</button>
            </div>
          </td>
        </tr>
      `;
    }).join('')
    : '<tr><td colspan="5" class="muted-note">No campaigns scheduled yet.</td></tr>';
}

function renderTournaments() {
  const tbody = document.getElementById('v-tournaments-tbody');
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
            <button type="button" class="btn btn-primary btn-xs" data-vtr-lb="${esc(t.id)}">🏆 Leaderboard</button>
            <button type="button" class="btn btn-outline btn-xs" data-vtr-edit="${esc(t.id)}">Edit / Room</button>
            <button type="button" class="btn btn-danger btn-xs" data-vtr-del="${esc(t.id)}">Del</button>
          </div>
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No tournaments created yet.</td></tr>';
}

function renderBlacklist() {
  const tbody = document.getElementById('v-blacklist-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.blacklist.length
    ? state.blacklist.map((b) => `
      <tr>
        <td><strong>${esc(b.phone || b.email || b.id)}</strong>${b.email && b.phone ? `<div class="cell-sub">${esc(b.email)}</div>` : ''}</td>
        <td>${esc(b.reason || 'Blocked')}</td>
        <td class="cell-sub">${fmtTime(b.createdAt)}</td>
        <td><button type="button" class="btn btn-outline btn-xs" data-vbl-del="${esc(b.id)}">Unblock</button></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">Blacklist shield is clean.</td></tr>';
}

function renderTickets() {
  const openCount = state.tickets.filter((t) => t.status !== 'resolved').length;
  const b = document.getElementById('v-badge-tickets');
  if (b) { b.textContent = String(openCount); b.classList.toggle('hidden', openCount === 0); }

  const wrap = document.getElementById('v-tickets-list');
  if (!wrap) return;
  wrap.innerHTML = state.tickets.length
    ? state.tickets.map((t) => `
      <div class="ticket-card">
        <div class="ticket-head">
          <div><strong>${esc(t.subject)}</strong><div class="cell-sub">Order #${esc(t.orderNumber || '—')} · ${fmtTime(t.createdAt)}</div></div>
          <span class="status-pill badge-${esc(t.status)}">${esc(t.status)}</span>
        </div>
        <div style="font-size:13px;margin-bottom:8px;">${esc(t.message)}</div>
        <div class="ticket-reply-row">
          <input type="text" class="inline-input" style="flex:1;min-width:190px" value="${esc(t.adminReply || '')}" placeholder="Write owner reply..." data-vtkt-reply="${esc(t.id)}" />
          <select class="inline-select" style="width:130px" data-vtkt-status="${esc(t.id)}">
            ${['open', 'in_progress', 'resolved'].map((s) => `<option value="${s}" ${t.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-primary btn-sm" data-vtkt-save="${esc(t.id)}">Send</button>
          <button type="button" class="btn btn-danger btn-sm" data-vtkt-del="${esc(t.id)}">Del</button>
        </div>
      </div>
    `).join('')
    : '<div class="muted-note">No support tickets.</div>';
}

function renderAudit() {
  const tbody = document.getElementById('v-audit-tbody');
  if (!tbody) return;
  const q = (document.getElementById('v-audit-search')?.value || '').trim().toLowerCase();
  const list = state.auditLogs.filter((l) => !q || `${l.action} ${l.target} ${l.actorEmail}`.toLowerCase().includes(q));
  tbody.innerHTML = list.length
    ? list.map((l) => `
      <tr>
        <td><strong>${esc(l.action)}</strong></td>
        <td>${esc(l.target)}</td>
        <td>${esc(l.actorEmail)} <span class="cell-sub">(${esc(l.actorRole)})</span></td>
        <td class="cell-sub">${fmtTime(l.createdAt)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="muted-note">No audit events recorded yet.</td></tr>';
}

/* ==================== MODALS ==================== */

function closeDetailModal() {
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  releaseVaultOrderLock();
  document.getElementById('v-detail-modal')?.classList.add('hidden');
}

function attachVaultOrderChat(order) {
  const msgBox = document.getElementById('v-order-chat-msgs');
  const form = document.getElementById('v-order-chat-form');
  if (!msgBox || !form || !order?.id) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }

  unsubModalChat = onSnapshot(
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
    const inp = document.getElementById('v-order-chat-input');
    const text = String(inp?.value || '').trim().slice(0, 800);
    if (!text || !currentOwner) return;
    inp.value = '';
    try {
      await addDoc(collection(db, 'orders', order.id, 'messages'), {
        orderId: order.id,
        orderOwnerUid: order.userId || '',
        senderUid: currentOwner.uid,
        senderRole: 'main_admin',
        senderName: 'Main Admin',
        text,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${order.id}/messages`);
      showToast(err.message || 'Failed to send message.');
    }
  };
}

function openInspectModal(order, isEMarket = false) {
  const modal = document.getElementById('v-detail-modal');
  const title = document.getElementById('vdm-title');
  const body = document.getElementById('vdm-body');
  const printBtn = document.getElementById('vdm-print-btn');
  if (!order || !modal) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  acquireVaultOrderLock(`${isEMarket ? 'em:' : 'ord:'}${order.id}`, 'acquire');
  if (printBtn) printBtn.classList.remove('hidden');

  const canRefund = order.paymentStatus !== 'refunded' && Boolean(order.userId) && Number(order.totalBdt || order.priceBdt || 0) > 0;

  if (isEMarket) {
    title.textContent = `E-Market #${order.orderNumber || order.id.slice(0, 8)}`;
    body.innerHTML = `
      <div class="invoice-brand-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${esc(storeConfig.brandLogoUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" />
          <div>
            <strong>${esc(storeConfig.brandName || 'Naxora Bd')}</strong>
            <div class="cell-sub">${esc(storeConfig.supportPhone || '')} · ${esc(storeConfig.supportEmail || '')}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <strong>DIGITAL INVOICE</strong>
          <div class="cell-sub">#${esc(order.orderNumber || order.id.slice(0, 8))} · ${fmtTime(order.createdAt)}</div>
        </div>
      </div>
      <div class="detail-kv"><span>Item &amp; Package</span><strong>${esc(order.itemTitle)} — ${esc(order.packageLabel)}</strong></div>
      <div class="detail-kv"><span>Target Account</span><strong>${esc(order.targetAccount)}</strong></div>
      ${order.playerNickname ? `<div class="detail-kv"><span>Player IGN / Nickname</span><strong>${esc(order.playerNickname)}</strong></div>` : ''}
      <div class="detail-kv"><span>Server / Note</span><span>${esc(order.serverOrNote || '—')}</span></div>
      <div class="detail-kv"><span>Customer Email</span><span>${esc(order.userEmail || '—')}</span></div>
      <div class="detail-kv"><span>Payment</span><span>${esc(fmtPayLabel(order))} (${esc(order.paymentStatus)})</span></div>
      <div class="detail-kv"><span>Sender / TrxID</span><span>${esc(order.senderNumber || '—')} / ${esc(order.trxId || '—')}</span></div>
      <div class="detail-kv"><span>Sent / Total Paid</span><strong>${order.paidAmountBdt ? `${money(order.paidAmountBdt)} sent · ` : ''}${money(order.totalBdt)}</strong></div>
      <div class="detail-kv"><span>Delivery Code</span><strong>${esc(order.deliveryCode || 'Pending')}</strong></div>
      <div class="ops-action-box no-print">
        <div>
          <strong>One-Click Refund → Customer Wallet</strong>
          <div class="cell-sub">ক্রেডিট হবে ${money(order.totalBdt || order.priceBdt)} এবং অর্ডার ক্যানসেল/রিফান্ডেড হবে</div>
        </div>
        ${canRefund
          ? `<button type="button" class="btn btn-danger btn-sm" data-v-refund-em="${esc(order.id)}">Refund ${money(order.totalBdt || order.priceBdt)} → Wallet</button>`
          : `<span class="status-pill badge-refunded">${esc(order.paymentStatus === 'refunded' ? 'Already Refunded' : 'Not Eligible')}</span>`}
      </div>
    `;
  } else {
    title.textContent = `Order #${order.orderNumber || order.id.slice(0, 8)}`;
    const items = (order.items || []).map((i) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12.5px;"><span>${esc(i.title)} ${i.variant ? `(${esc(i.variant)})` : ''} × ${Number(i.qty)}</span><strong>${money(Number(i.priceBdt) * Number(i.qty))}</strong></div>`).join('');
    body.innerHTML = `
      <div class="invoice-brand-head">
        <div style="display:flex;align-items:center;gap:10px;">
          <img src="${esc(storeConfig.brandLogoUrl || DEFAULT_LOGO)}" alt="" class="thumb-img" />
          <div>
            <strong>${esc(storeConfig.brandName || 'Naxora Bd')}</strong>
            <div class="cell-sub">${esc(storeConfig.supportPhone || '')} · ${esc(storeConfig.supportEmail || '')}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <strong>TAX / SALES INVOICE</strong>
          <div class="cell-sub">#${esc(order.orderNumber || order.id.slice(0, 8))} · ${fmtTime(order.createdAt)}</div>
        </div>
      </div>
      <div class="detail-kv"><span>Customer</span><strong>${esc(order.customerName)}</strong></div>
      <div class="detail-kv"><span>Phone / Email</span><span>${esc(order.phone)} · ${esc(order.userEmail || '—')}</span></div>
      <div class="detail-kv"><span>Address</span><span>${esc(order.address)} (${esc(order.deliveryZone)})</span></div>
      <div class="detail-kv"><span>Payment</span><span>${esc(fmtPayLabel(order))} (${esc(order.paymentStatus)})</span></div>
      <div class="detail-kv"><span>Sender / TrxID</span><span>${esc(order.senderNumber || '—')} / ${esc(order.trxId || '—')}</span></div>
      ${order.paidAmountBdt ? `<div class="detail-kv"><span>Customer Sent</span><strong>${money(order.paidAmountBdt)}</strong></div>` : ''}
      <div class="detail-kv"><span>Coupon</span><span>${esc(order.couponCode || 'None')} (-${money(order.discountBdt)})</span></div>
      ${order.comboDiscountBdt ? `<div class="detail-kv"><span>Combo Deal</span><span>-${money(order.comboDiscountBdt)}</span></div>` : ''}
      <div class="detail-kv"><span>Delivery Fee</span><span>${money(order.deliveryFeeBdt)}</span></div>
      <div class="detail-kv"><span>Courier</span><span>${esc(order.courierProvider || '—')} · ${esc(order.courierTracking || 'Not assigned')}</span></div>
      <div class="detail-kv"><span>Grand Total</span><strong>${money(order.totalBdt)}</strong></div>
      <div style="margin-top:12px;"><div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">ITEMS</div>${items}</div>

      ${(order.isResellerOrder || Number(order.resellerProfitBdt || 0) > 0) ? `
        <div class="ops-action-box no-print" style="margin-bottom:10px;">
          <div>
            <strong>🤝 Reseller Order Profit Payout</strong>
            <div class="cell-sub">Reseller Profit: <strong>${money(order.resellerProfitBdt || 0)}</strong> · ${order.resellerProfitCredited ? 'Already Credited' : 'Pending Credit'}</div>
          </div>
          ${order.resellerProfitCredited
            ? `<span class="status-pill badge-approved">Credited (${money(order.resellerCreditedBdt ?? order.resellerProfitBdt ?? 0)})</span>`
            : `<button type="button" class="btn btn-primary btn-sm" data-v-credit-reseller="${esc(order.id)}">Credit Reseller Profit</button>`}
        </div>
      ` : ''}

      <div class="ops-action-box no-print">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <select id="v-courier-book-prov" class="inline-select" style="width:auto;">
            <option value="">Default Configured</option>
            <option value="steadfast">Steadfast</option>
            <option value="pathao">Pathao</option>
            <option value="redx">RedX</option>
            <option value="sandbox">Sandbox</option>
          </select>
          <button type="button" class="btn btn-primary btn-sm" data-v-book-courier="${esc(order.id)}">🚚 Book Courier &amp; Ship</button>
        </div>
        ${canRefund
          ? `<button type="button" class="btn btn-danger btn-sm" data-v-refund-order="${esc(order.id)}">Refund ${money(order.totalBdt)} → Wallet</button>`
          : `<span class="status-pill badge-refunded">${esc(order.paymentStatus === 'refunded' ? 'Refunded' : 'No Refund')}</span>`}
      </div>

      <div class="chat-panel no-print">
        <strong style="font-size:13px;">Live Order Chat (Customer ↔ Owner)</strong>
        <div id="v-order-chat-msgs" class="chat-messages"><div class="muted-note">Loading chat...</div></div>
        <form id="v-order-chat-form" class="chat-form">
          <input type="text" id="v-order-chat-input" required maxlength="800" placeholder="Write live message to customer..." />
          <button type="submit" class="btn btn-primary btn-sm">Send</button>
        </form>
      </div>
    `;
    attachVaultOrderChat(order);
  }
  modal.classList.remove('hidden');
}

function openThermalLabelModal(order) {
  const modal = document.getElementById('v-detail-modal');
  const title = document.getElementById('vdm-title');
  const body = document.getElementById('vdm-body');
  const printBtn = document.getElementById('vdm-print-btn');
  if (!order || !modal) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  releaseVaultOrderLock();
  document.body.classList.add('printing-label');
  if (printBtn) printBtn.classList.remove('hidden');
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
        <div style="font-family:var(--mono);font-size:11px;letter-spacing:2px;">${esc(order.courierTracking || ordCode)}</div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

async function openManageUserModal(uid) {
  const u = state.users.find((x) => x.id === uid);
  const modal = document.getElementById('v-detail-modal');
  const title = document.getElementById('vdm-title');
  const body = document.getElementById('vdm-body');
  const printBtn = document.getElementById('vdm-print-btn');
  if (!u || !modal) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  releaseVaultOrderLock();
  if (printBtn) printBtn.classList.add('hidden');

  const cid = u.customerId || deriveClientNxId(u.id);
  const uOrders = state.orders.filter((o) => o.userId === uid);
  const spent = uOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.totalBdt || 0), 0);
  const fsBal = Number(u.walletBalanceBdt || 0);
  let autoBal = 0;
  try {
    const token = await currentOwner.getIdToken();
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
          <button type="button" class="btn btn-primary btn-xs" data-mu-wal="add" data-mu-uid="${esc(uid)}">+ Add Money</button>
          <button type="button" class="btn btn-danger btn-xs" data-mu-wal="deduct" data-mu-uid="${esc(uid)}">- Deduct Money</button>
        </div>
      </div>

      <div class="manage-box">
        <h4>🚫 Ban / Unban Account</h4>
        <input type="text" id="mu-ban-reason" class="inline-input" value="${esc(u.banReason || '')}" placeholder="Ban reason (optional)" style="margin-bottom:8px;" />
        <div class="inline-actions">
          ${u.isBanned
            ? `<button type="button" class="btn btn-primary btn-xs" data-mu-ban="unban" data-mu-uid="${esc(uid)}">Unban Customer</button>`
            : `<button type="button" class="btn btn-danger btn-xs" data-mu-ban="ban" data-mu-uid="${esc(uid)}">Ban Customer</button>`}
          <button type="button" class="btn btn-outline btn-xs" data-mu-blacklist="${esc(uid)}">Add to Order Shield</button>
        </div>
      </div>

      <div class="manage-box">
        <h4>🤝 Reseller / Dropship Tier</h4>
        <input type="number" id="mu-reseller-pct" class="inline-input" min="0" max="50" value="${Number(u.resellerDiscountPct ?? storeConfig.resellerDefaultDiscountPct ?? 8)}" placeholder="Discount %" style="margin-bottom:8px;" />
        <div class="inline-actions">
          <button type="button" class="btn btn-primary btn-xs" data-mu-reseller="approve" data-mu-uid="${esc(uid)}">Approve Reseller</button>
          <button type="button" class="btn btn-danger btn-xs" data-mu-reseller="revoke" data-mu-uid="${esc(uid)}">Revoke</button>
        </div>
      </div>

      <div class="manage-box">
        <h4>📝 Admin CRM Note</h4>
        <input type="text" id="mu-admin-note" class="inline-input" value="${esc(u.adminNote || '')}" placeholder="VIP, trusted buyer, etc." style="margin-bottom:8px;" />
        <button type="button" class="btn btn-outline btn-xs" data-mu-save-note="${esc(uid)}">Save Note</button>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

async function openQaModal(productId) {
  const p = state.products.find((x) => x.id === productId);
  const modal = document.getElementById('v-detail-modal');
  const title = document.getElementById('vdm-title');
  const body = document.getElementById('vdm-body');
  const printBtn = document.getElementById('vdm-print-btn');
  if (!modal || !title || !body) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  releaseVaultOrderLock();
  if (printBtn) printBtn.classList.add('hidden');
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
            <button type="button" class="btn btn-danger btn-xs" data-del-qa="${esc(productId)}::${esc(q.id)}">Del</button>
          </div>
          <div class="ticket-reply-row">
            <input type="text" class="inline-input" style="flex:1" value="${esc(q.answer || '')}" placeholder="Write answer..." data-qa-ans-inp="${esc(productId)}::${esc(q.id)}" />
            <button type="button" class="btn btn-primary btn-xs" data-qa-save="${esc(productId)}::${esc(q.id)}">Reply</button>
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
  const modal = document.getElementById('v-detail-modal');
  const title = document.getElementById('vdm-title');
  const body = document.getElementById('vdm-body');
  const printBtn = document.getElementById('vdm-print-btn');
  if (!modal || !title || !body) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  releaseVaultOrderLock();
  if (printBtn) printBtn.classList.add('hidden');
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
            <button type="button" class="btn btn-danger btn-xs" data-del-review="${esc(productId)}::${esc(r.id)}">Delete</button>
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

function openAssetPicker(targetId) {
  assetPickerTargetId = targetId;
  const grid = document.getElementById('vapm-grid');
  grid.innerHTML = STUDIO_ASSETS.map((a) => `
    <button type="button" class="asset-item" data-v-choose-asset="${esc(a.url)}">
      <img src="${esc(a.url)}" alt="${esc(a.label)}" />
      <span>${esc(a.label)}</span>
    </button>
  `).join('');
  document.getElementById('v-asset-picker-modal').classList.remove('hidden');
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

function renderVaultOrderLockBanner(data) {
  const banner = document.getElementById('v-order-lock-banner');
  if (!banner) return;
  if (!data || !activeVaultOrderLockKey) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }
  if (data.lockedByOther) {
    const holder = data.lock?.lockedByName || data.lock?.lockedByEmail || 'Another Admin';
    banner.className = 'lock-banner warning no-print';
    banner.innerHTML = `
      <span>🔒 Currently locked by <strong>${esc(holder)}</strong> to prevent duplicate edits.</span>
      <button type="button" class="btn btn-outline btn-xs" id="v-takeover-lock-btn">Take Over Lock</button>
    `;
  } else {
    banner.className = 'lock-banner self no-print';
    banner.innerHTML = '<span>🟢 Order Lock Active (Main Admin) · Protected</span>';
  }
}

async function acquireVaultOrderLock(orderKey, action = 'acquire') {
  if (!currentOwner || !orderKey) return;
  if (activeVaultOrderLockKey && activeVaultOrderLockKey !== orderKey && action === 'acquire') {
    await releaseVaultOrderLock();
  }
  activeVaultOrderLockKey = orderKey;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/orders/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderKey, action })
    });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    if (activeVaultOrderLockKey === orderKey) renderVaultOrderLockBanner(data);
  } catch {}
}

async function releaseVaultOrderLock() {
  const key = activeVaultOrderLockKey;
  activeVaultOrderLockKey = '';
  renderVaultOrderLockBanner(null);
  if (!key || !currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    await fetch('/api/orders/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orderKey: key, action: 'release' })
    });
  } catch {}
}

async function loadResellerWithdrawals() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/reseller/withdrawals', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.resellerWithdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
    renderResellerWithdrawals();
  } catch {}
}

function renderResellerWithdrawals() {
  const tbody = document.getElementById('v-reseller-withdrawals-tbody');
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
              <input type="text" class="inline-input" style="width:110px" placeholder="Note..." data-v-rwd-note="${esc(wd.id)}" />
              <button type="button" class="btn btn-primary btn-xs" data-v-rwd-act="approve" data-rwd-id="${esc(wd.id)}">Approve</button>
              <button type="button" class="btn btn-danger btn-xs" data-v-rwd-act="reject" data-rwd-id="${esc(wd.id)}">Reject</button>
            </div>
          ` : `<div class="cell-sub">${esc(wd.adminNote || 'Reviewed')}</div>`}
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="muted-note">No reseller withdrawal requests yet.</td></tr>';
}

async function loadSupportChats() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/support/chat?scope=all', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.supportChats = Array.isArray(data.threads) ? data.threads : [];
    renderSupportChats();
  } catch {}
}

function renderSupportChats() {
  const wrap = document.getElementById('v-support-chats-list');
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
          <input type="text" class="inline-input" style="flex:1;min-width:190px;" placeholder="Reply as Owner..." data-v-chat-inp="${esc(th.threadKey)}" />
          <button type="button" class="btn btn-primary btn-sm" data-v-chat-send="${esc(th.threadKey)}">Send Reply</button>
        </div>
      </div>
    `).join('')
    : '<div class="muted-note">No pre-purchase live support conversations yet.</div>';
}

async function loadFaqs() {
  try {
    const res = await fetch('/api/support/faq');
    if (!res.ok) return;
    const data = await parseApiJson(res, true);
    if (!data) return;
    state.faqs = Array.isArray(data.faqs) ? data.faqs : [];
    renderFaqs();
  } catch {}
}

function renderFaqs() {
  const wrap = document.getElementById('v-faqs-list');
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
          <button type="button" class="btn btn-outline btn-xs" data-v-faq-edit="${esc(f.id)}">Edit</button>
          <button type="button" class="btn btn-danger btn-xs" data-v-faq-del="${esc(f.id)}">Del</button>
        </div>
      </div>
    `).join('')
    : '<div class="muted-note">No FAQ entries published yet.</div>';
}

function makeVaultLbRowHtml(row = {}) {
  return `
    <div class="lb-row">
      <input type="number" class="inline-input" data-lb-rank min="1" max="50" value="${Number(row.rank || 1)}" placeholder="#" />
      <input type="text" class="inline-input" data-lb-uid list="v-tr-users-dl" value="${esc(row.uid || '')}" placeholder="User UID" />
      <input type="text" class="inline-input" data-lb-name value="${esc(row.name || '')}" placeholder="Player / Team Name" />
      <input type="text" class="inline-input" data-lb-gameuid value="${esc(row.gameUid || '')}" placeholder="In-Game UID" />
      <input type="number" class="inline-input" data-lb-kills min="0" value="${Number(row.kills || 0)}" placeholder="Kills" />
      <input type="number" class="inline-input" data-lb-prize min="0" value="${Number(row.prizeBdt || 0)}" placeholder="Prize ৳" />
      <button type="button" class="btn btn-danger btn-xs" data-v-lb-rm>×</button>
    </div>
  `;
}

function openVaultTournamentLeaderboardModal(tournamentId) {
  const t = state.tournaments.find((x) => x.id === tournamentId);
  const modal = document.getElementById('v-detail-modal');
  const title = document.getElementById('vdm-title');
  const body = document.getElementById('vdm-body');
  if (!t || !modal || !title || !body) return;
  if (unsubModalChat) { try { unsubModalChat(); } catch {} unsubModalChat = null; }
  releaseVaultOrderLock();
  document.body.classList.remove('printing-label');
  document.getElementById('vdm-print-btn')?.classList.add('hidden');

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
    <datalist id="v-tr-users-dl">${dlOpts}</datalist>
    <div class="detail-kv"><span>Mode &amp; Game</span><span>${esc(t.game)} · <strong style="text-transform:uppercase;">${esc(t.mode || 'solo')}</strong></span></div>
    <div class="detail-kv"><span>Prize Pool &amp; Joined</span><span>${money(t.prizePoolBdt || 0)} · ${joined.length} joined players ${t.prizesDistributed ? '· ✔ Prizes Paid' : ''}</span></div>
    <div style="margin:12px 0 6px;font-size:11.5px;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;">
      <span>Rank | User UID | Winner Name | Game UID | Kills | Prize (৳)</span>
      <button type="button" id="v-tr-lb-add" class="btn btn-outline btn-xs">+ Add Winner Row</button>
    </div>
    <div id="v-tr-lb-rows">${rows.map((r) => makeVaultLbRowHtml(r)).join('')}</div>
    <div class="ops-action-box no-print" style="margin-top:14px;">
      <button type="button" id="v-tr-lb-save" data-tr-id="${esc(t.id)}" class="btn btn-outline btn-sm">Save Leaderboard</button>
      <button type="button" id="v-tr-lb-payout" data-tr-id="${esc(t.id)}" class="btn btn-primary btn-sm" ${t.prizesDistributed ? 'disabled' : ''}>
        ${t.prizesDistributed ? '✔ Prizes Already Distributed' : '💸 1-Click Distribute Prizes → Wallets'}
      </button>
    </div>
    <div id="v-tr-proofs-wrap" class="chat-panel no-print" style="margin-top:14px;">
      <div class="panel-head" style="margin-bottom:6px;">
        <h4 style="margin:0;">📸 Match Result Screenshot Proofs</h4>
      </div>
      <div id="v-tr-proofs-list" class="muted-note">Loading proofs...</div>
    </div>
  `;
  modal.classList.remove('hidden');
  loadVaultTournamentProofs(t.id);
}

async function loadVaultTournamentProofs(tournamentId) {
  const wrap = document.getElementById('v-tr-proofs-list');
  if (!wrap || !currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
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
          <span class="status-pill ${p.status === 'approved' ? 'badge-approved' : p.status === 'rejected' ? 'badge-cancelled' : 'badge-pending'}">${esc(p.status || 'pending')}</span>
        </div>
        <div class="cell-sub">IGN/UID: ${esc(p.gameUid || '—')} · Claimed: #${Number(p.rankClaimed || 1)} (${Number(p.kills || 0)} kills)</div>
        ${p.screenshotUrl ? `<a href="${esc(p.screenshotUrl)}" target="_blank" rel="noopener noreferrer"><img src="${esc(p.screenshotUrl)}" alt="Proof" class="proof-thumb" /></a>` : ''}
        ${p.note ? `<div class="cell-sub">${esc(p.note)}</div>` : ''}
        <div class="inline-actions" style="margin-top:4px;">
          <button type="button" class="btn btn-primary btn-xs" data-v-proof-review="${esc(p.id)}::approve" data-proof-uid="${esc(p.uid)}" data-proof-tr="${esc(tournamentId)}">Approve</button>
          <button type="button" class="btn btn-danger btn-xs" data-v-proof-review="${esc(p.id)}::reject" data-proof-uid="${esc(p.uid)}" data-proof-tr="${esc(tournamentId)}">Reject</button>
        </div>
      </div>
    `).join('')}</div>`;
  } catch {
    wrap.innerHTML = '<div class="muted-note">Could not load proofs.</div>';
  }
}

function collectVaultLbRows() {
  return Array.from(document.querySelectorAll('#v-tr-lb-rows .lb-row')).map((row, idx) => {
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

function exportCsv(rows, filename) {
  const csv = rows.map((r) => r.map((v) => csvCell(v)).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ==================== SEED VIRAL CATALOG ==================== */

async function seedViralCatalog() {
  if (!currentOwner) return;

  const upsertSeedDoc = async (ref, baseData, includeCreatedBy = true) => {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...baseData, updatedAt: serverTimestamp() });
    } else {
      const createPayload = {
        ...baseData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (includeCreatedBy) createPayload.createdBy = currentOwner.uid;
      await setDoc(ref, createPayload);
    }
  };

  const cats = [
    { slug: 'smart-gadgets', nameBn: 'স্মার্ট গ্যাজেট', nameEn: 'Smart Gadgets', icon: 'icon:smartphone', sortOrder: 1, isActive: true },
    { slug: 'gaming-gear', nameBn: 'গেমিং গিয়ার', nameEn: 'Gaming Gear', icon: 'icon:gamepad', sortOrder: 2, isActive: true },
    { slug: 'streetwear', nameBn: 'স্ট্রিটওয়্যার', nameEn: 'Streetwear', icon: 'icon:shirt', sortOrder: 3, isActive: true },
    { slug: 'lifestyle', nameBn: 'লাইফস্টাইল', nameEn: 'Lifestyle', icon: 'icon:home', sortOrder: 4, isActive: true }
  ];
  for (const c of cats) {
    await upsertSeedDoc(doc(db, 'categories', c.slug), c, false);
  }

  const prods = [
    { id: 'viral-levitating-lamp', title: 'Levitating Moon Neon Lamp', subtitleBn: 'ম্যাগনেটিক থ্রিডি ফ্লোটিং ল্যাম্প', categoryId: 'lifestyle', priceBdt: 2490, compareAtBdt: 3200, stock: 18, viralSource: 'TikTok Viral', imageUrl: '/src/assets/images/product_levitating_lamp_1795121290698.jpg', variants: ['Warm Moon', 'Cyber Blue'], description: 'Magnetic 3D levitating lamp for desk and bedroom setups.', isFeatured: true, isFlashDrop: true, isActive: true, salesCount: 14 },
    { id: 'viral-cyber-keyboard', title: 'RGB 65% Mechanical Keyboard', subtitleBn: 'হট-সোয়াপেবল কমপ্যাক্ট গেমিং কিবোর্ড', categoryId: 'gaming-gear', priceBdt: 3290, compareAtBdt: 4100, stock: 14, viralSource: 'HOT DROP', imageUrl: '/src/assets/images/product_cyber_keyboard_1795121291161.jpg', variants: ['Red Switch', 'Blue Switch'], description: 'Hot-swappable compact RGB mechanical gaming keyboard.', isFeatured: true, isFlashDrop: true, isActive: true, salesCount: 19 },
    { id: 'viral-beauty-mirror', title: 'Halo Smart LED Vanity Mirror', subtitleBn: 'টাচ ডিমেবল স্টুডিও এলইডি মিরর', categoryId: 'lifestyle', priceBdt: 1450, compareAtBdt: 1950, stock: 25, viralSource: 'TOP PICK', imageUrl: '/src/assets/images/product_beauty_mirror_1795121291645.jpg', variants: ['Pearl White', 'Rose'], description: 'Touch-dimmable studio ring LED vanity mirror.', isFeatured: true, isFlashDrop: false, isActive: true, salesCount: 11 },
    { id: 'viral-street-hoodie', title: 'Oversized Cyber Street Hoodie', subtitleBn: '৩৮০ জিএসএম হেভিওয়েট ফ্লিস হুডি', categoryId: 'streetwear', priceBdt: 1690, compareAtBdt: 2200, stock: 22, viralSource: 'LIMITED', imageUrl: '/src/assets/images/product_streetwear_hoodie_1795121291299.jpg', variants: ['M', 'L', 'XL'], description: 'Heavyweight 380GSM fleece oversized streetwear hoodie.', isFeatured: true, isFlashDrop: false, isActive: true, salesCount: 16 },
    { id: 'viral-thermal-printer', title: 'Pocket Bluetooth Mini Printer', subtitleBn: 'কালি ছাড়াই ইনস্ট্যান্ট প্রিন্ট', categoryId: 'smart-gadgets', priceBdt: 1590, compareAtBdt: 2100, stock: 20, viralSource: 'VIRAL', imageUrl: '/src/assets/images/product_thermal_printer_1795121291285.jpg', variants: ['White + 3 Rolls'], description: 'Inkless wireless pocket printer for notes and stickers.', isFeatured: true, isFlashDrop: true, isActive: true, salesCount: 24 }
  ];
  for (const p of prods) {
    const { id, ...rest } = p;
    await upsertSeedDoc(doc(db, 'products', id), rest, true);
  }

  const emItems = [
    {
      id: 'em-ff-diamonds',
      title: 'Free Fire Diamonds Top-Up',
      subtitleBn: 'মাত্র ৫ মিনিটে প্লেয়ার ইউআইডিতে ডায়মন্ড ডেলিভারি',
      category: 'game_topup',
      inputLabel: 'Free Fire Player UID',
      inputPlaceholder: 'যেমন: 2948104821',
      packages: [
        { label: '115 Diamonds', priceBdt: 95 },
        { label: '240 Diamonds', priceBdt: 195 },
        { label: '520 Diamonds', priceBdt: 430 },
        { label: 'Weekly Membership', priceBdt: 165 }
      ],
      imageUrl: '/src/assets/images/emarket_game_topup_1795203622838.jpg',
      description: 'Official UID top-up without password.',
      deliveryEta: '5-10 Mins',
      salesCount: 38,
      isActive: true
    },
    {
      id: 'em-ott-bundle',
      title: 'Netflix & YouTube Premium Pass',
      subtitleBn: '4K UHD প্রাইভেট প্রোফাইল ও অ্যাড-ফ্রি অভিজ্ঞতা',
      category: 'platform_subscription',
      inputLabel: 'WhatsApp / Delivery Gmail',
      inputPlaceholder: 'name@gmail.com বা +8801...',
      packages: [
        { label: 'Netflix 4K (1 Month)', priceBdt: 350 },
        { label: 'YouTube Premium (1 Month)', priceBdt: 220 },
        { label: 'Spotify Duo (1 Month)', priceBdt: 260 }
      ],
      imageUrl: '/src/assets/images/emarket_app_subs_1795203623557.jpg',
      description: 'Full warranty for the entire subscription period.',
      deliveryEta: '10 Mins',
      salesCount: 27,
      isActive: true
    }
  ];
  for (const em of emItems) {
    const { id, ...rest } = em;
    await upsertSeedDoc(doc(db, 'emarketItems', id), rest, true);
  }

  await upsertSeedDoc(doc(db, 'sliders', 'hero-cyber-drop'), {
    title: 'Viral Tech & Cyber Setup Drop',
    subtitleBn: 'ট্রেন্ডিং গ্যাজেটে ৩০% ছাড় ও ইনস্ট্যান্ট গেম টপ-আপ!',
    badgeText: 'FLASH DROP',
    imageUrl: '/src/assets/images/slider_cyber_setup_banner_1795203622505.jpg',
    ctaLabel: 'শপ করুন',
    linkPage: 'explore',
    linkTarget: '',
    sortOrder: 1,
    isActive: true
  }, true);

  await upsertSeedDoc(doc(db, 'notices', 'welcome-drop-notice'), {
    title: '৳২,৫০০+ অর্ডারে ফ্রি ডেলিভারি ও VIRAL100 ডিসকাউন্ট!',
    messageBn: 'সারা বাংলাদেশে ফ্রি হোম ডেলিভারি পেতে ৳২,৫০০+ টাকার অর্ডার করুন এবং VIRAL100 কুপন ব্যবহার করুন!',
    messageEn: 'Order ৳2,500+ for free delivery nationwide and apply promo code VIRAL100!',
    priority: 'promo',
    isActive: true
  }, true);

  await upsertSeedDoc(doc(db, 'coupons', 'VIRAL100'), {
    code: 'VIRAL100',
    discountType: 'fixed',
    discountValue: 100,
    minOrderBdt: 800,
    isActive: true
  }, true);

  await saveStoreConfigPartial({});
  await logAudit('SEED_CATALOG', 'storeConfig/global');
}

/* ==================== PERMISSION HELPERS ==================== */

function getFormPermissions() {
  return {
    canCreateProduct: document.getElementById('va-p-create').checked,
    canEditProduct: document.getElementById('va-p-edit').checked,
    canDeleteProduct: document.getElementById('va-p-del').checked,
    canManageOrders: document.getElementById('va-p-orders').checked,
    canManageCoupons: document.getElementById('va-p-coupons').checked,
    canManageCategories: document.getElementById('va-p-cats').checked,
    canReplyTickets: document.getElementById('va-p-tkt').checked,
    canManageSliders: document.getElementById('va-p-sliders').checked,
    canManageNotices: document.getElementById('va-p-notices').checked,
    canSendNotifications: document.getElementById('va-p-notifs').checked,
    canManageEMarket: document.getElementById('va-p-emarket').checked,
    canManageUsers: document.getElementById('va-p-users')?.checked || false
  };
}

function setFormPermissions(perms = {}) {
  const map = {
    'va-p-create': 'canCreateProduct',
    'va-p-edit': 'canEditProduct',
    'va-p-del': 'canDeleteProduct',
    'va-p-orders': 'canManageOrders',
    'va-p-coupons': 'canManageCoupons',
    'va-p-cats': 'canManageCategories',
    'va-p-tkt': 'canReplyTickets',
    'va-p-sliders': 'canManageSliders',
    'va-p-notices': 'canManageNotices',
    'va-p-notifs': 'canSendNotifications',
    'va-p-emarket': 'canManageEMarket',
    'va-p-users': 'canManageUsers'
  };
  Object.entries(map).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.checked = !!perms[key];
  });
}

function parsePackagesInput(raw) {
  return String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 12).map((line) => {
    const [lbl, pr] = line.split('|').map((s) => s.trim());
    const priceBdt = Math.max(1, Number(pr) || 0);
    return { label: (lbl || 'Standard Pack').slice(0, 80), priceBdt };
  }).filter((pk) => pk.priceBdt > 0);
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
      await addDoc(collection(db, 'notifications'), {
        targetUid: al.userId,
        title: restocked ? `🔔 Back in Stock: ${title}` : `🔥 Price Dropped: ${title}`,
        body: restocked
          ? `${title} এখন আবার স্টকে এসেছে! দ্রুত অর্ডার করুন।`
          : `${title} এর দাম কমে এখন ${money(newPrice)} হয়েছে!`,
        type: 'stock_alert',
        refId: productId,
        isRead: false,
        createdBy: currentOwner?.uid || 'system',
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'stockAlerts', al.id), { notified: true, updatedAt: serverTimestamp() });
    } catch {}
  }
}

/* ==================== LISTENERS & EVENTS ==================== */

function attachVaultListeners() {
  const sub = (key, q, setter, path, onAdded) => {
    unsubs[key] = onSnapshot(q, (snap) => {
      if (!vLiveReady[key]) vLiveReady[key] = true;
      else if (onAdded) {
        snap.docChanges().filter((c) => c.type === 'added').forEach((c) => onAdded(c.doc.data(), c.doc.id));
      }
      state[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setter();
    }, (err) => handleFirestoreError(err, OperationType.LIST, path || key));
  };

  sub('orders', query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(250)), () => { renderAnalytics(); renderOrders(); renderUsersCrm(); renderAdmins(); }, 'orders', (o, id) => {
    showToast(`${(o.isResellerOrder || o.isDropship) ? '🤝 নতুন রিসেলার অর্ডার' : '🛍️ নতুন অর্ডার'} #${o.orderNumber || id.slice(0, 6)} · ${money(o.totalBdt || 0)}`);
  });
  sub('products', query(collection(db, 'products'), orderBy('createdAt', 'desc')), () => { renderAnalytics(); renderProducts(); renderReels(); renderSliders(); }, 'products');
  sub('emarketItems', query(collection(db, 'emarketItems'), orderBy('createdAt', 'desc')), () => { renderAnalytics(); renderEMarket(); }, 'emarketItems');
  sub('emarketOrders', query(collection(db, 'emarketOrders'), orderBy('createdAt', 'desc'), limit(250)), () => { renderAnalytics(); renderEMarket(); renderAdmins(); }, 'emarketOrders', (eo, id) => {
    showToast(`🎮 নতুন E-Market অর্ডার #${eo.orderNumber || id.slice(0, 6)} · ${eo.itemTitle || ''}`);
  });
  sub('walletRequests', query(collection(db, 'walletRequests'), orderBy('createdAt', 'desc'), limit(200)), () => { renderWalletRequests(); renderAdmins(); }, 'walletRequests', (w) => {
    showToast(`💰 ওয়ালেট অ্যাড-মানি রিকোয়েস্ট: ${money(w.amountBdt || 0)} (${w.userName || 'Customer'})`);
  });
  sub('sliders', query(collection(db, 'sliders'), orderBy('sortOrder', 'asc')), renderSliders, 'sliders');
  sub('notices', query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(50)), renderNotices, 'notices');
  sub('notifications', query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(80)), renderNotifications, 'notifications');
  sub('coupons', query(collection(db, 'coupons'), orderBy('createdAt', 'desc')), renderCoupons, 'coupons');
  sub('categories', query(collection(db, 'categories'), orderBy('sortOrder', 'asc')), () => { renderCategories(); renderProducts(); }, 'categories');
  sub('admins', query(collection(db, 'admins')), () => { renderAdmins(); renderAnalytics(); }, 'admins');
  sub('adminInvites', query(collection(db, 'adminInvites')), renderAdmins, 'adminInvites');
  sub('users', query(collection(db, 'users'), limit(300)), () => { renderUsersCrm(); renderNotifications(); renderAnalytics(); }, 'users');
  sub('returns', query(collection(db, 'returns'), orderBy('createdAt', 'desc'), limit(150)), renderReturns, 'returns', (r, id) => {
    showToast(`↩ নতুন রিটার্ন রিকোয়েস্ট #${r.orderNumber || id.slice(0, 6)}`);
  });
  sub('reels', query(collection(db, 'reels'), orderBy('createdAt', 'desc'), limit(100)), renderReels, 'reels');
  sub('campaigns', query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'), limit(60)), renderCampaigns, 'campaigns');
  sub('tournaments', query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'), limit(60)), renderTournaments, 'tournaments');
  sub('blacklist', query(collection(db, 'blacklist'), orderBy('createdAt', 'desc'), limit(150)), renderBlacklist, 'blacklist');
  sub('stockAlerts', query(collection(db, 'stockAlerts'), limit(200)), () => {}, 'stockAlerts');
  sub('tickets', query(collection(db, 'tickets'), orderBy('createdAt', 'desc'), limit(120)), renderTickets, 'tickets', (tk) => {
    showToast(`🎫 নতুন সাপোর্ট টিকেট: ${tk.subject || 'Support'}`);
  });
  sub('auditLogs', query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(120)), () => { renderAudit(); renderAdmins(); }, 'auditLogs', (log) => {
    if (log.action === 'ADMIN_LOGIN' && log.actorUid !== currentOwner?.uid) {
      showToast(`🔐 অ্যাডমিন লগইন অ্যালার্ট: ${log.actorEmail || 'Staff Admin'} (${log.actorRole || 'admin'})`);
    }
  });
}

function bindEvents() {
  window.addEventListener('resize', detectAndApplyDeviceLayout);
  window.addEventListener('orientationchange', detectAndApplyDeviceLayout);
  document.getElementById('vault-menu-btn')?.addEventListener('click', () => toggleMobileSidebar(true));
  document.getElementById('vault-sidebar-close')?.addEventListener('click', () => toggleMobileSidebar(false));
  document.getElementById('vault-drawer-backdrop')?.addEventListener('click', () => toggleMobileSidebar(false));

  // Owner Auth Events
  const runVaultGooglePopup = async (switchFirst = false) => {
    if (isGoogleSignInBusy) {
      showAuthNotice('Google Sign-In পপআপটি চালু আছে, অনুগ্রহ করে অপেক্ষা করুন।');
      return;
    }
    isGoogleSignInBusy = true;
    const gBtn = document.getElementById('vault-google-btn');
    const sBtn = document.getElementById('vault-switch-acct-btn');
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
        showAuthError('Popup blocked! ব্রাউজার থেকে এই সাইটের জন্য popup অনুমোদন দিন অথবা নতুন ট্যাবে ওপেন করুন।');
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

  document.getElementById('vault-google-btn').addEventListener('click', () => runVaultGooglePopup(false));
  document.getElementById('vault-switch-acct-btn')?.addEventListener('click', () => runVaultGooglePopup(true));

  document.getElementById('vault-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, document.getElementById('vault-login-email').value.trim(), document.getElementById('vault-login-password').value);
    } catch (err) {
      if (err?.code === 'auth/operation-not-allowed') {
        showAuthError('Email/Password লগইন চালু নেই। অনুগ্রহ করে উপরের Google বাটন দিয়ে লগইন করুন অথবা Firebase Console থেকে Email/Password চালু করুন।');
      } else {
        showAuthError(err.message);
      }
    }
  });

  document.getElementById('vault-reset-pw-btn').addEventListener('click', async () => {
    const email = document.getElementById('vault-login-email').value.trim();
    if (email.toLowerCase() !== MAIN_ADMIN_EMAIL) return showAuthError(`শুধুমাত্র ${MAIN_ADMIN_EMAIL} এর পাসওয়ার্ড রিসেট করা যাবে।`);
    try {
      await sendPasswordResetEmail(auth, email);
      showAuthNotice(`${email}-এ পাসওয়ার্ড সেট/রিসেট লিংক পাঠানো হয়েছে।`);
    } catch (err) {
      showAuthError(err.message);
    }
  });

  document.getElementById('vault-resend-verify-btn')?.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      showAuthNotice('Verification link sent to comebackemail12@gmail.com.');
    } catch (err) { showAuthError(err.message); }
  });

  document.getElementById('vault-recheck-verify-btn')?.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) window.location.reload();
    else showAuthError('Email এখনও verified হয়নি। ইনবক্সের লিংকে ক্লিক করুন অথবা Google দিয়ে সাইন ইন করুন।');
  });

  document.getElementById('vault-logout-btn').addEventListener('click', () => signOut(auth));

  // Logo live preview
  document.getElementById('pl-logo-url').addEventListener('input', (e) => {
    const lp = document.getElementById('pl-logo-preview');
    if (lp && e.target.value.trim()) lp.src = e.target.value.trim();
  });

  // Settings Tabs & Forms
  document.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchSettingsTab(btn.dataset.settingsTab));
  });

  document.querySelectorAll('[data-preset-accent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      document.getElementById('pl-accent').value = btn.dataset.presetAccent;
      document.getElementById('pl-secondary').value = btn.dataset.presetSec;
      try {
        await saveStoreConfigPartial({ accentColor: btn.dataset.presetAccent, secondaryColor: btn.dataset.presetSec });
        showToast('Theme preset saved live!');
      } catch (err) { showToast(err.message); }
    });
  });

  document.getElementById('settings-basic-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveStoreConfigPartial({
        brandName: document.getElementById('pl-brand-name').value.trim(),
        currencySymbol: document.getElementById('pl-currency').value.trim(),
        brandLogoUrl: document.getElementById('pl-logo-url').value.trim(),
        brandTaglineBn: document.getElementById('pl-tagline-bn').value.trim(),
        brandTaglineEn: document.getElementById('pl-tagline-en').value.trim(),
        footerTagBn: document.getElementById('pl-footer-bn').value.trim(),
        footerTagEn: document.getElementById('pl-footer-en').value.trim(),
        metaTitle: document.getElementById('pl-meta-title').value.trim(),
        metaDescription: document.getElementById('pl-meta-desc').value.trim(),
        defaultLang: document.getElementById('pl-default-lang').value,
        supportPhone: document.getElementById('pl-sup-phone').value.trim(),
        supportWhatsapp: document.getElementById('pl-sup-wa').value.trim(),
        supportEmail: document.getElementById('pl-sup-email').value.trim(),
        announcementBn: document.getElementById('pl-ann-bn').value.trim(),
        announcementEn: document.getElementById('pl-ann-en').value.trim(),
        heroTitle: document.getElementById('pl-hero-title').value.trim(),
        heroSubtitle: document.getElementById('pl-hero-sub').value.trim()
      });
      await logAudit('UPDATE_BASIC_BRANDING', 'storeConfig/global');
      showToast('Basic & Brand settings saved!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'storeConfig/global');
      showToast(err.message);
    }
  });

  document.getElementById('settings-theme-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const flashRaw = document.getElementById('pl-flash-end').value;
    const flashDate = flashRaw ? new Date(flashRaw) : null;
    const flashIso = (flashDate && !Number.isNaN(flashDate.getTime())) ? flashDate.toISOString() : storeConfig.flashDropEndIso;
    try {
      await saveStoreConfigPartial({
        accentColor: document.getElementById('pl-accent').value,
        secondaryColor: document.getElementById('pl-secondary').value,
        gridColsDesktop: parseInt(document.getElementById('pl-grid-cols').value || '5', 10),
        sliderAutoPlayMs: parseInt(document.getElementById('pl-slider-ms').value || '5000', 10),
        comboMinQty: parseInt(document.getElementById('pl-combo-min-qty').value || '3', 10),
        comboDiscountPercent: Number(document.getElementById('pl-combo-discount-pct').value || 0),
        cashbackPercent: Number(document.getElementById('pl-cashback-pct').value || 0),
        referralBonusBdt: Number(document.getElementById('pl-referral-bonus').value || 0),
        flashDropEndIso: flashIso,
        maintenanceMessage: document.getElementById('pl-maint-msg').value.trim(),
        cardCompactMode: document.getElementById('pl-compact-mode').checked,
        showAnnouncementBar: document.getElementById('pl-show-ann').checked,
        showHeaderSearch: document.getElementById('pl-show-search').checked,
        showHeaderNotices: document.getElementById('pl-show-notices').checked,
        showHeaderNotifs: document.getElementById('pl-show-notifs').checked,
        showLangToggle: document.getElementById('pl-show-lang').checked,
        showBottomNav: document.getElementById('pl-show-bnav').checked,
        showHomeCategories: document.getElementById('pl-show-cats').checked,
        showRecentlyViewed: document.getElementById('pl-show-recent').checked,
        showFooter: document.getElementById('pl-show-footer').checked,
        allowOrderCancel: document.getElementById('pl-allow-cancel').checked,
        userAppEnabled: document.getElementById('pl-user-app').checked,
        adminAppEnabled: document.getElementById('pl-admin-app').checked,
        flashDropEnabled: document.getElementById('pl-flash-enabled').checked,
        eMarketEnabled: document.getElementById('pl-emarket-enabled').checked,
        ffLookupEnabled: document.getElementById('pl-ff-lookup-enabled').checked,
        slidersEnabled: document.getElementById('pl-sliders-enabled').checked,
        noticesEnabled: document.getElementById('pl-notices-enabled').checked,
        couponsEnabled: document.getElementById('pl-coupons-enabled').checked,
        reviewsEnabled: document.getElementById('pl-reviews-enabled').checked,
        wishlistEnabled: document.getElementById('pl-wishlist-enabled').checked,
        ticketsEnabled: document.getElementById('pl-tickets-enabled').checked,
        reelsEnabled: document.getElementById('pl-reels-enabled')?.checked !== false,
        spinWheelEnabled: document.getElementById('pl-spin-enabled')?.checked !== false,
        dailyCheckInBdt: Number(document.getElementById('pl-daily-checkin-bdt')?.value || 5),
        preOrderEnabled: document.getElementById('pl-preorder-enabled')?.checked !== false,
        groupBuyEnabled: document.getElementById('pl-groupbuy-enabled')?.checked !== false,
        giftCardsEnabled: document.getElementById('pl-giftcards-enabled')?.checked !== false,
        tournamentsEnabled: document.getElementById('pl-tournaments-enabled')?.checked !== false,
        vipEnabled: document.getElementById('pl-vip-enabled')?.checked !== false,
        emiEnabled: document.getElementById('pl-emi-enabled')?.checked !== false,
        otpRequiredForOrder: document.getElementById('pl-otp-required')?.checked === true,
        reviewBonusBdt: Math.min(500, Math.max(0, Number(document.getElementById('pl-review-bonus')?.value ?? 20))),
        resellerCommissionPct: Math.min(50, Math.max(0, Number(document.getElementById('pl-reseller-comm')?.value ?? 10))),
        resellerDefaultDiscountPct: Number(document.getElementById('pl-reseller-disc')?.value || 8),
        lowStockThreshold: parseInt(document.getElementById('pl-low-stock')?.value || '5', 10)
      });
      await logAudit('UPDATE_THEME_TOGGLES', 'storeConfig/global');
      showToast('UI, Theme & Feature Switches saved!');
    } catch (err) { showToast(err.message); }
  });

  document.getElementById('gateway-control-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await saveStoreConfigPartial({
        deliveryInsideDhakaBdt: Number(document.getElementById('gw-dhaka').value || 0),
        deliveryOutsideDhakaBdt: Number(document.getElementById('gw-outside').value || 0),
        deliveryExpressBdt: Number(document.getElementById('gw-express').value || 0),
        freeDeliveryThresholdBdt: Number(document.getElementById('gw-free-over').value || 0),
        codMinOrderBdt: Number(document.getElementById('gw-cod-min').value || 0),
        codMaxOrderBdt: Number(document.getElementById('gw-cod-max').value || 0),
        bkashNumber: document.getElementById('gw-bkash-num').value.trim(),
        nagadNumber: document.getElementById('gw-nagad-num').value.trim(),
        rocketNumber: document.getElementById('gw-rocket-num').value.trim(),
        upayNumber: document.getElementById('gw-upay-num').value.trim(),
        autoPayProvider: document.getElementById('gw-auto-provider').value.trim(),
        gatewayFeePercent: Number(document.getElementById('gw-fee-pct').value || 0),
        gatewayInstructions: document.getElementById('gw-instructions').value.trim(),
        manualPayEnabled: document.getElementById('gw-manual-on').checked,
        autoPayEnabled: document.getElementById('gw-auto-on').checked,
        autoPaySandbox: document.getElementById('gw-auto-sandbox').checked,
        walletEnabled: document.getElementById('gw-wallet-on').checked,
        codEnabled: document.getElementById('gw-cod-on').checked,
        codAdvanceDeliveryOutsideDhaka: document.getElementById('gw-cod-adv').checked,
        codAdvanceDeliveryAll: document.getElementById('gw-cod-adv-all')?.checked || false,
        heavenPayEnabled: document.getElementById('gw-heaven-on').checked,
        bkashEnabled: document.getElementById('gw-bkash-on').checked,
        nagadEnabled: document.getElementById('gw-nagad-on').checked,
        rocketEnabled: document.getElementById('gw-rocket-on').checked,
        upayEnabled: document.getElementById('gw-upay-on').checked,
        cardGatewayEnabled: document.getElementById('gw-card-on').checked
      });
      await logAudit('UPDATE_GATEWAYS', 'storeConfig/global');
      showToast('Payment gateways & delivery saved!');
    } catch (err) { showToast(err.message); }
  });

  document.getElementById('auto-gateway-api-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/payments/auto-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: document.getElementById('agw-provider').value,
          displayName: document.getElementById('agw-display-name').value.trim(),
          checkoutUrl: document.getElementById('agw-checkout-url').value.trim(),
          verifyUrl: document.getElementById('agw-verify-url').value.trim(),
          apiKey: document.getElementById('agw-api-key').value.trim(),
          secretKey: document.getElementById('agw-secret-key').value.trim(),
          sandboxMode: document.getElementById('agw-sandbox').checked
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to save gateway API config.');
      renderAutoGatewayStatus(data);
      document.getElementById('agw-api-key').value = '';
      document.getElementById('agw-secret-key').value = '';
      await logAudit('UPDATE_AUTO_GATEWAY_API', data.provider || 'sandbox');
      showToast('Auto Payment Gateway API credentials saved securely on server!');
    } catch (err) {
      showToast(err.message || 'Save failed.');
    }
  });

  document.getElementById('agw-clear-secrets-btn')?.addEventListener('click', async () => {
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/payments/auto-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clearSecrets: true, sandboxMode: true })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Clear failed.');
      renderAutoGatewayStatus(data);
      document.getElementById('agw-api-key').value = '';
      document.getElementById('agw-secret-key').value = '';
      await logAudit('CLEAR_AUTO_GATEWAY_SECRETS', 'server-vault');
      showToast('Gateway API secrets cleared; sandbox mode enabled.');
    } catch (err) {
      showToast(err.message || 'Failed to clear secrets.');
    }
  });

  // Courier API Vault Form
  document.getElementById('courier-api-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/courier/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: document.getElementById('cr-provider').value,
          apiUrl: document.getElementById('cr-api-url').value.trim(),
          apiKey: document.getElementById('cr-api-key').value.trim(),
          secretKey: document.getElementById('cr-secret-key').value.trim(),
          sandboxMode: document.getElementById('cr-sandbox').checked
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Courier config save failed.');
      renderCourierConfigStatus(data);
      document.getElementById('cr-api-key').value = '';
      document.getElementById('cr-secret-key').value = '';
      await logAudit('UPDATE_COURIER_API', data.provider || 'sandbox');
      showToast('Courier API config saved on server!');
    } catch (err) { showToast(err.message || 'Save failed.'); }
  });

  document.getElementById('cr-clear-secrets-btn')?.addEventListener('click', async () => {
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/courier/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clearSecrets: true, sandboxMode: true })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Clear failed.');
      renderCourierConfigStatus(data);
      document.getElementById('cr-api-key').value = '';
      document.getElementById('cr-secret-key').value = '';
      await logAudit('CLEAR_COURIER_SECRETS', 'server-vault');
      showToast('Courier API secrets cleared.');
    } catch (err) { showToast(err.message || 'Failed.'); }
  });

  // Free Fire Lookup API Vault Form
  document.getElementById('ff-api-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/games/ff-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          apiUrl: document.getElementById('ff-api-url').value.trim(),
          defaultRegion: document.getElementById('ff-default-region').value,
          apiKey: document.getElementById('ff-api-key').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Free Fire config save failed.');
      renderFfConfigStatus(data);
      document.getElementById('ff-api-key').value = '';
      await logAudit('UPDATE_FF_LOOKUP_API', data.defaultRegion || 'BD');
      showToast('Free Fire UID Lookup API config saved!');
    } catch (err) { showToast(err.message || 'Save failed.'); }
  });

  document.getElementById('ff-clear-secrets-btn')?.addEventListener('click', async () => {
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/games/ff-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clearSecrets: true })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Clear failed.');
      renderFfConfigStatus(data);
      document.getElementById('ff-api-key').value = '';
      await logAudit('CLEAR_FF_API_KEY', 'server-vault');
      showToast('Free Fire API key cleared.');
    } catch (err) { showToast(err.message || 'Failed.'); }
  });

  // Alert Bot (Telegram / Webhook) Form
  document.getElementById('alert-bot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/alerts/bot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          botToken: document.getElementById('bot-token').value.trim(),
          chatId: document.getElementById('bot-chat-id').value.trim(),
          webhookUrl: document.getElementById('bot-webhook-url').value.trim(),
          enabled: document.getElementById('bot-enabled').checked
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Bot config save failed.');
      renderAlertBotStatus(data);
      document.getElementById('bot-token').value = '';
      await logAudit('UPDATE_ALERT_BOT', 'server-vault');
      showToast('Telegram / Webhook Alert Bot saved!');
    } catch (err) { showToast(err.message || 'Save failed.'); }
  });

  document.getElementById('bot-test-btn')?.addEventListener('click', async () => {
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/alerts/test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Test alert failed.');
      showToast(`Test alert sent! (TG: ${data.telegram ? 'OK' : 'Off'}, Webhook: ${data.webhook ? 'OK' : 'Off'})`);
    } catch (err) { showToast(err.message || 'Test failed.'); }
  });

  document.getElementById('bot-clear-btn')?.addEventListener('click', async () => {
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/alerts/bot-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clearSecrets: true, enabled: false })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Clear failed.');
      renderAlertBotStatus(data);
      document.getElementById('bot-token').value = '';
      showToast('Alert bot secrets cleared.');
    } catch (err) { showToast(err.message || 'Failed.'); }
  });

  // Analytics Date-Range & Profit CSV
  document.getElementById('ana-apply-range')?.addEventListener('click', () => {
    state.analyticsRange.from = document.getElementById('ana-from')?.value || '';
    state.analyticsRange.to = document.getElementById('ana-to')?.value || '';
    renderAnalytics();
    showToast('Date-range analytics updated.');
  });
  document.getElementById('ana-reset-range')?.addEventListener('click', () => {
    state.analyticsRange = { from: '', to: '' };
    const f = document.getElementById('ana-from'); if (f) f.value = '';
    const t = document.getElementById('ana-to'); if (t) t.value = '';
    renderAnalytics();
    showToast('Analytics range reset to All Time.');
  });
  document.getElementById('ana-export-profit-csv')?.addEventListener('click', () => {
    const snap = activeAnalyticsSnapshot;
    if (!snap) return showToast('No analytics snapshot ready.');
    const rows = [
      ['PeriodFrom', 'PeriodTo', 'GrossRevenueBdt', 'TotalCostBdt', 'NetProfitBdt', 'MarginPercent', 'OrdersCount'],
      [snap.from, snap.to, snap.totalRev, snap.totalCost, snap.netProfit, `${snap.marginPct}%`, snap.orderCount],
      [],
      ['TopProductOrService', 'Units', 'RevenueBdt'],
      ...snap.topItems.map((x) => [x.name, x.qty, x.rev])
    ];
    exportCsv(rows, `naxora-bd-profit-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  // Auto PIN Stock Vault Form
  document.getElementById('vem-pin-item')?.addEventListener('change', () => {
    const pkgSel = document.getElementById('vem-pin-pkg');
    const selected = state.emarketItems.find((it) => it.id === document.getElementById('vem-pin-item').value);
    const pkgs = Array.isArray(selected?.packages) ? selected.packages : [];
    if (pkgSel) {
      pkgSel.innerHTML = pkgs.length
        ? pkgs.map((pk) => `<option value="${esc(pk.label)}">${esc(pk.label)} (${money(pk.priceBdt)})</option>`).join('')
        : '<option value="">No packages</option>';
    }
  });
  document.getElementById('vem-pin-refresh')?.addEventListener('click', loadEmPinsVault);
  document.getElementById('vem-pin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    const itemId = document.getElementById('vem-pin-item')?.value;
    const packageLabel = document.getElementById('vem-pin-pkg')?.value;
    const codes = document.getElementById('vem-pin-codes')?.value.trim();
    if (!itemId || !packageLabel || !codes) return showToast('Select service, package, and enter codes.');
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/emarket/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, packageLabel, codes })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to add PINs.');
      document.getElementById('vem-pin-codes').value = '';
      await loadEmPinsVault();
      showToast(`Added ${data.added} PIN(s) to vault!`);
    } catch (err) { showToast(err.message || 'PIN upload failed.'); }
  });

  document.getElementById('code-overrides-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      userCustomCss: document.getElementById('co-user-css').value,
      userCustomJs: document.getElementById('co-user-js').value,
      adminCustomCss: document.getElementById('co-admin-css').value,
      adminCustomJs: document.getElementById('co-admin-js').value,
      updatedBy: currentOwner.uid,
      updatedAt: serverTimestamp()
    };
    try {
      await setDoc(doc(db, 'storeConfig', 'codeOverrides'), payload, { merge: true });
      await logAudit('UPDATE_CODE_OVERRIDES', 'storeConfig/codeOverrides');
      showToast('Live CSS/JS overrides published!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'storeConfig/codeOverrides');
      showToast(err.message);
    }
  });

  // Search & CSV
  document.getElementById('vo-search').addEventListener('input', renderOrders);
  document.getElementById('vo-status-filter').addEventListener('change', renderOrders);
  document.getElementById('vw-search')?.addEventListener('input', renderWalletRequests);
  document.getElementById('vw-status-filter')?.addEventListener('change', renderWalletRequests);
  document.getElementById('vp-search').addEventListener('input', renderProducts);
  document.getElementById('vu-search').addEventListener('input', renderUsersCrm);
  document.getElementById('vu-filter')?.addEventListener('change', renderUsersCrm);
  document.getElementById('vret-filter')?.addEventListener('change', renderReturns);
  document.getElementById('v-audit-search').addEventListener('input', renderAudit);

  document.getElementById('vu-sync-ids-btn')?.addEventListener('click', async () => {
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
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

  document.getElementById('vo-export-csv').addEventListener('click', () => {
    const rows = [['OrderNumber', 'Customer', 'Phone', 'Total', 'Method', 'PayStatus', 'Status', 'Tracking']];
    state.orders.forEach((o) => rows.push([o.orderNumber || o.id, o.customerName, o.phone, o.totalBdt, o.paymentMethod, o.paymentStatus, o.status, o.courierTracking]));
    exportCsv(rows, `naxora-bd-orders-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  document.getElementById('vem-export-csv').addEventListener('click', () => {
    const rows = [['OrderNumber', 'Item', 'Package', 'TargetAccount', 'PlayerNickname', 'Total', 'Method', 'TrxID', 'Status', 'DeliveryCode']];
    state.emarketOrders.forEach((o) => rows.push([o.orderNumber || o.id, o.itemTitle, o.packageLabel, o.targetAccount, o.playerNickname || '', o.totalBdt, o.paymentMethod, o.trxId, o.status, o.deliveryCode]));
    exportCsv(rows, `naxora-bd-emarket-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  document.getElementById('vp-export-csv')?.addEventListener('click', () => {
    if (!state.products.length) return showToast('No products to export.');
    const rows = [['title', 'subtitleBn', 'categoryId', 'priceBdt', 'compareAtBdt', 'costPriceBdt', 'stock', 'imageUrl', 'emiEligible', 'isFeatured', 'isActive']];
    state.products.forEach((p) => {
      rows.push([
        p.title || '', p.subtitleBn || '', p.categoryId || 'tech-gadgets',
        Number(p.priceBdt || 0), Number(p.compareAtBdt || 0), Number(p.costPriceBdt || 0),
        Number(p.stock || 0), p.imageUrl || '',
        p.emiEligible ? 'true' : 'false', p.isFeatured ? 'true' : 'false', p.isActive !== false ? 'true' : 'false'
      ]);
    });
    exportCsv(rows, `naxora-bd-products-${new Date().toISOString().slice(0, 10)}.csv`);
  });

  document.getElementById('vp-import-csv-btn')?.addEventListener('click', () => {
    document.getElementById('vp-csv-file')?.click();
  });
  document.getElementById('vp-csv-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentOwner) return;
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
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        imported++;
      }
      await logAudit('BULK_IMPORT_PRODUCTS_CSV', `${imported} products`);
      showToast(`Imported ${imported} product(s) from CSV!`);
    } catch (err) { showToast(err.message || 'CSV import failed.'); }
  });

  document.getElementById('vem-pin-import-csv-btn')?.addEventListener('click', () => {
    document.getElementById('vem-pin-csv-file')?.click();
  });
  document.getElementById('vem-pin-csv-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentOwner) return;
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
      if (!batches.size) return showToast('No valid PIN rows found.');
      const token = await currentOwner.getIdToken();
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
      await loadEmPinsVault();
      showToast(`Imported ${totalAdded} PIN(s) to vault!`);
    } catch (err) { showToast(err.message || 'PIN CSV import failed.'); }
  });

  document.getElementById('v-rwd-refresh-btn')?.addEventListener('click', loadResellerWithdrawals);
  document.getElementById('v-chat-refresh-btn')?.addEventListener('click', loadSupportChats);
  document.getElementById('v-faq-reset')?.addEventListener('click', () => {
    document.getElementById('v-faq-id').value = '';
    document.getElementById('v-faq-form').reset();
    document.getElementById('v-faq-reset').classList.add('hidden');
  });
  document.getElementById('v-faq-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/support/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'upsert',
          id: document.getElementById('v-faq-id').value.trim(),
          category: document.getElementById('v-faq-cat').value.trim() || 'General',
          question: document.getElementById('v-faq-q').value.trim(),
          answer: document.getElementById('v-faq-a').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Failed to save FAQ.');
      state.faqs = Array.isArray(data.faqs) ? data.faqs : state.faqs;
      renderFaqs();
      document.getElementById('v-faq-id').value = '';
      e.target.reset();
      document.getElementById('v-faq-reset').classList.add('hidden');
      showToast('FAQ saved!');
    } catch (err) { showToast(err.message || 'FAQ save failed.'); }
  });

  // Global Click Delegation
  document.addEventListener('click', async (e) => {
    const navBtn = e.target.closest('[data-view]');
    if (navBtn) { switchView(navBtn.dataset.view); return; }
    const jmp = e.target.closest('[data-jump-view]');
    if (jmp) { switchView(jmp.dataset.jumpView); return; }

    const permPreset = e.target.closest('[data-perm-preset]');
    if (permPreset) {
      const mode = permPreset.dataset.permPreset;
      const p = {};
      PERM_KEYS.forEach((k) => {
        if (mode === 'full') p[k] = true;
        else if (mode === 'ops') p[k] = ['canManageOrders', 'canReplyTickets', 'canSendNotifications', 'canManageEMarket'].includes(k);
        else if (mode === 'catalog') p[k] = ['canCreateProduct', 'canEditProduct', 'canManageCategories', 'canManageSliders', 'canManageNotices'].includes(k);
        else p[k] = false;
      });
      setFormPermissions(p);
      return;
    }

    const pick = e.target.closest('[data-v-pick-asset]');
    if (pick) { openAssetPicker(pick.dataset.vPickAsset); return; }

    const choose = e.target.closest('[data-v-choose-asset]');
    if (choose && assetPickerTargetId) {
      const inp = document.getElementById(assetPickerTargetId);
      if (inp) { inp.value = choose.dataset.vChooseAsset; inp.dispatchEvent(new Event('input')); }
      document.getElementById('v-asset-picker-modal').classList.add('hidden');
      assetPickerTargetId = null;
      return;
    }

    const inspOrd = e.target.closest('[data-v-inspect-order]');
    if (inspOrd) {
      const ord = state.orders.find((o) => o.id === inspOrd.dataset.vInspectOrder);
      if (ord) openInspectModal(ord, false);
      return;
    }

    const inspEm = e.target.closest('[data-v-inspect-em]');
    if (inspEm) {
      const eo = state.emarketOrders.find((o) => o.id === inspEm.dataset.vInspectEm);
      if (eo) openInspectModal(eo, true);
      return;
    }

    const labelOrd = e.target.closest('[data-v-label-order]');
    if (labelOrd) {
      const ord = state.orders.find((o) => o.id === labelOrd.dataset.vLabelOrder);
      if (ord) openThermalLabelModal(ord);
      return;
    }

    const revBtn = e.target.closest('[data-vp-reviews]');
    if (revBtn) { openReviewsModal(revBtn.dataset.vpReviews); return; }

    const qaBtn = e.target.closest('[data-vp-qa]');
    if (qaBtn) { openQaModal(qaBtn.dataset.vpQa); return; }

    const saveQa = e.target.closest('[data-qa-save]');
    if (saveQa) {
      const [prodId, qId] = saveQa.dataset.qaSave.split('::');
      const ans = (document.querySelector(`[data-qa-ans-inp="${prodId}::${qId}"]`)?.value.trim() || '').slice(0, 800);
      if (!ans) return showToast('Enter an answer first.');
      try {
        await updateDoc(doc(db, 'products', prodId, 'questions', qId), {
          answer: ans,
          answeredBy: String(currentOwner.email || currentOwner.uid).slice(0, 128),
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

    const delQa = e.target.closest('[data-del-qa]');
    if (delQa) {
      const [prodId, qId] = delQa.dataset.delQa.split('::');
      await deleteDoc(doc(db, 'products', prodId, 'questions', qId));
      showToast('Question removed.');
      openQaModal(prodId);
      return;
    }

    const delRev = e.target.closest('[data-del-review]');
    if (delRev) {
      const [prodId, revId] = delRev.dataset.delReview.split('::');
      await deleteDoc(doc(db, 'products', prodId, 'reviews', revId));
      showToast('Review removed.');
      openReviewsModal(prodId);
      return;
    }

    const verifyPay = e.target.closest('[data-verify-pay]');
    if (verifyPay) {
      await updateDoc(doc(db, 'orders', verifyPay.dataset.verifyPay), { paymentStatus: 'paid', status: 'confirmed', updatedAt: serverTimestamp() });
      showToast('Payment marked Paid & Confirmed.');
      return;
    }

    const vwApprove = e.target.closest('[data-vw-approve]');
    if (vwApprove) {
      const reqId = vwApprove.dataset.vwApprove;
      const noteInp = document.querySelector(`[data-vw-note="${reqId}"]`);
      const adminNote = (noteInp?.value.trim() || 'Verified & Credited by Main Admin').slice(0, 240);
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
          tx.update(reqRef, { status: 'approved', adminNote, reviewedBy: currentOwner.uid, updatedAt: serverTimestamp() });
          return { userId: rData.userId, amountBdt: rData.amountBdt, nextBal };
        });
        await addDoc(collection(db, 'notifications'), {
          targetUid: credited.userId,
          title: `ওয়ালেট অ্যাড-মানি অনুমোদিত (+${money(credited.amountBdt)})`,
          body: `আপনার ${money(credited.amountBdt)} অ্যাড-মানি রিকোয়েস্ট অনুমোদিত হয়েছে। নতুন ওয়ালেট ব্যালেন্স: ${money(credited.nextBal)}।`,
          type: 'wallet_approved',
          refId: reqId,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
        await logAudit('APPROVE_WALLET_TOPUP', `${reqId} (+${credited.amountBdt})`);
        showToast(`Approved! Credited ${money(credited.amountBdt)} to wallet.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `walletRequests/${reqId}`);
        showToast(err.message || 'Approval failed.');
      }
      return;
    }

    const vwReject = e.target.closest('[data-vw-reject]');
    if (vwReject) {
      const reqId = vwReject.dataset.vwReject;
      const reqItem = state.walletRequests.find((r) => r.id === reqId);
      const noteInp = document.querySelector(`[data-vw-note="${reqId}"]`);
      const adminNote = (noteInp?.value.trim() || 'TrxID / Amount could not be verified').slice(0, 240);
      try {
        await updateDoc(doc(db, 'walletRequests', reqId), {
          status: 'rejected',
          adminNote,
          reviewedBy: currentOwner.uid,
          updatedAt: serverTimestamp()
        });
        if (reqItem?.userId) {
          await addDoc(collection(db, 'notifications'), {
            targetUid: reqItem.userId,
            title: 'ওয়ালেট অ্যাড-মানি রিকোয়েস্ট বাতিল',
            body: `আপনার ${money(reqItem.amountBdt)} অ্যাড-মানি রিকোয়েস্টটি অনুমোদিত হয়নি। কারণ: ${adminNote}`,
            type: 'wallet_rejected',
            refId: reqId,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        await logAudit('REJECT_WALLET_TOPUP', reqId);
        showToast('Wallet request rejected.');
      } catch (err) {
        showToast(err.message || 'Reject failed.');
      }
      return;
    }

    const manageUserBtn = e.target.closest('[data-v-manage-user]');
    if (manageUserBtn) {
      openManageUserModal(manageUserBtn.dataset.vManageUser);
      return;
    }

    const muWal = e.target.closest('[data-mu-wal]');
    if (muWal && currentOwner) {
      const uid = muWal.dataset.muUid;
      const mode = muWal.dataset.muWal === 'deduct' ? 'deduct' : 'add';
      const amt = Math.max(0, Number(document.getElementById('mu-wal-amt')?.value || 0));
      const reason = (document.getElementById('mu-wal-reason')?.value.trim() || (mode === 'add' ? 'Added by Main Admin' : 'Deducted by Main Admin')).slice(0, 160);
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
            const token = await currentOwner.getIdToken();
            const r = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/wallet-adjust`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ target: 'auto', mode: 'deduct', amountBdt: remAuto, note: reason })
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Auto wallet deduction failed.');
          }
        }
        await addDoc(collection(db, 'notifications'), {
          targetUid: uid,
          title: mode === 'add' ? `ওয়ালেটে +${money(amt)} যোগ হয়েছে` : `ওয়ালেট থেকে -${money(amt)} সমন্বয় করা হয়েছে`,
          body: `${reason} (${mode === 'add' ? '+' : '-'}${money(amt)})`,
          type: mode === 'add' ? 'wallet_approved' : 'wallet_rejected',
          refId: uid,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
        await logAudit(mode === 'add' ? 'USER_WALLET_ADD' : 'USER_WALLET_DEDUCT', `${uid} (${amt}: ${reason})`);
        showToast(mode === 'add' ? `Added ${money(amt)} to user wallet!` : `Deducted ${money(amt)} from user wallet!`);
        openManageUserModal(uid);
      } catch (err) { showToast(err.message || 'Wallet adjustment failed.'); }
      finally { muWal.disabled = false; }
      return;
    }

    const muBan = e.target.closest('[data-mu-ban]');
    if (muBan && currentOwner) {
      const uid = muBan.dataset.muUid;
      const shouldBan = muBan.dataset.muBan === 'ban';
      const banReason = (document.getElementById('mu-ban-reason')?.value.trim() || (shouldBan ? 'Violation of store policy' : '')).slice(0, 200);
      await updateDoc(doc(db, 'users', uid), { isBanned: shouldBan, banReason: shouldBan ? banReason : '', updatedAt: serverTimestamp() });
      await addDoc(collection(db, 'notifications'), {
        targetUid: uid,
        title: shouldBan ? 'অ্যাকাউন্ট সাসপেন্ড করা হয়েছে' : 'অ্যাকাউন্ট সচল করা হয়েছে',
        body: shouldBan ? `কারণ: ${banReason}` : 'আপনার অ্যাকাউন্ট পুনরায় সচল করা হয়েছে।',
        type: 'system',
        refId: uid,
        isRead: false,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp()
      });
      await logAudit(shouldBan ? 'BAN_USER' : 'UNBAN_USER', `${uid}: ${banReason}`);
      showToast(shouldBan ? 'Customer BANNED.' : 'Customer UNBANNED.');
      openManageUserModal(uid);
      return;
    }

    const muBl = e.target.closest('[data-mu-blacklist]');
    if (muBl && currentOwner) {
      const uid = muBl.dataset.muBlacklist;
      const u = state.users.find((x) => x.id === uid);
      if (!u) return;
      await addDoc(collection(db, 'blacklist'), {
        phone: u.savedPhone || '',
        email: (u.email || '').toLowerCase(),
        reason: document.getElementById('mu-ban-reason')?.value.trim() || 'Blocked from Customer CRM',
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp()
      });
      showToast('Added customer phone/email to Fake Order Shield.');
      return;
    }

    const muRes = e.target.closest('[data-mu-reseller]');
    if (muRes && currentOwner) {
      const uid = muRes.dataset.muUid;
      const approve = muRes.dataset.muReseller === 'approve';
      const pct = Math.min(50, Math.max(0, Number(document.getElementById('mu-reseller-pct')?.value || 8)));
      await updateDoc(doc(db, 'users', uid), {
        isReseller: approve,
        resellerStatus: approve ? 'approved' : 'none',
        resellerDiscountPct: approve ? pct : 0,
        updatedAt: serverTimestamp()
      });
      await addDoc(collection(db, 'notifications'), {
        targetUid: uid,
        title: approve ? `🤝 Reseller Mode অনুমোদিত (${pct}% Off)` : 'Reseller স্ট্যাটাস বাতিল',
        body: approve ? `অভিনন্দন! এখন সব প্রোডাক্টে ${pct}% হোলসেল/ড্রপশিপ ডিসকাউন্ট পাবেন।` : 'আপনার রিসেলার সুবিধা বন্ধ করা হয়েছে।',
        type: 'system',
        refId: uid,
        isRead: false,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp()
      });
      await logAudit(approve ? 'APPROVE_RESELLER' : 'REVOKE_RESELLER', `${uid} (${pct}%)`);
      showToast(approve ? `Reseller approved (${pct}% off)!` : 'Reseller tier revoked.');
      openManageUserModal(uid);
      return;
    }

    const muNote = e.target.closest('[data-mu-save-note]');
    if (muNote && currentOwner) {
      const uid = muNote.dataset.muSaveNote;
      const adminNote = (document.getElementById('mu-admin-note')?.value.trim() || '').slice(0, 300);
      await updateDoc(doc(db, 'users', uid), { adminNote, updatedAt: serverTimestamp() });
      showToast('CRM note saved.');
      return;
    }

    const msgUser = e.target.closest('[data-msg-user]');
    if (msgUser) {
      const sel = document.getElementById('v-nf-target');
      if (sel) sel.value = msgUser.dataset.msgUser;
      switchView('notifications');
      return;
    }

    const vpStock = e.target.closest('[data-vp-stock]');
    if (vpStock) {
      const p = state.products.find((x) => x.id === vpStock.dataset.vpStock);
      if (!p) return;
      const oldStock = Number(p.stock || 0);
      const next = Math.max(0, oldStock + parseInt(vpStock.dataset.delta, 10));
      await updateDoc(doc(db, 'products', p.id), { stock: next, updatedAt: serverTimestamp() });
      await notifyStockAlertsForProduct(p.id, p.title, oldStock, next, p.priceBdt, p.priceBdt);
      showToast(`Stock: ${next}`);
      return;
    }

    const vpEdit = e.target.closest('[data-vp-edit]');
    if (vpEdit) {
      const p = state.products.find((x) => x.id === vpEdit.dataset.vpEdit);
      if (!p) return;
      document.getElementById('vp-id').value = p.id;
      document.getElementById('vp-title').value = p.title || '';
      document.getElementById('vp-sub-bn').value = p.subtitleBn || '';
      document.getElementById('vp-cat').value = p.categoryId || '';
      document.getElementById('vp-price').value = p.priceBdt || 0;
      document.getElementById('vp-compare').value = p.compareAtBdt || 0;
      document.getElementById('vp-cost').value = p.costPriceBdt || 0;
      document.getElementById('vp-stock').value = p.stock || 0;
      if (document.getElementById('vp-sales')) document.getElementById('vp-sales').value = Number(p.salesCount || 0);
      document.getElementById('vp-viral').value = p.viralSource || '';
      document.getElementById('vp-img').value = p.imageUrl || '';
      document.getElementById('vp-gallery').value = Array.isArray(p.galleryUrls) ? p.galleryUrls.join(', ') : '';
      document.getElementById('vp-video').value = p.videoUrl || '';
      document.getElementById('vp-variants').value = (p.variants || []).join(', ');
      if (document.getElementById('vp-reseller-price')) document.getElementById('vp-reseller-price').value = p.resellerPriceBdt || 0;
      if (document.getElementById('vp-preorder-eta')) document.getElementById('vp-preorder-eta').value = p.preOrderEta || '';
      if (document.getElementById('vp-preorder-pct')) document.getElementById('vp-preorder-pct').value = p.preOrderDepositPct || 30;
      if (document.getElementById('vp-groupbuy-price')) document.getElementById('vp-groupbuy-price').value = p.groupBuyPriceBdt || 0;
      if (document.getElementById('vp-groupbuy-size')) document.getElementById('vp-groupbuy-size').value = p.groupBuySize || 2;
      if (document.getElementById('vp-variant-details')) {
        document.getElementById('vp-variant-details').value = Array.isArray(p.variantDetails)
          ? p.variantDetails.map((vd) => `${vd.name} | ${vd.priceBdt} | ${vd.stock} | ${vd.imageUrl || ''}`).join('\n')
          : '';
      }
      if (document.getElementById('vp-preorder')) document.getElementById('vp-preorder').checked = !!p.isPreOrder;
      if (document.getElementById('vp-groupbuy')) document.getElementById('vp-groupbuy').checked = !!p.groupBuyEnabled;
      document.getElementById('vp-desc').value = p.description || '';
      if (document.getElementById('vp-fbt')) document.getElementById('vp-fbt').value = Array.isArray(p.fbtProductIds) ? p.fbtProductIds.join(', ') : '';
      if (document.getElementById('vp-emi')) document.getElementById('vp-emi').checked = !!p.emiEligible;
      if (document.getElementById('vp-adv-deliv')) document.getElementById('vp-adv-deliv').checked = !!p.requireAdvanceDelivery;
      if (document.getElementById('vp-adv-deliv-fee')) document.getElementById('vp-adv-deliv-fee').value = Number(p.advanceDeliveryFeeBdt || 0);
      if (document.getElementById('vp-deliv-dhaka')) document.getElementById('vp-deliv-dhaka').value = (p.deliveryInsideDhakaBdt !== undefined && p.deliveryInsideDhakaBdt !== null && Number(p.deliveryInsideDhakaBdt) >= 0) ? Number(p.deliveryInsideDhakaBdt) : '';
      if (document.getElementById('vp-deliv-outside')) document.getElementById('vp-deliv-outside').value = (p.deliveryOutsideDhakaBdt !== undefined && p.deliveryOutsideDhakaBdt !== null && Number(p.deliveryOutsideDhakaBdt) >= 0) ? Number(p.deliveryOutsideDhakaBdt) : '';
      document.getElementById('vp-featured').checked = !!p.isFeatured;
      document.getElementById('vp-flash').checked = !!p.isFlashDrop;
      document.getElementById('vp-active').checked = p.isActive !== false;
      document.getElementById('vp-reset-btn').classList.remove('hidden');
      updateVpAdvDelivHint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const vpDel = e.target.closest('[data-vp-del]');
    if (vpDel) { await deleteDoc(doc(db, 'products', vpDel.dataset.vpDel)); showToast('Product deleted.'); return; }

    const voTrack = e.target.closest('[data-vo-save-track]');
    if (voTrack) {
      const id = voTrack.dataset.voSaveTrack;
      const inp = document.querySelector(`[data-vo-track="${id}"]`);
      const tracking = inp?.value.trim() || '';
      await updateDoc(doc(db, 'orders', id), { courierTracking: tracking, handledBy: currentOwner.uid, handledByEmail: currentOwner.email || '', updatedAt: serverTimestamp() });
      const ord = state.orders.find((o) => o.id === id);
      if (ord) {
        fetch('/api/orders/sync-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await currentOwner.getIdToken()}` },
          body: JSON.stringify({ orderNumber: ord.orderNumber || id.slice(0, 8), phone: ord.phone, status: ord.status, paymentStatus: ord.paymentStatus, courierTracking: tracking, totalBdt: ord.totalBdt })
        }).catch(() => {});
      }
      showToast('Tracking saved.');
      return;
    }
    const voDel = e.target.closest('[data-vo-del]');
    if (voDel) { await deleteDoc(doc(db, 'orders', voDel.dataset.voDel)); showToast('Order deleted.'); return; }

    const vemEdit = e.target.closest('[data-vem-edit]');
    if (vemEdit) {
      const it = state.emarketItems.find((x) => x.id === vemEdit.dataset.vemEdit);
      if (!it) return;
      document.getElementById('vem-id').value = it.id;
      document.getElementById('vem-title').value = it.title || '';
      document.getElementById('vem-sub-bn').value = it.subtitleBn || '';
      document.getElementById('vem-category').value = it.category || 'game_topup';
      document.getElementById('vem-eta').value = it.deliveryEta || '';
      document.getElementById('vem-cost').value = it.costPriceBdt || 0;
      if (document.getElementById('vem-renewal-days')) document.getElementById('vem-renewal-days').value = it.renewalDays || 0;
      if (document.getElementById('vem-sales')) document.getElementById('vem-sales').value = Number(it.salesCount || 0);
      document.getElementById('vem-input-label').value = it.inputLabel || '';
      document.getElementById('vem-input-ph').value = it.inputPlaceholder || '';
      document.getElementById('vem-img').value = it.imageUrl || '';
      document.getElementById('vem-packages').value = (it.packages || []).map((pk) => `${pk.label} | ${pk.priceBdt}`).join('\n');
      document.getElementById('vem-desc').value = it.description || '';
      document.getElementById('vem-active').checked = it.isActive !== false;
      document.getElementById('vem-reset-btn').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const vemDel = e.target.closest('[data-vem-del]');
    if (vemDel) { await deleteDoc(doc(db, 'emarketItems', vemDel.dataset.vemDel)); showToast('E-Market item deleted.'); return; }

    const delPin = e.target.closest('[data-v-del-pin]');
    if (delPin && currentOwner) {
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch(`/api/emarket/pins/${encodeURIComponent(delPin.dataset.vDelPin)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Failed to delete PIN.');
        await loadEmPinsVault();
        showToast('PIN removed from vault.');
      } catch (err) { showToast(err.message || 'Delete failed.'); }
      return;
    }

    const bookCourier = e.target.closest('[data-v-book-courier]');
    if (bookCourier && currentOwner) {
      const orderId = bookCourier.dataset.vBookCourier;
      const prov = document.getElementById('v-courier-book-prov')?.value || '';
      bookCourier.disabled = true;
      try {
        const token = await currentOwner.getIdToken();
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
        const ord = state.orders.find((o) => o.id === orderId);
        if (ord?.userId) {
          await addDoc(collection(db, 'notifications'), {
            targetUid: ord.userId,
            title: `Order #${ord.orderNumber || orderId.slice(0, 8)} Shipped`,
            body: `আপনার অর্ডারটি ${String(data.provider || 'Courier').toUpperCase()} এর মাধ্যমে পাঠানো হয়েছে। Tracking: ${data.trackingCode}`,
            type: 'order_update',
            refId: orderId,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        await logAudit('BOOK_COURIER', `${orderId} · ${data.provider}:${data.trackingCode}`);
        showToast(`Courier booked (${data.mode}): ${data.trackingCode}`);
        const updatedOrd = state.orders.find((o) => o.id === orderId);
        if (updatedOrd) openInspectModal({ ...updatedOrd, courierProvider: data.provider, courierTracking: data.trackingCode, status: 'shipped' }, false);
      } catch (err) {
        showToast(err.message || 'Courier booking error.');
      } finally {
        bookCourier.disabled = false;
      }
      return;
    }

    const refundOrd = e.target.closest('[data-v-refund-order]');
    if (refundOrd && currentOwner) {
      const orderId = refundOrd.dataset.vRefundOrder;
      refundOrd.disabled = true;
      try {
        const res = await runTransaction(db, async (tx) => {
          const oRef = doc(db, 'orders', orderId);
          const oSnap = await tx.get(oRef);
          if (!oSnap.exists()) throw new Error('Order not found.');
          const oData = oSnap.data();
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
        await addDoc(collection(db, 'notifications'), {
          targetUid: res.userId,
          title: `অর্ডার #${res.orderNumber} ওয়ালেটে রিফান্ড (+${money(res.amt)})`,
          body: `আপনার ${money(res.amt)} কাস্টমার ওয়ালেটে রিফান্ড করা হয়েছে। নতুন ব্যালেন্স: ${money(res.nextBal)}।`,
          type: 'wallet_refund',
          refId: orderId,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
        await logAudit('REFUND_ORDER_TO_WALLET', `${orderId} (+${res.amt})`);
        showToast(`Refunded ${money(res.amt)} to customer wallet!`);
        const updatedOrd = state.orders.find((o) => o.id === orderId);
        if (updatedOrd) openInspectModal({ ...updatedOrd, status: 'cancelled', paymentStatus: 'refunded' }, false);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
        showToast(err.message || 'Refund failed.');
      } finally {
        refundOrd.disabled = false;
      }
      return;
    }

    const refundEm = e.target.closest('[data-v-refund-em]');
    if (refundEm && currentOwner) {
      const orderId = refundEm.dataset.vRefundEm;
      refundEm.disabled = true;
      try {
        const res = await runTransaction(db, async (tx) => {
          const oRef = doc(db, 'emarketOrders', orderId);
          const oSnap = await tx.get(oRef);
          if (!oSnap.exists()) throw new Error('E-Market order not found.');
          const oData = oSnap.data();
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
        await addDoc(collection(db, 'notifications'), {
          targetUid: res.userId,
          title: `E-Market #${res.orderNumber} ওয়ালেটে রিফান্ড (+${money(res.amt)})`,
          body: `আপনার ${money(res.amt)} কাস্টমার ওয়ালেটে রিফান্ড করা হয়েছে। নতুন ব্যালেন্স: ${money(res.nextBal)}।`,
          type: 'wallet_refund',
          refId: orderId,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
        await logAudit('REFUND_EMARKET_TO_WALLET', `${orderId} (+${res.amt})`);
        showToast(`Refunded ${money(res.amt)} to customer wallet!`);
        const updatedEo = state.emarketOrders.find((o) => o.id === orderId);
        if (updatedEo) openInspectModal({ ...updatedEo, status: 'cancelled', paymentStatus: 'refunded' }, true);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `emarketOrders/${orderId}`);
        showToast(err.message || 'Refund failed.');
      } finally {
        refundEm.disabled = false;
      }
      return;
    }

    const vemCode = e.target.closest('[data-vem-save-code]');
    if (vemCode) {
      const id = vemCode.dataset.vemSaveCode;
      const inp = document.querySelector(`[data-vem-code="${id}"]`);
      await updateDoc(doc(db, 'emarketOrders', id), { deliveryCode: inp?.value.trim() || '', updatedAt: serverTimestamp() });
      showToast('Redeem PIN saved.');
      return;
    }
    const vemOrdDel = e.target.closest('[data-vem-ord-del]');
    if (vemOrdDel) { await deleteDoc(doc(db, 'emarketOrders', vemOrdDel.dataset.vemOrdDel)); showToast('E-Market order deleted.'); return; }

    const tglSl = e.target.closest('[data-v-tgl-sl]');
    if (tglSl) {
      const s = state.sliders.find((x) => x.id === tglSl.dataset.vTglSl);
      if (s) await updateDoc(doc(db, 'sliders', s.id), { isActive: s.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const delSl = e.target.closest('[data-v-del-sl]');
    if (delSl) { await deleteDoc(doc(db, 'sliders', delSl.dataset.vDelSl)); showToast('Slider deleted.'); return; }

    const tglNt = e.target.closest('[data-v-tgl-nt]');
    if (tglNt) {
      const n = state.notices.find((x) => x.id === tglNt.dataset.vTglNt);
      if (n) await updateDoc(doc(db, 'notices', n.id), { isActive: n.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const delNt = e.target.closest('[data-v-del-nt]');
    if (delNt) { await deleteDoc(doc(db, 'notices', delNt.dataset.vDelNt)); showToast('Notice deleted.'); return; }

    const delNf = e.target.closest('[data-v-del-nf]');
    if (delNf) { await deleteDoc(doc(db, 'notifications', delNf.dataset.vDelNf)); showToast('Notification removed.'); return; }

    const tglCp = e.target.closest('[data-v-tgl-cp]');
    if (tglCp) {
      const c = state.coupons.find((x) => x.id === tglCp.dataset.vTglCp);
      if (c) await updateDoc(doc(db, 'coupons', c.id), { isActive: c.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const delCp = e.target.closest('[data-v-del-cp]');
    if (delCp) { await deleteDoc(doc(db, 'coupons', delCp.dataset.vDelCp)); showToast('Coupon deleted.'); return; }
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
    const editCat = e.target.closest('[data-v-edit-cat]');
    if (editCat) {
      const c = state.categories.find((x) => x.id === editCat.dataset.vEditCat);
      if (!c) return;
      document.getElementById('v-cat-slug').value = c.slug || c.id || '';
      document.getElementById('v-cat-en').value = c.nameEn || '';
      document.getElementById('v-cat-bn').value = c.nameBn || '';
      document.getElementById('v-cat-order').value = Number(c.sortOrder || 1);
      const iconInp = document.getElementById('v-cat-icon');
      if (iconInp) iconInp.value = c.icon || '';
      document.querySelectorAll('[data-icon-target="v-cat-icon"] .icon-preset-btn').forEach((b) => b.classList.toggle('active', (c.icon || '') === b.dataset.pickIcon));
      document.getElementById('v-cat-active').checked = c.isActive !== false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const delCat = e.target.closest('[data-v-del-cat]');
    if (delCat) { await deleteDoc(doc(db, 'categories', delCat.dataset.vDelCat)); showToast('Category deleted.'); return; }

    const loadInv = e.target.closest('[data-v-load-invite]');
    if (loadInv) {
      const inv = state.adminInvites.find((x) => x.id === loadInv.dataset.vLoadInvite);
      if (!inv) return;
      document.getElementById('va-uid').value = '';
      document.getElementById('va-email').value = inv.email || inv.id;
      document.getElementById('va-name').value = inv.displayName || '';
      document.getElementById('va-status').value = inv.status === 'suspended' ? 'suspended' : 'approved';
      document.getElementById('va-password').value = '';
      setFormPermissions(inv.permissions || {});
      document.getElementById('va-reset-btn').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const delInv = e.target.closest('[data-v-del-invite]');
    if (delInv) { await deleteDoc(doc(db, 'adminInvites', delInv.dataset.vDelInvite)); showToast('Invite removed.'); return; }

    const loadAdm = e.target.closest('[data-v-load-admin]');
    if (loadAdm) {
      const a = state.admins.find((x) => x.id === loadAdm.dataset.vLoadAdmin);
      if (!a) return;
      document.getElementById('va-uid').value = a.uid || a.id;
      document.getElementById('va-email').value = a.email || '';
      document.getElementById('va-name').value = a.displayName || '';
      document.getElementById('va-status').value = a.status === 'suspended' ? 'suspended' : 'approved';
      document.getElementById('va-password').value = '';
      setFormPermissions(a.permissions || {});
      document.getElementById('va-reset-btn').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const delAdm = e.target.closest('[data-v-del-admin]');
    if (delAdm) {
      await deleteDoc(doc(db, 'admins', delAdm.dataset.vDelAdmin));
      await logAudit('DELETE_ADMIN', delAdm.dataset.vDelAdmin);
      showToast('Admin removed.');
      return;
    }

    const saveTkt = e.target.closest('[data-vtkt-save]');
    if (saveTkt) {
      const id = saveTkt.dataset.vtktSave;
      const rep = document.querySelector(`[data-vtkt-reply="${id}"]`)?.value.trim() || '';
      const st = document.querySelector(`[data-vtkt-status="${id}"]`)?.value || 'in_progress';
      await updateDoc(doc(db, 'tickets', id), { adminReply: rep, status: st, updatedAt: serverTimestamp() });
      const t = state.tickets.find((x) => x.id === id);
      if (t?.userId) {
        await addDoc(collection(db, 'notifications'), {
          targetUid: t.userId,
          title: `Support Reply: ${t.subject}`,
          body: rep || `Ticket status updated to ${st}`,
          type: 'ticket_reply',
          refId: id,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
      }
      showToast('Ticket reply sent.');
      return;
    }
    const delTkt = e.target.closest('[data-vtkt-del]');
    if (delTkt) { await deleteDoc(doc(db, 'tickets', delTkt.dataset.vtktDel)); showToast('Ticket deleted.'); return; }

    // Returns & Disputes handlers
    const retApp = e.target.closest('[data-vret-approve]');
    if (retApp && currentOwner) {
      const retId = retApp.dataset.vretApprove;
      retApp.disabled = true;
      try {
        const res = await runTransaction(db, async (tx) => {
          const rRef = doc(db, 'returns', retId);
          const rSnap = await tx.get(rRef);
          if (!rSnap.exists()) throw new Error('Return request not found.');
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
          tx.update(rRef, { status: 'approved', adminNote: 'Return Approved & Refunded to Wallet', reviewedBy: currentOwner.uid, updatedAt: serverTimestamp() });
          return { userId: rData.userId, amt, nextBal, orderNumber: rData.orderNumber || '' };
        });
        if (res.userId) {
          await addDoc(collection(db, 'notifications'), {
            targetUid: res.userId,
            title: `রিটার্ন অনুমোদিত ও ওয়ালেটে রিফান্ড (+${money(res.amt)})`,
            body: `অর্ডার #${res.orderNumber} এর রিটার্ন রিকোয়েস্ট অনুমোদিত হয়েছে এবং ${money(res.amt)} ওয়ালেটে ক্রেডিট হয়েছে।`,
            type: 'wallet_refund',
            refId: retId,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        await logAudit('APPROVE_RETURN_REFUND', `${retId} (+${res.amt})`);
        showToast(`Return approved & refunded ${money(res.amt)}!`);
      } catch (err) { showToast(err.message || 'Approve failed.'); }
      finally { retApp.disabled = false; }
      return;
    }

    const retRep = e.target.closest('[data-vret-replace]');
    if (retRep && currentOwner) {
      const retId = retRep.dataset.vretReplace;
      const item = state.returns.find((r) => r.id === retId);
      await updateDoc(doc(db, 'returns', retId), { status: 'replacement', adminNote: 'Replacement approved & dispatched', reviewedBy: currentOwner.uid, updatedAt: serverTimestamp() });
      if (item?.userId) {
        await addDoc(collection(db, 'notifications'), {
          targetUid: item.userId,
          title: `রিপ্লেসমেন্ট অনুমোদিত (#${item.orderNumber || ''})`,
          body: 'আপনার রিপ্লেসমেন্ট রিকোয়েস্ট অনুমোদিত হয়েছে — শীঘ্রই নতুন পার্সেল পাঠানো হবে।',
          type: 'order_update',
          refId: retId,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
      }
      showToast('Replacement approved!');
      return;
    }

    const retRej = e.target.closest('[data-vret-reject]');
    if (retRej && currentOwner) {
      const retId = retRej.dataset.vretReject;
      const item = state.returns.find((r) => r.id === retId);
      await updateDoc(doc(db, 'returns', retId), { status: 'rejected', adminNote: 'Does not meet return criteria', reviewedBy: currentOwner.uid, updatedAt: serverTimestamp() });
      if (item?.userId) {
        await addDoc(collection(db, 'notifications'), {
          targetUid: item.userId,
          title: `রিটার্ন রিকোয়েস্ট বাতিল (#${item.orderNumber || ''})`,
          body: 'আপনার রিটার্ন রিকোয়েস্টটি অনুমোদিত হয়নি। সাপোর্টে যোগাযোগ করুন।',
          type: 'system',
          refId: retId,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
      }
      showToast('Return rejected.');
      return;
    }

    // Reels, Campaigns, Tournaments, Blacklist handlers
    const rlTgl = e.target.closest('[data-vrl-tgl]');
    if (rlTgl) {
      const r = state.reels.find((x) => x.id === rlTgl.dataset.vrlTgl);
      if (r) await updateDoc(doc(db, 'reels', r.id), { isActive: r.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const rlDel = e.target.closest('[data-vrl-del]');
    if (rlDel) { await deleteDoc(doc(db, 'reels', rlDel.dataset.vrlDel)); showToast('Reel deleted.'); return; }

    const cmpTgl = e.target.closest('[data-vcmp-tgl]');
    if (cmpTgl) {
      const c = state.campaigns.find((x) => x.id === cmpTgl.dataset.vcmpTgl);
      if (c) await updateDoc(doc(db, 'campaigns', c.id), { isActive: c.isActive === false, updatedAt: serverTimestamp() });
      return;
    }
    const cmpDel = e.target.closest('[data-vcmp-del]');
    if (cmpDel) { await deleteDoc(doc(db, 'campaigns', cmpDel.dataset.vcmpDel)); showToast('Campaign deleted.'); return; }

    const trEdit = e.target.closest('[data-vtr-edit]');
    if (trEdit) {
      const t = state.tournaments.find((x) => x.id === trEdit.dataset.vtrEdit);
      if (!t) return;
      document.getElementById('vtr-id').value = t.id;
      document.getElementById('vtr-title').value = t.title || '';
      document.getElementById('vtr-game').value = t.game || 'Free Fire';
      if (document.getElementById('vtr-mode')) document.getElementById('vtr-mode').value = t.mode || 'solo';
      document.getElementById('vtr-fee').value = t.entryFeeBdt || 0;
      document.getElementById('vtr-prize').value = t.prizePoolBdt || 0;
      document.getElementById('vtr-slots').value = t.maxSlots || 48;
      if (t.startTimeIso) {
        const d = new Date(t.startTimeIso);
        if (!Number.isNaN(d.getTime())) {
          document.getElementById('vtr-time').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }
      }
      document.getElementById('vtr-status').value = t.status || 'open';
      document.getElementById('vtr-img').value = t.imageUrl || '';
      try {
        const sec = await getDoc(doc(db, 'tournaments', t.id, 'secrets', 'room'));
        if (sec.exists()) {
          document.getElementById('vtr-room-id').value = sec.data()?.roomId || '';
          document.getElementById('vtr-room-pass').value = sec.data()?.roomPass || '';
        }
      } catch {}
      document.getElementById('vtr-reset-btn').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const trLb = e.target.closest('[data-vtr-lb]');
    if (trLb) {
      openVaultTournamentLeaderboardModal(trLb.dataset.vtrLb);
      return;
    }

    if (e.target.closest('#v-tr-lb-add')) {
      const box = document.getElementById('v-tr-lb-rows');
      if (box) {
        const nextRank = box.querySelectorAll('.lb-row').length + 1;
        box.insertAdjacentHTML('beforeend', makeVaultLbRowHtml({ rank: nextRank }));
      }
      return;
    }

    const rmLbRow = e.target.closest('[data-v-lb-rm]');
    if (rmLbRow) {
      rmLbRow.closest('.lb-row')?.remove();
      return;
    }

    const lbSaveBtn = e.target.closest('#v-tr-lb-save');
    if (lbSaveBtn && currentOwner) {
      const tourId = lbSaveBtn.dataset.trId;
      const leaderboard = collectVaultLbRows();
      await updateDoc(doc(db, 'tournaments', tourId), { leaderboard, updatedAt: serverTimestamp() });
      showToast('Tournament leaderboard saved!');
      return;
    }

    const lbPayoutBtn = e.target.closest('#v-tr-lb-payout');
    if (lbPayoutBtn && currentOwner) {
      const tourId = lbPayoutBtn.dataset.trId;
      const t = state.tournaments.find((x) => x.id === tourId);
      const leaderboard = collectVaultLbRows();
      const winners = leaderboard.filter((w) => w.uid && w.prizeBdt > 0).map((w) => ({ uid: w.uid, name: w.name, rank: w.rank, prizeBdt: w.prizeBdt }));
      if (!winners.length) return showToast('Enter at least 1 winner with valid UID & Prize > 0.');
      lbPayoutBtn.disabled = true;
      try {
        const token = await currentOwner.getIdToken();
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
            await addDoc(collection(db, 'notifications'), {
              targetUid: p.uid,
              title: `🏆 Tournament Prize Won! (+${money(p.prizeBdt)})`,
              body: `"${t?.title || 'Tournament'}" এ #${p.rank} স্থান অর্জনের জন্য ${money(p.prizeBdt)} আপনার ওয়ালেটে যোগ হয়েছে!`,
              type: 'wallet_approved',
              refId: tourId,
              isRead: false,
              createdBy: currentOwner.uid,
              createdAt: serverTimestamp()
            });
          }
        }
        await logAudit('TOURNAMENT_PRIZE_PAYOUT', `${tourId} (${money(data.totalPaidBdt)})`);
        showToast(`Distributed ${money(data.totalPaidBdt)} to ${data.paidCount} winner(s)!`);
        closeDetailModal();
      } catch (err) {
        showToast(err.message || 'Prize payout failed.');
        lbPayoutBtn.disabled = false;
      }
      return;
    }

    const takeLockBtn = e.target.closest('#v-takeover-lock-btn');
    if (takeLockBtn && activeVaultOrderLockKey) {
      await acquireVaultOrderLock(activeVaultOrderLockKey, 'override');
      showToast('Order lock overridden.');
      return;
    }

    const creditResBtn = e.target.closest('[data-v-credit-reseller]');
    if (creditResBtn && currentOwner) {
      const orderId = creditResBtn.dataset.vCreditReseller;
      creditResBtn.disabled = true;
      try {
        const token = await currentOwner.getIdToken();
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
          await addDoc(collection(db, 'notifications'), {
            targetUid: data.targetUid,
            title: `🤝 Reseller Profit Credited (+${money(data.creditedBdt)})`,
            body: `অর্ডার #${data.orderNumber} থেকে ${money(data.creditedBdt)} রিসেলার প্রফিট আপনার ব্যালেন্সে যোগ হয়েছে।`,
            type: 'wallet_approved',
            refId: orderId,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        await logAudit('CREDIT_RESELLER_ORDER', `${orderId} (+${data.creditedBdt})`);
        showToast(`Credited ${money(data.creditedBdt)} reseller profit!`);
        const ord = state.orders.find((o) => o.id === orderId);
        if (ord) openInspectModal({ ...ord, resellerProfitCredited: true, resellerCreditedBdt: data.creditedBdt }, false);
      } catch (err) {
        showToast(err.message || 'Credit failed.');
        creditResBtn.disabled = false;
      }
      return;
    }

    const rwdActBtn = e.target.closest('[data-v-rwd-act]');
    if (rwdActBtn && currentOwner) {
      const withdrawalId = rwdActBtn.dataset.rwdId;
      const action = rwdActBtn.dataset.vRwdAct;
      const adminNote = (document.querySelector(`[data-v-rwd-note="${withdrawalId}"]`)?.value || '').trim();
      rwdActBtn.disabled = true;
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch('/api/reseller/withdrawals/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ withdrawalId, action, adminNote })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Review failed.');
        if (data.withdrawal?.uid) {
          await addDoc(collection(db, 'notifications'), {
            targetUid: data.withdrawal.uid,
            title: action === 'approve' ? `💸 Reseller Withdrawal Approved (${money(data.withdrawal.amountBdt)})` : 'Reseller Withdrawal Rejected',
            body: action === 'approve' ? `আপনার ${money(data.withdrawal.amountBdt)} পে-আউট পাঠানো হয়েছে।` : `উইথড্রয়াল বাতিল হয়েছে: ${adminNote || 'Rejected'}`,
            type: action === 'approve' ? 'wallet_approved' : 'wallet_rejected',
            refId: withdrawalId,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        await logAudit('REVIEW_RESELLER_WITHDRAWAL', `${withdrawalId} (${action})`);
        await loadResellerWithdrawals();
        showToast(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}.`);
      } catch (err) {
        showToast(err.message || 'Review failed.');
        rwdActBtn.disabled = false;
      }
      return;
    }

    const chatSendBtn = e.target.closest('[data-v-chat-send]');
    if (chatSendBtn && currentOwner) {
      const threadKey = chatSendBtn.dataset.vChatSend;
      const inp = document.querySelector(`[data-v-chat-inp="${threadKey}"]`);
      const text = (inp?.value || '').trim();
      if (!text) return showToast('Enter a reply message first.');
      chatSendBtn.disabled = true;
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch('/api/support/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ asStaff: true, threadKey, text })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Send failed.');
        inp.value = '';
        await loadSupportChats();
        showToast('Reply sent to live chat!');
      } catch (err) { showToast(err.message || 'Send failed.'); }
      finally { chatSendBtn.disabled = false; }
      return;
    }

    const faqEditBtn = e.target.closest('[data-v-faq-edit]');
    if (faqEditBtn) {
      const faq = state.faqs.find((f) => f.id === faqEditBtn.dataset.vFaqEdit);
      if (!faq) return;
      document.getElementById('v-faq-id').value = faq.id;
      document.getElementById('v-faq-cat').value = faq.category || 'General';
      document.getElementById('v-faq-q').value = faq.question || '';
      document.getElementById('v-faq-a').value = faq.answer || '';
      document.getElementById('v-faq-reset')?.classList.remove('hidden');
      return;
    }

    const faqDelBtn = e.target.closest('[data-v-faq-del]');
    if (faqDelBtn && currentOwner) {
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch('/api/support/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'delete', id: faqDelBtn.dataset.vFaqDel })
        });
        const data = await parseApiJson(res);
        if (!res.ok) throw new Error(data.error || 'Delete failed.');
        state.faqs = Array.isArray(data.faqs) ? data.faqs : [];
        renderFaqs();
        showToast('FAQ deleted.');
      } catch (err) { showToast(err.message || 'Delete failed.'); }
      return;
    }

    const trDel = e.target.closest('[data-vtr-del]');
    if (trDel) { await deleteDoc(doc(db, 'tournaments', trDel.dataset.vtrDel)); showToast('Tournament removed.'); return; }

    const proofBtn = e.target.closest('[data-v-proof-review]');
    if (proofBtn && currentOwner) {
      const [proofId, action] = String(proofBtn.dataset.vProofReview || '').split('::');
      const targetUid = proofBtn.dataset.proofUid;
      const tourId = proofBtn.dataset.proofTr;
      proofBtn.disabled = true;
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch('/api/tournaments/proofs/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ proofId, action, adminNote: action === 'approve' ? 'Verified by Main Admin' : 'Invalid proof' })
        });
        if (!res.ok) throw new Error('Review failed');
        if (targetUid) {
          await addDoc(collection(db, 'notifications'), {
            targetUid,
            title: action === 'approve' ? '✅ Tournament Proof Verified' : '❌ Tournament Proof Rejected',
            body: action === 'approve' ? 'আপনার ম্যাচ রেজাল্ট প্রুফ অ্যাপ্রুভ হয়েছে।' : 'আপনার ম্যাচ রেজাল্ট প্রুফ বাতিল করা হয়েছে।',
            type: 'order_update',
            refId: tourId,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        showToast(`Proof ${action}d!`);
        loadVaultTournamentProofs(tourId);
      } catch (err) {
        showToast(err.message || 'Review failed.');
        proofBtn.disabled = false;
      }
      return;
    }

    const delExpBtn = e.target.closest('[data-v-del-exp]');
    if (delExpBtn && currentOwner) {
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch(`/api/expenses/${encodeURIComponent(delExpBtn.dataset.vDelExp)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { await loadVaultExpenses(); showToast('Expense removed.'); }
      } catch {}
      return;
    }

    if (e.target.closest('#v-abandoned-refresh')) { await loadVaultAbandonedCarts(); showToast('Abandoned carts refreshed.'); return; }
    if (e.target.closest('#v-creators-refresh')) { await loadVaultCreators(); showToast('Creator tracker refreshed.'); return; }

    const remindBtn = e.target.closest('[data-v-remind-cart]');
    if (remindBtn && currentOwner) {
      const key = remindBtn.dataset.vRemindCart;
      const targetUid = remindBtn.dataset.remindUid;
      remindBtn.disabled = true;
      try {
        if (targetUid) {
          await addDoc(collection(db, 'notifications'), {
            targetUid,
            title: '🛒 আপনার কার্টে পণ্য অপেক্ষা করছে!',
            body: 'আপনার পছন্দের পণ্যগুলো স্টক শেষ হওয়ার আগেই অর্ডার কনফার্ম করুন।',
            type: 'promo',
            refId: key,
            isRead: false,
            createdBy: currentOwner.uid,
            createdAt: serverTimestamp()
          });
        }
        const token = await currentOwner.getIdToken();
        await fetch('/api/carts/abandoned/remind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ key })
        });
        await loadVaultAbandonedCarts();
        showToast('Recovery push notification sent!');
      } catch (err) {
        showToast(err.message || 'Reminder failed.');
        remindBtn.disabled = false;
      }
      return;
    }

    const delOfferBtn = e.target.closest('[data-v-del-offer]');
    if (delOfferBtn && currentOwner) {
      try {
        const token = await currentOwner.getIdToken();
        const res = await fetch(`/api/offers/${encodeURIComponent(delOfferBtn.dataset.vDelOffer)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) { await loadVaultOffers(); showToast('Auto offer removed.'); }
      } catch {}
      return;
    }

    const singleDlBtn = e.target.closest('[data-single-dl]');
    if (singleDlBtn && currentOwner) {
      await downloadSingleHtmlApp(singleDlBtn.dataset.singleDl);
      return;
    }

    const blDel = e.target.closest('[data-vbl-del]');
    if (blDel) { await deleteDoc(doc(db, 'blacklist', blDel.dataset.vblDel)); showToast('Removed from blacklist.'); return; }
  });

  document.getElementById('vdm-close').addEventListener('click', () => {
    document.body.classList.remove('printing-label');
    closeDetailModal();
  });
  document.getElementById('vdm-print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('vapm-close').addEventListener('click', () => document.getElementById('v-asset-picker-modal').classList.add('hidden'));

  // Select changes
  document.addEventListener('change', async (e) => {
    const voPay = e.target.closest('[data-vo-pay]');
    if (voPay) {
      const id = voPay.dataset.voPay;
      const ord = state.orders.find((o) => o.id === id);
      await updateDoc(doc(db, 'orders', id), { paymentStatus: voPay.value, handledBy: currentOwner.uid, handledByEmail: currentOwner.email || '', updatedAt: serverTimestamp() });
      if (ord) {
        fetch('/api/orders/sync-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await currentOwner.getIdToken()}` },
          body: JSON.stringify({ orderNumber: ord.orderNumber || id.slice(0, 8), phone: ord.phone, status: ord.status, paymentStatus: voPay.value, courierTracking: ord.courierTracking || '', totalBdt: ord.totalBdt })
        }).catch(() => {});
      }
      showToast('Payment status updated.');
      return;
    }
    const voSt = e.target.closest('[data-vo-status]');
    if (voSt) {
      const id = voSt.dataset.voStatus;
      const ord = state.orders.find((o) => o.id === id);
      await updateDoc(doc(db, 'orders', id), { status: voSt.value, handledBy: currentOwner.uid, handledByEmail: currentOwner.email || '', updatedAt: serverTimestamp() });
      if (ord) {
        fetch('/api/orders/sync-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await currentOwner.getIdToken()}` },
          body: JSON.stringify({ orderNumber: ord.orderNumber || id.slice(0, 8), phone: ord.phone, status: voSt.value, paymentStatus: ord.paymentStatus, courierTracking: ord.courierTracking || '', totalBdt: ord.totalBdt })
        }).catch(() => {});
      }
      if (ord?.userId) {
        const nType = voSt.value === 'delivered' ? 'order_completed' : voSt.value === 'cancelled' ? 'order_cancelled' : 'order_update';
        await addDoc(collection(db, 'notifications'), {
          targetUid: ord.userId,
          title: `Order #${ord.orderNumber || id.slice(0, 8)} ${voSt.value}`,
          body: `আপনার অর্ডারটি এখন "${voSt.value}" অবস্থায় রয়েছে।`,
          type: nType,
          refId: id,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
      }
      showToast(`Order marked ${voSt.value}.`);
      return;
    }
    const vemSt = e.target.closest('[data-vem-status]');
    if (vemSt) {
      const id = vemSt.dataset.vemStatus;
      const eo = state.emarketOrders.find((o) => o.id === id);
      await updateDoc(doc(db, 'emarketOrders', id), { status: vemSt.value, handledBy: currentOwner.uid, handledByEmail: currentOwner.email || '', updatedAt: serverTimestamp() });
      if (eo?.userId) {
        const nType = vemSt.value === 'completed' ? 'emarket_completed' : vemSt.value === 'cancelled' ? 'emarket_cancelled' : 'order_update';
        await addDoc(collection(db, 'notifications'), {
          targetUid: eo.userId,
          title: `E-Market #${eo.orderNumber || id.slice(0, 8)} ${vemSt.value}`,
          body: `${eo.itemTitle} অর্ডারটি "${vemSt.value}" হয়েছে।`,
          type: nType,
          refId: id,
          isRead: false,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp()
        });
      }
      showToast(`E-Market order ${vemSt.value}.`);
      return;
    }
  });

  // Products Form
  ['vp-adv-deliv', 'vp-adv-deliv-fee', 'vp-deliv-dhaka', 'vp-deliv-outside', 'gw-dhaka', 'gw-outside', 'gw-cod-adv-all'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', updateVpAdvDelivHint);
  });
  updateVpAdvDelivHint();
  document.getElementById('vp-reset-btn').addEventListener('click', () => {
    document.getElementById('vp-id').value = '';
    document.getElementById('vp-form').reset();
    document.getElementById('vp-reset-btn').classList.add('hidden');
    updateVpAdvDelivHint();
  });
  document.getElementById('vp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vp-id').value;
    const prev = id ? state.products.find((x) => x.id === id) : null;
    const galleryUrls = document.getElementById('vp-gallery').value
      .split(/\r?\n|,/)
      .map((s) => s.trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, 6);
    const variantDetails = parseVariantDetailsInput(document.getElementById('vp-variant-details')?.value || '');
    const variantsRaw = document.getElementById('vp-variants').value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
    const variants = variantsRaw.length ? variantsRaw : variantDetails.map((v) => v.name);
    const fbtProductIds = String(document.getElementById('vp-fbt')?.value || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    const payload = {
      title: document.getElementById('vp-title').value.trim().slice(0, 120),
      subtitleBn: document.getElementById('vp-sub-bn').value.trim().slice(0, 160),
      categoryId: document.getElementById('vp-cat').value || 'tech-gadgets',
      priceBdt: Math.max(1, Number(document.getElementById('vp-price').value) || 1),
      compareAtBdt: Math.max(0, Number(document.getElementById('vp-compare').value) || 0),
      costPriceBdt: Math.max(0, Number(document.getElementById('vp-cost').value) || 0),
      resellerPriceBdt: Math.max(0, Number(document.getElementById('vp-reseller-price')?.value) || 0),
      stock: Math.max(0, parseInt(document.getElementById('vp-stock').value, 10) || 0),
      salesCount: Math.max(0, parseInt(document.getElementById('vp-sales')?.value, 10) || 0),
      viralSource: document.getElementById('vp-viral').value.trim().slice(0, 60),
      imageUrl: document.getElementById('vp-img').value.trim().slice(0, 500),
      galleryUrls,
      videoUrl: document.getElementById('vp-video').value.trim().slice(0, 500),
      variants,
      variantDetails,
      fbtProductIds,
      emiEligible: document.getElementById('vp-emi')?.checked || false,
      requireAdvanceDelivery: document.getElementById('vp-adv-deliv')?.checked || false,
      advanceDeliveryFeeBdt: Math.min(50000, Math.max(0, Number(document.getElementById('vp-adv-deliv-fee')?.value) || 0)),
      deliveryInsideDhakaBdt: (() => { const v = String(document.getElementById('vp-deliv-dhaka')?.value ?? '').trim(); return v === '' ? -1 : Math.min(50000, Math.max(0, Number(v) || 0)); })(),
      deliveryOutsideDhakaBdt: (() => { const v = String(document.getElementById('vp-deliv-outside')?.value ?? '').trim(); return v === '' ? -1 : Math.min(50000, Math.max(0, Number(v) || 0)); })(),
      isPreOrder: document.getElementById('vp-preorder')?.checked || false,
      preOrderDepositPct: Math.min(100, Math.max(10, parseInt(document.getElementById('vp-preorder-pct')?.value, 10) || 30)),
      preOrderEta: (document.getElementById('vp-preorder-eta')?.value || '').trim().slice(0, 60),
      groupBuyEnabled: document.getElementById('vp-groupbuy')?.checked || false,
      groupBuyPriceBdt: Math.max(0, Number(document.getElementById('vp-groupbuy-price')?.value) || 0),
      groupBuySize: Math.min(10, Math.max(2, parseInt(document.getElementById('vp-groupbuy-size')?.value, 10) || 2)),
      description: document.getElementById('vp-desc').value.trim().slice(0, 1500),
      isFeatured: document.getElementById('vp-featured').checked,
      isFlashDrop: document.getElementById('vp-flash').checked,
      isActive: document.getElementById('vp-active').checked,
      updatedAt: serverTimestamp()
    };
    try {
      if (id) {
        await updateDoc(doc(db, 'products', id), payload);
        if (prev) {
          await notifyStockAlertsForProduct(id, payload.title, prev.stock, payload.stock, prev.priceBdt, payload.priceBdt);
        }
        showToast('Product updated.');
      } else {
        await addDoc(collection(db, 'products'), { ...payload, createdBy: currentOwner.uid, createdAt: serverTimestamp() });
        showToast('Product created.');
      }
      document.getElementById('vp-id').value = '';
      e.target.reset();
      document.getElementById('vp-reset-btn').classList.add('hidden');
      updateVpAdvDelivHint();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
      showToast(err.message || 'Product save failed.');
    }
  });

  // E-Market Form
  document.getElementById('vem-reset-btn').addEventListener('click', () => {
    document.getElementById('vem-id').value = '';
    document.getElementById('vem-form').reset();
    document.getElementById('vem-reset-btn').classList.add('hidden');
  });
  document.getElementById('vem-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vem-id').value;
    const packages = parsePackagesInput(document.getElementById('vem-packages').value);
    if (!packages.length) return showToast('Enter at least 1 package: "Label | Price"');
    const payload = {
      title: document.getElementById('vem-title').value.trim().slice(0, 120),
      subtitleBn: document.getElementById('vem-sub-bn').value.trim().slice(0, 180),
      category: document.getElementById('vem-category').value,
      inputLabel: document.getElementById('vem-input-label').value.trim().slice(0, 80),
      inputPlaceholder: document.getElementById('vem-input-ph').value.trim().slice(0, 100),
      packages,
      costPriceBdt: Math.max(0, Number(document.getElementById('vem-cost').value) || 0),
      renewalDays: Math.min(365, Math.max(0, parseInt(document.getElementById('vem-renewal-days')?.value, 10) || 0)),
      salesCount: Math.max(0, parseInt(document.getElementById('vem-sales')?.value, 10) || 0),
      imageUrl: document.getElementById('vem-img').value.trim().slice(0, 500) || DEFAULT_LOGO,
      description: document.getElementById('vem-desc').value.trim().slice(0, 1000),
      deliveryEta: document.getElementById('vem-eta').value.trim().slice(0, 60),
      isActive: document.getElementById('vem-active').checked,
      updatedAt: serverTimestamp()
    };
    try {
      if (id) {
        await updateDoc(doc(db, 'emarketItems', id), payload);
        showToast('E-Market service updated.');
      } else {
        await addDoc(collection(db, 'emarketItems'), { ...payload, createdBy: currentOwner.uid, createdAt: serverTimestamp() });
        showToast('E-Market service added.');
      }
      document.getElementById('vem-id').value = '';
      e.target.reset();
      document.getElementById('vem-reset-btn').classList.add('hidden');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'emarketItems');
      showToast(err.message || 'E-Market save failed.');
    }
  });

  // Reels, Campaigns, Tournaments, Blacklist Forms
  document.getElementById('v-reel-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = document.getElementById('v-rl-prod')?.value || '';
    const prod = state.products.find((p) => p.id === prodId);
    try {
      await addDoc(collection(db, 'reels'), {
        title: document.getElementById('v-rl-title').value.trim(),
        badgeText: document.getElementById('v-rl-badge').value.trim() || 'Viral Reel',
        videoUrl: document.getElementById('v-rl-video').value.trim(),
        posterUrl: document.getElementById('v-rl-poster').value.trim(),
        productId: prodId,
        productTitle: prod?.title || '',
        likesCount: 0,
        isActive: true,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Viral Reel published!');
    } catch (err) { showToast(err.message || 'Reel publish failed.'); }
  });

  document.getElementById('v-campaign-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sRaw = document.getElementById('v-cmp-start').value;
    const eRaw = document.getElementById('v-cmp-end').value;
    try {
      await addDoc(collection(db, 'campaigns'), {
        title: document.getElementById('v-cmp-title').value.trim(),
        discountPercent: Math.min(50, Math.max(1, Number(document.getElementById('v-cmp-pct').value) || 10)),
        startIso: new Date(sRaw).toISOString(),
        endIso: new Date(eRaw).toISOString(),
        minOrderBdt: Math.max(0, Number(document.getElementById('v-cmp-min').value) || 0),
        bannerNoteBn: document.getElementById('v-cmp-note').value.trim(),
        isActive: true,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Campaign scheduled!');
    } catch (err) { showToast(err.message || 'Campaign schedule failed.'); }
  });

  document.getElementById('vtr-reset-btn')?.addEventListener('click', () => {
    document.getElementById('vtr-id').value = '';
    document.getElementById('v-tournament-form').reset();
    document.getElementById('vtr-reset-btn').classList.add('hidden');
  });

  document.getElementById('v-tournament-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('vtr-id').value.trim();
    const tRaw = document.getElementById('vtr-time').value;
    const payload = {
      title: document.getElementById('vtr-title').value.trim(),
      game: document.getElementById('vtr-game').value.trim(),
      mode: document.getElementById('vtr-mode')?.value || 'solo',
      entryFeeBdt: Math.max(0, Number(document.getElementById('vtr-fee').value) || 0),
      prizePoolBdt: Math.max(0, Number(document.getElementById('vtr-prize').value) || 0),
      maxSlots: Math.min(200, Math.max(2, parseInt(document.getElementById('vtr-slots').value, 10) || 48)),
      startTimeIso: tRaw ? new Date(tRaw).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      status: document.getElementById('vtr-status').value,
      imageUrl: document.getElementById('vtr-img').value.trim() || DEFAULT_LOGO,
      isActive: true,
      updatedAt: serverTimestamp()
    };
    try {
      let tourId = id;
      if (id) {
        await updateDoc(doc(db, 'tournaments', id), payload);
      } else {
        const ref = await addDoc(collection(db, 'tournaments'), { ...payload, filledSlots: 0, joinedUids: [], createdBy: currentOwner.uid, createdAt: serverTimestamp() });
        tourId = ref.id;
      }
      const roomId = document.getElementById('vtr-room-id').value.trim();
      const roomPass = document.getElementById('vtr-room-pass').value.trim();
      await setDoc(doc(db, 'tournaments', tourId, 'secrets', 'room'), { roomId, roomPass, updatedAt: serverTimestamp() });
      document.getElementById('vtr-id').value = '';
      e.target.reset();
      document.getElementById('vtr-reset-btn').classList.add('hidden');
      showToast('Tournament & protected room credentials saved!');
    } catch (err) { showToast(err.message || 'Tournament save failed.'); }
  });

  document.getElementById('v-blacklist-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('vbl-phone').value.trim();
    const email = document.getElementById('vbl-email').value.trim().toLowerCase();
    const reason = document.getElementById('vbl-reason').value.trim();
    if (!phone && !email) return showToast('Enter phone number or email to blacklist.');
    try {
      await addDoc(collection(db, 'blacklist'), { phone, email, reason, createdBy: currentOwner.uid, createdAt: serverTimestamp() });
      e.target.reset();
      showToast('Added to Fake Order Shield blacklist!');
    } catch (err) { showToast(err.message || 'Blacklist save failed.'); }
  });

  // Sliders, Notices, Notifications, Coupons, Categories
  document.getElementById('v-sl-prod')?.addEventListener('change', (ev) => {
    if (ev.target.value) {
      const sel = document.getElementById('v-sl-page');
      if (sel) sel.value = 'product';
    }
  });
  document.getElementById('v-slider-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const prodId = document.getElementById('v-sl-prod')?.value || '';
      const rawPage = document.getElementById('v-sl-page').value;
      const linkPage = prodId ? 'product' : rawPage;
      const linkTarget = prodId ? prodId.slice(0, 120) : document.getElementById('v-sl-target').value.trim().slice(0, 120);
      await addDoc(collection(db, 'sliders'), {
        title: document.getElementById('v-sl-title').value.trim().slice(0, 120),
        subtitleBn: document.getElementById('v-sl-sub').value.trim().slice(0, 220),
        badgeText: document.getElementById('v-sl-badge').value.trim().slice(0, 40),
        imageUrl: document.getElementById('v-sl-img').value.trim().slice(0, 500) || DEFAULT_LOGO,
        ctaLabel: (document.getElementById('v-sl-cta').value.trim() || 'Explore').slice(0, 50),
        linkPage,
        linkTarget,
        sortOrder: state.sliders.length + 1,
        isActive: true,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Slider published.');
    } catch (err) { showToast(err.message || 'Slider save failed.'); }
  });

  document.getElementById('v-notice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msgBn = document.getElementById('v-nt-bn').value.trim().slice(0, 600);
    const msgEn = (document.getElementById('v-nt-en').value.trim() || msgBn).slice(0, 600);
    try {
      await addDoc(collection(db, 'notices'), {
        title: document.getElementById('v-nt-title').value.trim().slice(0, 120),
        messageBn: msgBn,
        messageEn: msgEn,
        priority: document.getElementById('v-nt-priority').value,
        isActive: true,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Notice posted.');
    } catch (err) { showToast(err.message || 'Notice save failed.'); }
  });

  document.getElementById('v-notif-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'notifications'), {
        targetUid: (document.getElementById('v-nf-target').value || 'ALL').slice(0, 128),
        type: document.getElementById('v-nf-type').value,
        title: document.getElementById('v-nf-title').value.trim().slice(0, 120),
        body: document.getElementById('v-nf-body').value.trim().slice(0, 600),
        refId: '',
        isRead: false,
        createdBy: currentOwner.uid,
        createdAt: serverTimestamp()
      });
      e.target.reset();
      showToast('Notification dispatched.');
    } catch (err) { showToast(err.message || 'Notification failed.'); }
  });

  document.getElementById('v-coupon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('v-cp-code').value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
    const discountType = document.getElementById('v-cp-type').value;
    const discountValue = Math.max(1, Number(document.getElementById('v-cp-val').value) || 1);
    const minOrderBdt = Math.max(0, Number(document.getElementById('v-cp-min').value) || 0);
    if (!code) return;
    try {
      const ref = doc(db, 'coupons', code);
      const snap = await getDoc(ref);
      if (snap.exists()) await updateDoc(ref, { discountType, discountValue, minOrderBdt, isActive: true, updatedAt: serverTimestamp() });
      else await setDoc(ref, { code, discountType, discountValue, minOrderBdt, isActive: true, createdBy: currentOwner.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const creatorName = (document.getElementById('v-cp-creator-name')?.value || '').trim();
      if (creatorName) {
        const creatorPhone = (document.getElementById('v-cp-creator-phone')?.value || '').trim();
        const commissionPct = Math.max(0, Number(document.getElementById('v-cp-creator-pct')?.value) || 5);
        const token = await currentOwner.getIdToken();
        await fetch('/api/coupons/creators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code, creatorName, creatorPhone, commissionPct })
        });
        loadVaultCreators();
      }
      e.target.reset();
      showToast('Coupon saved.');
    } catch (err) { showToast(err.message || 'Coupon save failed.'); }
  });

  document.getElementById('v-expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: document.getElementById('v-exp-cat').value,
          title: document.getElementById('v-exp-title').value.trim(),
          amountBdt: Number(document.getElementById('v-exp-amount').value),
          date: document.getElementById('v-exp-date').value || new Date().toISOString().slice(0, 10),
          note: document.getElementById('v-exp-note').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Expense failed.');
      e.target.reset();
      await loadVaultExpenses();
      showToast('Expense added to ledger.');
    } catch (err) { showToast(err.message || 'Expense failed.'); }
  });

  document.getElementById('v-offer-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentOwner) return;
    try {
      const token = await currentOwner.getIdToken();
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: document.getElementById('v-ofr-title').value.trim(),
          type: document.getElementById('v-ofr-type').value,
          minQty: Number(document.getElementById('v-ofr-qty').value || 2),
          discountPct: Number(document.getElementById('v-ofr-pct').value || 0),
          targetCategory: document.getElementById('v-ofr-cat').value.trim()
        })
      });
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || 'Offer failed.');
      e.target.reset();
      await loadVaultOffers();
      showToast('Auto offer published!');
    } catch (err) { showToast(err.message || 'Offer failed.'); }
  });

  document.getElementById('v-cat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const slug = document.getElementById('v-cat-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
    const nameEn = document.getElementById('v-cat-en').value.trim().slice(0, 60);
    const nameBn = document.getElementById('v-cat-bn').value.trim().slice(0, 80);
    const sortOrder = parseInt(document.getElementById('v-cat-order').value, 10) || 1;
    const icon = String(document.getElementById('v-cat-icon')?.value || '').trim().slice(0, 500);
    const isActive = document.getElementById('v-cat-active').checked;
    if (!slug) return;
    try {
      const ref = doc(db, 'categories', slug);
      const snap = await getDoc(ref);
      if (snap.exists()) await updateDoc(ref, { slug, nameEn, nameBn, icon, sortOrder, isActive, updatedAt: serverTimestamp() });
      else await setDoc(ref, { slug, nameEn, nameBn, icon, sortOrder, isActive, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      e.target.reset();
      document.querySelectorAll('[data-icon-target="v-cat-icon"] .icon-preset-btn').forEach((b) => b.classList.remove('active'));
      showToast('Category saved.');
    } catch (err) { showToast(err.message || 'Category save failed.'); }
  });

  // Add / Edit Normal Admin (Gmail + Optional Password Creation + Email Pre-Invite)
  document.getElementById('va-reset-btn').addEventListener('click', () => {
    document.getElementById('va-uid').value = '';
    document.getElementById('v-admin-form').reset();
    document.getElementById('va-reset-btn').classList.add('hidden');
    document.getElementById('va-credentials-box').classList.add('hidden');
  });

  document.getElementById('v-admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailRaw = document.getElementById('va-email').value.trim();
    const emailLower = emailRaw.toLowerCase();
    const displayName = document.getElementById('va-name').value.trim() || 'Operations Admin';
    const password = document.getElementById('va-password').value;
    const status = document.getElementById('va-status').value === 'suspended' ? 'suspended' : 'approved';
    const uidField = document.getElementById('va-uid').value.trim();
    const permissions = getFormPermissions();

    if (!emailLower.includes('@') || emailLower === MAIN_ADMIN_EMAIL) {
      return showToast('সঠিক একটি নরমাল অ্যাডমিন জিমেইল দিন।');
    }

    const credBox = document.getElementById('va-credentials-box');
    credBox.classList.add('hidden');

    try {
      // 1. Always save/update pre-authorized invite by lowercase email
      const invRef = doc(db, 'adminInvites', emailLower);
      const invSnap = await getDoc(invRef);
      if (invSnap.exists()) {
        await updateDoc(invRef, { email: emailLower, displayName, status, permissions, updatedAt: serverTimestamp() });
      } else {
        await setDoc(invRef, {
          email: emailLower,
          displayName,
          status,
          permissions,
          createdBy: currentOwner.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // 2. If editing an existing UID in /admins, update it immediately
      if (uidField) {
        const admRef = doc(db, 'admins', uidField);
        const admSnap = await getDoc(admRef);
        if (admSnap.exists()) {
          await updateDoc(admRef, { displayName, status, permissions, updatedAt: serverTimestamp() });
        }
      }

      // 3. If Password >= 6 chars provided, provision Auth account via isolated secondary app
      let createdCredMsg = '';
      if (password && password.length >= 6) {
        try {
          const secApp = getApps().find((a) => a.name === 'admin-creator') || initializeApp(firebaseCfgGlobal, 'admin-creator');
          const secAuth = getAuth(secApp);
          const cred = await createUserWithEmailAndPassword(secAuth, emailLower, password);
          try { await updateProfile(cred.user, { displayName }); } catch {}
          try { await sendEmailVerification(cred.user); } catch {}
          const newUid = cred.user.uid;
          await signOut(secAuth);

          await setDoc(doc(db, 'admins', newUid), {
            uid: newUid,
            email: emailLower,
            displayName,
            status,
            permissions,
            requestedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          createdCredMsg = `
            <strong>নতুন নরমাল অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে!</strong><br/>
            Gmail: <code>${esc(emailLower)}</code><br/>
            Password: <code>${esc(password)}</code><br/>
            Admin URL: <code>${esc(location.origin)}/admin/</code><br/>
            <span class="muted-note">অ্যাডমিন প্রথমবার লগইন করার আগে ইনবক্সের ভেরিফিকেশন লিংকে ক্লিক করবেন অথবা সরাসরি এই জিমেইল দিয়ে Google সাইন ইন করতে পারবেন।</span>
          `;
        } catch (authErr) {
          if (authErr?.code === 'auth/operation-not-allowed') {
            createdCredMsg = `
              <strong>জিমেইল পারমিশন সেভ হয়েছে (${esc(emailLower)})!</strong><br/>
              <span class="muted-note">পাসওয়ার্ড অ্যাকাউন্ট তৈরি করতে Firebase Console → Authentication → Sign-in method থেকে <strong>Email/Password</strong> চালু করুন। ততক্ষণ অ্যাডমিন সরাসরি <strong>Continue with Google</strong> দিয়েই <code>/admin/</code>-এ প্রবেশ করতে পারবেন।</span>
            `;
          } else if (authErr?.code === 'auth/email-already-in-use') {
            createdCredMsg = `
              <strong>জিমেইল পারমিশন আপডেট হয়েছে (${esc(emailLower)})!</strong><br/>
              <span class="muted-note">এই জিমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট রয়েছে—অ্যাডমিন লগইন করলেই নতুন পারমিশন অটোমেটিক পেয়ে যাবেন।</span>
            `;
          } else {
            throw authErr;
          }
        }
      } else {
        createdCredMsg = `
          <strong>জিমেইল প্রি-অনুমোদন ও পারমিশন সেভ হয়েছে!</strong><br/>
          Gmail: <code>${esc(emailLower)}</code> · Admin URL: <code>${esc(location.origin)}/admin/</code><br/>
          <span class="muted-note">অ্যাডমিন এই জিমেইল দিয়ে Google Sign-In করলে অটোমেটিক অনুমোদিত পারমিশন নিয়ে ঢুকতে পারবেন।</span>
        `;
      }

      if (createdCredMsg) {
        credBox.innerHTML = createdCredMsg;
        credBox.classList.remove('hidden');
      }

      await logAudit('UPSERT_NORMAL_ADMIN', emailLower);
      showToast('Admin invite & permissions saved!');
      document.getElementById('va-password').value = '';
    } catch (err) {
      showToast(err.message || 'Failed to save admin');
    }
  });

  // Seed & Live Code Studio (matching /server.ts endpoints)
  document.getElementById('v-seed-btn').addEventListener('click', async () => {
    try {
      await seedViralCatalog();
      showToast('Viral catalog, E-Market & 65-field config seeded!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'seedViralCatalog');
      showToast(err.message);
    }
  });

  const getToken = () => currentOwner.getIdToken();

  document.getElementById('cs-load-btn').addEventListener('click', async () => {
    try {
      const appName = document.getElementById('cs-app').value;
      const fileName = document.getElementById('cs-file').value;
      const res = await fetch(`/api/code-studio/files?app=${encodeURIComponent(appName)}`, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      const data = await parseApiJson(res);
      if (!res.ok) return showToast(data.error || 'Load failed');
      document.getElementById('cs-editor').value = data.files?.[fileName] || '';
      showToast(`Loaded ${appName}/${fileName}`);
    } catch (err) { showToast(err.message || 'Load failed'); }
  });

  document.getElementById('cs-save-btn').addEventListener('click', async () => {
    try {
      const appName = document.getElementById('cs-app').value;
      const fileName = document.getElementById('cs-file').value;
      const content = document.getElementById('cs-editor').value;
      const res = await fetch('/api/code-studio/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ app: appName, fileName, content })
      });
      const data = await parseApiJson(res);
      if (!res.ok) return showToast(data.error || 'Save failed');
      showToast(`Saved ${appName}/${fileName}`);
    } catch (err) { showToast(err.message || 'Save failed'); }
  });

  document.getElementById('cs-restore-btn').addEventListener('click', async () => {
    try {
      const appName = document.getElementById('cs-app').value;
      const fileName = document.getElementById('cs-file').value;
      const res = await fetch('/api/code-studio/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ app: appName, fileName })
      });
      const data = await parseApiJson(res);
      if (!res.ok) return showToast(data.error || 'Restore failed');
      document.getElementById('cs-load-btn').click();
      showToast(`Restored default ${appName}/${fileName}`);
    } catch (err) { showToast(err.message || 'Restore failed'); }
  });

  document.getElementById('cs-download-btn').addEventListener('click', async () => {
    const appName = document.getElementById('cs-app').value;
    const res = await fetch(`/api/code-studio/download/${encodeURIComponent(appName)}`, {
      headers: { Authorization: `Bearer ${await getToken()}` }
    });
    if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) return showToast('ZIP download requires the Node backend (/api).');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `naxora-bd-${appName}-3files.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Downloaded naxora-bd-${appName}-3files.zip`);
  });

  // Single-File HTML Packaging System (HTML + CSS + JS embedded per app separately)
  document.getElementById('cs-single-load-btn')?.addEventListener('click', async () => {
    const appName = document.getElementById('cs-single-app')?.value || 'user';
    const metaEl = document.getElementById('cs-single-meta');
    try {
      const res = await fetch(`/api/code-studio/single-html/${encodeURIComponent(appName)}?mode=json`, {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      const data = await parseApiJson(res);
      if (!res.ok) return showToast(data.error || 'Single HTML build failed.');
      const preview = document.getElementById('cs-single-preview');
      if (preview) preview.value = data.html || '';
      if (metaEl) {
        metaEl.className = 'status-pill badge-approved';
        metaEl.textContent = `${data.fileName} (${Math.round((Number(data.bytes || 0) / 1024))} KB)`;
      }
      showToast(`Generated ${data.fileName} (CSS + JS embedded)!`);
    } catch (err) {
      showToast(err.message || 'Preview failed.');
    }
  });

  document.getElementById('cs-single-copy-btn')?.addEventListener('click', async () => {
    const text = document.getElementById('cs-single-preview')?.value || '';
    if (!text) return showToast('Click "Preview Combined HTML" first.');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Combined Single HTML copied to clipboard!');
    } catch {
      showToast('Copy blocked — select text in editor and copy.');
    }
  });

  document.getElementById('cs-single-download-btn')?.addEventListener('click', async () => {
    const appName = document.getElementById('cs-single-app')?.value || 'user';
    await downloadSingleHtmlApp(appName);
  });

  document.getElementById('cs-single-download-all-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/code-studio/download-all-singles', {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) return showToast('ZIP download requires the Node backend (/api).');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'naxora-bd-3-single-html-apps.zip';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Downloaded all 3 separate Single-File HTML apps (.zip)!');
    } catch (err) {
      showToast(err.message || 'Download failed.');
    }
  });

  document.getElementById('cs-download-images-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/code-studio/download-images', {
        headers: { Authorization: `Bearer ${await getToken()}` }
      });
      if (!res.ok || (res.headers.get('content-type') || '').includes('text/html')) return showToast('ZIP download requires the Node backend (/api).');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'naxora-bd-images.zip';
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('Downloaded naxora-bd-images.zip (all 11 images + icons)!');
    } catch (err) {
      showToast(err.message || 'Download failed.');
    }
  });
}

async function downloadSingleHtmlApp(appName) {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch(`/api/code-studio/single-html/${encodeURIComponent(appName)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return showToast('Single HTML download requires the Node backend (/api).');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `naxora-bd-${appName}-single.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Downloaded naxora-bd-${appName}-single.html`);
  } catch (err) {
    showToast(err.message || 'Download failed.');
  }
}

/* ==================== BOOTSTRAP ==================== */

async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (err) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

async function bootstrap() {
  detectAndApplyDeviceLayout();
  bindEvents();
  buildMobileNav();

  firebaseCfgGlobal = await (async () => {
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
  if (!firebaseCfgGlobal) {
    showVaultError('Firebase configuration লোড করা যায়নি। পেজটি রিলোড করুন।');
    return;
  }
  app = initializeApp(firebaseCfgGlobal);
  auth = getAuth(app);
  db = firebaseCfgGlobal.firestoreDatabaseId
    ? getFirestore(app, firebaseCfgGlobal.firestoreDatabaseId)
    : getFirestore(app);

  testFirestoreConnection();

  onSnapshot(doc(db, 'storeConfig', 'global'), (snap) => {
    if (snap.exists()) {
      const raw = { ...snap.data() };
      const patch = {};
      if (raw.brandName === 'ViralDrop BD') {
        raw.brandName = 'Naxora Bd';
        patch.brandName = 'Naxora Bd';
      }
      if (raw.brandLogoUrl === '/src/assets/images/brand_emblem_logo_1795204970933.jpg') {
        raw.brandLogoUrl = DEFAULT_LOGO;
        patch.brandLogoUrl = DEFAULT_LOGO;
      }
      if (typeof raw.metaTitle === 'string' && raw.metaTitle.startsWith('ViralDrop BD')) {
        raw.metaTitle = raw.metaTitle.replace('ViralDrop BD', 'Naxora Bd');
        patch.metaTitle = raw.metaTitle;
      }
      storeConfig = { ...DEFAULT_STORE_CONFIG, ...raw };
      if (currentOwner && Object.keys(patch).length) {
        setDoc(doc(db, 'storeConfig', 'global'), { ...patch, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    }
    syncBrandHeader();
    populateSettingsForms();
  }, (err) => handleFirestoreError(err, OperationType.GET, 'storeConfig/global'));

  onSnapshot(doc(db, 'storeConfig', 'codeOverrides'), (snap) => {
    if (snap.exists()) codeOverrides = snap.data();
    populateSettingsForms();
  }, (err) => handleFirestoreError(err, OperationType.GET, 'storeConfig/codeOverrides'));

  onAuthStateChanged(auth, (user) => {
    Object.keys(unsubs).forEach((k) => { try { unsubs[k]?.(); } catch {} delete unsubs[k]; });
    Object.keys(vLiveReady).forEach((k) => delete vLiveReady[k]);
    currentOwner = null;
    document.getElementById('vault-verify-box')?.classList.add('hidden');
    const switchBtn = document.getElementById('vault-switch-acct-btn');
    if (switchBtn) switchBtn.classList.toggle('hidden', !user);

    if (!user) {
      loggedOwnerUid = '';
      document.getElementById('vault-shell').classList.add('hidden');
      document.getElementById('vault-mobile-nav').classList.add('hidden');
      document.getElementById('vault-auth-gate').classList.remove('hidden');
      return;
    }

    const emailLower = (user.email || '').trim().toLowerCase();
    if (emailLower !== MAIN_ADMIN_EMAIL) {
      showAuthError(`শুধুমাত্র মেইন অ্যাডমিন (${MAIN_ADMIN_EMAIL}) এই ভল্টে প্রবেশ করতে পারবেন।`);
      document.getElementById('vault-shell').classList.add('hidden');
      document.getElementById('vault-auth-gate').classList.remove('hidden');
      return;
    }

    if (!user.emailVerified) {
      document.getElementById('vault-verify-box')?.classList.remove('hidden');
      showAuthError('নিরাপত্তার জন্য মেইন অ্যাডমিন ইমেইল ভেরিফিকেশন সম্পন্ন করুন অথবা Google দিয়ে সাইন ইন করুন।');
      return;
    }

    currentOwner = user;
    document.getElementById('vault-auth-gate').classList.add('hidden');
    document.getElementById('vault-shell').classList.remove('hidden');
    document.getElementById('vault-mobile-nav').classList.remove('hidden');
    document.getElementById('vault-owner-email').textContent = user.email || user.uid;

    populateSettingsForms();
    attachVaultListeners();
    loadAutoGatewayConfig();
    loadCourierApiConfig();
    loadFfApiConfig();
    loadAlertBotConfig();
    loadEmPinsVault();
    loadResellerWithdrawals();
    loadSupportChats();
    loadFaqs();
    loadVaultExpenses();
    loadVaultAbandonedCarts();
    loadVaultCreators();
    loadVaultOffers();
    if (loggedOwnerUid !== user.uid) {
      loggedOwnerUid = user.uid;
      logAudit('ADMIN_LOGIN', `${user.email || 'Main Owner'} (Main Admin Vault)`).catch(() => {});
      user.getIdToken().then((tk) => fetch('/api/alerts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ role: 'main_admin', panel: 'main-admin' })
      })).catch(() => {});
    }
  });
}

function renderAutoGatewayStatus(data) {
  const statusEl = document.getElementById('agw-key-status');
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  if (data.provider) setVal('agw-provider', data.provider);
  setVal('agw-display-name', data.displayName || 'Auto Payment Gateway');
  setVal('agw-checkout-url', data.checkoutUrl || '');
  setVal('agw-verify-url', data.verifyUrl || '');
  setChk('agw-sandbox', data.sandboxMode !== false);
  const apiInp = document.getElementById('agw-api-key');
  const secInp = document.getElementById('agw-secret-key');
  if (apiInp) apiInp.placeholder = data.hasApiKey ? `Saved (${data.apiKeyMasked}) — enter to replace` : 'Enter API Key...';
  if (secInp) secInp.placeholder = data.hasSecretKey ? `Saved (${data.secretKeyMasked}) — enter to replace` : 'Enter Secret Key...';
  if (statusEl) {
    if (data.hasApiKey && !data.sandboxMode) {
      statusEl.className = 'status-pill badge-approved';
      statusEl.textContent = `Live API (${data.provider})`;
    } else if (data.hasApiKey) {
      statusEl.className = 'status-pill badge-confirmed';
      statusEl.textContent = 'Keys Saved · Sandbox ON';
    } else {
      statusEl.className = 'status-pill badge-pending';
      statusEl.textContent = 'Sandbox Mode (No Live Key)';
    }
  }
}

function setVaultApiOfflinePill(id) {
  const el = document.getElementById(id);
  if (el) {
    el.className = 'status-pill badge-pending';
    el.textContent = 'Server API Offline (Static Host)';
  }
}

async function loadAutoGatewayConfig() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/payments/auto-config', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = res.ok ? await parseApiJson(res, true) : null;
    if (!data) return setVaultApiOfflinePill('agw-key-status');
    renderAutoGatewayStatus(data);
  } catch (err) {
    setVaultApiOfflinePill('agw-key-status');
    console.warn('Auto gateway status check skipped:', err?.message || err);
  }
}

function renderCourierConfigStatus(data) {
  const statusEl = document.getElementById('cr-key-status');
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  if (data.provider) setVal('cr-provider', data.provider);
  setVal('cr-api-url', data.apiUrl || '');
  setChk('cr-sandbox', data.sandboxMode !== false);
  const apiInp = document.getElementById('cr-api-key');
  const secInp = document.getElementById('cr-secret-key');
  if (apiInp) apiInp.placeholder = data.hasApiKey ? `Saved (${data.apiKeyMasked}) — enter to replace` : 'Enter Courier API Key...';
  if (secInp) secInp.placeholder = data.hasSecretKey ? `Saved (${data.secretKeyMasked}) — enter to replace` : 'Enter Courier Secret Key...';
  if (statusEl) {
    if (data.hasApiKey && !data.sandboxMode) {
      statusEl.className = 'status-pill badge-approved';
      statusEl.textContent = `Live (${data.provider})`;
    } else if (data.hasApiKey) {
      statusEl.className = 'status-pill badge-confirmed';
      statusEl.textContent = 'Keys Saved · Sandbox ON';
    } else {
      statusEl.className = 'status-pill badge-pending';
      statusEl.textContent = 'Sandbox Tracking ON';
    }
  }
}

async function loadCourierApiConfig() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/courier/config', { headers: { Authorization: `Bearer ${token}` } });
    const data = res.ok ? await parseApiJson(res, true) : null;
    if (!data) return setVaultApiOfflinePill('cr-key-status');
    renderCourierConfigStatus(data);
  } catch (err) {
    setVaultApiOfflinePill('cr-key-status');
    console.warn('Courier status skipped:', err?.message || err);
  }
}

function renderFfConfigStatus(data) {
  const statusEl = document.getElementById('ff-key-status');
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  setVal('ff-api-url', data.apiUrl || '');
  if (data.defaultRegion) setVal('ff-default-region', data.defaultRegion);
  const keyInp = document.getElementById('ff-api-key');
  if (keyInp) keyInp.placeholder = data.hasApiKey ? `Saved (${data.apiKeyMasked}) — enter to replace` : 'Enter FF Lookup API Key...';
  if (statusEl) {
    if (data.apiUrl) {
      statusEl.className = 'status-pill badge-approved';
      statusEl.textContent = `Custom API (${data.defaultRegion || 'BD'})`;
    } else {
      statusEl.className = 'status-pill badge-confirmed';
      statusEl.textContent = `Built-in Fallback (${data.defaultRegion || 'BD'})`;
    }
  }
}

async function loadFfApiConfig() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/games/ff-config', { headers: { Authorization: `Bearer ${token}` } });
    const data = res.ok ? await parseApiJson(res, true) : null;
    if (!data) return setVaultApiOfflinePill('ff-key-status');
    renderFfConfigStatus(data);
  } catch (err) {
    setVaultApiOfflinePill('ff-key-status');
    console.warn('FF lookup config skipped:', err?.message || err);
  }
}

async function loadEmPinsVault() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/emarket/pins', { headers: { Authorization: `Bearer ${token}` } });
    const data = res.ok ? await parseApiJson(res, true) : null;
    if (!data) return;
    state.emPinsVault = data;
    renderEmPinsVault();
  } catch (err) {
    console.warn('EM pins load skipped:', err?.message || err);
  }
}

function renderAlertBotStatus(data) {
  const statusEl = document.getElementById('bot-key-status');
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  setVal('bot-chat-id', data.chatId || '');
  setVal('bot-webhook-url', data.webhookUrl || '');
  setChk('bot-enabled', !!data.enabled);
  const tokInp = document.getElementById('bot-token');
  if (tokInp) tokInp.placeholder = data.hasBotToken ? `Saved (${data.botTokenMasked}) — enter to replace` : '123456789:ABC...';
  if (statusEl) {
    if (data.enabled && (data.hasBotToken || data.webhookUrl)) {
      statusEl.className = 'status-pill badge-approved';
      statusEl.textContent = 'Bot Active';
    } else if (data.hasBotToken || data.webhookUrl) {
      statusEl.className = 'status-pill badge-confirmed';
      statusEl.textContent = 'Configured (Paused)';
    } else {
      statusEl.className = 'status-pill badge-pending';
      statusEl.textContent = 'Not Configured';
    }
  }
}

async function loadAlertBotConfig() {
  if (!currentOwner) return;
  try {
    const token = await currentOwner.getIdToken();
    const res = await fetch('/api/alerts/bot-config', { headers: { Authorization: `Bearer ${token}` } });
    const data = res.ok ? await parseApiJson(res, true) : null;
    if (!data) return setVaultApiOfflinePill('bot-key-status');
    renderAlertBotStatus(data);
  } catch (err) {
    setVaultApiOfflinePill('bot-key-status');
    console.warn('Alert bot config skipped:', err?.message || err);
  }
}

bootstrap().catch((err) => showAuthError(err.message || 'Vault initialization failed'));
