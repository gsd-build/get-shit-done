# Family Savings App

A personal family savings and budgeting application with real-time transfers between family members and WhatsApp notifications.

## Features

- **Family Accounts**: Add family members with individual balances
- **Real-time Transfers**: Send money between family members instantly
- **Deposits & Expenses**: Track money coming in and going out
- **Budget Management**: Set monthly spending limits by category
- **Savings Goals**: Create shared family savings goals and track contributions
- **WhatsApp Notifications**: Get instant notifications for:
  - Money received/sent
  - Budget alerts (when spending reaches threshold)
  - Savings goal progress
- **Transaction History**: Full history of all family transactions
- **Analytics**: Monthly summaries of deposits, expenses, and savings

## Quick Start

```bash
cd family-savings
npm start
```

Open http://localhost:3001 in your browser.

## Setup WhatsApp Notifications

1. Save the CallMeBot number in your phone: **+34 644 51 95 23**
2. Send them this message via WhatsApp: `I allow callmebot to send me messages`
3. Wait for the API key response
4. Go to Settings in the app and enter your phone number and API key for each family member

## How It Works

### Adding Money
1. Click "Add Money" on the dashboard
2. Select the family member
3. Enter the amount and description
4. The balance is updated instantly

### Transferring Money
1. Go to the Transfer tab
2. Select sender and recipient
3. Enter amount and optional note
4. Both members receive WhatsApp notifications

### Recording Expenses
1. Click "Record Expense" on the dashboard
2. Select who spent the money
3. Choose a category and enter amount
4. Budget alerts are checked automatically

### Budget Management
1. Go to the Budgets tab
2. Create budgets for different spending categories
3. As expenses are recorded, progress bars show spending
4. WhatsApp alerts are sent when spending reaches 80% (configurable)

### Savings Goals
1. Go to the Goals tab
2. Create a goal with a target amount
3. Family members can contribute from their balance
4. Everyone gets notified of contributions and progress

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data` | GET | Get all app data |
| `/api/settings` | PUT | Update family settings |
| `/api/members` | GET/POST/PUT/DELETE | Manage family members |
| `/api/deposit` | POST | Add money to a member's account |
| `/api/transfer` | POST | Transfer between members |
| `/api/expense` | POST | Record an expense |
| `/api/transactions` | GET | Get transaction history |
| `/api/budgets` | GET/POST/PUT/DELETE | Manage budgets |
| `/api/goals` | GET/POST/PUT/DELETE | Manage savings goals |
| `/api/goals/contribute` | POST | Contribute to a goal |
| `/api/summary` | GET | Get analytics summary |
| `/api/whatsapp/config` | POST | Configure WhatsApp |
| `/api/whatsapp/test` | POST | Test WhatsApp notification |

## Data Storage

All data is stored in `data.json` in the app directory. Back up this file regularly to preserve your data.

## Running as a Service

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name family-savings
pm2 save
pm2 startup
```

### Using systemd (Linux)
Create `/etc/systemd/system/family-savings.service`:
```ini
[Unit]
Description=Family Savings App
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/family-savings
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable family-savings
sudo systemctl start family-savings
```

## Configuration

Environment variables:
- `PORT`: Server port (default: 3001)

In-app settings:
- Family name
- Currency symbol
- Budget alert threshold (default: 80%)

## Security Note

This app is designed for personal/family use on a trusted network. For production use, consider:
- Adding user authentication
- Using HTTPS
- Implementing rate limiting
- Encrypting sensitive data
