const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Your exact Apps Script targets
const SCRIPT_A_URL = "https://script.google.com/macros/s/AKfycbx_PGm2jt7RSIhHUkWhKtJG0Y6n3RVblCBAJB3iSRxQzQZzSmoGiRN9zPvaFLAf7P3w-A/exec";
const SCRIPT_B_URL = "https://script.google.com/macros/s/AKfycbzyT12oT4XVy9tOd-A1KE7ppiiB9qz4HWPFrfplJX3Yj3uL4br_g9coWgCofTJ_hXt8/exec";

// This is the memory container that saves all file lists, links, names, and metadata
let GLOBAL_FILE_CACHE = {}; 

/**
 * 1. The Core Synchronizer Function
 * This maps out all possible path codes and stores the responses directly in memory.
 */
async function syncCacheFromGoogle() {
    console.log(`[${new Date().toISOString()}] Background worker active: Fetching fresh directory data...`);

    const tempCache = {};
    const queue = [];

    // All structural coordinate boundaries 
    const semList = [1, 2];
    const subjectsPerSem = { 1: [1,2,3,4,5,6,7], 2: [1,2,3,4,5,6,7,8] };
    const optionsPerType = { 'A': [1, 2, 3], 'B': [1, 2, 3, 4], 'C': [1, 2] };
    const subTypes = {
        1: { 1:'A', 2:'A', 3:'B', 4:'A', 5:'A', 6:'C', 7:'C' },
        2: { 1:'A', 2:'A', 3:'B', 4:'A', 5:'A', 6:'A', 7:'B', 8:'C' }
    };

    // Build the collection of string codes (e.g., "1.1.1", "1.3.4.1")
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

    // Download data for every code from Google Apps Script
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

    // Save everything (file name, links, index positions) straight into our global memory object
    for (const item of results) {
        if (item.data && item.data.status === 'ok') {
            tempCache[item.code] = item.data.files; // Array of file objects
        }
    }

    // Overwrite the old cache with the freshly grabbed data
    GLOBAL_FILE_CACHE = tempCache;
    console.log(`[${new Date().toISOString()}] Local database memory refreshed. Sleeping...`);
}

// ══════════════════════════════════════════════
//  2. AUTOMATION TIMER (Runs every 250 seconds)
// ══════════════════════════════════════════════
setInterval(async () => {
    await syncCacheFromGoogle();
}, 250 * 1000);


// ══════════════════════════════════════════════
//  3. NETWORK ENDPOINTS & SERVICES
// ══════════════════════════════════════════════

// Serve front-end files out of the 'public' folder layout automatically
app.use(express.static('public'));

// Route to get file metadata list instantly from the local server memory map
app.get('/api/files', (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ status: "error", message: "Missing path parameter code." });

    const files = GLOBAL_FILE_CACHE[code];
    if (!files) {
        return res.json({ status: "empty", files: [] });
    }

    // Responds in O(1) time because it reads straight out of RAM memory instantly!
    return res.json({ status: "ok", files: files });
});

// Route to proxy individual secure file redirects through Script B
app.get('/api/link', async (req, res) => {
    const { code, index } = req.query;
    if (!code || index === undefined) return res.status(400).json({ status: "error", message: "Incomplete specs." });

    try {
        const response = await fetch(`${SCRIPT_B_URL}?code=${encodeURIComponent(code)}&index=${index}`);
        const data = await response.json();
        return res.json(data);
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Proxy link failure." });
    }
});

// Run the server setup
app.listen(PORT, () => {
    console.log(`Server active on port ${PORT}`);
    // Run an initial download cycle immediately upon launching so memory isn't empty on boot
    syncCacheFromGoogle();
});
;

