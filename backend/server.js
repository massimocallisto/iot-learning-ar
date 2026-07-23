const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const STORE_DIR = path.join(__dirname, 'storage');
const TTL_MS = Number(process.env.UPLOAD_TTL_MS || 30 * 60 * 1000);
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 80 * 1024 * 1024);
const HTTPS_KEY_PATH = String(process.env.HTTPS_KEY_PATH || '').trim();
const HTTPS_CERT_PATH = String(process.env.HTTPS_CERT_PATH || '').trim();
const HTTPS_CA_PATH = String(process.env.HTTPS_CA_PATH || '').trim();
const HTTPS_PASSPHRASE = String(process.env.HTTPS_PASSPHRASE || '');
const HTTPS_ONLY = String(process.env.HTTPS_ONLY || 'false').toLowerCase() === 'true';
const TEXTURES_DIR = path.join(__dirname, '..', 'public', 'texture');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);


app.use(express.json({ limit: MAX_BODY_BYTES }));
app.use('/textures', express.static(TEXTURES_DIR));



app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});





app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});




app.post('/api/auth/register', async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = normalizeText(body.name);
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    const validationError = validateTeacherCredentials({ name, email, password });
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const existingTeacher = db
      .prepare('SELECT id FROM teachers WHERE email = ?')
      .get(email);

    if (existingTeacher) {
      res.status(409).json({ error: 'Email gia registrata' });
      return;
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const accessCode = createUniqueTeacherAccessCode(name);

    db.prepare(`
      INSERT INTO teachers (id, name, email, password_hash, access_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, email, passwordHash, accessCode, createdAt);

    const teacher = {
      id,
      name,
      email,
      accessCode,
      createdAt
    };

    res.status(201).json({
      token: signTeacherToken(teacher),
      teacher
    });
  } catch (err) {
    next(err);
  }
});




app.post('/api/auth/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatorie' });
      return;
    }

    const teacherRow = db
      .prepare('SELECT * FROM teachers WHERE email = ?')
      .get(email);

    if (!teacherRow) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, teacherRow.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ error: 'Credenziali non valide' });
      return;
    }

    const teacher = teacherResponseFromRow(teacherRow);

    res.json({
      token: signTeacherToken(teacher),
      teacher
    });
  } catch (err) {
    next(err);
  }
});




app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ teacher: req.teacher });
});




app.get('/api/experiences', requireAuth, (req, res, next) => {
  try {
    const rows = db
      .prepare(`
        SELECT id, title, description, created_at, updated_at
        FROM experiences
        WHERE teacher_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
      .all(req.teacher.id);

    res.json({
      experiences: rows.map(experienceResponseFromRow)
    });
  } catch (err) {
    next(err);
  }
});




app.post('/api/experiences', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = normalizeText(body.title);
    const description = normalizeText(body.description);
    const glbBase64 = stripDataUrlPrefix(body.glbBase64);
    const configJson = body.configJson;

    if (!title) {
      res.status(400).json({ error: 'Titolo esperienza obbligatorio' });
      return;
    }

    if (!glbBase64) {
      res.status(400).json({ error: 'GLB esperienza obbligatorio' });
      return;
    }

    if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
      res.status(400).json({ error: 'Configurazione JSON non valida' });
      return;
    }

    const glbBuffer = Buffer.from(glbBase64, 'base64');
    if (!glbBuffer.length) {
      res.status(400).json({ error: 'GLB vuoto o base64 non valido' });
      return;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const experienceDir = experienceDirFromId(id);
    const glbFilePath = path.join(experienceDir, 'model.glb');
    const jsonFilePath = path.join(experienceDir, 'config.json');
    const relativeGlbPath = path.join('storage', 'experiences', id, 'model.glb');
    const relativeJsonPath = path.join('storage', 'experiences', id, 'config.json');

    await fsp.mkdir(experienceDir, { recursive: true });
    await Promise.all([
      fsp.writeFile(glbFilePath, glbBuffer),
      fsp.writeFile(jsonFilePath, JSON.stringify(configJson, null, 2), 'utf8')
    ]);

    db.prepare(`
      INSERT INTO experiences (
        id,
        teacher_id,
        title,
        description,
        glb_path,
        json_path,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.teacher.id,
      title,
      description,
      relativeGlbPath,
      relativeJsonPath,
      now,
      now
    );

    const row = db
      .prepare('SELECT id, title, description, created_at, updated_at FROM experiences WHERE id = ?')
      .get(id);

    res.status(201).json({ experience: experienceResponseFromRow(row) });
  } catch (err) {
    next(err);
  }
});




app.get('/api/experiences/:id', requireAuth, (req, res, next) => {
  try {
    const row = loadTeacherExperienceOrNull(req.teacher.id, req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    res.json({ experience: experienceResponseFromRow(row) });
  } catch (err) {
    next(err);
  }
});




app.get('/api/experiences/:id/glb', requireAuth, (req, res, next) => {
  try {
    const row = loadTeacherExperienceOrNull(req.teacher.id, req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    const filePath = path.join(__dirname, row.glb_path);
    streamFile(res, filePath, 'model/gltf-binary', 'model.glb', fs.statSync(filePath).size);
  } catch (err) {
    next(err);
  }
});




app.get('/api/experiences/:id/json', requireAuth, (req, res, next) => {
  try {
    const row = loadTeacherExperienceOrNull(req.teacher.id, req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    const filePath = path.join(__dirname, row.json_path);
    streamFile(res, filePath, 'application/json', 'config.json', fs.statSync(filePath).size);
  } catch (err) {
    next(err);
  }
});




app.put('/api/experiences/:id', requireAuth, async (req, res, next) => {
  try {
    const row = loadTeacherExperienceOrNull(req.teacher.id, req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    const body = req.body || {};
    const title = normalizeText(body.title);
    const description = normalizeText(body.description);
    const configJson = body.configJson;

    if (!title) {
      res.status(400).json({ error: 'Titolo esperienza obbligatorio' });
      return;
    }

    if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) {
      res.status(400).json({ error: 'Configurazione JSON non valida' });
      return;
    }

    const now = new Date().toISOString();
    await fsp.writeFile(path.join(__dirname, row.json_path), JSON.stringify(configJson, null, 2), 'utf8');

    db.prepare(`
      UPDATE experiences
      SET title = ?, description = ?, updated_at = ?
      WHERE id = ? AND teacher_id = ?
    `).run(title, description, now, req.params.id, req.teacher.id);

    const updatedRow = loadTeacherExperienceOrNull(req.teacher.id, req.params.id);
    res.json({ experience: experienceResponseFromRow(updatedRow) });
  } catch (err) {
    next(err);
  }
});




app.delete('/api/experiences/:id', requireAuth, async (req, res, next) => {
  try {
    const row = loadTeacherExperienceOrNull(req.teacher.id, req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    db.prepare('DELETE FROM experiences WHERE id = ? AND teacher_id = ?')
      .run(req.params.id, req.teacher.id);

    await fsp.rm(experienceDirFromId(req.params.id), { recursive: true, force: true });
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});




app.get('/api/public/teachers/:code/experiences', (req, res, next) => {
  try {
    const accessCode = normalizeAccessCode(req.params.code);

    if (!accessCode) {
      res.status(400).json({ error: 'Codice docente obbligatorio' });
      return;
    }

    const teacher = db
      .prepare('SELECT id, name, access_code, created_at FROM teachers WHERE access_code = ?')
      .get(accessCode);

    if (!teacher) {
      res.status(404).json({ error: 'Codice docente non trovato' });
      return;
    }

    const rows = db
      .prepare(`
        SELECT id, title, description, created_at, updated_at
        FROM experiences
        WHERE teacher_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `)
      .all(teacher.id);

    res.json({
      teacher: {
        name: teacher.name,
        accessCode: teacher.access_code
      },
      experiences: rows.map(experienceResponseFromRow)
    });
  } catch (err) {
    next(err);
  }
});




app.get('/api/public/experiences/:id/glb', (req, res, next) => {
  try {
    const row = loadExperienceOrNull(req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    const filePath = path.join(__dirname, row.glb_path);
    streamFile(res, filePath, 'model/gltf-binary', 'model.glb', fs.statSync(filePath).size);
  } catch (err) {
    next(err);
  }
});




app.get('/api/public/experiences/:id/json', (req, res, next) => {
  try {
    const row = loadExperienceOrNull(req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Esperienza non trovata' });
      return;
    }

    const filePath = path.join(__dirname, row.json_path);
    streamFile(res, filePath, 'application/json', 'config.json', fs.statSync(filePath).size);
  } catch (err) {
    next(err);
  }
});




app.post('/api/uploads', async (req, res, next) => {
  try {
    const body = req.body || {};

    const glbBase64 = stripDataUrlPrefix(body.glbBase64);
    const jsonBase64 = stripDataUrlPrefix(body.jsonBase64);

    if (!glbBase64 || !jsonBase64) {
      res.status(400).json({
        error: 'Campi richiesti mancanti: glbBase64 e jsonBase64'
      });
      return;
    }

    const glbBuffer = Buffer.from(glbBase64, 'base64');
    const jsonBuffer = Buffer.from(jsonBase64, 'base64');

    if (!glbBuffer.length || !jsonBuffer.length) {
      res.status(400).json({ error: 'File vuoti o base64 non valido' });
      return;
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = getExpirationIso();

    const dir = uploadDirFromId(id);
    const glbFilePath = path.join(dir, 'model.glb');
    const jsonFilePath = path.join(dir, 'config.json');

    const glbName = sanitizeFilename(body.glbName, 'model.glb');
    const jsonName = sanitizeFilename(body.jsonName, 'config.json');
    const glbMime = String(body.glbMime || 'model/gltf-binary');
    const jsonMime = String(body.jsonMime || 'application/json');

    await fsp.mkdir(dir, { recursive: true });

    await Promise.all([
      fsp.writeFile(glbFilePath, glbBuffer),
      fsp.writeFile(jsonFilePath, jsonBuffer)
    ]);

    const meta = {
      id,
      createdAt,
      expiresAt,
      glb: {
        storedAs: 'model.glb',
        originalName: glbName,
        mime: glbMime,
        size: glbBuffer.length
      },
      json: {
        storedAs: 'config.json',
        originalName: jsonName,
        mime: jsonMime,
        size: jsonBuffer.length
      }
    };

    await fsp.writeFile(metaPathFromId(id), JSON.stringify(meta, null, 2), 'utf8');
    res.status(201).json(buildPayloadResponse(req, meta));
  } catch (err) {
    next(err);
  }
});

app.post('/api/upload', async (req, res, next) => {
  try{
    const body = req.body || {};

    const glbBase64 = stripDataUrlPrefix(body.glbBase64);

    if(!glbBase64){
      res.status(400).json({
        error: 'Campo richiesto mancante: glbBase64'
      });
      return;
    }

    const glbBuffer = Buffer.from(glbBase64, 'base64');

    if(!glbBuffer.length){
      res.status(400).json({ error: 'File vuoto o base64 non valido'});
      return;
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = getExpirationIso();

    const dir = uploadDirFromId(id);
    const glbFilePath = path.join(dir, 'model.glb');

    const glbName = sanitizeFilename(body.glbName, 'model.glb');
    const glbMime = String(body.glbMime || 'model/gltf-binary');

    await fsp.mkdir(dir, { recursive: true});

    await Promise.all([
      fsp.writeFile(glbFilePath, glbBuffer)
    ]);

    const meta = {
      id,
      createdAt,
      expiresAt,
      glb:{
        storedAs: 'model.glb',
        originalName: glbName,
        mime: glbMime,
        size: glbBuffer.length
      }
    };

    await fsp.writeFile(metaPathFromId(id), JSON.stringify(meta, null, 2), 'utf8');
    res.status(201).json(buildPayloadResponseGlb(req, meta));

  }catch(err){
    next(err);
  }
})








app.get('/api/uploads/:id', async (req, res, next) => {
  try {
    const meta = await loadMetaOrNull(req.params.id);
    if (!meta) {
      res.status(404).json({ error: 'Upload non trovato' });
      return;
    }

    res.json(buildPayloadResponse(req, meta));
  } catch (err) {
    next(err);
  }
});




app.get('/api/uploads/:id/glb', async (req, res, next) => {
  try {
    const meta = await loadMetaOrNull(req.params.id);
    if (!meta) {
      res.status(404).json({ error: 'Upload non trovato' });
      return;
    }

    const filePath = path.join(uploadDirFromId(req.params.id), meta.glb.storedAs);
    streamFile(res, filePath, meta.glb.mime, meta.glb.originalName, meta.glb.size);
  } catch (err) {
    next(err);
  }
});



app.get('/api/uploads/:id/json', async (req, res, next) => {
  try {
    const meta = await loadMetaOrNull(req.params.id);
    if (!meta) {
      res.status(404).json({ error: 'Upload non trovato' });
      return;
    }

    const filePath = path.join(uploadDirFromId(req.params.id), meta.json.storedAs);
    streamFile(res, filePath, meta.json.mime, meta.json.originalName, meta.json.size);
  } catch (err) {
    next(err);
  }
});



app.delete('/api/uploads/:id', async (req, res, next) => {
  try {
    await deleteUpload(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});



app.get('/api/textures', async (req, res, next) => {
  try {
    const entries = await fsp.readdir(TEXTURES_DIR, { withFileTypes: true });

    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    const textures = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => allowedExt.has(path.extname(fileName).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((fileName) => ({
        name: prettifyTextureName(fileName),
        preview: `/textures/${encodeURIComponent(fileName)}`,
        value: `texture/${encodeURIComponent(fileName)}`,
        type: 'texture'
      }));

    res.json(textures);
  } catch (err) {
    next(err);
  }
});




app.use((req, res) => {
  res.status(404).json({ error: 'Route non trovata' });
});




app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Body JSON non valido' });
    return;
  }

  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload troppo grande' });
    return;
  }

  const statusCode = err?.statusCode || 500;
  res.status(statusCode).json({ error: err?.message || 'Errore interno server' });
});
















function sanitizeFilename(filename, fallback) {
  const base = path.basename(String(filename || fallback));
  const safe = base.replace(/[^\w.-]/g, '_');
  return safe || fallback;
}




function stripDataUrlPrefix(value) {
  if (typeof value !== 'string') return '';
  if (!value.startsWith('data:')) return value;
  const idx = value.indexOf(',');
  return idx >= 0 ? value.slice(idx + 1) : '';
}



function getExpirationIso() {
  return new Date(Date.now() + TTL_MS).toISOString();
}



function uploadDirFromId(id) {
  return path.join(STORE_DIR, id);
}


function experienceDirFromId(id) {
  return path.join(STORE_DIR, 'experiences', id);
}




function metaPathFromId(id) {
  return path.join(uploadDirFromId(id), 'meta.json');
}





function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${proto}://${req.get('host')}`;
}





function buildPayloadResponse(req, meta) {
  const base = getBaseUrl(req);
  return {
    id: meta.id,
    createdAt: meta.createdAt,
    expiresAt: meta.expiresAt,
    glbUrl: `${base}/api/uploads/${meta.id}/glb`,
    jsonUrl: `${base}/api/uploads/${meta.id}/json`
  };
}


function buildPayloadResponseGlb(req, meta){
  const base = getBaseUrl(req);

  return{
    id: meta.id,
    createdAt: meta.createdAt,
    expiresAt: meta.expiresAt,
    glbUrl: `${base}/api/uploads/${meta.id}/glb`
  };
}



function isExpired(expiresAt) {
  return Date.now() > new Date(expiresAt).getTime();
}




async function ensureStoreDir() {
  await fsp.mkdir(STORE_DIR, { recursive: true });
}




async function readUploadMeta(id) {
  const raw = await fsp.readFile(metaPathFromId(id), 'utf8');
  return JSON.parse(raw);
}




async function deleteUpload(id) {
  await fsp.rm(uploadDirFromId(id), { recursive: true, force: true });
}






async function loadMetaOrNull(id) {
  try {
    const meta = await readUploadMeta(id);
    if (isExpired(meta.expiresAt)) {
      await deleteUpload(id);
      return null;
    }
    return meta;
  } catch {
    return null;
  }
}






async function cleanupExpiredUploads() {
  let entries;

  try {
    entries = await fsp.readdir(STORE_DIR, { withFileTypes: true });
  } catch {
    return;
  }

  const now = Date.now();

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => entry.name !== 'experiences')
      .map(async (entry) => {
        try {
          const meta = await readUploadMeta(entry.name);
          const exp = new Date(meta.expiresAt).getTime();
          if (Number.isFinite(exp) && exp <= now) {
            await deleteUpload(entry.name);
          }
        } catch {
          await deleteUpload(entry.name);
        }
      })
  );
}






function streamFile(res, filePath, mime, filename, size) {
  const encodedName = String(filename || '').replace(/"/g, '');

  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Length', String(size));
  res.setHeader('Content-Disposition', `inline; filename="${encodedName}"`);

  const rs = fs.createReadStream(filePath);

  rs.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Errore streaming file' });
    } else {
      res.destroy();
    }
  });

  rs.pipe(res);
}


function requireAuth(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const [type, token] = authHeader.split(' ');

  if (type !== 'Bearer' || !token) {
    res.status(401).json({ error: 'Token mancante' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const teacherRow = db
      .prepare('SELECT * FROM teachers WHERE id = ?')
      .get(payload.sub);

    if (!teacherRow) {
      res.status(401).json({ error: 'Token non valido' });
      return;
    }

    req.teacher = teacherResponseFromRow(teacherRow);
    next();
  } catch {
    res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}


function signTeacherToken(teacher) {
  return jwt.sign(
    {
      email: teacher.email,
      accessCode: teacher.accessCode
    },
    JWT_SECRET,
    {
      subject: teacher.id,
      expiresIn: JWT_EXPIRES_IN
    }
  );
}


function teacherResponseFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    accessCode: row.access_code,
    createdAt: row.created_at
  };
}


function experienceResponseFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}


function loadTeacherExperienceOrNull(teacherId, experienceId) {
  return db
    .prepare(`
      SELECT id, teacher_id, title, description, glb_path, json_path, created_at, updated_at
      FROM experiences
      WHERE id = ? AND teacher_id = ?
    `)
    .get(experienceId, teacherId) || null;
}


function loadExperienceOrNull(experienceId) {
  return db
    .prepare(`
      SELECT id, teacher_id, title, description, glb_path, json_path, created_at, updated_at
      FROM experiences
      WHERE id = ?
    `)
    .get(experienceId) || null;
}


function validateTeacherCredentials({ name, email, password }) {
  if (!name) return 'Nome docente obbligatorio';
  if (name.length < 2) return 'Il nome docente deve contenere almeno 2 caratteri';
  if (!email) return 'Email obbligatoria';
  if (!isValidEmail(email)) return 'Email non valida';
  if (!password) return 'Password obbligatoria';
  if (password.length < 8) return 'La password deve contenere almeno 8 caratteri';
  return '';
}


function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}


function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}


function normalizeAccessCode(value) {
  return String(value || '').trim().toUpperCase();
}


function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}


function createUniqueTeacherAccessCode(name) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = createTeacherAccessCode(name);
    const existing = db
      .prepare('SELECT id FROM teachers WHERE access_code = ?')
      .get(code);

    if (!existing) return code;
  }

  throw new Error('Impossibile generare un codice docente univoco');
}


function createTeacherAccessCode(name) {
  const prefix = normalizeAccessCodePrefix(name);
  return `${prefix}-${randomAccessCodeSuffix(4)}`;
}


function normalizeAccessCodePrefix(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return (normalized || 'DOC').slice(0, 8);
}


function randomAccessCodeSuffix(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = '';

  for (let i = 0; i < length; i++) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}


async function createHttpServer() {
  const hasKey = Boolean(HTTPS_KEY_PATH);
  const hasCert = Boolean(HTTPS_CERT_PATH);

  if (hasKey !== hasCert) {
    throw new Error('Configurazione HTTPS non valida: imposta sia HTTPS_KEY_PATH che HTTPS_CERT_PATH');
  }

  if (!hasKey && !hasCert) {
    if (HTTPS_ONLY) {
      throw new Error('HTTPS_ONLY=true ma mancano HTTPS_KEY_PATH e HTTPS_CERT_PATH');
    }

    return {
      protocol: 'http',
      server: http.createServer(app)
    };
  }

  const keyPath = path.resolve(process.cwd(), HTTPS_KEY_PATH);
  const certPath = path.resolve(process.cwd(), HTTPS_CERT_PATH);
  const caPath = HTTPS_CA_PATH ? path.resolve(process.cwd(), HTTPS_CA_PATH) : '';

  const [key, cert, ca] = await Promise.all([
    fsp.readFile(keyPath),
    fsp.readFile(certPath),
    caPath ? fsp.readFile(caPath) : Promise.resolve(undefined)
  ]);

  const tlsOptions = { key, cert };
  if (ca) tlsOptions.ca = ca;
  if (HTTPS_PASSPHRASE) tlsOptions.passphrase = HTTPS_PASSPHRASE;

  return {
    protocol: 'https',
    server: https.createServer(tlsOptions, app)
  };
}



function prettifyTextureName(fileName) {
  const base = path.parse(fileName).name;
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}











async function main() {
  await ensureStoreDir();
  await cleanupExpiredUploads();

  setInterval(() => {
    cleanupExpiredUploads().catch((err) => {
      console.error('[cleanup]', err);
    });
  }, 5 * 60 * 1000).unref();

  const { protocol, server } = await createHttpServer();

  server.listen(PORT, HOST, () => {
    console.log(`[backend] listening on ${protocol}://${HOST}:${PORT}`);
  });
}



main().catch((err) => {
  console.error('[startup]', err);
  process.exit(1);
});
