import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import net from 'net';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const MAIN_ADMIN_EMAIL = 'comebackemail12@gmail.com';
const ALLOWED_APPS = new Set(['user', 'admin', 'main-admin']);
const ALLOWED_FILES = new Set(['index.html', 'style.css', 'app.js']);
const RUNTIME_DIR = path.resolve(ROOT_DIR, '.runtime');
const EPHEMERAL_HMAC_KEY = process.env.GATEWAY_HMAC_SECRET || crypto.randomBytes(32).toString('hex');

interface AuthUser {
  uid: string;
  email: string;
  name: string;
  token: string;
}

interface AuthedRequest extends Request {
  authUser?: AuthUser;
}

interface AutoGatewayConfig {
  provider: string;
  displayName: string;
  checkoutUrl: string;
  verifyUrl: string;
  apiKey: string;
  secretKey: string;
  sandboxMode: boolean;
  updatedAt: string;
  updatedBy: string;
}

interface AutoSessionRecord {
  sessionId: string;
  uid: string;
  email: string;
  amountBdt: number;
  purpose: 'order' | 'emarket' | 'wallet_topup';
  referenceId: string;
  mode: 'live' | 'sandbox';
  provider: string;
  gatewayInvoiceId: string;
  paymentUrl: string;
  hmacSig: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  trxId?: string;
}

interface WalletSpendReceipt {
  spendId: string;
  uid: string;
  amountBdt: number;
  rollbackToken: string;
  rolledBack: boolean;
  createdAt: number;
}

function loadFirebaseConfig() {
  const configPath = path.join(ROOT_DIR, 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

const firebaseConfig = loadFirebaseConfig();
let adminAuth: ReturnType<typeof getAuth> | null = null;
if (firebaseConfig?.projectId && firebaseConfig.projectId !== 'remixed-project-id') {
  const adminApp = getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseConfig.projectId });
  adminAuth = getAuth(adminApp);
}

function safeRuntimeFile(fileName: string): string {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const resolved = path.resolve(RUNTIME_DIR, path.basename(fileName));
  if (!resolved.startsWith(RUNTIME_DIR + path.sep)) {
    throw new Error('Invalid runtime file path');
  }
  return resolved;
}

function readJsonRuntime<T>(fileName: string, fallback: T): T {
  try {
    const filePath = safeRuntimeFile(fileName);
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonRuntime(fileName: string, data: unknown): void {
  const filePath = safeRuntimeFile(fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function isPrivateOrLocalIp(host: string): boolean {
  const clean = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!clean || clean === 'localhost' || clean.endsWith('.localhost') || clean.endsWith('.local')) {
    return true;
  }
  const ipVer = net.isIP(clean);
  if (ipVer === 4) {
    const parts = clean.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (ipVer === 6) {
    if (clean === '::' || clean === '::1') return true;
    if (clean.startsWith('fc') || clean.startsWith('fd') || clean.startsWith('fe80') || clean.startsWith('::ffff:')) {
      return true;
    }
    return false;
  }
  return false;
}

function isSafeExternalHttpUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (!parsed.hostname || isPrivateOrLocalIp(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 6) return '••••••';
  return `${secret.slice(0, 3)}••••••${secret.slice(-3)}`;
}

function loadGatewayConfig(): AutoGatewayConfig {
  const defaults: AutoGatewayConfig = {
    provider: process.env.AUTO_PAY_PROVIDER || 'sandbox',
    displayName: 'Auto Payment Gateway',
    checkoutUrl: process.env.AUTO_PAY_CHECKOUT_URL || '',
    verifyUrl: process.env.AUTO_PAY_VERIFY_URL || '',
    apiKey: process.env.AUTO_PAY_API_KEY || '',
    secretKey: process.env.AUTO_PAY_SECRET_KEY || '',
    sandboxMode: (process.env.AUTO_PAY_SANDBOX || 'true').toLowerCase() !== 'false',
    updatedAt: '',
    updatedBy: ''
  };
  const saved = readJsonRuntime<Partial<AutoGatewayConfig>>('payment-gateway.json', {});
  return { ...defaults, ...saved };
}

function signAutoPayload(payload: string): string {
  return crypto.createHmac('sha256', EPHEMERAL_HMAC_KEY).update(payload).digest('hex');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(String(a || ''), 'hex');
    const bufB = Buffer.from(String(b || ''), 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function ensureDefaultSnapshots() {
  const defaultsRoot = path.join(ROOT_DIR, '.defaults');
  for (const appName of ALLOWED_APPS) {
    const appDir = path.join(ROOT_DIR, 'apps', appName);
    const defDir = path.join(defaultsRoot, appName);
    if (!fs.existsSync(appDir)) continue;
    if (!fs.existsSync(defDir)) {
      fs.mkdirSync(defDir, { recursive: true });
      for (const fileName of ALLOWED_FILES) {
        const src = path.join(appDir, fileName);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(defDir, fileName));
        }
      }
    }
  }
}

async function verifyUserToken(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!adminAuth) {
    res.status(503).json({ error: 'Firebase Auth verifier is not configured.' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email_verified !== true) {
      res.status(403).json({ error: 'Verified Google account required.' });
      return;
    }
    req.authUser = {
      uid: decoded.uid,
      email: (decoded.email || '').trim().toLowerCase(),
      name: String(decoded.name || decoded.email || 'User'),
      token
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

async function requireMainAdmin(req: Request, res: Response, next: NextFunction) {
  if (!adminAuth) {
    res.status(503).json({ error: 'Firebase Auth verifier is not configured.' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if ((decoded.email || '').trim().toLowerCase() !== MAIN_ADMIN_EMAIL.toLowerCase() || decoded.email_verified !== true) {
      res.status(403).json({ error: 'Main Admin privileges required.' });
      return;
    }
    (req as AuthedRequest).authUser = {
      uid: decoded.uid,
      email: (decoded.email || '').trim().toLowerCase(),
      name: String(decoded.name || 'Main Admin'),
      token
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('stringValue' in val) return String(val.stringValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return Array.isArray(val.arrayValue?.values) ? val.arrayValue.values.map(decodeFirestoreValue) : [];
  }
  if ('mapValue' in val) {
    return decodeFirestoreFields(val.mapValue?.fields || {});
  }
  return null;
}

function decodeFirestoreFields(fields: Record<string, any> = {}): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

async function fetchFirestoreDocWithToken(collectionPath: string, docId: string, bearerToken: string): Promise<Record<string, any> | null> {
  if (!firebaseConfig?.projectId) return null;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const safePath = `${collectionPath}/${docId}`.split('/').map(encodeURIComponent).join('/');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(dbId)}/documents/${safePath}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { fields?: Record<string, any> } | null;
    if (!json || !json.fields) return null;
    return decodeFirestoreFields(json.fields);
  } catch {
    return null;
  }
}

function requireStaffPermission(permKey: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!adminAuth) {
      res.status(503).json({ error: 'Firebase Auth verifier is not configured.' });
      return;
    }
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization Bearer token.' });
      return;
    }
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded.email_verified !== true) {
        res.status(403).json({ error: 'Verified account required.' });
        return;
      }
      const emailLower = (decoded.email || '').trim().toLowerCase();
      req.authUser = {
        uid: decoded.uid,
        email: emailLower,
        name: String(decoded.name || emailLower || 'Staff'),
        token
      };
      if (emailLower === MAIN_ADMIN_EMAIL.toLowerCase()) {
        next();
        return;
      }
      const adminDoc = await fetchFirestoreDocWithToken('admins', decoded.uid, token);
      if (adminDoc && adminDoc.status === 'approved' && adminDoc.permissions?.[permKey] === true) {
        next();
        return;
      }
      res.status(403).json({ error: `Permission "${permKey}" or Main Admin access required.` });
    } catch {
      res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
    }
  };
}

function requireAnyStaffPerm(permKeys: string[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!adminAuth) {
      res.status(503).json({ error: 'Firebase Auth verifier is not configured.' });
      return;
    }
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({ error: 'Missing Authorization Bearer token.' });
      return;
    }
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded.email_verified !== true) {
        res.status(403).json({ error: 'Verified account required.' });
        return;
      }
      const emailLower = (decoded.email || '').trim().toLowerCase();
      req.authUser = {
        uid: decoded.uid,
        email: emailLower,
        name: String(decoded.name || emailLower || 'Staff'),
        token
      };
      if (emailLower === MAIN_ADMIN_EMAIL.toLowerCase()) {
        next();
        return;
      }
      const adminDoc = await fetchFirestoreDocWithToken('admins', decoded.uid, token);
      if (adminDoc && adminDoc.status === 'approved' && permKeys.some((k) => adminDoc.permissions?.[k] === true)) {
        next();
        return;
      }
      res.status(403).json({ error: 'Insufficient staff permissions.' });
    } catch {
      res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
    }
  };
}

async function patchFirestoreWalletBalanceWithToken(uid: string, nextBalanceBdt: number, bearerToken: string): Promise<boolean> {
  if (!firebaseConfig?.projectId) return false;
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const safePath = `users/${encodeURIComponent(uid)}`;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/${encodeURIComponent(dbId)}/documents/${safePath}?updateMask.fieldPaths=walletBalanceBdt&updateMask.fieldPaths=updatedAt`;
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          walletBalanceBdt: { doubleValue: Math.max(0, Math.round(nextBalanceBdt * 100) / 100) },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      }),
      signal: AbortSignal.timeout(7000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

const app = express();
const ALLOWED_WEB_ORIGINS = new Set([
  'https://nexorabd.web.app',
  'https://nexora-3092c.web.app',
  'https://nexora-3092c.firebaseapp.com'
]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && ALLOWED_WEB_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  }
  next();
});
app.use(express.json({ limit: '4mb' }));

// Public Firebase client config for standalone 3-file apps
app.get('/api/firebase-config', (_req, res) => {
  const cfg = loadFirebaseConfig();
  if (!cfg) {
    res.status(404).json({ error: 'Firebase configuration not found.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
    firestoreDatabaseId: cfg.firestoreDatabaseId
  });
});

// Main Admin Auto Payment Gateway Config (Secrets stay on server only)
app.get('/api/payments/auto-config', requireMainAdmin, (_req, res) => {
  const cfg = loadGatewayConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    provider: cfg.provider,
    displayName: cfg.displayName,
    checkoutUrl: cfg.checkoutUrl,
    verifyUrl: cfg.verifyUrl,
    sandboxMode: cfg.sandboxMode,
    hasApiKey: Boolean(cfg.apiKey),
    hasSecretKey: Boolean(cfg.secretKey),
    apiKeyMasked: maskSecret(cfg.apiKey),
    secretKeyMasked: maskSecret(cfg.secretKey),
    updatedAt: cfg.updatedAt,
    updatedBy: cfg.updatedBy
  });
});

app.post('/api/payments/auto-config', requireMainAdmin, (req: AuthedRequest, res: Response) => {
  const current = loadGatewayConfig();
  const body = req.body || {};
  const allowedProviders = new Set(['sandbox', 'uddoktapay', 'sslcommerz', 'shurjopay', 'custom']);
  const provider = allowedProviders.has(String(body.provider || '').trim())
    ? String(body.provider).trim()
    : current.provider;
  const displayName = String(body.displayName ?? current.displayName).trim().slice(0, 60) || 'Auto Payment Gateway';
  const checkoutUrl = String(body.checkoutUrl ?? current.checkoutUrl).trim().slice(0, 300);
  const verifyUrl = String(body.verifyUrl ?? current.verifyUrl).trim().slice(0, 300);
  const sandboxMode = typeof body.sandboxMode === 'boolean' ? body.sandboxMode : current.sandboxMode;

  if (checkoutUrl && !isSafeExternalHttpUrl(checkoutUrl)) {
    res.status(400).json({ error: 'Checkout URL must be a valid public http(s) endpoint.' });
    return;
  }
  if (verifyUrl && !isSafeExternalHttpUrl(verifyUrl)) {
    res.status(400).json({ error: 'Verify URL must be a valid public http(s) endpoint.' });
    return;
  }

  const clearSecrets = body.clearSecrets === true;
  const incomingApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const incomingSecretKey = typeof body.secretKey === 'string' ? body.secretKey.trim() : '';
  const nextConfig: AutoGatewayConfig = {
    provider,
    displayName,
    checkoutUrl,
    verifyUrl,
    apiKey: clearSecrets ? '' : (incomingApiKey || current.apiKey),
    secretKey: clearSecrets ? '' : (incomingSecretKey || current.secretKey),
    sandboxMode,
    updatedAt: new Date().toISOString(),
    updatedBy: req.authUser?.email || MAIN_ADMIN_EMAIL
  };

  writeJsonRuntime('payment-gateway.json', nextConfig);
  res.json({
    ok: true,
    provider: nextConfig.provider,
    displayName: nextConfig.displayName,
    checkoutUrl: nextConfig.checkoutUrl,
    verifyUrl: nextConfig.verifyUrl,
    sandboxMode: nextConfig.sandboxMode,
    hasApiKey: Boolean(nextConfig.apiKey),
    hasSecretKey: Boolean(nextConfig.secretKey),
    apiKeyMasked: maskSecret(nextConfig.apiKey),
    secretKeyMasked: maskSecret(nextConfig.secretKey),
    updatedAt: nextConfig.updatedAt,
    updatedBy: nextConfig.updatedBy
  });
});

// Auto Payment Gateway: Initiate Checkout Session (Cart / E-Market / Wallet Add Money)
app.post('/api/payments/auto/initiate', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const body = req.body || {};
  const amountBdt = Math.round((Number(body.amountBdt) || 0) * 100) / 100;
  const purpose = String(body.purpose || 'order');
  const referenceId = String(body.referenceId || '').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80);
  const customerName = String(body.customerName || authUser.name || 'Shopper').trim().slice(0, 80);
  const customerPhone = String(body.customerPhone || '').trim().slice(0, 25);

  if (!Number.isFinite(amountBdt) || amountBdt < 1 || amountBdt > 500000) {
    res.status(400).json({ error: 'Amount must be between ৳1 and ৳500,000.' });
    return;
  }
  if (purpose !== 'order' && purpose !== 'emarket' && purpose !== 'wallet_topup') {
    res.status(400).json({ error: 'Invalid payment purpose.' });
    return;
  }

  const cfg = loadGatewayConfig();
  const sessionId = `AP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const isLive = !cfg.sandboxMode && Boolean(cfg.apiKey) && isSafeExternalHttpUrl(cfg.checkoutUrl);

  let mode: 'live' | 'sandbox' = isLive ? 'live' : 'sandbox';
  let paymentUrl = '';
  let gatewayInvoiceId = sessionId;

  if (mode === 'live') {
    try {
      const originUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let payload: Record<string, unknown>;

      if (cfg.provider === 'uddoktapay') {
        headers['RT-UDDOKTAPAY-API-KEY'] = cfg.apiKey;
        payload = {
          full_name: customerName,
          email: authUser.email,
          amount: String(amountBdt),
          metadata: { uid: authUser.uid, purpose, reference_id: referenceId || sessionId },
          redirect_url: `${originUrl}/?autopay=success&session=${encodeURIComponent(sessionId)}`,
          cancel_url: `${originUrl}/?autopay=cancel&session=${encodeURIComponent(sessionId)}`
        };
      } else {
        headers['Authorization'] = `Bearer ${cfg.apiKey}`;
        headers['X-API-KEY'] = cfg.apiKey;
        if (cfg.secretKey) headers['X-SECRET-KEY'] = cfg.secretKey;
        payload = {
          session_id: sessionId,
          amount: amountBdt,
          currency: 'BDT',
          customer_name: customerName,
          customer_email: authUser.email,
          customer_phone: customerPhone,
          purpose,
          reference_id: referenceId || sessionId,
          redirect_url: `${originUrl}/?autopay=success&session=${encodeURIComponent(sessionId)}`
        };
      }

      const gwRes = await fetch(cfg.checkoutUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        redirect: 'manual',
        signal: AbortSignal.timeout(12000)
      });
      const gwData = (await gwRes.json().catch(() => ({}))) as Record<string, unknown>;
      const resolvedUrl = String(gwData.payment_url || gwData.checkout_url || gwData.GatewayPageURL || gwData.url || '').trim();
      if (!gwRes.ok || !resolvedUrl || !isSafeExternalHttpUrl(resolvedUrl)) {
        res.status(502).json({
          error: String(gwData.message || gwData.error || 'Configured live payment gateway rejected checkout initiation.')
        });
        return;
      }
      paymentUrl = resolvedUrl;
      gatewayInvoiceId = String(gwData.invoice_id || gwData.sessionkey || gwData.trx_id || sessionId).slice(0, 100);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? `Live payment gateway error: ${err.message}` : 'Live payment gateway request failed.'
      });
      return;
    }
  }

  const createdAt = Date.now();
  const expiresAt = createdAt + 15 * 60 * 1000;
  const hmacSig = signAutoPayload(`${sessionId}:${authUser.uid}:${amountBdt}:${purpose}:${createdAt}`);
  const sessions = readJsonRuntime<Record<string, AutoSessionRecord>>('auto-sessions.json', {});
  // Prune expired sessions older than 2 hours
  for (const key of Object.keys(sessions)) {
    if (sessions[key].expiresAt + 2 * 60 * 60 * 1000 < createdAt) {
      delete sessions[key];
    }
  }
  sessions[sessionId] = {
    sessionId,
    uid: authUser.uid,
    email: authUser.email,
    amountBdt,
    purpose,
    referenceId,
    mode,
    provider: cfg.provider,
    gatewayInvoiceId,
    paymentUrl,
    hmacSig,
    createdAt,
    expiresAt,
    used: false
  };
  writeJsonRuntime('auto-sessions.json', sessions);

  res.json({
    ok: true,
    mode,
    provider: cfg.provider,
    displayName: cfg.displayName,
    sessionId,
    hmacSig,
    amountBdt,
    purpose,
    paymentUrl,
    gatewayInvoiceId,
    expiresAt
  });
});

// Auto Payment Gateway: Verify Payment & Credit Server Auto Wallet (if wallet_topup)
app.post('/api/payments/auto/verify', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const body = req.body || {};
  const sessionId = String(body.sessionId || '').trim();
  const hmacSig = String(body.hmacSig || '').trim();
  const sandboxCode = String(body.sandboxCode || '123456').trim();
  const channel = String(body.channel || 'bkash_auto').trim().slice(0, 30);

  if (!sessionId || !hmacSig) {
    res.status(400).json({ error: 'Missing payment session credentials.' });
    return;
  }

  const sessions = readJsonRuntime<Record<string, AutoSessionRecord>>('auto-sessions.json', {});
  const session = sessions[sessionId];
  if (!session || session.uid !== authUser.uid) {
    res.status(404).json({ error: 'Payment session not found.' });
    return;
  }
  if (session.used) {
    res.status(409).json({ error: 'Payment session already verified.' });
    return;
  }
  if (session.expiresAt < Date.now()) {
    res.status(410).json({ error: 'Payment session expired. Please initiate again.' });
    return;
  }

  const expectedSig = signAutoPayload(
    `${session.sessionId}:${session.uid}:${session.amountBdt}:${session.purpose}:${session.createdAt}`
  );
  if (!timingSafeHexEqual(hmacSig, expectedSig) || !timingSafeHexEqual(session.hmacSig, expectedSig)) {
    res.status(403).json({ error: 'Invalid payment session signature.' });
    return;
  }

  let verifiedTrxId = '';
  if (session.mode === 'live') {
    const cfg = loadGatewayConfig();
    if (!isSafeExternalHttpUrl(cfg.verifyUrl)) {
      res.status(502).json({ error: 'Gateway verification endpoint is not configured securely.' });
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.provider === 'uddoktapay') {
        headers['RT-UDDOKTAPAY-API-KEY'] = cfg.apiKey;
      } else {
        headers['Authorization'] = `Bearer ${cfg.apiKey}`;
        headers['X-API-KEY'] = cfg.apiKey;
        if (cfg.secretKey) headers['X-SECRET-KEY'] = cfg.secretKey;
      }
      const verifyRes = await fetch(cfg.verifyUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          invoice_id: body.invoiceId || session.gatewayInvoiceId,
          session_id: session.sessionId
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(12000)
      });
      const verifyData = (await verifyRes.json().catch(() => ({}))) as Record<string, unknown>;
      const statusText = String(verifyData.status || verifyData.payment_status || '').toUpperCase();
      const paidFlag = verifyData.verified === true || ['COMPLETED', 'VALID', 'VALIDATED', 'PAID', 'SUCCESS'].includes(statusText);
      if (!verifyRes.ok || !paidFlag) {
        res.status(402).json({ error: 'Payment not completed or could not be verified by gateway yet.' });
        return;
      }
      verifiedTrxId = String(verifyData.transaction_id || verifyData.trx_id || verifyData.bank_tran_id || session.gatewayInvoiceId).slice(0, 60);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Gateway verification request failed.' });
      return;
    }
  } else {
    if (sandboxCode && sandboxCode !== '123456') {
      res.status(400).json({ error: 'Invalid Sandbox Gateway verification PIN (use 123456).' });
      return;
    }
    verifiedTrxId = `AUTO-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  }

  session.used = true;
  session.trxId = verifiedTrxId;
  writeJsonRuntime('auto-sessions.json', sessions);

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  let autoWalletBalanceBdt = Number(autoWallets[authUser.uid] || 0);
  if (session.purpose === 'wallet_topup') {
    autoWalletBalanceBdt = Math.round((autoWalletBalanceBdt + session.amountBdt) * 100) / 100;
    autoWallets[authUser.uid] = autoWalletBalanceBdt;
    writeJsonRuntime('auto-wallets.json', autoWallets);
  }

  res.json({
    ok: true,
    verified: true,
    mode: session.mode,
    provider: session.provider,
    channel,
    trxId: verifiedTrxId,
    amountBdt: session.amountBdt,
    purpose: session.purpose,
    autoWalletBalanceBdt
  });
});

// Server-Verified Auto Wallet Balance & Atomic Spend / Rollback
app.get('/api/wallet/balance', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const pins = readJsonRuntime<Record<string, { salt: string; hash: string }>>('wallet-pins.json', {});
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    autoWalletBalanceBdt: Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100,
    hasPin: Boolean(pins[authUser.uid]?.hash)
  });
});

app.post('/api/wallet/spend', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const body = req.body || {};
  const amountBdt = Math.round((Number(body.amountBdt) || 0) * 100) / 100;
  if (!Number.isFinite(amountBdt) || amountBdt <= 0) {
    res.status(400).json({ error: 'Spend amount must be positive.' });
    return;
  }

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const current = Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100;
  if (current < amountBdt) {
    res.status(400).json({ error: 'Insufficient Auto Wallet balance.', availableBdt: current });
    return;
  }

  const nextBalance = Math.round((current - amountBdt) * 100) / 100;
  autoWallets[authUser.uid] = nextBalance;
  writeJsonRuntime('auto-wallets.json', autoWallets);

  const spendId = `WSP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const rollbackToken = signAutoPayload(`${spendId}:${authUser.uid}:${amountBdt}`);
  const receipts = readJsonRuntime<Record<string, WalletSpendReceipt>>('wallet-spends.json', {});
  const now = Date.now();
  for (const key of Object.keys(receipts)) {
    if (receipts[key].createdAt + 60 * 60 * 1000 < now) {
      delete receipts[key];
    }
  }
  receipts[spendId] = {
    spendId,
    uid: authUser.uid,
    amountBdt,
    rollbackToken,
    rolledBack: false,
    createdAt: now
  };
  writeJsonRuntime('wallet-spends.json', receipts);

  res.json({
    ok: true,
    spendId,
    rollbackToken,
    deductedBdt: amountBdt,
    autoWalletBalanceBdt: nextBalance,
    trxId: spendId
  });
});

app.post('/api/wallet/rollback', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const { spendId, rollbackToken } = req.body || {};
  if (!spendId || !rollbackToken) {
    res.status(400).json({ error: 'Missing spend receipt credentials.' });
    return;
  }
  const receipts = readJsonRuntime<Record<string, WalletSpendReceipt>>('wallet-spends.json', {});
  const rec = receipts[String(spendId)];
  if (!rec || rec.uid !== authUser.uid || rec.rolledBack) {
    res.status(404).json({ error: 'Spend receipt not eligible for rollback.' });
    return;
  }
  if (!timingSafeHexEqual(String(rollbackToken), rec.rollbackToken)) {
    res.status(403).json({ error: 'Invalid rollback token.' });
    return;
  }
  rec.rolledBack = true;
  writeJsonRuntime('wallet-spends.json', receipts);

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const restored = Math.round((Number(autoWallets[authUser.uid] || 0) + rec.amountBdt) * 100) / 100;
  autoWallets[authUser.uid] = restored;
  writeJsonRuntime('auto-wallets.json', autoWallets);

  res.json({ ok: true, autoWalletBalanceBdt: restored });
});

// ==================== FREE FIRE UID LOOKUP ENGINE ====================

interface FfLookupConfig {
  apiUrl: string;
  apiKey: string;
  defaultRegion: string;
  updatedAt: string;
  updatedBy: string;
}

const FF_ALLOWED_REGIONS = new Set(['BD', 'SG', 'IND', 'VN', 'ID', 'MENA', 'BR', 'TH', 'TW', 'EUROPE']);
const ffLookupCache = new Map<string, { ts: number; data: Record<string, unknown> }>();

function loadFfConfig(): FfLookupConfig {
  const defaults: FfLookupConfig = {
    apiUrl: process.env.FF_LOOKUP_API_URL || '',
    apiKey: process.env.FF_LOOKUP_API_KEY || '',
    defaultRegion: (process.env.FF_LOOKUP_DEFAULT_REGION || 'BD').toUpperCase(),
    updatedAt: '',
    updatedBy: ''
  };
  const saved = readJsonRuntime<Partial<FfLookupConfig>>('games-config.json', {});
  return { ...defaults, ...saved };
}

function extractFfNickname(raw: any, requestedUid = ''): { nickname: string; level: number | null; clan: string; region: string } {
  if (!raw || typeof raw !== 'object') return { nickname: '', level: null, clan: '', region: '' };
  if (raw.error === true || raw.success === false || (typeof raw.status === 'number' && raw.status >= 400)) {
    return { nickname: '', level: null, clan: '', region: '' };
  }
  const b = raw.basicInfo || raw.player || raw.result || raw.data?.basicInfo || raw.data || raw;
  const rawNick = String(
    b?.nickname || b?.AccountName || b?.playerName || b?.player_name || b?.username || b?.name || b?.ign || raw.nickname || ''
  ).trim().slice(0, 60);
  const nickname = requestedUid && rawNick === String(requestedUid).trim() ? '' : rawNick;
  const lvlRaw = Number(b?.level ?? b?.AccountLevel ?? raw?.level ?? 0);
  const level = Number.isFinite(lvlRaw) && lvlRaw > 0 ? lvlRaw : null;
  const clan = String(raw?.clanBasicInfo?.clanName || b?.clanName || b?.guild || '').trim().slice(0, 50);
  const regRaw = String(b?.region || raw?.region || raw?.server || raw?.country || '').trim().toUpperCase();
  const region = FF_ALLOWED_REGIONS.has(regRaw) ? regRaw : '';
  return { nickname, level, clan, region };
}

async function fetchFfCandidate(url: string, headers: Record<string, string>, fallbackRegion: string, source: string, requestedUid = '') {
  if (!isSafeExternalHttpUrl(url)) return null;
  try {
    const upstream = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(4500)
    });
    if (!upstream.ok) return null;
    const json = await upstream.json().catch(() => null);
    const parsed = extractFfNickname(json, requestedUid);
    if (!parsed.nickname) return null;
    return {
      ok: true,
      verified: true,
      source,
      region: parsed.region || fallbackRegion,
      nickname: parsed.nickname,
      level: parsed.level,
      clan: parsed.clan
    };
  } catch {
    return null;
  }
}

async function resolveFreeFireUid(uid: string, rawRegionInput: string) {
  const cfg = loadFfConfig();
  const upperInput = String(rawRegionInput || '').trim().toUpperCase();
  const isAuto = !upperInput || upperInput === 'AUTO';
  const regionKey = isAuto ? 'AUTO' : (FF_ALLOWED_REGIONS.has(upperInput) ? upperInput : (FF_ALLOWED_REGIONS.has(cfg.defaultRegion) ? cfg.defaultRegion : 'BD'));
  const cacheKey = `${regionKey}:${uid}`;
  const cached = ffLookupCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.data;
  }

  const probeRegions = isAuto
    ? Array.from(new Set([cfg.defaultRegion || 'BD', 'BD', 'ID', 'SG', 'IND', 'VN', 'TH', 'MENA']))
    : [regionKey];

  let found: { ok: boolean; verified: boolean; source: string; region: string; nickname: string; level: number | null; clan: string } | null = null;

  const cleanCfgUrl = String(cfg.apiUrl || '').replace(/\s+/g, '');
  if (cleanCfgUrl && isSafeExternalHttpUrl(cleanCfgUrl)) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (cfg.apiKey) {
      let isRapid = false;
      try {
        const host = new URL(cleanCfgUrl).hostname.toLowerCase();
        if (host.endsWith('.rapidapi.com')) {
          isRapid = true;
          headers['X-RapidAPI-Key'] = cfg.apiKey;
          headers['X-RapidAPI-Host'] = host;
        }
      } catch {}
      if (!isRapid) {
        headers['x-api-key'] = cfg.apiKey;
        headers['Authorization'] = `Bearer ${cfg.apiKey}`;
      }
    }
    if (!cleanCfgUrl.includes('{region}') && isAuto) {
      const resolved = cleanCfgUrl.includes('{uid}')
        ? cleanCfgUrl.replace(/\{uid\}/g, encodeURIComponent(uid))
        : `${cleanCfgUrl}${cleanCfgUrl.includes('?') ? '&' : '?'}uid=${encodeURIComponent(uid)}`;
      found = await fetchFfCandidate(resolved, headers, '', 'configured_api', uid);
    } else {
      for (let i = 0; i < probeRegions.length && !found; i += 4) {
        const batch = probeRegions.slice(i, i + 4);
        const results = await Promise.all(batch.map((reg) => {
          const resolved = cleanCfgUrl.includes('{uid}')
            ? cleanCfgUrl.replace(/\{uid\}/g, encodeURIComponent(uid)).replace(/\{region\}/g, encodeURIComponent(reg))
            : `${cleanCfgUrl}${cleanCfgUrl.includes('?') ? '&' : '?'}uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(reg)}`;
          return fetchFfCandidate(resolved, headers, reg, 'configured_api', uid);
        }));
        found = results.find(Boolean) || null;
      }
    }
  }

  if (!found) {
    const pubHeaders = { Accept: 'application/json' };
    const directCandidates = [
      fetchFfCandidate(`https://api.isan.eu.org/nickname/ff?id=${encodeURIComponent(uid)}`, pubHeaders, '', 'public_isan_api', uid),
      ...probeRegions.slice(0, 4).map((reg) =>
        fetchFfCandidate(`https://freefire-api-six.vercel.app/get_player_personal_show?server=${encodeURIComponent(reg)}&uid=${encodeURIComponent(uid)}`, pubHeaders, reg, 'public_ff_api', uid)
      )
    ];
    const settled = await Promise.all(directCandidates);
    found = settled.find(Boolean) || null;
  }

  if (found) {
    const result = {
      ok: true,
      verified: true,
      source: found.source,
      uid,
      region: found.region,
      nickname: found.nickname,
      level: found.level,
      clan: found.clan
    };
    if (ffLookupCache.size > 400) ffLookupCache.clear();
    ffLookupCache.set(cacheKey, { ts: Date.now(), data: result });
    return result;
  }

  return {
    ok: true,
    verified: false,
    formatValid: true,
    source: 'unverified',
    uid,
    region: isAuto ? 'AUTO' : regionKey,
    nickname: '',
    level: null,
    clan: '',
    message: 'প্লেয়ারের নিকনেম পাওয়া যায়নি — UID Unverified।'
  };
}

app.get('/api/games/ff-config', requireMainAdmin, (_req, res) => {
  const cfg = loadFfConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    apiUrl: cfg.apiUrl,
    defaultRegion: cfg.defaultRegion,
    hasApiKey: Boolean(cfg.apiKey),
    apiKeyMasked: maskSecret(cfg.apiKey),
    updatedAt: cfg.updatedAt,
    updatedBy: cfg.updatedBy
  });
});

app.post('/api/games/ff-config', requireMainAdmin, (req: AuthedRequest, res: Response) => {
  const current = loadFfConfig();
  const body = req.body || {};
  const apiUrl = String(body.apiUrl ?? current.apiUrl).replace(/\s+/g, '').slice(0, 350);
  if (apiUrl && !isSafeExternalHttpUrl(apiUrl)) {
    res.status(400).json({ error: 'Free Fire lookup API URL must be a valid public http(s) URL.' });
    return;
  }
  const rawReg = String(body.defaultRegion ?? current.defaultRegion).trim().toUpperCase();
  const defaultRegion = FF_ALLOWED_REGIONS.has(rawReg) ? rawReg : 'BD';
  const clearSecrets = body.clearSecrets === true;
  const incomingKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const next: FfLookupConfig = {
    apiUrl,
    apiKey: clearSecrets ? '' : (incomingKey || current.apiKey),
    defaultRegion,
    updatedAt: new Date().toISOString(),
    updatedBy: req.authUser?.email || MAIN_ADMIN_EMAIL
  };
  writeJsonRuntime('games-config.json', next);
  ffLookupCache.clear();
  res.json({
    ok: true,
    apiUrl: next.apiUrl,
    defaultRegion: next.defaultRegion,
    hasApiKey: Boolean(next.apiKey),
    apiKeyMasked: maskSecret(next.apiKey),
    updatedAt: next.updatedAt
  });
});

app.get('/api/games/ff-lookup', async (req, res) => {
  const uid = String(req.query.uid || '').trim();
  const rawRegion = String(req.query.region || 'AUTO').trim().toUpperCase();
  if (!/^\d{5,15}$/.test(uid)) {
    res.status(400).json({ error: 'সঠিক ৫ থেকে ১৫ সংখ্যার সংখ্যাগত Free Fire UID দিন।' });
    return;
  }
  const data = await resolveFreeFireUid(uid, rawRegion);
  res.json(data);
});

async function resolveOtherGameUid(game: 'pubg' | 'mlbb' | 'valorant', rawUid: string, rawRegion: string) {
  const cfg = loadFfConfig();
  const cleanCfgUrl = String(cfg.apiUrl || '').replace(/\s+/g, '');
  let origin = '';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cleanCfgUrl && isSafeExternalHttpUrl(cleanCfgUrl)) {
    try {
      const parsedUrl = new URL(cleanCfgUrl);
      const host = parsedUrl.hostname.toLowerCase();
      if (host.endsWith('.rapidapi.com') && cfg.apiKey) {
        origin = parsedUrl.origin;
        headers['X-RapidAPI-Key'] = cfg.apiKey;
        headers['X-RapidAPI-Host'] = host;
      }
    } catch {}
  }

  let baseUid = rawUid.trim();
  let zone = rawRegion.trim();
  if (game === 'mlbb') {
    const inlineMatch = baseUid.match(/^(\d{6,12})\s*[\(\-\/]\s*(\d{4,6})\)?$/);
    if (inlineMatch) {
      baseUid = inlineMatch[1];
      zone = inlineMatch[2];
    }
  }

  const cacheKey = `${game}:${baseUid}:${zone}`;
  const cached = ffLookupCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.data;
  }

  let verified = false;
  let nickname = '';
  let source = 'format_check';
  let statusNote = '';

  if (origin && headers['X-RapidAPI-Key']) {
    let endpoint = '';
    if (game === 'pubg') {
      endpoint = `${origin}/pubgm-global/${encodeURIComponent(baseUid)}`;
    } else if (game === 'mlbb' && /^\d{4,6}$/.test(zone)) {
      endpoint = `${origin}/mobile-legends/${encodeURIComponent(baseUid)}/${encodeURIComponent(zone)}`;
    } else if (game === 'valorant') {
      const parts = baseUid.split('#');
      if (parts.length === 2 && /^\d+$/.test(parts[1])) {
        endpoint = `${origin}/valorant/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
      } else {
        statusNote = 'সংখ্যাসূচক #Tag হলে লাইভ নাম যাচাই হয় (যেমন Name#1234)।';
      }
    }

    if (endpoint && isSafeExternalHttpUrl(endpoint)) {
      try {
        const up = await fetch(endpoint, { headers, redirect: 'manual', signal: AbortSignal.timeout(4800) });
        const json = await up.json().catch(() => null);
        if (up.ok) {
          const parsed = extractFfNickname(json, baseUid);
          if (parsed.nickname) {
            verified = true;
            nickname = parsed.nickname;
            source = 'configured_api';
          }
        } else if (json?.msg === 'upstream_verification_required') {
          statusNote = 'সার্ভার রেট-লিমিটের কারণে তাৎক্ষণিক নাম আসেনি — ID ফরম্যাট সঠিক।';
        }
      } catch {}
    }
  }

  const regionLabel = game === 'mlbb'
    ? (/^\d{4,6}$/.test(zone) ? zone : 'Default')
    : (game === 'pubg' ? 'Global' : 'AP/SG');

  const result = {
    ok: true,
    verified,
    formatValid: true,
    game,
    source: verified ? source : (statusNote ? 'unverified' : 'format_check'),
    uid: baseUid,
    region: regionLabel,
    nickname,
    message: verified
      ? `ভেরিফায়েড প্লেয়ার: ${nickname}`
      : (statusNote || (game === 'mlbb' && !/^\d{4,6}$/.test(zone)
        ? 'লাইভ নাম যাচাই করতে Server/Zone ID (যেমন 15748) লিখুন।'
        : 'প্লেয়ার আইডি ফরম্যাট সঠিক — নিশ্চিত হয়ে অর্ডার করুন।'))
  };

  if (verified) {
    if (ffLookupCache.size > 400) ffLookupCache.clear();
    ffLookupCache.set(cacheKey, { ts: Date.now(), data: result });
  }
  return result;
}

app.get('/api/games/uid-lookup', async (req, res) => {
  const game = String(req.query.game || 'free_fire').trim().toLowerCase();
  const uid = String(req.query.uid || '').trim();
  const region = String(req.query.region || 'AUTO').trim().slice(0, 20);

  if (game === 'free_fire' || game === 'freefire' || game === 'ff') {
    if (!/^\d{5,15}$/.test(uid)) {
      res.status(400).json({ error: 'সঠিক ৫ থেকে ১৫ সংখ্যার Free Fire UID দিন।' });
      return;
    }
    const data = await resolveFreeFireUid(uid, region);
    res.json({ ...data, game: 'free_fire' });
    return;
  }

  if (game === 'pubg' || game === 'pubgm') {
    if (!/^\d{8,12}$/.test(uid)) {
      res.status(400).json({ error: 'সঠিক ৮ থেকে ১২ সংখ্যার PUBG Character ID দিন।' });
      return;
    }
    const data = await resolveOtherGameUid('pubg', uid, region);
    res.json(data);
    return;
  }

  if (game === 'mlbb') {
    const inlineMatch = uid.match(/^(\d{6,12})\s*[\(\-\/]\s*(\d{4,6})\)?$/);
    const cleanUid = inlineMatch ? inlineMatch[1] : uid;
    const cleanZone = inlineMatch ? inlineMatch[2] : (region !== 'BD' && region !== 'AUTO' ? region : '');
    if (!/^\d{6,12}$/.test(cleanUid)) {
      res.status(400).json({ error: 'সঠিক ৬ থেকে ১২ সংখ্যার MLBB User ID দিন।' });
      return;
    }
    if (cleanZone && !/^\d{4,6}$/.test(cleanZone)) {
      res.status(400).json({ error: 'সঠিক ৪–৬ সংখ্যার MLBB Zone/Server ID দিন (যেমন: 15748)।' });
      return;
    }
    const data = await resolveOtherGameUid('mlbb', cleanUid, cleanZone);
    res.json(data);
    return;
  }

  if (game === 'valorant' || game === 'val') {
    if (!/^.{2,16}#[A-Za-z0-9]{2,5}$/.test(uid)) {
      res.status(400).json({ error: 'সঠিক Riot ID#Tag দিন (যেমন: Player#1234 বা TenZ#NA1)।' });
      return;
    }
    const data = await resolveOtherGameUid('valorant', uid, region);
    res.json(data);
    return;
  }

  res.status(400).json({ error: 'Unsupported game identifier.' });
});

// ==================== E-MARKET AUTO PIN / VOUCHER VAULT ====================

interface EmPinRecord {
  id: string;
  itemId: string;
  packageLabel: string;
  code: string;
  addedBy: string;
  createdAt: string;
}

app.get('/api/emarket/pin-availability', (_req, res) => {
  const pins = readJsonRuntime<EmPinRecord[]>('em-pins.json', []);
  const counts: Record<string, number> = {};
  for (const p of pins) {
    const key = `${p.itemId}::${p.packageLabel}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, counts });
});

app.get('/api/emarket/pins', requireStaffPermission('canManageEMarket'), (_req, res) => {
  const pins = readJsonRuntime<EmPinRecord[]>('em-pins.json', []);
  const counts: Record<string, number> = {};
  for (const p of pins) {
    const key = `${p.itemId}::${p.packageLabel}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, total: pins.length, counts, pins: pins.slice(0, 300) });
});

app.post('/api/emarket/pins', requireStaffPermission('canManageEMarket'), (req: AuthedRequest, res: Response) => {
  const body = req.body || {};
  const itemId = String(body.itemId || '').trim().slice(0, 128);
  const packageLabel = String(body.packageLabel || '').trim().slice(0, 80);
  const rawCodes = Array.isArray(body.codes)
    ? body.codes
    : String(body.codes || '').split(/\r?\n|,/);
  const cleanCodes = rawCodes
    .map((c: unknown) => String(c || '').trim().slice(0, 240))
    .filter((c: string) => c.length >= 2)
    .slice(0, 200);

  if (!itemId || !packageLabel || !cleanCodes.length) {
    res.status(400).json({ error: 'Item ID, Package Label, and at least 1 valid PIN/voucher code required.' });
    return;
  }

  const pins = readJsonRuntime<EmPinRecord[]>('em-pins.json', []);
  const existingSet = new Set(pins.map((p) => `${p.itemId}::${p.packageLabel}::${p.code}`));
  let added = 0;
  for (const code of cleanCodes) {
    const dedup = `${itemId}::${packageLabel}::${code}`;
    if (existingSet.has(dedup)) continue;
    existingSet.add(dedup);
    pins.push({
      id: `PIN-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      itemId,
      packageLabel,
      code,
      addedBy: req.authUser?.email || MAIN_ADMIN_EMAIL,
      createdAt: new Date().toISOString()
    });
    added++;
  }
  writeJsonRuntime('em-pins.json', pins);
  res.json({ ok: true, added, total: pins.length });
});

app.delete('/api/emarket/pins/:pinId', requireStaffPermission('canManageEMarket'), (req, res) => {
  const pinId = String(req.params.pinId || '').trim();
  const pins = readJsonRuntime<EmPinRecord[]>('em-pins.json', []);
  const next = pins.filter((p) => p.id !== pinId);
  if (next.length === pins.length) {
    res.status(404).json({ error: 'PIN not found.' });
    return;
  }
  writeJsonRuntime('em-pins.json', next);
  res.json({ ok: true, total: next.length });
});

app.post('/api/emarket/claim-pin', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const orderId = String(req.body?.orderId || '').trim();
  if (!orderId || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid E-Market Order ID required.' });
    return;
  }
  const order = await fetchFirestoreDocWithToken('emarketOrders', orderId, authUser.token);
  if (!order || order.userId !== authUser.uid) {
    res.status(404).json({ error: 'E-Market order not found for your account.' });
    return;
  }
  if (order.paymentStatus !== 'paid') {
    res.status(402).json({ error: 'Only paid orders can claim instant PIN delivery.' });
    return;
  }
  if (order.deliveryCode) {
    res.json({ ok: true, claimed: true, deliveryCode: order.deliveryCode });
    return;
  }
  if (order.status !== 'pending') {
    res.json({ ok: true, claimed: false, reason: 'order_not_pending' });
    return;
  }

  const pins = readJsonRuntime<EmPinRecord[]>('em-pins.json', []);
  const idx = pins.findIndex((p) => p.itemId === order.itemId && p.packageLabel === order.packageLabel);
  if (idx === -1) {
    res.json({ ok: true, claimed: false, reason: 'no_stock' });
    return;
  }
  const [claimedPin] = pins.splice(idx, 1);
  writeJsonRuntime('em-pins.json', pins);
  res.json({ ok: true, claimed: true, deliveryCode: claimedPin.code });
});

// ==================== COURIER API VAULT & CONSIGNMENT BOOKING ====================

interface CourierConfig {
  provider: string;
  apiUrl: string;
  apiKey: string;
  secretKey: string;
  sandboxMode: boolean;
  updatedAt: string;
  updatedBy: string;
}

function loadCourierConfig(): CourierConfig {
  const defaults: CourierConfig = {
    provider: process.env.COURIER_PROVIDER || 'sandbox',
    apiUrl: process.env.COURIER_API_URL || '',
    apiKey: process.env.COURIER_API_KEY || '',
    secretKey: process.env.COURIER_SECRET_KEY || '',
    sandboxMode: !process.env.COURIER_API_KEY,
    updatedAt: '',
    updatedBy: ''
  };
  const saved = readJsonRuntime<Partial<CourierConfig>>('courier-config.json', {});
  return { ...defaults, ...saved };
}

app.get('/api/courier/config', requireMainAdmin, (_req, res) => {
  const cfg = loadCourierConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    provider: cfg.provider,
    apiUrl: cfg.apiUrl,
    sandboxMode: cfg.sandboxMode,
    hasApiKey: Boolean(cfg.apiKey),
    hasSecretKey: Boolean(cfg.secretKey),
    apiKeyMasked: maskSecret(cfg.apiKey),
    secretKeyMasked: maskSecret(cfg.secretKey),
    updatedAt: cfg.updatedAt,
    updatedBy: cfg.updatedBy
  });
});

app.post('/api/courier/config', requireMainAdmin, (req: AuthedRequest, res: Response) => {
  const current = loadCourierConfig();
  const body = req.body || {};
  const allowed = new Set(['sandbox', 'steadfast', 'pathao', 'redx', 'custom']);
  const provider = allowed.has(String(body.provider || '')) ? String(body.provider) : current.provider;
  const apiUrl = String(body.apiUrl ?? current.apiUrl).trim().slice(0, 300);
  if (apiUrl && !isSafeExternalHttpUrl(apiUrl)) {
    res.status(400).json({ error: 'Courier API URL must be a valid public http(s) URL.' });
    return;
  }
  const clearSecrets = body.clearSecrets === true;
  const next: CourierConfig = {
    provider,
    apiUrl,
    apiKey: clearSecrets ? '' : (typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey),
    secretKey: clearSecrets ? '' : (typeof body.secretKey === 'string' && body.secretKey.trim() ? body.secretKey.trim() : current.secretKey),
    sandboxMode: typeof body.sandboxMode === 'boolean' ? body.sandboxMode : current.sandboxMode,
    updatedAt: new Date().toISOString(),
    updatedBy: req.authUser?.email || MAIN_ADMIN_EMAIL
  };
  writeJsonRuntime('courier-config.json', next);
  res.json({
    ok: true,
    provider: next.provider,
    apiUrl: next.apiUrl,
    sandboxMode: next.sandboxMode,
    hasApiKey: Boolean(next.apiKey),
    hasSecretKey: Boolean(next.secretKey),
    apiKeyMasked: maskSecret(next.apiKey),
    secretKeyMasked: maskSecret(next.secretKey),
    updatedAt: next.updatedAt
  });
});

app.post('/api/courier/book', requireStaffPermission('canManageOrders'), async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const orderId = String(req.body?.orderId || '').trim();
  const overrideProvider = String(req.body?.provider || '').trim().slice(0, 40);
  if (!orderId || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid Order ID required.' });
    return;
  }
  const order = await fetchFirestoreDocWithToken('orders', orderId, authUser.token);
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  const cfg = loadCourierConfig();
  const provider = overrideProvider || cfg.provider || 'steadfast';
  const codAmount = order.paymentStatus === 'paid' ? 0 : Math.max(0, Number(order.totalBdt || 0));

  if (!cfg.sandboxMode && cfg.apiKey && isSafeExternalHttpUrl(cfg.apiUrl)) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Api-Key': cfg.apiKey,
        Authorization: `Bearer ${cfg.apiKey}`
      };
      if (cfg.secretKey) headers['Secret-Key'] = cfg.secretKey;
      const cRes = await fetch(cfg.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          invoice: order.orderNumber || orderId,
          recipient_name: order.customerName,
          recipient_phone: order.phone,
          recipient_address: order.address,
          cod_amount: codAmount,
          note: `Zone: ${order.deliveryZone}`
        }),
        redirect: 'manual',
        signal: AbortSignal.timeout(10000)
      });
      const cData = (await cRes.json().catch(() => ({}))) as Record<string, any>;
      const trackingCode = String(
        cData?.consignment?.tracking_code || cData?.tracking_code || cData?.consignment_id || cData?.data?.consignment_id || ''
      ).trim().slice(0, 80);
      if (cRes.ok && trackingCode) {
        res.json({ ok: true, mode: 'live', provider, trackingCode });
        return;
      }
      res.status(502).json({ error: String(cData?.message || 'Courier API rejected consignment booking.') });
      return;
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Courier API request failed.' });
      return;
    }
  }

  const prefix = provider.slice(0, 3).toUpperCase() || 'TRK';
  const refSuffix = String(order.orderNumber || orderId).replace(/[^A-Z0-9]/gi, '').slice(-5).toUpperCase();
  const trackingCode = `${prefix}-${refSuffix}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  res.json({ ok: true, mode: 'sandbox', provider, trackingCode });
});

// ==================== CASHBACK & REFERRAL REWARDS LEDGER ====================

interface RewardHistoryEntry {
  id: string;
  type: 'cashback' | 'referral' | 'redeem';
  amountBdt: number;
  note: string;
  createdAt: string;
}

interface UserRewardAccount {
  referralCode: string;
  balanceBdt: number;
  totalEarnedBdt: number;
  referredByUid: string;
  claimedOrderIds: string[];
  history: RewardHistoryEntry[];
}

interface RewardsLedger {
  users: Record<string, UserRewardAccount>;
  codeToUid: Record<string, string>;
  countByReferrer: Record<string, number>;
}

function ensureUserRewardAccount(ledger: RewardsLedger, uid: string): UserRewardAccount {
  if (ledger.users[uid]) return ledger.users[uid];
  const baseCode = `VD${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'DROP'}`;
  let code = baseCode;
  let counter = 1;
  while (ledger.codeToUid[code] && ledger.codeToUid[code] !== uid) {
    code = `${baseCode}${counter++}`;
  }
  ledger.codeToUid[code] = uid;
  ledger.users[uid] = {
    referralCode: code,
    balanceBdt: 0,
    totalEarnedBdt: 0,
    referredByUid: '',
    claimedOrderIds: [],
    history: []
  };
  return ledger.users[uid];
}

app.get('/api/rewards/summary', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  writeJsonRuntime('rewards-ledger.json', ledger);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    referralCode: acct.referralCode,
    rewardsBalanceBdt: Math.round(acct.balanceBdt * 100) / 100,
    totalEarnedBdt: Math.round(acct.totalEarnedBdt * 100) / 100,
    referralsCount: Number(ledger.countByReferrer[authUser.uid] || 0),
    referredByUid: acct.referredByUid,
    history: acct.history.slice(-25).reverse()
  });
});

app.post('/api/rewards/apply-referral', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'রেফারেল কোড লিখুন।' });
    return;
  }

  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const myAcct = ensureUserRewardAccount(ledger, authUser.uid);
  if (myAcct.referredByUid) {
    res.status(409).json({ error: 'আপনি ইতিমধ্যে একটি রেফারেল কোড ব্যবহার করেছেন।' });
    return;
  }
  const referrerUid = ledger.codeToUid[code];
  if (!referrerUid) {
    res.status(404).json({ error: 'সঠিক রেফারেল কোড পাওয়া যায়নি।' });
    return;
  }
  if (referrerUid === authUser.uid) {
    res.status(400).json({ error: 'নিজের রেফারেল কোড নিজে ব্যবহার করা যাবে না।' });
    return;
  }

  const storeCfg = await fetchFirestoreDocWithToken('storeConfig', 'global', authUser.token);
  const bonusBdt = Math.min(5000, Math.max(0, Number(storeCfg?.referralBonusBdt ?? 50)));
  if (bonusBdt <= 0) {
    res.status(400).json({ error: 'রেফারেল বোনাস বর্তমানে বন্ধ রয়েছে।' });
    return;
  }

  const refAcct = ensureUserRewardAccount(ledger, referrerUid);
  const nowIso = new Date().toISOString();
  myAcct.referredByUid = referrerUid;
  myAcct.balanceBdt = Math.round((myAcct.balanceBdt + bonusBdt) * 100) / 100;
  myAcct.totalEarnedBdt = Math.round((myAcct.totalEarnedBdt + bonusBdt) * 100) / 100;
  myAcct.history.push({ id: `RW-${Date.now().toString(36)}`, type: 'referral', amountBdt: bonusBdt, note: `Referral signup (${code})`, createdAt: nowIso });

  refAcct.balanceBdt = Math.round((refAcct.balanceBdt + bonusBdt) * 100) / 100;
  refAcct.totalEarnedBdt = Math.round((refAcct.totalEarnedBdt + bonusBdt) * 100) / 100;
  refAcct.history.push({ id: `RW-${Date.now().toString(36)}R`, type: 'referral', amountBdt: bonusBdt, note: `Friend joined (${authUser.name.slice(0, 24)})`, createdAt: nowIso });
  ledger.countByReferrer[referrerUid] = (ledger.countByReferrer[referrerUid] || 0) + 1;

  writeJsonRuntime('rewards-ledger.json', ledger);
  res.json({
    ok: true,
    bonusBdt,
    rewardsBalanceBdt: myAcct.balanceBdt,
    totalEarnedBdt: myAcct.totalEarnedBdt
  });
});

app.post('/api/rewards/claim-cashback', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const collectionName = req.body?.collectionName === 'emarketOrders' ? 'emarketOrders' : 'orders';
  const orderId = String(req.body?.orderId || '').trim();
  if (!orderId || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid Order ID required.' });
    return;
  }

  const claimKey = `${collectionName}:${orderId}`;
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  if (acct.claimedOrderIds.includes(claimKey)) {
    res.json({ ok: true, awardedBdt: 0, alreadyClaimed: true, rewardsBalanceBdt: acct.balanceBdt });
    return;
  }

  const [storeCfg, order] = await Promise.all([
    fetchFirestoreDocWithToken('storeConfig', 'global', authUser.token),
    fetchFirestoreDocWithToken(collectionName, orderId, authUser.token)
  ]);
  if (!order || order.userId !== authUser.uid) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (order.paymentStatus !== 'paid' || order.status === 'cancelled') {
    res.json({ ok: true, awardedBdt: 0, rewardsBalanceBdt: acct.balanceBdt });
    return;
  }

  const cashbackPct = Math.min(25, Math.max(0, Number(storeCfg?.cashbackPercent ?? 2)));
  if (cashbackPct <= 0) {
    res.json({ ok: true, awardedBdt: 0, rewardsBalanceBdt: acct.balanceBdt });
    return;
  }
  const baseAmt = Math.max(0, Number(order.subtotalBdt || order.priceBdt || order.totalBdt || 0));
  const awardedBdt = Math.round((baseAmt * cashbackPct) / 100);
  if (awardedBdt <= 0) {
    res.json({ ok: true, awardedBdt: 0, rewardsBalanceBdt: acct.balanceBdt });
    return;
  }

  acct.claimedOrderIds.push(claimKey);
  acct.balanceBdt = Math.round((acct.balanceBdt + awardedBdt) * 100) / 100;
  acct.totalEarnedBdt = Math.round((acct.totalEarnedBdt + awardedBdt) * 100) / 100;
  acct.history.push({
    id: `CB-${Date.now().toString(36)}`,
    type: 'cashback',
    amountBdt: awardedBdt,
    note: `${cashbackPct}% cashback (#${order.orderNumber || orderId.slice(0, 8)})`,
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('rewards-ledger.json', ledger);
  res.json({ ok: true, awardedBdt, rewardsBalanceBdt: acct.balanceBdt, totalEarnedBdt: acct.totalEarnedBdt });
});

app.post('/api/rewards/spend', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const amountBdt = Math.round((Number(req.body?.amountBdt) || 0) * 100) / 100;
  if (!Number.isFinite(amountBdt) || amountBdt <= 0) {
    res.status(400).json({ error: 'Reward redeem amount must be positive.' });
    return;
  }
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  if (acct.balanceBdt < amountBdt) {
    res.status(400).json({ error: 'Insufficient rewards balance.', rewardsBalanceBdt: acct.balanceBdt });
    return;
  }
  acct.balanceBdt = Math.round((acct.balanceBdt - amountBdt) * 100) / 100;
  const spendId = `RSP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const rollbackToken = signAutoPayload(`RWD:${spendId}:${authUser.uid}:${amountBdt}`);
  acct.history.push({
    id: spendId,
    type: 'redeem',
    amountBdt: -amountBdt,
    note: 'Redeemed on checkout',
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('rewards-ledger.json', ledger);
  res.json({ ok: true, spendId, rollbackToken, deductedBdt: amountBdt, rewardsBalanceBdt: acct.balanceBdt });
});

app.post('/api/rewards/rollback', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const { spendId, rollbackToken, amountBdt } = req.body || {};
  const amt = Math.round((Number(amountBdt) || 0) * 100) / 100;
  if (!spendId || !rollbackToken || amt <= 0) {
    res.status(400).json({ error: 'Missing reward rollback details.' });
    return;
  }
  const expected = signAutoPayload(`RWD:${String(spendId)}:${authUser.uid}:${amt}`);
  if (!timingSafeHexEqual(String(rollbackToken), expected)) {
    res.status(403).json({ error: 'Invalid reward rollback token.' });
    return;
  }
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  acct.balanceBdt = Math.round((acct.balanceBdt + amt) * 100) / 100;
  writeJsonRuntime('rewards-ledger.json', ledger);
  res.json({ ok: true, rewardsBalanceBdt: acct.balanceBdt });
});

// ==================== CUSTOMER DIRECTORY, UNIQUE ID & ADMIN WALLET ADJUST ====================

interface CustomerDirectoryEntry {
  uid: string;
  customerId: string;
  email: string;
  displayName: string;
  updatedAt: string;
}

interface CustomerDirectoryStore {
  byUid: Record<string, CustomerDirectoryEntry>;
  byCustomerId: Record<string, string>;
  byEmail: Record<string, string>;
}

function generateDeterministicCustomerId(uid: string, existingMap: Record<string, string>): string {
  const hash = crypto.createHash('sha256').update(uid).digest('hex');
  let num = (parseInt(hash.slice(0, 8), 16) % 900000) + 100000;
  let candidate = `NX-${num}`;
  let step = 0;
  while (existingMap[candidate] && existingMap[candidate] !== uid && step < 500) {
    num = ((num - 100000 + 7919) % 900000) + 100000;
    candidate = `NX-${num}`;
    step++;
  }
  return candidate;
}

function upsertCustomerDir(uid: string, email: string, displayName: string, preferredCustomerId = ''): CustomerDirectoryEntry {
  const dir = readJsonRuntime<CustomerDirectoryStore>('customer-directory.json', { byUid: {}, byCustomerId: {}, byEmail: {} });
  const existing = dir.byUid[uid];
  const emailLower = (email || existing?.email || '').trim().toLowerCase();
  const cleanPref = String(preferredCustomerId || '').trim().toUpperCase();
  const customerId = existing?.customerId
    || (/^NX-\d{6}$/.test(cleanPref) && (!dir.byCustomerId[cleanPref] || dir.byCustomerId[cleanPref] === uid) ? cleanPref : '')
    || generateDeterministicCustomerId(uid, dir.byCustomerId);

  const entry: CustomerDirectoryEntry = {
    uid,
    customerId,
    email: emailLower,
    displayName: (displayName || existing?.displayName || 'Shopper').slice(0, 100),
    updatedAt: new Date().toISOString()
  };
  dir.byUid[uid] = entry;
  dir.byCustomerId[customerId] = uid;
  if (emailLower) dir.byEmail[emailLower] = uid;
  writeJsonRuntime('customer-directory.json', dir);
  return entry;
}

app.post('/api/users/register-id', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const preferred = String(req.body?.customerId || '').trim();
  const displayName = String(req.body?.displayName || authUser.name || 'Shopper').trim();
  const entry = upsertCustomerDir(authUser.uid, authUser.email, displayName, preferred);
  res.json({ ok: true, customerId: entry.customerId, entry });
});

app.post('/api/admin/users/sync-ids', requireAnyStaffPerm(['canManageUsers', 'canManageOrders']), (req: AuthedRequest, res: Response) => {
  const users = Array.isArray(req.body?.users) ? req.body.users : [];
  const results: Record<string, string> = {};
  users.slice(0, 300).forEach((u: any) => {
    const uid = String(u?.uid || '').trim();
    if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return;
    const entry = upsertCustomerDir(uid, String(u?.email || ''), String(u?.displayName || 'Shopper'), String(u?.customerId || ''));
    results[uid] = entry.customerId;
  });
  res.json({ ok: true, customerIds: results });
});

app.get('/api/admin/users/:uid/wallet-summary', requireAnyStaffPerm(['canManageUsers', 'canManageOrders']), (req: AuthedRequest, res: Response) => {
  const uid = String(req.params.uid || '').trim();
  if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
    res.status(400).json({ error: 'Invalid user ID.' });
    return;
  }
  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const dir = readJsonRuntime<CustomerDirectoryStore>('customer-directory.json', { byUid: {}, byCustomerId: {}, byEmail: {} });
  res.json({
    ok: true,
    uid,
    customerId: dir.byUid[uid]?.customerId || '',
    autoWalletBalanceBdt: Math.round(Number(autoWallets[uid] || 0) * 100) / 100
  });
});

app.post('/api/admin/users/:uid/wallet-adjust', requireAnyStaffPerm(['canManageUsers', 'canManageOrders']), (req: AuthedRequest, res: Response) => {
  const uid = String(req.params.uid || '').trim();
  if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) {
    res.status(400).json({ error: 'Invalid user ID.' });
    return;
  }
  const mode = req.body?.mode === 'deduct' ? 'deduct' : 'add';
  const amountBdt = Math.round((Number(req.body?.amountBdt) || 0) * 100) / 100;
  if (!Number.isFinite(amountBdt) || amountBdt <= 0 || amountBdt > 500000) {
    res.status(400).json({ error: 'Adjustment amount must be between 1 and 500,000 BDT.' });
    return;
  }
  const note = String(req.body?.note || '').trim().slice(0, 200);
  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const currentAuto = Math.round(Number(autoWallets[uid] || 0) * 100) / 100;
  let nextAuto = currentAuto;
  let deductedFromAuto = 0;

  if (mode === 'deduct' && req.body?.target === 'auto') {
    deductedFromAuto = Math.min(currentAuto, amountBdt);
    nextAuto = Math.round((currentAuto - deductedFromAuto) * 100) / 100;
    autoWallets[uid] = nextAuto;
    writeJsonRuntime('auto-wallets.json', autoWallets);
  } else if (mode === 'add' && req.body?.target === 'auto') {
    nextAuto = Math.round((currentAuto + amountBdt) * 100) / 100;
    autoWallets[uid] = nextAuto;
    writeJsonRuntime('auto-wallets.json', autoWallets);
  }

  const adjLog = readJsonRuntime<any[]>('admin-wallet-adjusts.json', []);
  adjLog.push({
    id: `ADJ-${Date.now().toString(36).toUpperCase()}`,
    uid,
    mode,
    amountBdt,
    note,
    actorUid: req.authUser?.uid || '',
    actorEmail: req.authUser?.email || '',
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('admin-wallet-adjusts.json', adjLog.slice(-500));

  res.json({
    ok: true,
    uid,
    mode,
    amountBdt,
    deductedFromAuto,
    autoWalletBalanceBdt: nextAuto
  });
});

// ==================== WALLET PIN & P2P BALANCE TRANSFER ====================

function hashWalletPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin, salt, 32).toString('hex');
}

app.post('/api/wallet/pin', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const newPin = String(req.body?.newPin || '').trim();
  const currentPin = String(req.body?.currentPin || '').trim();
  if (!/^\d{4,6}$/.test(newPin)) {
    res.status(400).json({ error: 'ওয়ালেট পিন অবশ্যই ৪ থেকে ৬ ডিজিটের সংখ্যা হতে হবে।' });
    return;
  }
  const pins = readJsonRuntime<Record<string, { salt: string; hash: string; updatedAt: string }>>('wallet-pins.json', {});
  const existing = pins[authUser.uid];
  if (existing?.hash) {
    const checkHash = hashWalletPin(currentPin, existing.salt);
    if (!timingSafeHexEqual(checkHash, existing.hash)) {
      res.status(403).json({ error: 'বর্তমান পিনটি সঠিক নয়।' });
      return;
    }
  }
  const salt = crypto.randomBytes(16).toString('hex');
  pins[authUser.uid] = {
    salt,
    hash: hashWalletPin(newPin, salt),
    updatedAt: new Date().toISOString()
  };
  writeJsonRuntime('wallet-pins.json', pins);
  res.json({ ok: true, hasPin: true });
});

app.get('/api/wallet/transfers', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const transfers = readJsonRuntime<any[]>('wallet-transfers.json', []);
  const mine = transfers
    .filter((t) => t.fromUid === authUser.uid || t.toUid === authUser.uid)
    .slice(-30)
    .reverse();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, transfers: mine });
});

app.post('/api/wallet/transfer', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const recipientQuery = String(req.body?.recipient || '').trim();
  const amountBdt = Math.round((Number(req.body?.amountBdt) || 0) * 100) / 100;
  const pin = String(req.body?.pin || '').trim();

  if (!recipientQuery || !Number.isFinite(amountBdt) || amountBdt < 10 || amountBdt > 50000) {
    res.status(400).json({ error: 'সঠিক প্রাপক (NX-ID বা Gmail) এবং ১০ – ৫০,০০০৳ পরিমাণ লিখুন।' });
    return;
  }

  const pins = readJsonRuntime<Record<string, { salt: string; hash: string }>>('wallet-pins.json', {});
  const pinRec = pins[authUser.uid];
  if (!pinRec?.hash) {
    res.status(400).json({ error: 'টাকা পাঠানোর আগে একটি ৪–৬ ডিজিটের Wallet PIN সেট করুন।' });
    return;
  }
  if (!timingSafeHexEqual(hashWalletPin(pin, pinRec.salt), pinRec.hash)) {
    res.status(403).json({ error: 'Wallet PIN ভুল হয়েছে।' });
    return;
  }

  const dir = readJsonRuntime<CustomerDirectoryStore>('customer-directory.json', { byUid: {}, byCustomerId: {}, byEmail: {} });
  const upper = recipientQuery.toUpperCase();
  const lower = recipientQuery.toLowerCase();
  const targetUid = dir.byCustomerId[upper] || dir.byEmail[lower] || (dir.byUid[recipientQuery] ? recipientQuery : '');
  if (!targetUid || !dir.byUid[targetUid]) {
    res.status(404).json({ error: 'এই Customer ID বা Gmail-এ কোনো নিবন্ধিত ইউজার পাওয়া যায়নি।' });
    return;
  }
  if (targetUid === authUser.uid) {
    res.status(400).json({ error: 'নিজের অ্যাকাউন্টে ব্যালেন্স ট্রান্সফার করা যাবে না।' });
    return;
  }

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const senderAuto = Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100;
  const userDoc = await fetchFirestoreDocWithToken('users', authUser.uid, authUser.token);
  const senderFsBal = Math.round(Number(userDoc?.walletBalanceBdt || 0) * 100) / 100;
  const totalAvailable = Math.round((senderAuto + senderFsBal) * 100) / 100;

  if (totalAvailable < amountBdt) {
    res.status(400).json({ error: `পর্যাপ্ত ব্যালেন্স নেই (বর্তমান ব্যালেন্স: ৳${totalAvailable})।` });
    return;
  }

  const fromAuto = Math.min(senderAuto, amountBdt);
  const fromFs = Math.round((amountBdt - fromAuto) * 100) / 100;

  if (fromFs > 0) {
    const okPatch = await patchFirestoreWalletBalanceWithToken(authUser.uid, senderFsBal - fromFs, authUser.token);
    if (!okPatch) {
      res.status(502).json({ error: 'ওয়ালেট ব্যালেন্স আপডেট করা যায়নি, আবার চেষ্টা করুন।' });
      return;
    }
  }

  autoWallets[authUser.uid] = Math.round((senderAuto - fromAuto) * 100) / 100;
  autoWallets[targetUid] = Math.round((Number(autoWallets[targetUid] || 0) + amountBdt) * 100) / 100;
  writeJsonRuntime('auto-wallets.json', autoWallets);

  const senderDir = upsertCustomerDir(authUser.uid, authUser.email, authUser.name);
  const recDir = dir.byUid[targetUid];
  const txRecord = {
    id: `P2P-${Date.now().toString(36).toUpperCase()}`,
    fromUid: authUser.uid,
    fromCustomerId: senderDir.customerId,
    fromName: senderDir.displayName,
    toUid: targetUid,
    toCustomerId: recDir.customerId,
    toName: recDir.displayName,
    amountBdt,
    createdAt: new Date().toISOString()
  };
  const transfers = readJsonRuntime<any[]>('wallet-transfers.json', []);
  transfers.push(txRecord);
  writeJsonRuntime('wallet-transfers.json', transfers.slice(-500));

  res.json({
    ok: true,
    transfer: txRecord,
    autoWalletBalanceBdt: autoWallets[authUser.uid],
    deductedFromFirestoreBdt: fromFs
  });
});

// ==================== SAFE IMAGE UPLOAD (PHOTO REVIEWS & RETURN DISPUTES) ====================

app.post('/api/uploads/image', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const dataUrl = String(req.body?.dataUrl || '').trim();
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are supported.' });
    return;
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length < 32 || buf.length > 1500000) {
    res.status(400).json({ error: 'Image size must be under 1.5 MB.' });
    return;
  }
  const uploadDir = path.resolve(ROOT_DIR, 'public', 'uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `nx-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  const outPath = path.resolve(uploadDir, fileName);
  if (!outPath.startsWith(uploadDir + path.sep)) {
    res.status(400).json({ error: 'Invalid upload destination.' });
    return;
  }
  fs.writeFileSync(outPath, buf);
  res.json({ ok: true, url: `/uploads/${fileName}` });
});

// ==================== GAMIFICATION: DAILY CHECK-IN & LUCKY SPIN WHEEL ====================

interface GamificationUser {
  points: number;
  streak: number;
  lastCheckInDate: string;
  spinDate: string;
  spinsToday: number;
  history: { id: string; kind: 'checkin' | 'spin'; label: string; rewardBdt: number; pointsDelta: number; createdAt: string }[];
}

const SPIN_PRIZES = [
  { id: 'bdt_5', label: '৳5 Bonus', rewardBdt: 5, points: 5, weight: 28 },
  { id: 'pts_25', label: '25 Points', rewardBdt: 0, points: 25, weight: 24 },
  { id: 'bdt_10', label: '৳10 Bonus', rewardBdt: 10, points: 10, weight: 18 },
  { id: 'pts_50', label: '50 Points', rewardBdt: 0, points: 50, weight: 12 },
  { id: 'bdt_25', label: '৳25 Bonus', rewardBdt: 25, points: 15, weight: 9 },
  { id: 'try_again', label: '5 Pts Luck', rewardBdt: 0, points: 5, weight: 5 },
  { id: 'bdt_50', label: '৳50 Jackpot', rewardBdt: 50, points: 30, weight: 3 },
  { id: 'bdt_100', label: '৳100 Mega!', rewardBdt: 100, points: 50, weight: 1 }
];

function getDhakaDateStr(offsetDays = 0): string {
  const dt = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(dt);
}

function getGamificationUser(store: Record<string, GamificationUser>, uid: string): GamificationUser {
  if (!store[uid]) {
    store[uid] = { points: 0, streak: 0, lastCheckInDate: '', spinDate: '', spinsToday: 0, history: [] };
  }
  return store[uid];
}

app.get('/api/gamification/status', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const store = readJsonRuntime<Record<string, GamificationUser>>('gamification.json', {});
  const u = getGamificationUser(store, authUser.uid);
  const today = getDhakaDateStr(0);
  const spinsToday = u.spinDate === today ? u.spinsToday : 0;
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    points: u.points,
    streak: u.streak,
    checkedInToday: u.lastCheckInDate === today,
    spinsToday,
    freeSpinsLeft: spinsToday === 0 ? 1 : 0,
    extraSpinCostPts: 25,
    prizes: SPIN_PRIZES.map((p) => ({ id: p.id, label: p.label })),
    history: u.history.slice(-15).reverse()
  });
});

app.post('/api/gamification/checkin', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const storeCfg = await fetchFirestoreDocWithToken('storeConfig', 'global', authUser.token);
  const baseBdt = Math.min(100, Math.max(1, Number(storeCfg?.dailyCheckInBdt ?? 3)));
  const store = readJsonRuntime<Record<string, GamificationUser>>('gamification.json', {});
  const u = getGamificationUser(store, authUser.uid);
  const today = getDhakaDateStr(0);
  const yesterday = getDhakaDateStr(-1);

  if (u.lastCheckInDate === today) {
    res.status(409).json({ error: 'আজকের ডেইলি চেক-ইন ইতিমধ্যে সম্পন্ন হয়েছে।' });
    return;
  }

  const nextStreak = u.lastCheckInDate === yesterday ? (u.streak >= 7 ? 1 : u.streak + 1) : 1;
  const bonusBdt = Math.round(baseBdt + (nextStreak === 7 ? baseBdt * 2 : (nextStreak - 1)));
  const pts = 10 + nextStreak * 5;

  u.streak = nextStreak;
  u.lastCheckInDate = today;
  u.points += pts;
  u.history.push({
    id: `CHK-${Date.now().toString(36)}`,
    kind: 'checkin',
    label: `Day ${nextStreak} Check-in`,
    rewardBdt: bonusBdt,
    pointsDelta: pts,
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('gamification.json', store);

  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  acct.balanceBdt = Math.round((acct.balanceBdt + bonusBdt) * 100) / 100;
  acct.totalEarnedBdt = Math.round((acct.totalEarnedBdt + bonusBdt) * 100) / 100;
  acct.history.push({ id: `CHK-${Date.now().toString(36)}`, type: 'cashback', amountBdt: bonusBdt, note: `Day ${nextStreak} Check-in Bonus`, createdAt: new Date().toISOString() });
  writeJsonRuntime('rewards-ledger.json', ledger);

  res.json({ ok: true, streak: nextStreak, bonusBdt, pointsAwarded: pts, points: u.points, rewardsBalanceBdt: acct.balanceBdt });
});

app.post('/api/gamification/spin', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const storeCfg = await fetchFirestoreDocWithToken('storeConfig', 'global', authUser.token);
  if (storeCfg?.spinWheelEnabled === false) {
    res.status(403).json({ error: 'Lucky Spin বর্তমানে সাময়িকভাবে বন্ধ আছে।' });
    return;
  }

  const store = readJsonRuntime<Record<string, GamificationUser>>('gamification.json', {});
  const u = getGamificationUser(store, authUser.uid);
  const today = getDhakaDateStr(0);
  if (u.spinDate !== today) {
    u.spinDate = today;
    u.spinsToday = 0;
  }
  const extraSpinCost = 25;
  let ptsCost = 0;
  if (u.spinsToday >= 1) {
    if (u.points < extraSpinCost) {
      res.status(400).json({ error: `আজকের ফ্রি স্পিন শেষ! অতিরিক্ত স্পিনের জন্য ${extraSpinCost} পয়েন্ট প্রয়োজন।` });
      return;
    }
    ptsCost = extraSpinCost;
    u.points -= ptsCost;
  }

  const totalWeight = SPIN_PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = crypto.randomInt(totalWeight);
  let prizeIndex = 0;
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    if (roll < SPIN_PRIZES[i].weight) {
      prizeIndex = i;
      break;
    }
    roll -= SPIN_PRIZES[i].weight;
  }
  const prize = SPIN_PRIZES[prizeIndex];
  u.spinsToday += 1;
  u.points += prize.points;
  u.history.push({
    id: `SPN-${Date.now().toString(36)}`,
    kind: 'spin',
    label: prize.label,
    rewardBdt: prize.rewardBdt,
    pointsDelta: prize.points - ptsCost,
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('gamification.json', store);

  let rewardsBalanceBdt = 0;
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  if (prize.rewardBdt > 0) {
    acct.balanceBdt = Math.round((acct.balanceBdt + prize.rewardBdt) * 100) / 100;
    acct.totalEarnedBdt = Math.round((acct.totalEarnedBdt + prize.rewardBdt) * 100) / 100;
    acct.history.push({ id: `SPN-${Date.now().toString(36)}`, type: 'cashback', amountBdt: prize.rewardBdt, note: `Lucky Spin (${prize.label})`, createdAt: new Date().toISOString() });
    writeJsonRuntime('rewards-ledger.json', ledger);
  }
  rewardsBalanceBdt = acct.balanceBdt;

  res.json({
    ok: true,
    prizeIndex,
    prize: { id: prize.id, label: prize.label, rewardBdt: prize.rewardBdt, points: prize.points },
    points: u.points,
    spinsToday: u.spinsToday,
    freeSpinsLeft: 0,
    rewardsBalanceBdt
  });
});

// ==================== MYSTERY BOX / LUCKY TOKEN EVENT ====================

const MYSTERY_BOX_COST_PTS = 30;
const MYSTERY_BOX_COST_BDT = 50;
const MYSTERY_BOX_PRIZES = [
  { id: 'mb_bdt_15', label: '৳15 ক্যাশব্যাক বোনাস', rewardBdt: 15, points: 10, weight: 30 },
  { id: 'mb_pts_45', label: '45 লয়্যালটি পয়েন্টস', rewardBdt: 0, points: 45, weight: 25 },
  { id: 'mb_bdt_35', label: '৳35 রিওয়ার্ড বোনাস', rewardBdt: 35, points: 15, weight: 18 },
  { id: 'mb_bdt_60', label: '৳60 গোল্ডেন বক্স!', rewardBdt: 60, points: 20, weight: 14 },
  { id: 'mb_bdt_120', label: '৳120 এপিক জ্যাকপট!', rewardBdt: 120, points: 40, weight: 9 },
  { id: 'mb_bdt_250', label: '৳250 মিথিক মেগা রিওয়ার্ড!', rewardBdt: 250, points: 80, weight: 4 }
];

interface MysteryBoxLogItem {
  id: string;
  uid: string;
  paidWith: 'points' | 'wallet';
  prizeId: string;
  label: string;
  rewardBdt: number;
  pointsDelta: number;
  createdAt: string;
}

app.get('/api/gamification/mystery-box', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const gam = readJsonRuntime<Record<string, GamificationUser>>('gamification.json', {});
  const u = getGamificationUser(gam, authUser.uid);
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const rAcct = ensureUserRewardAccount(ledger, authUser.uid);
  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const logs = readJsonRuntime<MysteryBoxLogItem[]>('mystery-boxes.json', []);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    costPoints: MYSTERY_BOX_COST_PTS,
    costWalletBdt: MYSTERY_BOX_COST_BDT,
    points: u.points,
    rewardsBalanceBdt: rAcct.balanceBdt,
    autoWalletBalanceBdt: Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100,
    prizes: MYSTERY_BOX_PRIZES.map((p) => ({ id: p.id, label: p.label, rewardBdt: p.rewardBdt, points: p.points })),
    history: logs.filter((x) => x.uid === authUser.uid).slice(-10).reverse()
  });
});

app.post('/api/gamification/mystery-box/open', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const payWith = String(req.body?.payWith || 'points').trim() === 'wallet' ? 'wallet' : 'points';
  const gam = readJsonRuntime<Record<string, GamificationUser>>('gamification.json', {});
  const u = getGamificationUser(gam, authUser.uid);
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const rAcct = ensureUserRewardAccount(ledger, authUser.uid);
  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const autoBal = Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100;

  let ptsCost = 0;
  if (payWith === 'points') {
    if (u.points < MYSTERY_BOX_COST_PTS) {
      res.status(400).json({ error: `মিস্ট্রি বক্স খুলতে কমপক্ষে ${MYSTERY_BOX_COST_PTS} পয়েন্ট প্রয়োজন।` });
      return;
    }
    ptsCost = MYSTERY_BOX_COST_PTS;
    u.points -= ptsCost;
  } else {
    if (rAcct.balanceBdt + autoBal < MYSTERY_BOX_COST_BDT) {
      res.status(400).json({ error: `মিস্ট্রি বক্স খুলতে রিওয়ার্ডস/অটো ওয়ালেটে কমপক্ষে ৳${MYSTERY_BOX_COST_BDT} প্রয়োজন।` });
      return;
    }
    const fromRewards = Math.min(rAcct.balanceBdt, MYSTERY_BOX_COST_BDT);
    const fromAuto = Math.round((MYSTERY_BOX_COST_BDT - fromRewards) * 100) / 100;
    if (fromRewards > 0) {
      rAcct.balanceBdt = Math.round((rAcct.balanceBdt - fromRewards) * 100) / 100;
      rAcct.history.push({ id: `MBO-${Date.now().toString(36)}`, type: 'redeem', amountBdt: fromRewards, note: 'Mystery Box Entry', createdAt: new Date().toISOString() });
    }
    if (fromAuto > 0) {
      autoWallets[authUser.uid] = Math.round((autoBal - fromAuto) * 100) / 100;
    }
  }

  const totalWeight = MYSTERY_BOX_PRIZES.reduce((s, p) => s + p.weight, 0);
  let roll = crypto.randomInt(totalWeight);
  let prize = MYSTERY_BOX_PRIZES[0];
  for (const item of MYSTERY_BOX_PRIZES) {
    if (roll < item.weight) {
      prize = item;
      break;
    }
    roll -= item.weight;
  }

  u.points += prize.points;
  const createdAt = new Date().toISOString();
  const id = `MBX-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  if (prize.rewardBdt > 0) {
    rAcct.balanceBdt = Math.round((rAcct.balanceBdt + prize.rewardBdt) * 100) / 100;
    rAcct.totalEarnedBdt = Math.round((rAcct.totalEarnedBdt + prize.rewardBdt) * 100) / 100;
    rAcct.history.push({ id, type: 'cashback', amountBdt: prize.rewardBdt, note: `Mystery Box (${prize.label})`, createdAt });
  }
  writeJsonRuntime('gamification.json', gam);
  writeJsonRuntime('rewards-ledger.json', ledger);
  writeJsonRuntime('auto-wallets.json', autoWallets);

  const logs = readJsonRuntime<MysteryBoxLogItem[]>('mystery-boxes.json', []);
  const entry: MysteryBoxLogItem = {
    id,
    uid: authUser.uid,
    paidWith: payWith,
    prizeId: prize.id,
    label: prize.label,
    rewardBdt: prize.rewardBdt,
    pointsDelta: prize.points - ptsCost,
    createdAt
  };
  logs.push(entry);
  writeJsonRuntime('mystery-boxes.json', logs.slice(-500));

  res.json({
    ok: true,
    entry,
    prize: { id: prize.id, label: prize.label, rewardBdt: prize.rewardBdt, points: prize.points },
    points: u.points,
    rewardsBalanceBdt: rAcct.balanceBdt,
    autoWalletBalanceBdt: Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100
  });
});

// ==================== DIGITAL GIFT CARDS ====================

interface GiftCardRecord {
  code: string;
  amountBdt: number;
  buyerUid: string;
  buyerName: string;
  recipientName: string;
  message: string;
  status: 'active' | 'redeemed';
  redeemedByUid: string;
  redeemedByEmail: string;
  createdAt: string;
  redeemedAt: string;
}

app.get('/api/giftcards/mine', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const cards = readJsonRuntime<GiftCardRecord[]>('giftcards.json', []);
  const mine = cards.filter((c) => c.buyerUid === authUser.uid || c.redeemedByUid === authUser.uid).slice(-30).reverse();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, giftCards: mine });
});

app.post('/api/giftcards/create', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const amountBdt = Math.round(Number(req.body?.amountBdt) || 0);
  const recipientName = String(req.body?.recipientName || 'Friend').trim().slice(0, 80) || 'Friend';
  const message = String(req.body?.message || 'Enjoy shopping on Naxora Bd!').trim().slice(0, 200);
  const spendId = String(req.body?.spendId || '').trim();
  const autoSessionId = String(req.body?.autoSessionId || '').trim();

  if (!Number.isFinite(amountBdt) || amountBdt < 100 || amountBdt > 25000) {
    res.status(400).json({ error: 'গিফট কার্ডের পরিমাণ ১০০৳ থেকে ২৫,০০০৳ হতে হবে।' });
    return;
  }

  let authorized = false;
  if (spendId) {
    const receipts = readJsonRuntime<Record<string, WalletSpendReceipt>>('wallet-spends.json', {});
    const rec = receipts[spendId];
    if (rec && rec.uid === authUser.uid && !rec.rolledBack && rec.amountBdt >= amountBdt) {
      authorized = true;
    }
  } else if (autoSessionId) {
    const sessions = readJsonRuntime<Record<string, AutoSessionRecord>>('auto-sessions.json', {});
    const sess = sessions[autoSessionId];
    if (sess && sess.uid === authUser.uid && sess.used && sess.amountBdt >= amountBdt) {
      authorized = true;
    }
  } else {
    // Allow direct deduction from server auto-wallet or verified Firestore walletBalanceBdt
    const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
    const senderAuto = Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100;
    const userDoc = await fetchFirestoreDocWithToken('users', authUser.uid, authUser.token);
    const senderFs = Math.round(Number(userDoc?.walletBalanceBdt || 0) * 100) / 100;
    if (senderAuto + senderFs >= amountBdt) {
      const fromAuto = Math.min(senderAuto, amountBdt);
      const fromFs = Math.round((amountBdt - fromAuto) * 100) / 100;
      if (fromFs > 0) {
        const patched = await patchFirestoreWalletBalanceWithToken(authUser.uid, senderFs - fromFs, authUser.token);
        if (!patched) {
          res.status(502).json({ error: 'ওয়ালেট থেকে টাকা কাটতে সমস্যা হয়েছে।' });
          return;
        }
      }
      autoWallets[authUser.uid] = Math.round((senderAuto - fromAuto) * 100) / 100;
      writeJsonRuntime('auto-wallets.json', autoWallets);
      authorized = true;
    }
  }

  if (!authorized) {
    res.status(400).json({ error: 'গিফট কার্ড কিনতে পর্যাপ্ত ওয়ালেট ব্যালেন্স বা পেমেন্ট ভেরিফিকেশন প্রয়োজন।' });
    return;
  }

  const cards = readJsonRuntime<GiftCardRecord[]>('giftcards.json', []);
  const code = `NXGIFT-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const card: GiftCardRecord = {
    code,
    amountBdt,
    buyerUid: authUser.uid,
    buyerName: authUser.name.slice(0, 80),
    recipientName,
    message,
    status: 'active',
    redeemedByUid: '',
    redeemedByEmail: '',
    createdAt: new Date().toISOString(),
    redeemedAt: ''
  };
  cards.push(card);
  writeJsonRuntime('giftcards.json', cards.slice(-1000));
  res.json({ ok: true, giftCard: card });
});

app.post('/api/giftcards/redeem', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'গিফট কার্ড কোড লিখুন।' });
    return;
  }
  const cards = readJsonRuntime<GiftCardRecord[]>('giftcards.json', []);
  const idx = cards.findIndex((c) => c.code === code);
  if (idx === -1) {
    res.status(404).json({ error: 'গিফট কার্ড কোডটি সঠিক নয়।' });
    return;
  }
  if (cards[idx].status !== 'active') {
    res.status(409).json({ error: 'এই গিফট কার্ডটি ইতিমধ্যে রিডিম করা হয়ে গেছে।' });
    return;
  }
  cards[idx].status = 'redeemed';
  cards[idx].redeemedByUid = authUser.uid;
  cards[idx].redeemedByEmail = authUser.email;
  cards[idx].redeemedAt = new Date().toISOString();
  writeJsonRuntime('giftcards.json', cards);

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  autoWallets[authUser.uid] = Math.round((Number(autoWallets[authUser.uid] || 0) + cards[idx].amountBdt) * 100) / 100;
  writeJsonRuntime('auto-wallets.json', autoWallets);

  res.json({ ok: true, amountBdt: cards[idx].amountBdt, autoWalletBalanceBdt: autoWallets[authUser.uid], giftCard: cards[idx] });
});

// ==================== DUPLICATE TRXID BLOCKER, ORDER COOLDOWN & GUEST TRACKING ====================

app.post('/api/payments/register-trx', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const rawTrx = String(req.body?.trxId || '').trim().toUpperCase();
  const context = String(req.body?.context || 'order').trim().slice(0, 40);
  if (!rawTrx || rawTrx.length < 3 || rawTrx.length > 60) {
    res.status(400).json({ error: 'সঠিক Transaction ID (TrxID) লিখুন।' });
    return;
  }
  const used = readJsonRuntime<Record<string, { uid: string; context: string; createdAt: string }>>('used-trxids.json', {});
  if (used[rawTrx]) {
    res.status(409).json({ error: `এই Transaction ID (${rawTrx}) ইতিমধ্যে ব্যবহৃত হয়েছে! ভুয়া বা ডুপ্লিকেট TrxID গ্রহণযোগ্য নয়।` });
    return;
  }
  used[rawTrx] = { uid: authUser.uid, context, createdAt: new Date().toISOString() };
  writeJsonRuntime('used-trxids.json', used);
  res.json({ ok: true, trxId: rawTrx });
});

app.post('/api/fraud/check-order', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const phone = String(req.body?.phone || '').replace(/[^0-9+]/g, '').slice(0, 20);
  const now = Date.now();
  const history = readJsonRuntime<Record<string, number[]>>('order-rate-guard.json', {});
  const keyUid = `u:${authUser.uid}`;
  const recentUid = (history[keyUid] || []).filter((ts) => now - ts < 30 * 60 * 1000);
  if (recentUid.length >= 6) {
    res.status(429).json({ error: 'অতিরিক্ত দ্রুত অর্ডারের কারণে ৩০ মিনিটের কুলডাউন চালু হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।' });
    return;
  }
  recentUid.push(now);
  history[keyUid] = recentUid;
  if (phone.length >= 6) {
    const keyPhone = `p:${phone.slice(-8)}`;
    const recentPhone = (history[keyPhone] || []).filter((ts) => now - ts < 30 * 60 * 1000);
    if (recentPhone.length >= 6) {
      res.status(429).json({ error: 'এই নম্বর থেকে অল্প সময়ে অনেকগুলো অর্ডার হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।' });
      return;
    }
    recentPhone.push(now);
    history[keyPhone] = recentPhone;
  }
  writeJsonRuntime('order-rate-guard.json', history);
  res.json({ ok: true });
});

interface OrderTrackIndexItem {
  orderNumber: string;
  phoneLast4: string;
  maskedName: string;
  status: string;
  paymentStatus: string;
  deliveryZone: string;
  courierProvider: string;
  courierTracking: string;
  totalBdt: number;
  updatedAt: string;
}

app.post('/api/orders/sync-track', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const b = req.body || {};
  const orderNumber = String(b.orderNumber || '').trim().toUpperCase();
  if (!orderNumber) {
    res.status(400).json({ error: 'Order number required.' });
    return;
  }
  const index = readJsonRuntime<Record<string, OrderTrackIndexItem>>('order-tracking-index.json', {});
  const prev = index[orderNumber];
  const digits = String(b.phone || '').replace(/\D/g, '');
  const phoneLast4 = digits.length >= 4 ? digits.slice(-4) : (prev?.phoneLast4 || '0000');
  const rawName = String(b.customerName || '').trim();
  const maskedName = rawName
    ? `${rawName[0]}${'*'.repeat(Math.min(5, Math.max(2, rawName.length - 1)))}`
    : (prev?.maskedName || 'Shopper');

  index[orderNumber] = {
    orderNumber,
    phoneLast4,
    maskedName,
    status: String(b.status || prev?.status || 'pending').slice(0, 30),
    paymentStatus: String(b.paymentStatus || prev?.paymentStatus || 'unpaid').slice(0, 30),
    deliveryZone: String(b.deliveryZone || prev?.deliveryZone || 'inside_dhaka').slice(0, 30),
    courierProvider: String(b.courierProvider ?? prev?.courierProvider ?? '').slice(0, 40),
    courierTracking: String(b.courierTracking ?? prev?.courierTracking ?? '').slice(0, 80),
    totalBdt: Number(b.totalBdt ?? prev?.totalBdt ?? 0),
    updatedAt: new Date().toISOString()
  };
  writeJsonRuntime('order-tracking-index.json', index);
  res.json({ ok: true });
});

app.get('/api/orders/track', (req: Request, res: Response) => {
  const orderNumber = String(req.query.orderNumber || '').trim().toUpperCase();
  const phoneDigits = String(req.query.phone || '').replace(/\D/g, '');
  if (!orderNumber || phoneDigits.length < 4) {
    res.status(400).json({ error: 'Order Number এবং ফোনের শেষ ৪ ডিজিট (বা সম্পূর্ণ নম্বর) দিন।' });
    return;
  }
  const index = readJsonRuntime<Record<string, OrderTrackIndexItem>>('order-tracking-index.json', {});
  const rec = index[orderNumber];
  if (!rec || rec.phoneLast4 !== phoneDigits.slice(-4)) {
    res.status(404).json({ error: 'এই Order Number ও Phone-এর সাথে মিল কোনো অর্ডার পাওয়া যায়নি।' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, tracking: rec });
});

// ==================== TELEGRAM / WEBHOOK INSTANT ADMIN ALERT BOT ====================

interface AlertBotConfig {
  enabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  webhookUrl: string;
  onNewOrder: boolean;
  onManualPay: boolean;
  onWalletReq: boolean;
  onReturnReq: boolean;
  updatedAt: string;
  updatedBy: string;
}

function loadAlertBotConfig(): AlertBotConfig {
  const defaults: AlertBotConfig = {
    enabled: false,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
    webhookUrl: '',
    onNewOrder: true,
    onManualPay: true,
    onWalletReq: true,
    onReturnReq: true,
    updatedAt: '',
    updatedBy: ''
  };
  const saved = readJsonRuntime<Partial<AlertBotConfig>>('alert-bot.json', {});
  return { ...defaults, ...saved };
}

async function dispatchAdminBotMessage(eventLabel: string, text: string): Promise<{ sent: boolean; channel: string; error?: string }> {
  const cfg = loadAlertBotConfig();
  if (!cfg.enabled) return { sent: false, channel: 'disabled' };
  let sent = false;
  const channels: string[] = [];
  let lastErr = '';

  if (cfg.telegramBotToken && cfg.telegramChatId) {
    try {
      const tgUrl = `https://api.telegram.org/bot${encodeURIComponent(cfg.telegramBotToken)}/sendMessage`;
      const r = await fetch(tgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cfg.telegramChatId,
          text: `🔔 [Naxora Bd · ${eventLabel}]\n${text}`.slice(0, 3800)
        }),
        signal: AbortSignal.timeout(7000)
      });
      if (r.ok) {
        sent = true;
        channels.push('telegram');
      } else {
        lastErr = `Telegram HTTP ${r.status}`;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'Telegram error';
    }
  }

  if (cfg.webhookUrl && isSafeExternalHttpUrl(cfg.webhookUrl)) {
    try {
      const r = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: 'Naxora Bd', event: eventLabel, message: text, timestamp: new Date().toISOString() }),
        redirect: 'manual',
        signal: AbortSignal.timeout(7000)
      });
      if (r.ok) {
        sent = true;
        channels.push('webhook');
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'Webhook error';
    }
  }

  const logs = readJsonRuntime<any[]>('alert-logs.json', []);
  logs.push({
    id: `ALT-${Date.now().toString(36)}`,
    event: eventLabel,
    channel: channels.join('+') || 'none',
    sent,
    error: lastErr,
    preview: text.slice(0, 140),
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('alert-logs.json', logs.slice(-50));
  return { sent, channel: channels.join('+') || 'none', error: lastErr || undefined };
}

app.get('/api/alerts/bot-config', requireMainAdmin, (_req, res) => {
  const cfg = loadAlertBotConfig();
  const logs = readJsonRuntime<any[]>('alert-logs.json', []);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    enabled: cfg.enabled,
    telegramChatId: cfg.telegramChatId,
    hasBotToken: Boolean(cfg.telegramBotToken),
    botTokenMasked: maskSecret(cfg.telegramBotToken),
    webhookUrl: cfg.webhookUrl,
    onNewOrder: cfg.onNewOrder,
    onManualPay: cfg.onManualPay,
    onWalletReq: cfg.onWalletReq,
    onReturnReq: cfg.onReturnReq,
    updatedAt: cfg.updatedAt,
    recentLogs: logs.slice(-15).reverse()
  });
});

app.post('/api/alerts/bot-config', requireMainAdmin, (req: AuthedRequest, res: Response) => {
  const cur = loadAlertBotConfig();
  const b = req.body || {};
  const webhookUrl = String(b.webhookUrl ?? cur.webhookUrl).trim().slice(0, 300);
  if (webhookUrl && !isSafeExternalHttpUrl(webhookUrl)) {
    res.status(400).json({ error: 'Webhook URL must be a valid public http(s) URL.' });
    return;
  }
  const clearToken = b.clearToken === true;
  const next: AlertBotConfig = {
    enabled: typeof b.enabled === 'boolean' ? b.enabled : cur.enabled,
    telegramBotToken: clearToken ? '' : (String(b.telegramBotToken || '').trim() || cur.telegramBotToken),
    telegramChatId: String(b.telegramChatId ?? cur.telegramChatId).trim().slice(0, 80),
    webhookUrl,
    onNewOrder: typeof b.onNewOrder === 'boolean' ? b.onNewOrder : cur.onNewOrder,
    onManualPay: typeof b.onManualPay === 'boolean' ? b.onManualPay : cur.onManualPay,
    onWalletReq: typeof b.onWalletReq === 'boolean' ? b.onWalletReq : cur.onWalletReq,
    onReturnReq: typeof b.onReturnReq === 'boolean' ? b.onReturnReq : cur.onReturnReq,
    updatedAt: new Date().toISOString(),
    updatedBy: req.authUser?.email || MAIN_ADMIN_EMAIL
  };
  writeJsonRuntime('alert-bot.json', next);
  res.json({ ok: true, enabled: next.enabled, hasBotToken: Boolean(next.telegramBotToken), botTokenMasked: maskSecret(next.telegramBotToken) });
});

app.post('/api/alerts/test', requireMainAdmin, async (req: AuthedRequest, res: Response) => {
  const result = await dispatchAdminBotMessage('TEST', `Test alert triggered by ${req.authUser?.email || 'Owner'} at ${new Date().toLocaleString()}`);
  res.json({ ok: true, ...result });
});

const adminLoginAlertThrottle = new Map<string, number>();

app.post('/api/alerts/login', async (req: Request, res: Response) => {
  if (!adminAuth) {
    res.json({ ok: true, sent: false });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email_verified !== true) {
      res.status(403).json({ error: 'Verified account required.' });
      return;
    }
    const emailLower = (decoded.email || '').trim().toLowerCase();
    const isOwner = emailLower === MAIN_ADMIN_EMAIL.toLowerCase();
    let roleLabel = 'Main Admin (Owner)';
    if (!isOwner) {
      const admDoc = await fetchFirestoreDocWithToken('admins', decoded.uid, token);
      if (!admDoc || admDoc.status !== 'approved') {
        res.status(403).json({ error: 'Approved admin account required.' });
        return;
      }
      roleLabel = String(admDoc.role || 'Staff Admin').slice(0, 60);
    }
    const lastTs = adminLoginAlertThrottle.get(emailLower) || 0;
    if (Date.now() - lastTs < 5 * 60 * 1000) {
      res.json({ ok: true, sent: false, throttled: true });
      return;
    }
    adminLoginAlertThrottle.set(emailLower, Date.now());
    const portal = String(req.body?.portal || 'admin').trim().slice(0, 30);
    const result = await dispatchAdminBotMessage(
      'ADMIN_LOGIN',
      `Admin signed into /${portal} workspace\nName: ${String(decoded.name || emailLower).slice(0, 80)}\nEmail: ${emailLower}\nRole: ${roleLabel}`
    );
    res.json({ ok: true, ...result });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

app.post('/api/alerts/notify', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const cfg = loadAlertBotConfig();
  if (!cfg.enabled) {
    res.json({ ok: true, sent: false });
    return;
  }
  const kind = String(req.body?.kind || 'order').trim();
  if ((kind === 'order' || kind === 'reseller_order') && !cfg.onNewOrder) { res.json({ ok: true, sent: false }); return; }
  if (kind === 'manual_pay' && !cfg.onManualPay) { res.json({ ok: true, sent: false }); return; }
  if (kind === 'wallet_req' && !cfg.onWalletReq) { res.json({ ok: true, sent: false }); return; }
  if (kind === 'return_req' && !cfg.onReturnReq) { res.json({ ok: true, sent: false }); return; }
  const summary = String(req.body?.summary || '').trim().slice(0, 500);
  if (!summary) {
    res.json({ ok: true, sent: false });
    return;
  }
  const result = await dispatchAdminBotMessage(kind.toUpperCase(), `${summary}\nUser: ${req.authUser?.email || req.authUser?.uid}`);
  res.json({ ok: true, ...result });
});

// ==================== VIP LOYALTY TIERS (SERVER VERIFIED SPEND) ====================

interface VipUserCache {
  verifiedAmounts: Record<string, number>;
  totalSpendBdt: number;
  orderCount: number;
  updatedAt: string;
}

function computeVipTier(totalSpendBdt: number) {
  if (totalSpendBdt >= 25000) {
    return { tier: 'diamond', label: 'Diamond VIP', discountPct: 7, freeDeliveryMinBdt: 0, earlyFlashDrop: true, badgeColor: '#00e5ff', nextTier: '', nextSpendNeededBdt: 0, targetSpendBdt: 25000 };
  }
  if (totalSpendBdt >= 10000) {
    return { tier: 'gold', label: 'Gold VIP', discountPct: 4, freeDeliveryMinBdt: 1000, earlyFlashDrop: true, badgeColor: '#f59e0b', nextTier: 'Diamond VIP', nextSpendNeededBdt: Math.round(25000 - totalSpendBdt), targetSpendBdt: 25000 };
  }
  if (totalSpendBdt >= 3000) {
    return { tier: 'silver', label: 'Silver VIP', discountPct: 2, freeDeliveryMinBdt: 1800, earlyFlashDrop: false, badgeColor: '#cbd5e1', nextTier: 'Gold VIP', nextSpendNeededBdt: Math.round(10000 - totalSpendBdt), targetSpendBdt: 10000 };
  }
  return { tier: 'bronze', label: 'Bronze Member', discountPct: 0, freeDeliveryMinBdt: null, earlyFlashDrop: false, badgeColor: '#cd7f32', nextTier: 'Silver VIP', nextSpendNeededBdt: Math.round(3000 - totalSpendBdt), targetSpendBdt: 3000 };
}

app.post('/api/vip/summary', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const orderIds = Array.isArray(req.body?.orderIds) ? req.body.orderIds.slice(0, 35).map((x: unknown) => String(x || '').trim()).filter((x: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(x)) : [];
  const emOrderIds = Array.isArray(req.body?.emOrderIds) ? req.body.emOrderIds.slice(0, 35).map((x: unknown) => String(x || '').trim()).filter((x: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(x)) : [];

  const cache = readJsonRuntime<Record<string, VipUserCache>>('vip-cache.json', {});
  const entry = cache[authUser.uid] || { verifiedAmounts: {}, totalSpendBdt: 0, orderCount: 0, updatedAt: '' };
  let changed = false;

  for (const oid of orderIds) {
    const key = `o:${oid}`;
    if (entry.verifiedAmounts[key] !== undefined) continue;
    const ord = await fetchFirestoreDocWithToken('orders', oid, authUser.token);
    if (ord && ord.userId === authUser.uid && ord.status !== 'cancelled' && (ord.paymentStatus === 'paid' || ord.status === 'delivered')) {
      entry.verifiedAmounts[key] = Math.max(0, Number(ord.totalBdt || 0));
      changed = true;
    }
  }
  for (const eid of emOrderIds) {
    const key = `e:${eid}`;
    if (entry.verifiedAmounts[key] !== undefined) continue;
    const eo = await fetchFirestoreDocWithToken('emarketOrders', eid, authUser.token);
    if (eo && eo.userId === authUser.uid && eo.status !== 'cancelled' && (eo.paymentStatus === 'paid' || eo.status === 'completed')) {
      entry.verifiedAmounts[key] = Math.max(0, Number(eo.totalBdt || eo.priceBdt || 0));
      changed = true;
    }
  }

  const amounts = Object.values(entry.verifiedAmounts);
  entry.totalSpendBdt = Math.round(amounts.reduce((s, n) => s + Number(n || 0), 0));
  entry.orderCount = amounts.length;
  entry.updatedAt = new Date().toISOString();
  if (changed || !cache[authUser.uid]) {
    cache[authUser.uid] = entry;
    writeJsonRuntime('vip-cache.json', cache);
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    totalSpendBdt: entry.totalSpendBdt,
    orderCount: entry.orderCount,
    ...computeVipTier(entry.totalSpendBdt)
  });
});

// ==================== RESELLER PROFIT WALLET & PAYOUTS ====================

interface ResellerWalletEntry {
  profitBalanceBdt: number;
  totalEarnedBdt: number;
  withdrawnBdt: number;
  creditedOrderIds: string[];
  ledger: { id: string; type: 'credit' | 'withdraw' | 'refund'; amountBdt: number; note: string; createdAt: string }[];
}

interface ResellerWithdrawal {
  id: string;
  uid: string;
  email: string;
  name: string;
  amountBdt: number;
  method: 'bkash' | 'nagad' | 'rocket';
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  reviewedBy: string;
  createdAt: string;
  reviewedAt: string;
}

interface ResellerStore {
  wallets: Record<string, ResellerWalletEntry>;
  withdrawals: ResellerWithdrawal[];
}

function getResellerWallet(store: ResellerStore, uid: string): ResellerWalletEntry {
  if (!store.wallets[uid]) {
    store.wallets[uid] = { profitBalanceBdt: 0, totalEarnedBdt: 0, withdrawnBdt: 0, creditedOrderIds: [], ledger: [] };
  }
  return store.wallets[uid];
}

app.get('/api/reseller/summary', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const store = readJsonRuntime<ResellerStore>('reseller-profits.json', { wallets: {}, withdrawals: [] });
  const w = getResellerWallet(store, authUser.uid);
  const myWithdrawals = store.withdrawals.filter((wd) => wd.uid === authUser.uid).slice(-25).reverse();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    profitBalanceBdt: w.profitBalanceBdt,
    totalEarnedBdt: w.totalEarnedBdt,
    withdrawnBdt: w.withdrawnBdt,
    creditedOrderIds: w.creditedOrderIds,
    ledger: w.ledger.slice(-20).reverse(),
    withdrawals: myWithdrawals
  });
});

app.post('/api/reseller/credit-order', requireStaffPermission('canManageOrders'), async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const orderId = String(req.body?.orderId || '').trim();
  if (!orderId || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid Order ID required.' });
    return;
  }
  const order = await fetchFirestoreDocWithToken('orders', orderId, authUser.token);
  if (!order || !order.userId) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  if (!order.isResellerOrder && !(Number(order.resellerProfitBdt) > 0)) {
    res.status(400).json({ error: 'This is not a reseller order.' });
    return;
  }
  const store = readJsonRuntime<ResellerStore>('reseller-profits.json', { wallets: {}, withdrawals: [] });
  const w = getResellerWallet(store, String(order.userId));
  if (w.creditedOrderIds.includes(orderId)) {
    res.status(409).json({ error: 'এই অর্ডারের রিসেলার প্রফিট ইতিমধ্যে ক্রেডিট করা হয়েছে।' });
    return;
  }
  const cfg = await fetchFirestoreDocWithToken('storeConfig', 'global', authUser.token);
  const pct = Math.min(50, Math.max(0, Number(cfg?.resellerCommissionPct ?? 10)));
  const explicitProfit = Number(order.resellerProfitBdt || 0);
  const profitBdt = explicitProfit > 0
    ? Math.round(explicitProfit * 100) / 100
    : Math.max(10, Math.round(Number(order.subtotalBdt || order.totalBdt || 0) * pct / 100));

  w.profitBalanceBdt = Math.round((w.profitBalanceBdt + profitBdt) * 100) / 100;
  w.totalEarnedBdt = Math.round((w.totalEarnedBdt + profitBdt) * 100) / 100;
  w.creditedOrderIds.push(orderId);
  w.ledger.push({
    id: `RPR-${Date.now().toString(36)}`,
    type: 'credit',
    amountBdt: profitBdt,
    note: `Order #${order.orderNumber || orderId.slice(0, 8)} Profit (${authUser.email})`,
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('reseller-profits.json', store);
  res.json({ ok: true, targetUid: order.userId, orderNumber: order.orderNumber || orderId, creditedBdt: profitBdt, profitBalanceBdt: w.profitBalanceBdt });
});

app.post('/api/reseller/withdraw', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const amountBdt = Math.round(Number(req.body?.amountBdt) || 0);
  const method = String(req.body?.method || 'bkash').trim().toLowerCase();
  const accountNumber = String(req.body?.accountNumber || '').replace(/[^0-9+]/g, '').slice(0, 20);

  if (!['bkash', 'nagad', 'rocket'].includes(method)) {
    res.status(400).json({ error: 'bKash, Nagad অথবা Rocket নির্বাচন করুন।' });
    return;
  }
  if (!/^(\+?88)?01[3-9]\d{8}$/.test(accountNumber)) {
    res.status(400).json({ error: 'সঠিক ১১ সংখ্যার মোবাইল ওয়ালেট নম্বর দিন।' });
    return;
  }
  if (!Number.isFinite(amountBdt) || amountBdt < 100 || amountBdt > 100000) {
    res.status(400).json({ error: 'উইথড্র পরিমাণ ১০০৳ থেকে ১,০০,০০০৳ হতে হবে।' });
    return;
  }

  const userDoc = await fetchFirestoreDocWithToken('users', authUser.uid, authUser.token);
  if (!userDoc?.isReseller) {
    res.status(403).json({ error: 'শুধুমাত্র অনুমোদিত রিসেলার প্রফিট উইথড্র করতে পারবেন।' });
    return;
  }

  const store = readJsonRuntime<ResellerStore>('reseller-profits.json', { wallets: {}, withdrawals: [] });
  const w = getResellerWallet(store, authUser.uid);
  if (w.profitBalanceBdt < amountBdt) {
    res.status(400).json({ error: `পর্যাপ্ত প্রফিট ব্যালেন্স নেই (বর্তমান: ৳${w.profitBalanceBdt})।` });
    return;
  }

  w.profitBalanceBdt = Math.round((w.profitBalanceBdt - amountBdt) * 100) / 100;
  const wd: ResellerWithdrawal = {
    id: `RWD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    uid: authUser.uid,
    email: authUser.email,
    name: String(userDoc.displayName || authUser.name).slice(0, 80),
    amountBdt,
    method: method as 'bkash' | 'nagad' | 'rocket',
    accountNumber,
    status: 'pending',
    adminNote: '',
    reviewedBy: '',
    createdAt: new Date().toISOString(),
    reviewedAt: ''
  };
  w.ledger.push({ id: wd.id, type: 'withdraw', amountBdt, note: `Payout Req (${method.toUpperCase()} · ${accountNumber})`, createdAt: wd.createdAt });
  store.withdrawals.push(wd);
  writeJsonRuntime('reseller-profits.json', store);
  res.json({ ok: true, withdrawal: wd, profitBalanceBdt: w.profitBalanceBdt });
});

app.get('/api/reseller/withdrawals', requireAnyStaffPerm(['canManageOrders', 'canManageUsers']), (_req, res) => {
  const store = readJsonRuntime<ResellerStore>('reseller-profits.json', { wallets: {}, withdrawals: [] });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, withdrawals: [...store.withdrawals].reverse().slice(0, 200) });
});

app.post('/api/reseller/withdrawals/review', requireAnyStaffPerm(['canManageOrders', 'canManageUsers']), (req: AuthedRequest, res: Response) => {
  const withdrawalId = String(req.body?.withdrawalId || '').trim();
  const action = String(req.body?.action || '').trim();
  const adminNote = String(req.body?.adminNote || '').trim().slice(0, 200);
  if (!withdrawalId || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'Valid withdrawalId and action (approve/reject) required.' });
    return;
  }
  const store = readJsonRuntime<ResellerStore>('reseller-profits.json', { wallets: {}, withdrawals: [] });
  const wd = store.withdrawals.find((x) => x.id === withdrawalId);
  if (!wd) {
    res.status(404).json({ error: 'Withdrawal request not found.' });
    return;
  }
  if (wd.status !== 'pending') {
    res.status(409).json({ error: 'This withdrawal has already been reviewed.' });
    return;
  }
  const w = getResellerWallet(store, wd.uid);
  wd.status = action === 'approve' ? 'approved' : 'rejected';
  wd.adminNote = adminNote || (action === 'approve' ? 'Paid by Admin' : 'Rejected by Admin');
  wd.reviewedBy = req.authUser?.email || MAIN_ADMIN_EMAIL;
  wd.reviewedAt = new Date().toISOString();

  if (action === 'approve') {
    w.withdrawnBdt = Math.round((w.withdrawnBdt + wd.amountBdt) * 100) / 100;
  } else {
    w.profitBalanceBdt = Math.round((w.profitBalanceBdt + wd.amountBdt) * 100) / 100;
    w.ledger.push({ id: `RFN-${Date.now().toString(36)}`, type: 'refund', amountBdt: wd.amountBdt, note: `Payout Rejected Refund (${wd.id})`, createdAt: wd.reviewedAt });
  }
  writeJsonRuntime('reseller-profits.json', store);
  res.json({ ok: true, withdrawal: wd });
});

interface ResellerWhiteLabelProfile {
  uid: string;
  shopName: string;
  phone: string;
  tagline: string;
  defaultMarkupPct: number;
  updatedAt: string;
}

app.get('/api/reseller/whitelabel', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const all = readJsonRuntime<Record<string, ResellerWhiteLabelProfile>>('whitelabel-resellers.json', {});
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, profile: all[authUser.uid] || null });
});

app.post('/api/reseller/whitelabel', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const userDoc = await fetchFirestoreDocWithToken('users', authUser.uid, authUser.token);
  if (!userDoc?.isReseller) {
    res.status(403).json({ error: 'শুধুমাত্র অনুমোদিত রিসেলার হোয়াইট-লেবেল প্রোফাইল সেভ করতে পারবেন।' });
    return;
  }
  const shopName = String(req.body?.shopName || '').trim().slice(0, 80);
  const phone = String(req.body?.phone || '').replace(/[^0-9+\-\s]/g, '').trim().slice(0, 20);
  const tagline = String(req.body?.tagline || '').trim().slice(0, 120);
  const defaultMarkupPct = Math.min(200, Math.max(0, Math.round(Number(req.body?.defaultMarkupPct) || 0)));
  if (shopName.length < 2) {
    res.status(400).json({ error: 'কমপক্ষে ২ অক্ষরের শপের নাম দিন।' });
    return;
  }
  const all = readJsonRuntime<Record<string, ResellerWhiteLabelProfile>>('whitelabel-resellers.json', {});
  const profile: ResellerWhiteLabelProfile = {
    uid: authUser.uid,
    shopName,
    phone,
    tagline,
    defaultMarkupPct,
    updatedAt: new Date().toISOString()
  };
  all[authUser.uid] = profile;
  writeJsonRuntime('whitelabel-resellers.json', all);
  res.json({ ok: true, profile });
});

// ==================== PHONE NUMBER OTP VERIFICATION ====================

interface PendingPhoneOtp {
  phone: string;
  hash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

interface VerifiedPhoneRecord {
  phone: string;
  verifiedAt: string;
}

function normalizeBdPhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length === 13) return digits.slice(2);
  if (digits.startsWith('01') && digits.length === 11) return digits;
  return '';
}

app.get('/api/auth/otp/status', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const verified = readJsonRuntime<Record<string, VerifiedPhoneRecord>>('verified-phones.json', {});
  const rec = verified[req.authUser!.uid];
  const phone = rec?.phone || '';
  const maskedPhone = phone ? `${phone.slice(0, 3)}••••${phone.slice(-3)}` : '';
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, phoneVerified: Boolean(rec), verifiedPhone: phone, maskedPhone, verifiedAt: rec?.verifiedAt || '' });
});

app.post('/api/auth/otp/send', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const phone = normalizeBdPhone(String(req.body?.phone || ''));
  if (!/^01[3-9]\d{8}$/.test(phone)) {
    res.status(400).json({ error: 'সঠিক ১১ সংখ্যার বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।' });
    return;
  }
  const otps = readJsonRuntime<Record<string, PendingPhoneOtp>>('phone-otps.json', {});
  const existing = otps[authUser.uid];
  const now = Date.now();
  if (existing && now - existing.lastSentAt < 45000) {
    const waitSec = Math.ceil((45000 - (now - existing.lastSentAt)) / 1000);
    res.status(429).json({ error: `নতুন OTP পাঠাতে ${waitSec} সেকেন্ড অপেক্ষা করুন।` });
    return;
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const hash = crypto.createHash('sha256').update(`${code}:${EPHEMERAL_HMAC_KEY}`).digest('hex');
  otps[authUser.uid] = { phone, hash, expiresAt: now + 5 * 60 * 1000, attempts: 0, lastSentAt: now };
  writeJsonRuntime('phone-otps.json', otps);

  const smsWebhook = String(process.env.SMS_WEBHOOK_URL || '').trim();
  if (smsWebhook && isSafeExternalHttpUrl(smsWebhook)) {
    try {
      const r = await fetch(smsWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: code, message: `Naxora Bd verification code: ${code} (valid for 5 minutes)` }),
        redirect: 'manual',
        signal: AbortSignal.timeout(7000)
      });
      if (r.ok) {
        res.json({ ok: true, sandboxMode: false, phone, expiresInSec: 300 });
        return;
      }
    } catch {}
  }

  res.json({ ok: true, sandboxMode: true, previewCode: code, phone, expiresInSec: 300 });
});

app.post('/api/auth/otp/verify', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const code = String(req.body?.code || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) {
    res.status(400).json({ error: '৬ সংখ্যার সঠিক OTP কোড লিখুন।' });
    return;
  }
  const otps = readJsonRuntime<Record<string, PendingPhoneOtp>>('phone-otps.json', {});
  const rec = otps[authUser.uid];
  if (!rec) {
    res.status(404).json({ error: 'কোনো সক্রিয় OTP পাওয়া যায়নি। আবার OTP পাঠান।' });
    return;
  }
  if (Date.now() > rec.expiresAt) {
    delete otps[authUser.uid];
    writeJsonRuntime('phone-otps.json', otps);
    res.status(410).json({ error: 'OTP-এর মেয়াদ শেষ হয়ে গেছে। নতুন OTP পাঠান।' });
    return;
  }
  if (rec.attempts >= 5) {
    delete otps[authUser.uid];
    writeJsonRuntime('phone-otps.json', otps);
    res.status(429).json({ error: 'অনেকবার ভুল OTP দেওয়া হয়েছে। নতুন OTP অনুরোধ করুন।' });
    return;
  }

  const expectedHash = crypto.createHash('sha256').update(`${code}:${EPHEMERAL_HMAC_KEY}`).digest('hex');
  if (expectedHash !== rec.hash) {
    rec.attempts += 1;
    otps[authUser.uid] = rec;
    writeJsonRuntime('phone-otps.json', otps);
    res.status(400).json({ error: `OTP কোডটি সঠিক নয় (${5 - rec.attempts} বার চেষ্টা বাকি)।` });
    return;
  }

  const verifiedPhone = rec.phone;
  delete otps[authUser.uid];
  writeJsonRuntime('phone-otps.json', otps);

  const verified = readJsonRuntime<Record<string, VerifiedPhoneRecord>>('verified-phones.json', {});
  verified[authUser.uid] = { phone: verifiedPhone, verifiedAt: new Date().toISOString() };
  writeJsonRuntime('verified-phones.json', verified);

  res.json({ ok: true, phoneVerified: true, verifiedPhone, maskedPhone: `${verifiedPhone.slice(0, 3)}••••${verifiedPhone.slice(-3)}` });
});

// ==================== VERIFIED PHOTO REVIEW AUTO-REWARD ====================

app.post('/api/rewards/review-bonus', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const productId = String(req.body?.productId || '').trim();
  const orderId = String(req.body?.orderId || '').trim();
  const photoUrl = String(req.body?.photoUrl || '').trim();

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(productId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid productId and delivered orderId required.' });
    return;
  }
  if (!photoUrl.startsWith('/uploads/')) {
    res.status(400).json({ error: 'Photo proof upload required for bonus.' });
    return;
  }

  const order = await fetchFirestoreDocWithToken('orders', orderId, authUser.token);
  const ownsDelivered = order && order.userId === authUser.uid && order.status === 'delivered' &&
    Array.isArray(order.items) && order.items.some((i: any) => String(i.productId || '') === productId);
  if (!ownsDelivered) {
    res.status(403).json({ error: 'Delivered order verification failed for this product.' });
    return;
  }

  const dedupKey = `REV:${authUser.uid}:${productId}`;
  const ledger = readJsonRuntime<RewardsLedger>('rewards-ledger.json', { users: {}, codeToUid: {}, countByReferrer: {} });
  const acct = ensureUserRewardAccount(ledger, authUser.uid);
  if (acct.claimedOrderIds.includes(dedupKey)) {
    res.json({ ok: true, alreadyClaimed: true, awardedBdt: 0, rewardsBalanceBdt: acct.balanceBdt });
    return;
  }

  const storeCfg = await fetchFirestoreDocWithToken('storeConfig', 'global', authUser.token);
  const bonusBdt = Math.min(500, Math.max(0, Number(storeCfg?.reviewBonusBdt ?? 20)));
  if (bonusBdt <= 0) {
    res.json({ ok: true, awardedBdt: 0, rewardsBalanceBdt: acct.balanceBdt });
    return;
  }

  acct.claimedOrderIds.push(dedupKey);
  acct.balanceBdt = Math.round((acct.balanceBdt + bonusBdt) * 100) / 100;
  acct.totalEarnedBdt = Math.round((acct.totalEarnedBdt + bonusBdt) * 100) / 100;
  acct.history.push({
    id: `RWB-${Date.now().toString(36)}`,
    type: 'cashback',
    amountBdt: bonusBdt,
    note: `Verified Photo Review Bonus`,
    createdAt: new Date().toISOString()
  });
  writeJsonRuntime('rewards-ledger.json', ledger);
  res.json({ ok: true, awardedBdt: bonusBdt, rewardsBalanceBdt: acct.balanceBdt });
});

// ==================== TOURNAMENT 1-CLICK PRIZE PAYOUT ====================

app.post('/api/tournaments/prize-payout', requireStaffPermission('canManageEMarket'), (req: AuthedRequest, res: Response) => {
  const tournamentId = String(req.body?.tournamentId || '').trim();
  const title = String(req.body?.title || 'Tournament').trim().slice(0, 120);
  const rawWinners = Array.isArray(req.body?.winners) ? req.body.winners.slice(0, 10) : [];
  if (!tournamentId || !/^[a-zA-Z0-9_-]{1,128}$/.test(tournamentId) || !rawWinners.length) {
    res.status(400).json({ error: 'Tournament ID and at least 1 winner required.' });
    return;
  }

  const prizeLog = readJsonRuntime<Record<string, any>>('tournament-prizes.json', {});
  if (prizeLog[tournamentId]?.distributed) {
    res.status(409).json({ error: 'এই টুর্নামেন্টের প্রাইজ মানি ইতিমধ্যে বিতরণ করা হয়েছে।' });
    return;
  }

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const payouts: { uid: string; name: string; rank: number; prizeBdt: number }[] = [];
  let totalPaidBdt = 0;

  for (const w of rawWinners) {
    const uid = String(w?.uid || '').trim();
    const name = String(w?.name || 'Player').trim().slice(0, 80);
    const rank = Math.max(1, parseInt(String(w?.rank || 1), 10) || 1);
    const prizeBdt = Math.round(Number(w?.prizeBdt || 0) * 100) / 100;
    if (!uid || prizeBdt <= 0 || prizeBdt > 100000) continue;
    autoWallets[uid] = Math.round((Number(autoWallets[uid] || 0) + prizeBdt) * 100) / 100;
    payouts.push({ uid, name, rank, prizeBdt });
    totalPaidBdt = Math.round((totalPaidBdt + prizeBdt) * 100) / 100;
  }

  if (!payouts.length) {
    res.status(400).json({ error: 'Valid winner UID and positive prize amount required.' });
    return;
  }

  writeJsonRuntime('auto-wallets.json', autoWallets);
  prizeLog[tournamentId] = {
    distributed: true,
    title,
    payouts,
    totalPaidBdt,
    distributedBy: req.authUser?.email || MAIN_ADMIN_EMAIL,
    distributedAt: new Date().toISOString()
  };
  writeJsonRuntime('tournament-prizes.json', prizeLog);
  res.json({ ok: true, paidCount: payouts.length, totalPaidBdt, payouts });
});

// ==================== SUBSCRIPTION AUTO-RENEW ====================

app.post('/api/emarket/auto-renew/run', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const orderId = String(req.body?.orderId || '').trim();
  if (!orderId || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid E-Market Order ID required.' });
    return;
  }
  const order = await fetchFirestoreDocWithToken('emarketOrders', orderId, authUser.token);
  if (!order || order.userId !== authUser.uid) {
    res.status(404).json({ error: 'Subscription order not found.' });
    return;
  }
  const priceBdt = Math.round(Number(order.priceBdt || order.totalBdt || 0) * 100) / 100;
  if (!(priceBdt > 0)) {
    res.status(400).json({ error: 'Invalid renewal price.' });
    return;
  }

  const autoWallets = readJsonRuntime<Record<string, number>>('auto-wallets.json', {});
  const autoBal = Math.round(Number(autoWallets[authUser.uid] || 0) * 100) / 100;
  const userDoc = await fetchFirestoreDocWithToken('users', authUser.uid, authUser.token);
  const fsBal = Math.round(Number(userDoc?.walletBalanceBdt || 0) * 100) / 100;
  if (autoBal + fsBal < priceBdt) {
    res.status(400).json({ error: `অটো-রিনিউয়ের জন্য ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই (প্রয়োজন ৳${priceBdt})।` });
    return;
  }

  const fromAuto = Math.min(autoBal, priceBdt);
  const fromFs = Math.round((priceBdt - fromAuto) * 100) / 100;
  if (fromFs > 0) {
    const ok = await patchFirestoreWalletBalanceWithToken(authUser.uid, fsBal - fromFs, authUser.token);
    if (!ok) {
      res.status(502).json({ error: 'ওয়ালেট ব্যালেন্স কাটা যায়নি, আবার চেষ্টা করুন।' });
      return;
    }
  }
  autoWallets[authUser.uid] = Math.round((autoBal - fromAuto) * 100) / 100;
  writeJsonRuntime('auto-wallets.json', autoWallets);

  const days = Math.max(1, Number(order.renewalDays || 30));
  const curExpMs = order.expiresAtIso ? new Date(order.expiresAtIso).getTime() : 0;
  const baseMs = Number.isFinite(curExpMs) && curExpMs > Date.now() ? curExpMs : Date.now();
  const newExpiresAtIso = new Date(baseMs + days * 86400000).toISOString();
  const trxId = `RNW-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  res.json({ ok: true, trxId, paidBdt: priceBdt, newExpiresAtIso, autoWalletBalanceBdt: autoWallets[authUser.uid] });
});

// ==================== ADMIN ORDER CONCURRENCY LOCK ====================

interface OrderLockRecord {
  orderKey: string;
  lockedByUid: string;
  lockedByEmail: string;
  lockedByName: string;
  acquiredAt: number;
  expiresAt: number;
}

const ORDER_LOCK_TTL_MS = 3 * 60 * 1000;

function readActiveOrderLocks(): Record<string, OrderLockRecord> {
  const raw = readJsonRuntime<Record<string, OrderLockRecord>>('order-locks.json', {});
  const now = Date.now();
  const clean: Record<string, OrderLockRecord> = {};
  let changed = false;
  for (const [k, v] of Object.entries(raw)) {
    if (v && v.expiresAt > now) clean[k] = v;
    else changed = true;
  }
  if (changed) writeJsonRuntime('order-locks.json', clean);
  return clean;
}

app.get('/api/orders/locks', requireAnyStaffPerm(['canManageOrders', 'canManageEMarket']), (_req, res) => {
  const locks = readActiveOrderLocks();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, locks });
});

app.post('/api/orders/lock', requireAnyStaffPerm(['canManageOrders', 'canManageEMarket']), (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const orderKey = String(req.body?.orderKey || '').trim().slice(0, 140);
  const action = String(req.body?.action || 'acquire').trim();
  if (!orderKey) {
    res.status(400).json({ error: 'orderKey required.' });
    return;
  }
  const locks = readActiveOrderLocks();
  const cur = locks[orderKey];

  if (action === 'release') {
    if (cur && cur.lockedByUid === authUser.uid) {
      delete locks[orderKey];
      writeJsonRuntime('order-locks.json', locks);
    }
    res.json({ ok: true, released: true });
    return;
  }

  if (action === 'acquire' && cur && cur.lockedByUid !== authUser.uid) {
    res.json({ ok: true, lockedByOther: true, lock: cur });
    return;
  }

  const nextLock: OrderLockRecord = {
    orderKey,
    lockedByUid: authUser.uid,
    lockedByEmail: authUser.email,
    lockedByName: authUser.name,
    acquiredAt: Date.now(),
    expiresAt: Date.now() + ORDER_LOCK_TTL_MS
  };
  locks[orderKey] = nextLock;
  writeJsonRuntime('order-locks.json', locks);
  res.json({ ok: true, lockedByOther: false, lock: nextLock });
});

// ==================== CUSTOMER FAQ & PRE-PURCHASE LIVE SUPPORT CHAT ====================

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  updatedAt: string;
}

interface SupportChatMessage {
  id: string;
  sender: 'customer' | 'staff';
  senderName: string;
  text: string;
  createdAt: string;
}

interface SupportChatThread {
  threadKey: string;
  customerName: string;
  customerEmail: string;
  updatedAt: string;
  messages: SupportChatMessage[];
}

const DEFAULT_FAQS: FaqItem[] = [
  { id: 'faq-cod', category: 'অর্ডার ও ডেলিভারি', question: 'ঢাকার ভেতরে ও বাইরে ডেলিভারি চার্জ ও সময় কত?', answer: 'ঢাকার ভেতরে সাধারণত ১–২ কার্যদিবস এবং ঢাকার বাইরে ২–৪ কার্যদিবসের মধ্যে ডেলিভারি পৌঁছায়। নির্দিষ্ট চার্জ চেকআউটে স্বয়ংক্রিয়ভাবে দেখানো হয়।', updatedAt: new Date().toISOString() },
  { id: 'faq-emarket', category: 'ই-মার্কেট ও টপআপ', question: 'গেম টপআপ বা সাবস্ক্রিপশন কতক্ষণে ডেলিভারি হয়?', answer: 'ইনস্ট্যান্ট PIN ভল্ট প্রোডাক্ট পেমেন্টের সাথে সাথেই অর্ডার কার্ডে পাওয়া যায়; ম্যানুয়াল UID টপআপ ৫–১৫ মিনিটের মধ্যে সম্পন্ন হয়।', updatedAt: new Date().toISOString() },
  { id: 'faq-vip', category: 'VIP ও রিওয়ার্ডস', question: 'VIP মেম্বারশিপ ও ডিসকাউন্ট কীভাবে পাওয়া যায়?', answer: 'মোট ভেরিফায়েড কেনাকাটার ওপর ভিত্তি করে স্বয়ংক্রিয়ভাবে Bronze, Silver, Gold এবং Diamond VIP টিয়ার আনলক হয় — যাতে অতিরিক্ত ৭% পর্যন্ত ছাড় ও ফ্রি ডেলিভারি থাকে।', updatedAt: new Date().toISOString() },
  { id: 'faq-reseller', category: 'রিসেলার প্রোগ্রাম', question: 'রিসেলার হলে কীভাবে প্রফিট তুলবো?', answer: 'অ্যাকাউন্ট থেকে Reseller-এ আবেদন করে অনুমোদন পেলে বিশেষ পাইকারি ছাড়ে অর্ডার ও নিজের নির্ধারিত প্রফিট সরাসরি bKash/Nagad/Rocket-এ উইথড্র করতে পারবেন।', updatedAt: new Date().toISOString() },
  { id: 'faq-return', category: 'রিটার্ন ও ওয়ারেন্টি', question: 'ভুল বা ক্ষতিগ্রস্ত পণ্য পেলে কী করবো?', answer: 'অর্ডার ডেলিভারি হওয়ার পর "Orders" পেজ থেকে আনবক্সিং ছবিসহ Return/Dispute আবেদন করলে টিম ওয়ালেটে রিফান্ড বা রিপ্লেসমেন্ট ব্যবস্থা করবে।', updatedAt: new Date().toISOString() }
];

function readFaqs(): FaqItem[] {
  const list = readJsonRuntime<FaqItem[]>('support-faq.json', []);
  if (!list.length) {
    writeJsonRuntime('support-faq.json', DEFAULT_FAQS);
    return DEFAULT_FAQS;
  }
  return list;
}

app.get('/api/support/faq', (_req, res) => {
  res.json({ ok: true, faqs: readFaqs() });
});

app.post('/api/support/faq', requireAnyStaffPerm(['canManageNotices', 'canReplyTickets']), (req: AuthedRequest, res: Response) => {
  const action = String(req.body?.action || 'upsert').trim();
  const id = String(req.body?.id || '').trim().slice(0, 80);
  const faqs = [...readFaqs()];
  if (action === 'delete') {
    const next = faqs.filter((f) => f.id !== id);
    writeJsonRuntime('support-faq.json', next);
    res.json({ ok: true, faqs: next });
    return;
  }
  const question = String(req.body?.question || '').trim().slice(0, 220);
  const answer = String(req.body?.answer || '').trim().slice(0, 1000);
  const category = String(req.body?.category || 'সাধারণ প্রশ্ন').trim().slice(0, 60);
  if (question.length < 3 || answer.length < 3) {
    res.status(400).json({ error: 'Question and answer required.' });
    return;
  }
  const targetId = id || `faq-${Date.now().toString(36)}`;
  const idx = faqs.findIndex((f) => f.id === targetId);
  const item: FaqItem = { id: targetId, category, question, answer, updatedAt: new Date().toISOString() };
  if (idx >= 0) faqs[idx] = item;
  else faqs.unshift(item);
  writeJsonRuntime('support-faq.json', faqs.slice(0, 60));
  res.json({ ok: true, faqs });
});

async function resolveOptionalStaff(req: Request): Promise<{ isStaff: boolean; user?: AuthUser }> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token || !adminAuth) return { isStaff: false };
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email_verified !== true) return { isStaff: false };
    const emailLower = (decoded.email || '').trim().toLowerCase();
    const user: AuthUser = { uid: decoded.uid, email: emailLower, name: String(decoded.name || emailLower || 'User'), token };
    if (emailLower === MAIN_ADMIN_EMAIL.toLowerCase()) return { isStaff: true, user };
    const adm = await fetchFirestoreDocWithToken('admins', decoded.uid, token);
    if (adm && adm.status === 'approved' && (adm.permissions?.canReplyTickets === true || adm.permissions?.canManageOrders === true)) {
      return { isStaff: true, user };
    }
    return { isStaff: false, user };
  } catch {
    return { isStaff: false };
  }
}

app.get('/api/support/chat', async (req: Request, res: Response) => {
  const { isStaff, user } = await resolveOptionalStaff(req);
  const chats = readJsonRuntime<Record<string, SupportChatThread>>('support-chats.json', {});
  res.setHeader('Cache-Control', 'no-store');
  if (isStaff && req.query.scope === 'all') {
    const threads = Object.values(chats).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 100);
    res.json({ ok: true, isStaff: true, threads });
    return;
  }
  const guestSid = String(req.query.sessionId || '').trim();
  const threadKey = user?.uid || (/^G-[a-zA-Z0-9_-]{6,48}$/.test(guestSid) ? guestSid : '');
  const thread = threadKey ? (chats[threadKey] || { threadKey, customerName: user?.name || 'Guest', customerEmail: user?.email || '', updatedAt: '', messages: [] }) : null;
  res.json({ ok: true, isStaff: false, thread });
});

app.post('/api/support/chat', async (req: Request, res: Response) => {
  const { isStaff, user } = await resolveOptionalStaff(req);
  const text = String(req.body?.text || '').trim().slice(0, 600);
  if (!text) {
    res.status(400).json({ error: 'মেসেজ লিখুন।' });
    return;
  }
  const chats = readJsonRuntime<Record<string, SupportChatThread>>('support-chats.json', {});
  const nowIso = new Date().toISOString();

  if (req.body?.asStaff === true) {
    if (!isStaff || !user) {
      res.status(403).json({ error: 'Staff permission required to reply.' });
      return;
    }
    const threadKey = String(req.body?.threadKey || '').trim().slice(0, 128);
    if (!threadKey || !chats[threadKey]) {
      res.status(404).json({ error: 'Support chat thread not found.' });
      return;
    }
    chats[threadKey].messages.push({ id: `MSG-${Date.now().toString(36)}`, sender: 'staff', senderName: `${user.name} (Support)`, text, createdAt: nowIso });
    chats[threadKey].messages = chats[threadKey].messages.slice(-60);
    chats[threadKey].updatedAt = nowIso;
    writeJsonRuntime('support-chats.json', chats);
    res.json({ ok: true, thread: chats[threadKey] });
    return;
  }

  const guestSid = String(req.body?.sessionId || '').trim();
  const threadKey = user?.uid || (/^G-[a-zA-Z0-9_-]{6,48}$/.test(guestSid) ? guestSid : '');
  if (!threadKey) {
    res.status(400).json({ error: 'Valid session required.' });
    return;
  }
  const senderName = String(req.body?.customerName || user?.name || 'Guest Shopper').trim().slice(0, 80);
  if (!chats[threadKey]) {
    chats[threadKey] = { threadKey, customerName: senderName, customerEmail: user?.email || '', updatedAt: nowIso, messages: [] };
  }
  chats[threadKey].customerName = senderName;
  if (user?.email) chats[threadKey].customerEmail = user.email;
  chats[threadKey].messages.push({ id: `MSG-${Date.now().toString(36)}`, sender: 'customer', senderName, text, createdAt: nowIso });
  chats[threadKey].messages = chats[threadKey].messages.slice(-60);
  chats[threadKey].updatedAt = nowIso;
  writeJsonRuntime('support-chats.json', chats);
  res.json({ ok: true, thread: chats[threadKey] });
});

// ==================== DAILY EXPENSES & TRUE NET ROI LEDGER ====================

interface ExpenseRecord {
  id: string;
  date: string;
  category: 'ads' | 'packaging' | 'shipping' | 'ops';
  title: string;
  amountBdt: number;
  note: string;
  createdBy: string;
  createdAt: string;
}

app.get('/api/expenses', requireAnyStaffPerm(['canManageOrders', 'canManageProducts']), (_req, res) => {
  const expenses = readJsonRuntime<ExpenseRecord[]>('expenses.json', []);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, expenses: [...expenses].reverse().slice(0, 300) });
});

app.post('/api/expenses', requireAnyStaffPerm(['canManageOrders', 'canManageProducts']), (req: AuthedRequest, res: Response) => {
  const b = req.body || {};
  const category = String(b.category || 'ads').trim().toLowerCase();
  if (!['ads', 'packaging', 'shipping', 'ops'].includes(category)) {
    res.status(400).json({ error: 'Invalid expense category.' });
    return;
  }
  const title = String(b.title || '').trim().slice(0, 120);
  const amountBdt = Math.round((Number(b.amountBdt) || 0) * 100) / 100;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? String(b.date) : getDhakaDateStr(0);
  const note = String(b.note || '').trim().slice(0, 200);
  if (title.length < 2 || !Number.isFinite(amountBdt) || amountBdt <= 0 || amountBdt > 5000000) {
    res.status(400).json({ error: 'Valid expense title and amount (1..5,000,000) required.' });
    return;
  }
  const expenses = readJsonRuntime<ExpenseRecord[]>('expenses.json', []);
  const item: ExpenseRecord = {
    id: `EXP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    date,
    category: category as ExpenseRecord['category'],
    title,
    amountBdt,
    note,
    createdBy: req.authUser?.email || MAIN_ADMIN_EMAIL,
    createdAt: new Date().toISOString()
  };
  expenses.push(item);
  writeJsonRuntime('expenses.json', expenses.slice(-1000));
  res.json({ ok: true, expense: item });
});

app.delete('/api/expenses/:id', requireAnyStaffPerm(['canManageOrders', 'canManageProducts']), (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const expenses = readJsonRuntime<ExpenseRecord[]>('expenses.json', []);
  const next = expenses.filter((x) => x.id !== id);
  if (next.length === expenses.length) {
    res.status(404).json({ error: 'Expense not found.' });
    return;
  }
  writeJsonRuntime('expenses.json', next);
  res.json({ ok: true });
});

// ==================== ESPORTS TOURNAMENT RESULT SCREENSHOT PROOFS ====================

interface TournamentProofRecord {
  id: string;
  tournamentId: string;
  uid: string;
  playerName: string;
  teamName: string;
  gameUid: string;
  placement: number;
  kills: number;
  photoUrl: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  reviewedBy: string;
  createdAt: string;
  reviewedAt: string;
}

app.get('/api/tournaments/proofs', async (req: Request, res: Response) => {
  const { isStaff, user } = await resolveOptionalStaff(req);
  if (!isStaff && !user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const tid = String(req.query.tournamentId || '').trim();
  const all = readJsonRuntime<TournamentProofRecord[]>('tournament-proofs.json', []);
  const filtered = tid ? all.filter((p) => p.tournamentId === tid) : all;
  res.setHeader('Cache-Control', 'no-store');
  if (isStaff) {
    res.json({ ok: true, isStaff: true, proofs: [...filtered].reverse().slice(0, 200) });
    return;
  }
  const visible = filtered
    .filter((p) => p.uid === user?.uid || p.status === 'approved')
    .map((p) => p.uid === user?.uid ? p : {
      id: p.id,
      tournamentId: p.tournamentId,
      playerName: p.playerName,
      teamName: p.teamName,
      placement: p.placement,
      kills: p.kills,
      status: p.status,
      createdAt: p.createdAt
    });
  res.json({ ok: true, isStaff: false, proofs: visible.reverse().slice(0, 100) });
});

app.post('/api/tournaments/proofs', verifyUserToken, (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const b = req.body || {};
  const tournamentId = String(b.tournamentId || '').trim();
  const photoUrl = String(b.photoUrl || '').trim();
  const teamName = String(b.teamName || '').trim().slice(0, 80);
  const gameUid = String(b.gameUid || '').trim().slice(0, 60);
  const kills = Math.min(99, Math.max(0, Math.round(Number(b.kills) || 0)));
  const placement = Math.min(100, Math.max(1, Math.round(Number(b.placement) || 1)));
  const note = String(b.note || '').trim().slice(0, 300);

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(tournamentId)) {
    res.status(400).json({ error: 'Valid tournament ID required.' });
    return;
  }
  if (!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(photoUrl)) {
    res.status(400).json({ error: 'বৈধ আপলোড করা রেজাল্ট স্ক্রিনশট দিন।' });
    return;
  }

  const all = readJsonRuntime<TournamentProofRecord[]>('tournament-proofs.json', []);
  const pendingIdx = all.findIndex((p) => p.tournamentId === tournamentId && p.uid === authUser.uid && p.status === 'pending');
  const rec: TournamentProofRecord = {
    id: pendingIdx >= 0 ? all[pendingIdx].id : `TPR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    tournamentId,
    uid: authUser.uid,
    playerName: String(b.playerName || authUser.name || 'Player').trim().slice(0, 80),
    teamName,
    gameUid,
    placement,
    kills,
    photoUrl,
    note,
    status: 'pending',
    adminNote: '',
    reviewedBy: '',
    createdAt: new Date().toISOString(),
    reviewedAt: ''
  };
  if (pendingIdx >= 0) {
    all[pendingIdx] = rec;
  } else {
    all.push(rec);
  }
  writeJsonRuntime('tournament-proofs.json', all.slice(-500));
  res.json({ ok: true, proof: rec });
});

app.post('/api/tournaments/proofs/review', requireStaffPermission('canManageEMarket'), (req: AuthedRequest, res: Response) => {
  const proofId = String(req.body?.proofId || '').trim();
  const action = String(req.body?.action || '').trim();
  const adminNote = String(req.body?.adminNote || '').trim().slice(0, 200);
  if (!proofId || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'Valid proofId and action required.' });
    return;
  }
  const all = readJsonRuntime<TournamentProofRecord[]>('tournament-proofs.json', []);
  const item = all.find((p) => p.id === proofId);
  if (!item) {
    res.status(404).json({ error: 'Result proof not found.' });
    return;
  }
  item.status = action === 'approve' ? 'approved' : 'rejected';
  item.adminNote = adminNote || (action === 'approve' ? 'Verified by Tournament Referee' : 'Rejected');
  item.reviewedBy = req.authUser?.email || MAIN_ADMIN_EMAIL;
  item.reviewedAt = new Date().toISOString();
  writeJsonRuntime('tournament-proofs.json', all);
  res.json({ ok: true, proof: item });
});

// ==================== CREATOR / INFLUENCER PROMO CODE TRACKER ====================

interface CreatorPromoRecord {
  code: string;
  creatorName: string;
  creatorPhone: string;
  commissionPct: number;
  uses: number;
  revenueBdt: number;
  discountBdt: number;
  commissionOwedBdt: number;
  recordedOrderIds: string[];
  updatedAt: string;
}

app.get('/api/coupons/creators', requireAnyStaffPerm(['canManageCoupons', 'canManageOrders']), (_req, res) => {
  const creators = readJsonRuntime<Record<string, CreatorPromoRecord>>('coupon-creators.json', {});
  const list = Object.values(creators).sort((a, b) => b.revenueBdt - a.revenueBdt);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, creators: list });
});

app.post('/api/coupons/creators', requireStaffPermission('canManageCoupons'), (req: AuthedRequest, res: Response) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const creatorName = String(req.body?.creatorName || '').trim().slice(0, 80);
  const creatorPhone = String(req.body?.creatorPhone || '').replace(/[^0-9+\-\s]/g, '').trim().slice(0, 20);
  const commissionPct = Math.min(50, Math.max(0, Math.round((Number(req.body?.commissionPct) || 0) * 100) / 100));
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || creatorName.length < 2) {
    res.status(400).json({ error: 'Valid coupon code and creator name required.' });
    return;
  }
  const creators = readJsonRuntime<Record<string, CreatorPromoRecord>>('coupon-creators.json', {});
  const prev = creators[code];
  creators[code] = {
    code,
    creatorName,
    creatorPhone,
    commissionPct,
    uses: prev?.uses || 0,
    revenueBdt: prev?.revenueBdt || 0,
    discountBdt: prev?.discountBdt || 0,
    commissionOwedBdt: prev?.commissionOwedBdt || 0,
    recordedOrderIds: prev?.recordedOrderIds || [],
    updatedAt: new Date().toISOString()
  };
  writeJsonRuntime('coupon-creators.json', creators);
  res.json({ ok: true, creator: creators[code] });
});

app.post('/api/coupons/record-use', verifyUserToken, async (req: AuthedRequest, res: Response) => {
  const authUser = req.authUser!;
  const code = String(req.body?.code || '').trim().toUpperCase();
  const orderId = String(req.body?.orderId || '').trim();
  const orderType = String(req.body?.orderType || 'order') === 'emarket' ? 'emarketOrders' : 'orders';
  if (!/^[A-Z0-9_-]{2,40}$/.test(code) || !/^[a-zA-Z0-9_-]{1,128}$/.test(orderId)) {
    res.status(400).json({ error: 'Valid coupon code and orderId required.' });
    return;
  }
  const creators = readJsonRuntime<Record<string, CreatorPromoRecord>>('coupon-creators.json', {});
  const rec = creators[code];
  if (!rec) {
    res.json({ ok: true, tracked: false });
    return;
  }
  if (rec.recordedOrderIds.includes(orderId)) {
    res.json({ ok: true, tracked: true, duplicate: true });
    return;
  }
  const orderDoc = await fetchFirestoreDocWithToken(orderType, orderId, authUser.token);
  if (!orderDoc || orderDoc.userId !== authUser.uid) {
    res.status(403).json({ error: 'Order ownership mismatch.' });
    return;
  }
  const totalBdt = Math.max(0, Number(orderDoc.totalBdt || 0));
  const discountBdt = Math.max(0, Number(orderDoc.discountBdt || 0));
  const commission = Math.round((totalBdt * rec.commissionPct / 100) * 100) / 100;
  rec.uses += 1;
  rec.revenueBdt = Math.round((rec.revenueBdt + totalBdt) * 100) / 100;
  rec.discountBdt = Math.round((rec.discountBdt + discountBdt) * 100) / 100;
  rec.commissionOwedBdt = Math.round((rec.commissionOwedBdt + commission) * 100) / 100;
  rec.recordedOrderIds.push(orderId);
  rec.recordedOrderIds = rec.recordedOrderIds.slice(-300);
  rec.updatedAt = new Date().toISOString();
  writeJsonRuntime('coupon-creators.json', creators);
  res.json({ ok: true, tracked: true, creator: rec });
});

// ==================== ABANDONED CART RECOVERY ====================

interface AbandonedCartRecord {
  key: string;
  uid: string;
  customerName: string;
  email: string;
  phone: string;
  items: { productId: string; title: string; variant: string; qty: number; priceBdt: number }[];
  subtotalBdt: number;
  updatedAt: string;
  remindedAt: string;
}

app.post('/api/carts/abandoned', async (req: Request, res: Response) => {
  const { user } = await resolveOptionalStaff(req);
  const b = req.body || {};
  const guestSid = String(b.sessionId || '').trim();
  const key = user?.uid || (/^G-[a-zA-Z0-9_-]{6,64}$/.test(guestSid) ? guestSid : '');
  if (!key) {
    res.status(400).json({ error: 'Valid cart session required.' });
    return;
  }
  const carts = readJsonRuntime<Record<string, AbandonedCartRecord>>('abandoned-carts.json', {});
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (!rawItems.length) {
    if (carts[key]) {
      delete carts[key];
      writeJsonRuntime('abandoned-carts.json', carts);
    }
    res.json({ ok: true, cleared: true });
    return;
  }
  const items = rawItems.slice(0, 20).map((i: any) => ({
    productId: String(i?.productId || '').slice(0, 80),
    title: String(i?.title || '').slice(0, 100),
    variant: String(i?.variant || '').slice(0, 40),
    qty: Math.max(1, Math.min(99, Math.round(Number(i?.qty) || 1))),
    priceBdt: Math.max(0, Number(i?.priceBdt) || 0)
  }));
  const subtotalBdt = items.reduce((s: number, i: any) => s + i.qty * i.priceBdt, 0);
  carts[key] = {
    key,
    uid: user?.uid || '',
    customerName: String(b.customerName || user?.name || 'Guest Shopper').trim().slice(0, 80),
    email: String(user?.email || b.email || '').trim().slice(0, 100),
    phone: String(b.phone || '').replace(/[^0-9+\-\s]/g, '').trim().slice(0, 20),
    items,
    subtotalBdt: Math.round(subtotalBdt * 100) / 100,
    updatedAt: new Date().toISOString(),
    remindedAt: carts[key]?.remindedAt || ''
  };
  const keys = Object.keys(carts);
  if (keys.length > 200) {
    keys.sort((a, c) => carts[a].updatedAt.localeCompare(carts[c].updatedAt)).slice(0, keys.length - 200).forEach((k) => delete carts[k]);
  }
  writeJsonRuntime('abandoned-carts.json', carts);
  res.json({ ok: true });
});

app.get('/api/carts/abandoned', requireAnyStaffPerm(['canManageOrders', 'canManageUsers']), (_req, res) => {
  const carts = readJsonRuntime<Record<string, AbandonedCartRecord>>('abandoned-carts.json', {});
  const list = Object.values(carts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, carts: list });
});

app.post('/api/carts/abandoned/remind', requireAnyStaffPerm(['canManageOrders', 'canManageUsers']), (req: Request, res: Response) => {
  const key = String(req.body?.key || '').trim();
  const carts = readJsonRuntime<Record<string, AbandonedCartRecord>>('abandoned-carts.json', {});
  if (!carts[key]) {
    res.status(404).json({ error: 'Abandoned cart not found.' });
    return;
  }
  carts[key].remindedAt = new Date().toISOString();
  writeJsonRuntime('abandoned-carts.json', carts);
  res.json({ ok: true, cart: carts[key] });
});

// ==================== BUY X GET Y / AUTO COMBO OFFER BUILDER ====================

interface ComboOfferRule {
  id: string;
  title: string;
  type: 'buy_x_get_pct' | 'bogo_half' | 'min_qty_free_ship';
  minQty: number;
  discountPct: number;
  targetCategory: string;
  isActive: boolean;
  createdAt: string;
}

app.get('/api/offers', (_req, res) => {
  const offers = readJsonRuntime<ComboOfferRule[]>('combo-offers.json', []);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, offers });
});

app.post('/api/offers', requireAnyStaffPerm(['canManageCoupons', 'canManageProducts']), (req: Request, res: Response) => {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 120);
  const type = String(b.type || 'buy_x_get_pct').trim();
  if (!['buy_x_get_pct', 'bogo_half', 'min_qty_free_ship'].includes(type)) {
    res.status(400).json({ error: 'Invalid offer type.' });
    return;
  }
  const minQty = Math.min(20, Math.max(2, Math.round(Number(b.minQty) || 2)));
  const discountPct = type === 'bogo_half' ? 50 : (type === 'min_qty_free_ship' ? 0 : Math.min(80, Math.max(1, Math.round(Number(b.discountPct) || 10))));
  const targetCategory = String(b.targetCategory || '').trim().slice(0, 60);
  const isActive = b.isActive !== false;
  if (title.length < 2) {
    res.status(400).json({ error: 'Offer title required.' });
    return;
  }
  const offers = readJsonRuntime<ComboOfferRule[]>('combo-offers.json', []);
  const rule: ComboOfferRule = {
    id: `OFR-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    title,
    type: type as ComboOfferRule['type'],
    minQty,
    discountPct,
    targetCategory,
    isActive,
    createdAt: new Date().toISOString()
  };
  offers.push(rule);
  writeJsonRuntime('combo-offers.json', offers.slice(-50));
  res.json({ ok: true, offer: rule });
});

app.delete('/api/offers/:id', requireAnyStaffPerm(['canManageCoupons', 'canManageProducts']), (req: Request, res: Response) => {
  const id = String(req.params.id || '').trim();
  const offers = readJsonRuntime<ComboOfferRule[]>('combo-offers.json', []);
  const next = offers.filter((o) => o.id !== id);
  if (next.length === offers.length) {
    res.status(404).json({ error: 'Offer not found.' });
    return;
  }
  writeJsonRuntime('combo-offers.json', next);
  res.json({ ok: true });
});

// Main Admin Code Studio: Inspect 3-file app source
app.get('/api/code-studio/files', requireMainAdmin, (req, res) => {
  const targetApp = String(req.query.app || 'user');
  if (!ALLOWED_APPS.has(targetApp)) {
    res.status(400).json({ error: 'Invalid app identifier.' });
    return;
  }
  const appDir = path.join(ROOT_DIR, 'apps', targetApp);
  const files: Record<string, string> = {};
  for (const fileName of ALLOWED_FILES) {
    const filePath = path.join(appDir, fileName);
    files[fileName] = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
  }
  res.json({ app: targetApp, files });
});

// Main Admin Code Studio: Save edits to any of the 3 files with automatic backup
app.post('/api/code-studio/save', requireMainAdmin, (req, res) => {
  const { app: targetApp, fileName, content } = req.body || {};
  if (!ALLOWED_APPS.has(targetApp) || !ALLOWED_FILES.has(fileName) || typeof content !== 'string') {
    res.status(400).json({ error: 'Invalid app, fileName, or content.' });
    return;
  }
  if (content.length > 350000) {
    res.status(400).json({ error: 'File exceeds maximum allowed size (350KB).' });
    return;
  }

  const targetPath = path.join(ROOT_DIR, 'apps', targetApp, fileName);
  const backupDir = path.join(ROOT_DIR, '.backups', targetApp);
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(targetPath, path.join(backupDir, `${stamp}-${fileName}`));
  }
  fs.writeFileSync(targetPath, content, 'utf-8');
  res.json({ ok: true, app: targetApp, fileName, bytes: Buffer.byteLength(content, 'utf-8') });
});

// Main Admin Code Studio: Restore factory defaults
app.post('/api/code-studio/restore', requireMainAdmin, (req, res) => {
  const { app: targetApp, fileName } = req.body || {};
  if (!ALLOWED_APPS.has(targetApp)) {
    res.status(400).json({ error: 'Invalid app identifier.' });
    return;
  }
  const defDir = path.join(ROOT_DIR, '.defaults', targetApp);
  const appDir = path.join(ROOT_DIR, 'apps', targetApp);
  const toRestore = fileName && ALLOWED_FILES.has(fileName) ? [fileName] : Array.from(ALLOWED_FILES);

  for (const name of toRestore) {
    const src = path.join(defDir, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(appDir, name));
    }
  }
  res.json({ ok: true, app: targetApp, restored: toRestore });
});

function getPublicFirebaseConfig() {
  const cfg = loadFirebaseConfig();
  if (!cfg || !cfg.projectId || cfg.projectId === 'remixed-project-id') return null;
  return {
    apiKey: cfg.apiKey || '',
    authDomain: cfg.authDomain || '',
    projectId: cfg.projectId || '',
    storageBucket: cfg.storageBucket || '',
    messagingSenderId: cfg.messagingSenderId || '',
    appId: cfg.appId || '',
    firestoreDatabaseId: cfg.firestoreDatabaseId || '(default)'
  };
}

function injectFirebaseConfigIntoHtml(html: string): string {
  const publicFbCfg = getPublicFirebaseConfig();
  if (!publicFbCfg) return html;
  const fbBoot = `<script>window.__NAXORA_FIREBASE_CONFIG__=${JSON.stringify(publicFbCfg).replace(/</g, '\\u003c')};</script>\n`;
  if (/<script[^>]+src=["'][^"']*app\.js["'][^>]*>/i.test(html)) {
    return html.replace(/<script[^>]+src=["'][^"']*app\.js["'][^>]*>/i, (m) => `${fbBoot}${m}`);
  }
  return html.replace(/<\/head>/i, () => `${fbBoot}</head>`);
}

function buildSingleHtmlBundle(targetApp: string): string {
  const appDir = path.join(ROOT_DIR, 'apps', targetApp);
  const htmlPath = path.join(appDir, 'index.html');
  const cssPath = path.join(appDir, 'style.css');
  const jsPath = path.join(appDir, 'app.js');
  let html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf-8') : '';
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8').replace(/<\/style/gi, '<\\/style') : '';
  const js = fs.existsSync(jsPath) ? fs.readFileSync(jsPath, 'utf-8').replace(/<\/script/gi, '<\\/script') : '';

  const publicFbCfg = getPublicFirebaseConfig();

  const styleBlock = `<style>\n${css}\n</style>`;
  if (/<link[^>]+rel=["']stylesheet["'][^>]*style\.css[^>]*>/i.test(html)) {
    html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*style\.css[^>]*>/i, () => styleBlock);
  } else {
    html = html.replace(/<\/head>/i, () => `${styleBlock}\n</head>`);
  }

  const fbBoot = publicFbCfg
    ? `<script>window.__NAXORA_FIREBASE_CONFIG__=${JSON.stringify(publicFbCfg).replace(/</g, '\\u003c')};</script>\n`
    : '';
  const scriptBlock = `${fbBoot}<script type="module">\n${js}\n</script>`;
  if (/<script[^>]+src=["'][^"']*app\.js["'][^>]*><\/script>/i.test(html)) {
    html = html.replace(/<script[^>]+src=["'][^"']*app\.js["'][^>]*><\/script>/i, () => scriptBlock);
  } else {
    html = html.replace(/<\/body>/i, () => `${scriptBlock}\n</body>`);
  }
  return html;
}

// Main Admin Code Studio: Generate Single-File HTML (CSS + JS embedded inside HTML) per app
app.get('/api/code-studio/single-html/:app', requireMainAdmin, (req, res) => {
  const targetApp = String(req.params.app || '');
  if (!ALLOWED_APPS.has(targetApp)) {
    res.status(400).json({ error: 'Invalid app identifier.' });
    return;
  }
  const html = buildSingleHtmlBundle(targetApp);
  const fileName = `naxora-bd-${targetApp}-single.html`;
  if (req.query.mode === 'json') {
    res.json({ ok: true, app: targetApp, fileName, bytes: Buffer.byteLength(html, 'utf-8'), html });
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(html);
});

// Main Admin Code Studio: Download all 3 apps as 3 separate Single-File HTMLs + image/icon assets in 1 ZIP
app.get('/api/code-studio/download-all-singles', requireMainAdmin, async (_req, res) => {
  const zip = new JSZip();
  for (const targetApp of ALLOWED_APPS) {
    const html = buildSingleHtmlBundle(targetApp);
    const outName = targetApp === 'user' ? 'user-storefront.html' : `${targetApp}.html`;
    zip.file(outName, html);
  }
  const imgDir = path.join(ROOT_DIR, 'src/assets/images');
  if (fs.existsSync(imgDir)) {
    for (const f of fs.readdirSync(imgDir)) {
      const full = path.join(imgDir, f);
      if (fs.statSync(full).isFile()) {
        zip.file(`src/assets/images/${f}`, fs.readFileSync(full));
      }
    }
  }
  const iconsDir = path.join(ROOT_DIR, 'public/icons');
  if (fs.existsSync(iconsDir)) {
    for (const f of fs.readdirSync(iconsDir)) {
      const full = path.join(iconsDir, f);
      if (fs.statSync(full).isFile()) {
        zip.file(`icons/${f}`, fs.readFileSync(full));
      }
    }
  }
  const manifestPath = path.join(ROOT_DIR, 'public/manifest.webmanifest');
  if (fs.existsSync(manifestPath)) {
    zip.file('manifest.webmanifest', fs.readFileSync(manifestPath));
  }
  const swPath = path.join(ROOT_DIR, 'public/sw.js');
  if (fs.existsSync(swPath)) {
    zip.file('sw.js', fs.readFileSync(swPath));
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="naxora-bd-3-single-html-apps.zip"');
  res.send(buffer);
});

// Main Admin Code Studio: Download clean Image & Icon Assets ZIP (naxora-bd-images.zip)
app.get('/api/code-studio/download-images', requireMainAdmin, async (_req, res) => {
  const zip = new JSZip();
  const imgDir = path.join(ROOT_DIR, 'src/assets/images');
  if (fs.existsSync(imgDir)) {
    for (const f of fs.readdirSync(imgDir)) {
      const full = path.join(imgDir, f);
      if (fs.statSync(full).isFile()) {
        zip.file(`src/assets/images/${f}`, fs.readFileSync(full));
      }
    }
  }
  const iconsDir = path.join(ROOT_DIR, 'public/icons');
  if (fs.existsSync(iconsDir)) {
    for (const f of fs.readdirSync(iconsDir)) {
      const full = path.join(iconsDir, f);
      if (fs.statSync(full).isFile()) {
        zip.file(`icons/${f}`, fs.readFileSync(full));
      }
    }
  }
  const manifestPath = path.join(ROOT_DIR, 'public/manifest.webmanifest');
  if (fs.existsSync(manifestPath)) {
    zip.file('manifest.webmanifest', fs.readFileSync(manifestPath));
  }
  const swPath = path.join(ROOT_DIR, 'public/sw.js');
  if (fs.existsSync(swPath)) {
    zip.file('sw.js', fs.readFileSync(swPath));
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="naxora-bd-images.zip"');
  res.send(buffer);
});

// Main Admin Code Studio: Download strict 3-file ZIP bundle (with Firebase client config pre-injected in index.html for static hosts)
app.get('/api/code-studio/download/:app', requireMainAdmin, async (req, res) => {
  const targetApp = String(req.params.app || '');
  if (!ALLOWED_APPS.has(targetApp)) {
    res.status(400).json({ error: 'Invalid app identifier.' });
    return;
  }
  const zip = new JSZip();
  const appDir = path.join(ROOT_DIR, 'apps', targetApp);
  for (const fileName of ALLOWED_FILES) {
    const filePath = path.join(appDir, fileName);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      zip.file(fileName, fileName === 'index.html' ? injectFirebaseConfigIntoHtml(content) : content);
    }
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="naxora-bd-${targetApp}-3files.zip"`);
  res.send(buffer);
});

// Serve generated product and hero images
app.use('/src/assets', express.static(path.join(ROOT_DIR, 'src/assets')));

const noCacheStaticOptions = {
  setHeaders(res: Response) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
  }
};

// Serve PWA manifest, service worker & icons from /public cleanly without polluting 3-file /apps/* folders
app.use(express.static(path.join(ROOT_DIR, 'public'), {
  setHeaders(res: Response, filePath: string) {
    if (filePath.endsWith('sw.js') || filePath.endsWith('.webmanifest')) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
    }
    if (filePath.endsWith('.webmanifest')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    }
  }
}));

function getPublicOrigin(req: Request): string {
  const envUrl = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl) return envUrl;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || 'nexorabd-swha.onrender.com').split(',')[0].trim();
  return `${proto}://${host}`;
}

app.get('/robots.txt', (req: Request, res: Response) => {
  const origin = getPublicOrigin(req);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /main-admin/',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`
  ].join('\n'));
});

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const origin = getPublicOrigin(req).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lastMod = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send([
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${origin}/</loc>`,
    `    <lastmod>${lastMod}</lastmod>`,
    '    <changefreq>daily</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>'
  ].join('\n'));
});

function sendAppIndexHtml(targetApp: string, res: Response, req?: Request) {
  const htmlPath = path.join(ROOT_DIR, 'apps', targetApp, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    res.status(404).send('Not found');
    return;
  }
  let html = fs.readFileSync(htmlPath, 'utf-8');
  if (targetApp === 'user' && req) {
    const origin = getPublicOrigin(req).replace(/"/g, '&quot;');
    const canonicalTags = `<link rel="canonical" href="${origin}/" />\n    <meta property="og:url" content="${origin}/" />\n`;
    html = html.replace(/<\/head>/i, () => `${canonicalTags}  </head>`);
  }
  const cfg = loadFirebaseConfig();
  if (cfg && cfg.projectId && cfg.projectId !== 'remixed-project-id') {
    const publicFbCfg = {
      apiKey: cfg.apiKey || '',
      authDomain: cfg.authDomain || '',
      projectId: cfg.projectId || '',
      storageBucket: cfg.storageBucket || '',
      messagingSenderId: cfg.messagingSenderId || '',
      appId: cfg.appId || '',
      firestoreDatabaseId: cfg.firestoreDatabaseId || '(default)'
    };
    const fbBoot = `<script>window.__NAXORA_FIREBASE_CONFIG__=${JSON.stringify(publicFbCfg).replace(/</g, '\\u003c')};</script>\n`;
    if (/<script[^>]+src=["'][^"']*app\.js["'][^>]*>/i.test(html)) {
      html = html.replace(/<script[^>]+src=["'][^"']*app\.js["'][^>]*>/i, (m) => `${fbBoot}${m}`);
    } else {
      html = html.replace(/<\/head>/i, () => `${fbBoot}</head>`);
    }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, must-revalidate');
  res.send(html);
}

app.get(['/', '/index.html', '/user', '/user/', '/user/index.html'], (req, res) => sendAppIndexHtml('user', res, req));
app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) => sendAppIndexHtml('admin', res, req));
app.get(['/main-admin', '/main-admin/', '/main-admin/index.html'], (req, res) => sendAppIndexHtml('main-admin', res, req));

// Serve the 3 isolated 3-file applications
app.use('/admin', express.static(path.join(ROOT_DIR, 'apps/admin'), noCacheStaticOptions));
app.use('/main-admin', express.static(path.join(ROOT_DIR, 'apps/main-admin'), noCacheStaticOptions));
app.use('/user', express.static(path.join(ROOT_DIR, 'apps/user'), noCacheStaticOptions));
app.use('/', express.static(path.join(ROOT_DIR, 'apps/user'), noCacheStaticOptions));

ensureDefaultSnapshots();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Naxora Bd Tri-App Server listening on http://0.0.0.0:${PORT}`);
});
