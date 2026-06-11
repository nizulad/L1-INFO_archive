const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Script A is now our single source of truth. Script B is no longer needed.
const SCRIPT_A_URL = "https://script.google.com/macros/s/AKfycbx_PGm2jt7RSIhHUkWhKtJG0Y6n3RVblCBAJB3iSRxQzQZzSmoGiRN9zPvaFLAf7P3w-A/exec";

let GLOBAL_FILE_CACHE = {};
let isSyncing = false;

async function syncCacheFromGoogle() {
    if (isSyncing) return;
    isSyncing = true;
    console.log(`[${new Date().toISOString()}] Background worker active: Fetching file lists & links...`);

    try {
        const tempCache = {};
        const queue = [];

        const semList = [1, 2];
        const subjectsPerSem = { 1: [1,2,3,4,5,6,7], 2: [1,2,3,4,5,6,7,8] };
        const optionsPerType = { 'A': [1, 2, 3], 'B': [1, 2, 3, 4], 'C': [1, 2] };
        const subTypes = {
            1: { 1:'A', 2:'A', 3:'B', 4:'A', 5:'A', 6:'C', 7:'C' },
            2: { 1:'A', 2:'A', 3:'B', 4:'A', 5:'A', 6:'A', 7:'B', 8:'C' }
        };

        for (const sem of semList) {
            for (const sub of subjectsPerSem[sem]) {
                const type = subTypes[sem][sub];
                for (const opt of optionsPerType[type]) {
                    if ((type === 'A' && opt !== 3) || (type === 'B' && opt !== 4) || (type === 'C' && opt !== 2)) {
                        queue.push(`${sem}.${sub}.${opt}`);
                    } else {
                        const totalExamSubfolders = type === 'B' ? [1,2,3,4] : [1,2,3];
                        for (const exType of totalExamSubfolders) {
                            queue.push(`${sem}.${sub}.${opt}.${exType}`);
                        }
                    }
                }
            }
        }

        const results = await Promise.all(
            queue.map(async (code) => {
                try {
                    const res = await fetch(`${SCRIPT_A_URL}?code=${encodeURIComponent(code)}`);
                    const data = await res.json();
                    return { code, data };
                } catch (e) {
                    return { code, data: null };
                }
            })
        );

        for (const item of results) {
            if (item.data && item.data.status === 'ok') {
                tempCache[item.code] = item.data.files; 
            }
        }

        GLOBAL_FILE_CACHE = tempCache;
        console.log(`[${new Date().toISOString()}] Master sync complete. Names & Links cached smoothly.`);
    } catch (err) {
        console.error("Sync error:", err.message);
    } finally {
        isSyncing = false;
    }
}

// Background Automator (250s Heartbeat Loop)
setInterval(async () => {
    await syncCacheFromGoogle();
}, 250 * 1000);

app.use(express.static('public'));

// Delivers full file metadata and links instantly in O(1) space runtime
app.get('/api/files', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ status: "error", message: "Missing path parameter code." });

    if (Object.keys(GLOBAL_FILE_CACHE).length === 0) {
        await syncCacheFromGoogle();
    }

    const files = GLOBAL_FILE_CACHE[code];
    if (!files) return res.json({ status: "empty", files: [] });

    return res.json({ status: "ok", files: files });
});

app.listen(PORT, () => {
    console.log(`Server executing operations successfully on port ${PORT}`);
    syncCacheFromGoogle();
});
