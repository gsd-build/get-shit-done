const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize data file
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({
            weightData: [],
            workoutData: [],
            goals: { start: null, goal: null },
            whatsappConfig: { phone: '', apiKey: '' }
        }, null, 2));
    }
}

// Read data
function readData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        return {
            weightData: [],
            workoutData: [],
            goals: { start: null, goal: null },
            whatsappConfig: { phone: '', apiKey: '' }
        };
    }
}

// Write data
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Send WhatsApp message via CallMeBot
function sendWhatsAppMessage(phone, apiKey, message) {
    return new Promise((resolve, reject) => {
        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`[${new Date().toISOString()}] WhatsApp message sent successfully`);
                    resolve({ success: true });
                } else {
                    console.error(`[${new Date().toISOString()}] WhatsApp API error: ${res.statusCode}`);
                    reject(new Error(`API returned status ${res.statusCode}`));
                }
            });
        }).on('error', (err) => {
            console.error(`[${new Date().toISOString()}] WhatsApp send error:`, err.message);
            reject(err);
        });
    });
}

// Check if workout reminder needed (no workout in 2 days)
function checkWorkoutReminder() {
    const data = readData();
    const { workoutData, whatsappConfig } = data;

    if (!whatsappConfig.phone || !whatsappConfig.apiKey) {
        console.log(`[${new Date().toISOString()}] WhatsApp not configured, skipping workout reminder`);
        return;
    }

    if (workoutData.length === 0) {
        console.log(`[${new Date().toISOString()}] No workout data, skipping reminder`);
        return;
    }

    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const recentWorkouts = workoutData.filter(w => new Date(w.date) >= twoDaysAgo);

    if (recentWorkouts.length === 0) {
        const message = `🏋️ Weight Loss Tracker Reminder!\n\nYou haven't logged a workout in 2+ days! Time to get moving!\n\nStay consistent to reach your goals! 💪`;

        sendWhatsAppMessage(whatsappConfig.phone, whatsappConfig.apiKey, message)
            .then(() => console.log(`[${new Date().toISOString()}] Workout reminder sent`))
            .catch(err => console.error(`[${new Date().toISOString()}] Failed to send workout reminder:`, err.message));
    } else {
        console.log(`[${new Date().toISOString()}] Recent workout found, no reminder needed`);
    }
}

// Send Sunday weight update
function sendSundayWeightUpdate() {
    const data = readData();
    const { weightData, goals, whatsappConfig } = data;

    if (!whatsappConfig.phone || !whatsappConfig.apiKey) {
        console.log(`[${new Date().toISOString()}] WhatsApp not configured, skipping Sunday update`);
        return;
    }

    if (weightData.length === 0) {
        console.log(`[${new Date().toISOString()}] No weight data, skipping Sunday update`);
        return;
    }

    // Get current weight (most recent entry)
    const sortedWeights = [...weightData].sort((a, b) => new Date(b.date) - new Date(a.date));
    const currentWeight = sortedWeights[0].weight;
    const currentDate = sortedWeights[0].date;

    // Get weight from last week if available
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastWeekWeight = sortedWeights.find(w => new Date(w.date) <= oneWeekAgo);

    let weeklyChange = '';
    if (lastWeekWeight) {
        const change = currentWeight - lastWeekWeight.weight;
        if (change < 0) {
            weeklyChange = `\n📉 Weekly change: ${change.toFixed(1)} lbs (Lost!)`;
        } else if (change > 0) {
            weeklyChange = `\n📈 Weekly change: +${change.toFixed(1)} lbs`;
        } else {
            weeklyChange = `\n➡️ Weekly change: No change`;
        }
    }

    let goalProgress = '';
    if (goals.start && goals.goal) {
        const totalLost = goals.start - currentWeight;
        const totalToLose = goals.start - goals.goal;
        const percentComplete = totalToLose > 0 ? Math.min((totalLost / totalToLose) * 100, 100) : 0;

        if (percentComplete >= 100) {
            goalProgress = `\n🎉 GOAL REACHED! You did it!`;
        } else {
            goalProgress = `\n🎯 Progress: ${percentComplete.toFixed(1)}% to goal (${goals.goal} lbs)`;
        }
    }

    const message = `📊 Weekly Weight Update\n\n` +
        `Current weight: ${currentWeight} lbs` +
        `${weeklyChange}` +
        `${goalProgress}\n\n` +
        `Keep up the great work! 💪`;

    sendWhatsAppMessage(whatsappConfig.phone, whatsappConfig.apiKey, message)
        .then(() => console.log(`[${new Date().toISOString()}] Sunday weight update sent`))
        .catch(err => console.error(`[${new Date().toISOString()}] Failed to send Sunday update:`, err.message));
}

// Scheduled checks
function runScheduledChecks() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const hour = now.getHours();

    console.log(`[${now.toISOString()}] Running scheduled checks (Day: ${day}, Hour: ${hour})`);

    // Check workout reminder daily at 9 AM
    if (hour === 9) {
        checkWorkoutReminder();
    }

    // Send Sunday weight update at 10 AM
    if (day === 0 && hour === 10) {
        sendSundayWeightUpdate();
    }
}

// Parse JSON body
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

// Serve static files
function serveStatic(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = req.url.split('?')[0];

    // API Routes
    if (url === '/api/sync' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            writeData(body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (url === '/api/data' && req.method === 'GET') {
        const data = readData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
    }

    if (url === '/api/test-whatsapp' && req.method === 'POST') {
        try {
            const { phone, apiKey } = await parseBody(req);
            await sendWhatsAppMessage(phone, apiKey, '✅ Weight Loss Tracker: Test message successful! Your notifications are working.');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
        return;
    }

    if (url === '/api/send-workout-reminder' && req.method === 'POST') {
        checkWorkoutReminder();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Workout reminder check triggered' }));
        return;
    }

    if (url === '/api/send-weight-update' && req.method === 'POST') {
        sendSundayWeightUpdate();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Weight update triggered' }));
        return;
    }

    // Serve static files
    if (url === '/' || url === '/index.html') {
        serveStatic(res, path.join(__dirname, 'index.html'), 'text/html');
        return;
    }

    // 404
    res.writeHead(404);
    res.end('Not found');
});

// Initialize and start
initDataFile();

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║         Weight Loss Tracker Server Started!                 ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                   ║
║                                                            ║
║  Features:                                                 ║
║  • Web app served at root (/)                              ║
║  • Data sync endpoint (/api/sync)                          ║
║  • WhatsApp test (/api/test-whatsapp)                      ║
║  • Manual workout reminder (/api/send-workout-reminder)    ║
║  • Manual weight update (/api/send-weight-update)          ║
║                                                            ║
║  Scheduled notifications:                                  ║
║  • Workout reminders: Daily at 9 AM (if no workout in 2d)  ║
║  • Weight updates: Every Sunday at 10 AM                   ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Run scheduled checks every hour
setInterval(runScheduledChecks, 60 * 60 * 1000);

// Also run once at startup after a short delay
setTimeout(runScheduledChecks, 5000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
