const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const DATA_DIRECTORY = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = process.env.AUTH_STORE_PATH || path.join(DATA_DIRECTORY, 'auth-store.json');
const SESSION_COOKIE_NAME = 'meetspace_session';
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_DERIVED_BYTES = 64;
let writeQueue = Promise.resolve();

const emptyStore = () => ({ users: [], sessions: {} });

async function loadStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
    if (!Array.isArray(parsed.users) || !parsed.sessions || typeof parsed.sessions !== 'object') {
      throw new Error('The authentication store has an invalid structure.');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyStore();
    throw error;
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true, mode: 0o700 });
  const temporaryPath = `${STORE_PATH}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    await fs.writeFile(temporaryPath, JSON.stringify(store), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await fs.rename(temporaryPath, STORE_PATH);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function updateStore(update) {
  const operation = writeQueue.then(async () => {
    const store = await loadStore();
    const result = await update(store);
    await saveStore(store);
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

async function initialize() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true, mode: 0o700 });
  await loadStore();
}

function getPublicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_DERIVED_BYTES, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, cost, blockSize, parallelization, saltValue, keyValue] = storedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    cost !== '16384' ||
    blockSize !== '8' ||
    parallelization !== '1' ||
    !saltValue ||
    !keyValue
  ) {
    return false;
  }

  const salt = Buffer.from(saltValue, 'base64url');
  const expectedKey = Buffer.from(keyValue, 'base64url');
  if (salt.length !== 16 || expectedKey.length !== PASSWORD_DERIVED_BYTES) return false;

  const derivedKey = await scrypt(password, salt, expectedKey.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
    maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(derivedKey, expectedKey);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

async function register(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    displayName: normalizedEmail.split('@')[0].slice(0, 40) || 'MeetSpace user',
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await updateStore((store) => {
    if (store.users.some((existingUser) => existingUser.email === normalizedEmail)) {
      const error = new Error('An account with this email already exists. Sign in instead.');
      error.code = 'EMAIL_IN_USE';
      throw error;
    }
    store.users.push(user);
  });

  return getPublicUser(user);
}

async function login(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const store = await loadStore();
  const user = store.users.find((entry) => entry.email === normalizedEmail);
  const dummyHash = `scrypt$16384$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(PASSWORD_DERIVED_BYTES).toString('base64url')}`;
  const isPasswordValid = await verifyPassword(password, user?.passwordHash || dummyHash);
  if (!user || !isPasswordValid) return null;

  return getPublicUser(user);
}

async function createSession(userId) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = Date.now() + SESSION_LIFETIME_MS;

  await updateStore((store) => {
    for (const [storedHash, session] of Object.entries(store.sessions)) {
      if (session.expiresAt <= Date.now()) delete store.sessions[storedHash];
    }
    store.sessions[tokenHash] = { userId, expiresAt };
  });

  return { token, expiresAt };
}

async function getSessionUser(token) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const store = await loadStore();
  const session = store.sessions[tokenHash];
  if (!session || session.expiresAt <= Date.now()) return null;

  const user = store.users.find((entry) => entry.id === session.userId);
  return user ? { ...getPublicUser(user), expiresAt: session.expiresAt } : null;
}

async function revokeSession(token) {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  return updateStore((store) => {
    const session = store.sessions[tokenHash];
    delete store.sessions[tokenHash];
    return session?.userId || null;
  });
}

function getCookieToken(cookieHeader = '') {
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) =>
    part.startsWith(`${SESSION_COOKIE_NAME}=`)
  );
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(SESSION_COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
}

function setSessionCookie(res, token, req) {
  const secure =
    process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}`,
  ];
  if (secure) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

function clearSessionCookie(res, req) {
  const secure =
    process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https';
  const attributes = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attributes.push('Secure');
  res.setHeader('Set-Cookie', attributes.join('; '));
}

module.exports = {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSession,
  getCookieToken,
  getSessionUser,
  initialize,
  login,
  register,
  revokeSession,
  setSessionCookie,
};
