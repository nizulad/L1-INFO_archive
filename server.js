const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Script A is our single source of truth.
const SCRIPT_A_URL = "https://script.google.com/macros/s/AKfycbypxihf4QomArfv1XR3u_0OjGZN-HxVmyujEjkGnHSRdZ9yFvOQAFobMC_1LGtcg24aEw/exec";

let GLOBAL_FILE_CACHE = {};
let isSyncing = false;

async function syncCacheFromGoogle() {
    if (isSyncing) return;
    isSyncing = true;
    console.log(`[${new Date().toISOString()}] Background worker active: Fetching Master Payload in a single request...`);

    try {
        // Fetching without a code query parameter tells the script to bundle everything
        const res = await fetch(SCRIPT_A_URL);
        const result = await res.json();

        if (result && result.status === 'ok' && result.masterData) {
            GLOBAL_FILE_CACHE = result.masterData;
            console.log(`[${new Date().toISOString()}] Master sync complete. All paths cached smoothly from a single batch response.`);
        } else {
            console.error("Sync payload error:", result ? result.message : "Empty response");
        }
    } catch (err) {
        console.error("Sync error:", err.message);
    } finally {
        isSyncing = false;
    }
}

// Background Automator (Runs rarely: Once every 12 hours)
setInterval(async () => {
    await syncCacheFromGoogle();
}, 12 * 60 * 60 * 1000);

app.use(express.static('public'));

// Delivers full file metadata and links instantly from local cache
app.get('/api/files', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ status: "error", message: "Missing path parameter code." });

    // Fallback if the initial boot fetch hasn't finished yet
    if (Object.keys(GLOBAL_FILE_CACHE).length === 0) {
        await syncCacheFromGoogle();
    }

    const files = GLOBAL_FILE_CACHE[code];
    if (!files) return res.json({ status: "empty", files: [] });

    return res.json({ status: "ok", files: files });
});

app.listen(PORT, () => {
    console.log(`Server executing operations successfully on port ${PORT}`);
    syncCacheFromGoogle(); // Immediate seed on boot
});
