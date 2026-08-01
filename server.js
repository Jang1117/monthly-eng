const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const boards = {
  main: { redisKey: 'events', dataFile: path.join(__dirname, 'data', 'events.json') },
  family: { redisKey: 'events_family', dataFile: path.join(__dirname, 'data', 'family-events.json') },
};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

async function readEventsFromFile(dataFile) {
  try {
    const txt = await fs.readFile(dataFile, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function writeEventsToFile(dataFile, events) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(events, null, 2), 'utf8');
}

async function readEventsFromRedis(redisKey) {
  const res = await fetch(`${UPSTASH_URL}/get/${redisKey}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Upstash GET failed: ${res.status}`);
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : [];
}

async function writeEventsToRedis(redisKey, events) {
  const res = await fetch(`${UPSTASH_URL}/set/${redisKey}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(events),
  });
  if (!res.ok) throw new Error(`Upstash SET failed: ${res.status}`);
}

async function readEvents(board) {
  return useRedis ? readEventsFromRedis(board.redisKey) : readEventsFromFile(board.dataFile);
}

async function writeEvents(board, events) {
  return useRedis ? writeEventsToRedis(board.redisKey, events) : writeEventsToFile(board.dataFile, events);
}

function makeEventsRouter(board) {
  const router = express.Router();

  router.get('/events', async (req, res) => {
    const events = await readEvents(board);
    res.json(events);
  });

  router.post('/events', async (req, res) => {
    const ev = req.body;
    const events = await readEvents(board);
    ev.id = Date.now().toString();
    events.push(ev);
    await writeEvents(board, events);
    res.json(ev);
  });

  router.put('/events/:id', async (req, res) => {
    const id = req.params.id;
    const update = req.body;
    let events = await readEvents(board);
    events = events.map(ev => (ev.id === id ? { ...ev, ...update, id } : ev));
    await writeEvents(board, events);
    res.json({ ok: true });
  });

  router.delete('/events/:id', async (req, res) => {
    const id = req.params.id;
    let events = await readEvents(board);
    events = events.filter(ev => ev.id !== id);
    await writeEvents(board, events);
    res.json({ ok: true });
  });

  return router;
}

app.use('/', makeEventsRouter(boards.main));
app.use('/family', makeEventsRouter(boards.family));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Storage backend: ${useRedis ? 'Upstash Redis' : 'local file (data/*.json)'}`);
});
