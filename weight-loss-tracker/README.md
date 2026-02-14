# Weight Loss Tracker

A comprehensive weight loss and workout tracking app with WhatsApp notifications.

## Features

- **Weight Tracking**: Log daily weight with visual progress charts
- **Workout Logging**: Track workouts with type, duration, and notes
- **Goal Setting**: Set starting weight and goal weight
- **Progress Stats**: See total lost, weekly workouts, and streaks
- **WhatsApp Notifications**:
  - Reminder if you haven't worked out in 2 days (daily at 9 AM)
  - Weekly weight update every Sunday at 10 AM
- **Data Export**: Export all data as CSV
- **Data Persistence**: Saves to browser localStorage and server

## Quick Start

### Option 1: Static HTML Only (No notifications)

Simply open `index.html` in your browser. Your data will be saved in localStorage.

### Option 2: With Server (Enables WhatsApp notifications)

1. Start the server:
   ```bash
   cd weight-loss-tracker
   npm start
   ```

2. Open http://localhost:3000 in your browser

3. Configure WhatsApp notifications (see below)

## WhatsApp Setup (Free via CallMeBot)

1. Add the CallMeBot number to your contacts: **+34 644 51 95 23**

2. Send this exact message to that number on WhatsApp:
   ```
   I allow callmebot to send me messages
   ```

3. You'll receive a response with your API key

4. In the app, enter:
   - Your phone number (with country code, e.g., +12025551234)
   - Your API key from CallMeBot

5. Click "Save WhatsApp Settings"

6. Click "Send Test Message" to verify it works

## Notification Schedule

| Notification | When | Condition |
|--------------|------|-----------|
| Workout Reminder | Daily at 9 AM | No workout logged in past 2 days |
| Weight Update | Sundays at 10 AM | Always (if weight data exists) |

## Running as a Background Service

To keep the server running and send scheduled notifications:

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start the server
pm2 start server.js --name weight-tracker

# Auto-start on system boot
pm2 startup
pm2 save
```

### Using systemd (Linux)

Create `/etc/systemd/system/weight-tracker.service`:

```ini
[Unit]
Description=Weight Loss Tracker
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/weight-loss-tracker
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable weight-tracker
sudo systemctl start weight-tracker
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve the web app |
| `/api/sync` | POST | Sync data from browser |
| `/api/data` | GET | Get all stored data |
| `/api/test-whatsapp` | POST | Send a test message |
| `/api/send-workout-reminder` | POST | Manually trigger workout reminder |
| `/api/send-weight-update` | POST | Manually trigger weight update |

## Data Storage

- **Browser**: Data stored in localStorage
- **Server**: Data stored in `data.json` file

The browser syncs to the server automatically when changes are made.

## Troubleshooting

### WhatsApp messages not sending

1. Make sure you sent the activation message to CallMeBot
2. Verify your phone number includes country code (+1 for US)
3. Check the server console for error messages
4. Try the "Send Test Message" button

### Server not starting

1. Make sure Node.js is installed (v14+ recommended)
2. Check if port 3000 is available
3. Try: `PORT=3001 npm start` to use a different port

### Data not syncing

1. Make sure the server is running
2. Check browser console for errors
3. Click "Sync to Server" button manually

## License

MIT
