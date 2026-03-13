const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

// Default data structure
const defaultData = {
    familyName: 'My Family',
    currency: 'USD',
    currencySymbol: '$',
    members: [],
    transactions: [],
    budgets: [],
    savingsGoals: [],
    whatsappConfig: {
        enabled: false,
        members: {} // { memberId: { phone: '', apiKey: '' } }
    },
    settings: {
        notifyOnTransfer: true,
        notifyOnBudgetAlert: true,
        notifyOnGoalProgress: true,
        budgetAlertThreshold: 80 // percent
    }
};

// Read data from file
function readData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            return { ...defaultData, ...data };
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error reading data:`, error.message);
    }
    return { ...defaultData };
}

// Write data to file
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error writing data:`, error.message);
        return false;
    }
}

// Initialize data file if needed
function initDataFile() {
    if (!fs.existsSync(DATA_FILE)) {
        writeData(defaultData);
        console.log(`[${new Date().toISOString()}] Initialized data file`);
    }
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Send WhatsApp message via CallMeBot
function sendWhatsAppMessage(phone, apiKey, message) {
    return new Promise((resolve, reject) => {
        if (!phone || !apiKey) {
            reject(new Error('WhatsApp not configured'));
            return;
        }

        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`[${new Date().toISOString()}] WhatsApp sent to ${phone}`);
                    resolve(data);
                } else {
                    reject(new Error(`WhatsApp API error: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

// Send notification to a family member
async function notifyMember(memberId, message) {
    const data = readData();
    const config = data.whatsappConfig.members[memberId];

    if (config && config.phone && config.apiKey) {
        try {
            await sendWhatsAppMessage(config.phone, config.apiKey, message);
            return true;
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Failed to notify member ${memberId}:`, error.message);
        }
    }
    return false;
}

// Notify all family members
async function notifyAllMembers(message, excludeMemberId = null) {
    const data = readData();
    const promises = data.members
        .filter(m => m.id !== excludeMemberId)
        .map(m => notifyMember(m.id, message));

    await Promise.allSettled(promises);
}

// Format currency
function formatCurrency(amount, data) {
    return `${data.currencySymbol}${amount.toFixed(2)}`;
}

// Get member by ID
function getMemberById(data, memberId) {
    return data.members.find(m => m.id === memberId);
}

// Calculate member balance
function calculateMemberBalance(data, memberId) {
    let balance = 0;

    for (const tx of data.transactions) {
        if (tx.toMemberId === memberId) {
            balance += tx.amount;
        }
        if (tx.fromMemberId === memberId) {
            balance -= tx.amount;
        }
    }

    return balance;
}

// Calculate budget spending for current month
function calculateBudgetSpending(data, budgetId) {
    const budget = data.budgets.find(b => b.id === budgetId);
    if (!budget) return 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return data.transactions
        .filter(tx =>
            tx.category === budget.category &&
            tx.type === 'expense' &&
            new Date(tx.date) >= monthStart
        )
        .reduce((sum, tx) => sum + tx.amount, 0);
}

// Check budget alerts
async function checkBudgetAlerts(data) {
    if (!data.settings.notifyOnBudgetAlert) return;

    const threshold = data.settings.budgetAlertThreshold / 100;

    for (const budget of data.budgets) {
        const spent = calculateBudgetSpending(data, budget.id);
        const percentage = spent / budget.limit;

        if (percentage >= threshold && !budget.alertSent) {
            const message = `Budget Alert: ${budget.category} spending is at ${Math.round(percentage * 100)}% (${formatCurrency(spent, data)} of ${formatCurrency(budget.limit, data)})`;
            await notifyAllMembers(message);
            budget.alertSent = true;
            writeData(data);
        }
    }
}

// Reset monthly budget alerts
function resetMonthlyBudgetAlerts() {
    const data = readData();
    const now = new Date();

    if (now.getDate() === 1) {
        data.budgets.forEach(b => b.alertSent = false);
        writeData(data);
        console.log(`[${new Date().toISOString()}] Reset monthly budget alerts`);
    }
}

// Parse request body
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
        req.on('error', reject);
    });
}

// Send JSON response
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// API Routes
const routes = {
    // Get all data
    'GET /api/data': async (req, res) => {
        const data = readData();
        // Add calculated balances to members
        data.members = data.members.map(m => ({
            ...m,
            balance: calculateMemberBalance(data, m.id)
        }));
        sendJson(res, 200, data);
    },

    // Family settings
    'PUT /api/settings': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (body.familyName) data.familyName = body.familyName;
        if (body.currency) data.currency = body.currency;
        if (body.currencySymbol) data.currencySymbol = body.currencySymbol;
        if (body.settings) data.settings = { ...data.settings, ...body.settings };

        writeData(data);
        sendJson(res, 200, { success: true, data });
    },

    // Add family member
    'POST /api/members': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.name) {
            sendJson(res, 400, { error: 'Name is required' });
            return;
        }

        const member = {
            id: generateId(),
            name: body.name,
            email: body.email || '',
            avatar: body.avatar || '',
            role: body.role || 'member', // admin, member
            createdAt: new Date().toISOString()
        };

        data.members.push(member);
        writeData(data);

        // Notify other members
        if (data.settings.notifyOnTransfer) {
            await notifyAllMembers(`${member.name} has joined the family savings group!`, member.id);
        }

        sendJson(res, 201, { success: true, member });
    },

    // Update family member
    'PUT /api/members': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        const memberIndex = data.members.findIndex(m => m.id === body.id);
        if (memberIndex === -1) {
            sendJson(res, 404, { error: 'Member not found' });
            return;
        }

        data.members[memberIndex] = { ...data.members[memberIndex], ...body };
        writeData(data);
        sendJson(res, 200, { success: true, member: data.members[memberIndex] });
    },

    // Delete family member
    'DELETE /api/members': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        const memberIndex = data.members.findIndex(m => m.id === body.id);
        if (memberIndex === -1) {
            sendJson(res, 404, { error: 'Member not found' });
            return;
        }

        const member = data.members[memberIndex];
        data.members.splice(memberIndex, 1);
        delete data.whatsappConfig.members[body.id];
        writeData(data);

        sendJson(res, 200, { success: true, message: `${member.name} removed` });
    },

    // Add money (deposit)
    'POST /api/deposit': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.memberId || !body.amount || body.amount <= 0) {
            sendJson(res, 400, { error: 'Valid member ID and amount required' });
            return;
        }

        const member = getMemberById(data, body.memberId);
        if (!member) {
            sendJson(res, 404, { error: 'Member not found' });
            return;
        }

        const transaction = {
            id: generateId(),
            type: 'deposit',
            toMemberId: body.memberId,
            fromMemberId: null,
            amount: parseFloat(body.amount),
            description: body.description || 'Deposit',
            category: 'deposit',
            date: new Date().toISOString()
        };

        data.transactions.push(transaction);
        writeData(data);

        // Notify
        if (data.settings.notifyOnTransfer) {
            const msg = `${member.name} deposited ${formatCurrency(transaction.amount, data)}`;
            await notifyAllMembers(msg);
        }

        sendJson(res, 201, {
            success: true,
            transaction,
            newBalance: calculateMemberBalance(data, body.memberId)
        });
    },

    // Transfer money between members
    'POST /api/transfer': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.fromMemberId || !body.toMemberId || !body.amount || body.amount <= 0) {
            sendJson(res, 400, { error: 'Valid from/to member IDs and amount required' });
            return;
        }

        if (body.fromMemberId === body.toMemberId) {
            sendJson(res, 400, { error: 'Cannot transfer to yourself' });
            return;
        }

        const fromMember = getMemberById(data, body.fromMemberId);
        const toMember = getMemberById(data, body.toMemberId);

        if (!fromMember || !toMember) {
            sendJson(res, 404, { error: 'Member not found' });
            return;
        }

        const fromBalance = calculateMemberBalance(data, body.fromMemberId);
        const amount = parseFloat(body.amount);

        if (fromBalance < amount) {
            sendJson(res, 400, { error: 'Insufficient balance' });
            return;
        }

        const transaction = {
            id: generateId(),
            type: 'transfer',
            fromMemberId: body.fromMemberId,
            toMemberId: body.toMemberId,
            amount: amount,
            description: body.description || 'Transfer',
            category: 'transfer',
            date: new Date().toISOString()
        };

        data.transactions.push(transaction);
        writeData(data);

        // Send WhatsApp notifications
        if (data.settings.notifyOnTransfer) {
            const senderMsg = `You sent ${formatCurrency(amount, data)} to ${toMember.name}. New balance: ${formatCurrency(calculateMemberBalance(data, body.fromMemberId), data)}`;
            const receiverMsg = `You received ${formatCurrency(amount, data)} from ${fromMember.name}! New balance: ${formatCurrency(calculateMemberBalance(data, body.toMemberId), data)}`;

            await Promise.all([
                notifyMember(body.fromMemberId, senderMsg),
                notifyMember(body.toMemberId, receiverMsg)
            ]);
        }

        sendJson(res, 201, {
            success: true,
            transaction,
            fromBalance: calculateMemberBalance(data, body.fromMemberId),
            toBalance: calculateMemberBalance(data, body.toMemberId)
        });
    },

    // Record expense
    'POST /api/expense': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.memberId || !body.amount || body.amount <= 0) {
            sendJson(res, 400, { error: 'Valid member ID and amount required' });
            return;
        }

        const member = getMemberById(data, body.memberId);
        if (!member) {
            sendJson(res, 404, { error: 'Member not found' });
            return;
        }

        const balance = calculateMemberBalance(data, body.memberId);
        const amount = parseFloat(body.amount);

        if (balance < amount) {
            sendJson(res, 400, { error: 'Insufficient balance' });
            return;
        }

        const transaction = {
            id: generateId(),
            type: 'expense',
            fromMemberId: body.memberId,
            toMemberId: null,
            amount: amount,
            description: body.description || 'Expense',
            category: body.category || 'general',
            date: new Date().toISOString()
        };

        data.transactions.push(transaction);
        writeData(data);

        // Check budget alerts
        await checkBudgetAlerts(data);

        sendJson(res, 201, {
            success: true,
            transaction,
            newBalance: calculateMemberBalance(data, body.memberId)
        });
    },

    // Get transactions
    'GET /api/transactions': async (req, res) => {
        const data = readData();
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const memberId = url.searchParams.get('memberId');
        const limit = parseInt(url.searchParams.get('limit')) || 50;

        let transactions = data.transactions;

        if (memberId) {
            transactions = transactions.filter(tx =>
                tx.fromMemberId === memberId || tx.toMemberId === memberId
            );
        }

        // Sort by date descending and limit
        transactions = transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);

        // Add member names
        transactions = transactions.map(tx => ({
            ...tx,
            fromMemberName: tx.fromMemberId ? getMemberById(data, tx.fromMemberId)?.name : null,
            toMemberName: tx.toMemberId ? getMemberById(data, tx.toMemberId)?.name : null
        }));

        sendJson(res, 200, { transactions });
    },

    // Budget management
    'POST /api/budgets': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.category || !body.limit || body.limit <= 0) {
            sendJson(res, 400, { error: 'Category and limit required' });
            return;
        }

        const budget = {
            id: generateId(),
            category: body.category,
            limit: parseFloat(body.limit),
            alertSent: false,
            createdAt: new Date().toISOString()
        };

        data.budgets.push(budget);
        writeData(data);

        sendJson(res, 201, { success: true, budget });
    },

    'PUT /api/budgets': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        const budgetIndex = data.budgets.findIndex(b => b.id === body.id);
        if (budgetIndex === -1) {
            sendJson(res, 404, { error: 'Budget not found' });
            return;
        }

        data.budgets[budgetIndex] = { ...data.budgets[budgetIndex], ...body };
        writeData(data);

        sendJson(res, 200, { success: true, budget: data.budgets[budgetIndex] });
    },

    'DELETE /api/budgets': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        const budgetIndex = data.budgets.findIndex(b => b.id === body.id);
        if (budgetIndex === -1) {
            sendJson(res, 404, { error: 'Budget not found' });
            return;
        }

        data.budgets.splice(budgetIndex, 1);
        writeData(data);

        sendJson(res, 200, { success: true });
    },

    'GET /api/budgets': async (req, res) => {
        const data = readData();

        const budgets = data.budgets.map(budget => ({
            ...budget,
            spent: calculateBudgetSpending(data, budget.id),
            remaining: budget.limit - calculateBudgetSpending(data, budget.id),
            percentage: Math.round((calculateBudgetSpending(data, budget.id) / budget.limit) * 100)
        }));

        sendJson(res, 200, { budgets });
    },

    // Savings goals
    'POST /api/goals': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.name || !body.targetAmount || body.targetAmount <= 0) {
            sendJson(res, 400, { error: 'Name and target amount required' });
            return;
        }

        const goal = {
            id: generateId(),
            name: body.name,
            targetAmount: parseFloat(body.targetAmount),
            currentAmount: 0,
            deadline: body.deadline || null,
            createdAt: new Date().toISOString()
        };

        data.savingsGoals.push(goal);
        writeData(data);

        sendJson(res, 201, { success: true, goal });
    },

    'PUT /api/goals': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        const goalIndex = data.savingsGoals.findIndex(g => g.id === body.id);
        if (goalIndex === -1) {
            sendJson(res, 404, { error: 'Goal not found' });
            return;
        }

        data.savingsGoals[goalIndex] = { ...data.savingsGoals[goalIndex], ...body };
        writeData(data);

        sendJson(res, 200, { success: true, goal: data.savingsGoals[goalIndex] });
    },

    // Contribute to a savings goal
    'POST /api/goals/contribute': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.goalId || !body.memberId || !body.amount || body.amount <= 0) {
            sendJson(res, 400, { error: 'Goal ID, member ID, and amount required' });
            return;
        }

        const goalIndex = data.savingsGoals.findIndex(g => g.id === body.goalId);
        if (goalIndex === -1) {
            sendJson(res, 404, { error: 'Goal not found' });
            return;
        }

        const member = getMemberById(data, body.memberId);
        if (!member) {
            sendJson(res, 404, { error: 'Member not found' });
            return;
        }

        const balance = calculateMemberBalance(data, body.memberId);
        const amount = parseFloat(body.amount);

        if (balance < amount) {
            sendJson(res, 400, { error: 'Insufficient balance' });
            return;
        }

        // Create expense transaction for the contribution
        const transaction = {
            id: generateId(),
            type: 'goal_contribution',
            fromMemberId: body.memberId,
            toMemberId: null,
            amount: amount,
            description: `Contribution to: ${data.savingsGoals[goalIndex].name}`,
            category: 'savings',
            goalId: body.goalId,
            date: new Date().toISOString()
        };

        data.transactions.push(transaction);
        data.savingsGoals[goalIndex].currentAmount += amount;
        writeData(data);

        const goal = data.savingsGoals[goalIndex];
        const progress = Math.round((goal.currentAmount / goal.targetAmount) * 100);

        // Notify on goal progress
        if (data.settings.notifyOnGoalProgress) {
            const msg = `${member.name} contributed ${formatCurrency(amount, data)} to "${goal.name}"! Progress: ${progress}% (${formatCurrency(goal.currentAmount, data)} / ${formatCurrency(goal.targetAmount, data)})`;
            await notifyAllMembers(msg);
        }

        sendJson(res, 201, {
            success: true,
            goal: data.savingsGoals[goalIndex],
            transaction,
            newBalance: calculateMemberBalance(data, body.memberId)
        });
    },

    'DELETE /api/goals': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        const goalIndex = data.savingsGoals.findIndex(g => g.id === body.id);
        if (goalIndex === -1) {
            sendJson(res, 404, { error: 'Goal not found' });
            return;
        }

        data.savingsGoals.splice(goalIndex, 1);
        writeData(data);

        sendJson(res, 200, { success: true });
    },

    'GET /api/goals': async (req, res) => {
        const data = readData();

        const goals = data.savingsGoals.map(goal => ({
            ...goal,
            remaining: goal.targetAmount - goal.currentAmount,
            percentage: Math.round((goal.currentAmount / goal.targetAmount) * 100)
        }));

        sendJson(res, 200, { goals });
    },

    // WhatsApp configuration
    'POST /api/whatsapp/config': async (req, res) => {
        const body = await parseBody(req);
        const data = readData();

        if (!body.memberId || !body.phone || !body.apiKey) {
            sendJson(res, 400, { error: 'Member ID, phone, and API key required' });
            return;
        }

        data.whatsappConfig.enabled = true;
        data.whatsappConfig.members[body.memberId] = {
            phone: body.phone,
            apiKey: body.apiKey
        };
        writeData(data);

        sendJson(res, 200, { success: true, message: 'WhatsApp configured' });
    },

    'POST /api/whatsapp/test': async (req, res) => {
        const body = await parseBody(req);

        if (!body.phone || !body.apiKey) {
            sendJson(res, 400, { error: 'Phone and API key required' });
            return;
        }

        try {
            await sendWhatsAppMessage(body.phone, body.apiKey, 'Family Savings App: Test notification successful!');
            sendJson(res, 200, { success: true, message: 'Test message sent' });
        } catch (error) {
            sendJson(res, 500, { error: error.message });
        }
    },

    // Analytics / Summary
    'GET /api/summary': async (req, res) => {
        const data = readData();
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const period = url.searchParams.get('period') || 'month'; // week, month, year

        const now = new Date();
        let startDate;

        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default: // month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const periodTransactions = data.transactions.filter(tx =>
            new Date(tx.date) >= startDate
        );

        const totalDeposits = periodTransactions
            .filter(tx => tx.type === 'deposit')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalExpenses = periodTransactions
            .filter(tx => tx.type === 'expense')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalTransfers = periodTransactions
            .filter(tx => tx.type === 'transfer')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalGoalContributions = periodTransactions
            .filter(tx => tx.type === 'goal_contribution')
            .reduce((sum, tx) => sum + tx.amount, 0);

        // Spending by category
        const spendingByCategory = {};
        periodTransactions
            .filter(tx => tx.type === 'expense')
            .forEach(tx => {
                spendingByCategory[tx.category] = (spendingByCategory[tx.category] || 0) + tx.amount;
            });

        // Total family balance
        const totalBalance = data.members.reduce((sum, m) =>
            sum + calculateMemberBalance(data, m.id), 0
        );

        // Total savings in goals
        const totalSavings = data.savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);

        sendJson(res, 200, {
            period,
            totalBalance,
            totalSavings,
            totalDeposits,
            totalExpenses,
            totalTransfers,
            totalGoalContributions,
            spendingByCategory,
            transactionCount: periodTransactions.length
        });
    }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Serve static files
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = path.join(__dirname, filePath);

        const extname = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        try {
            const content = fs.readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': contentTypes[extname] || 'text/plain' });
            res.end(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Serve index.html for SPA routing
                try {
                    const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'));
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(indexContent);
                } catch (e) {
                    res.writeHead(404);
                    res.end('Not found');
                }
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        }
        return;
    }

    // API routes
    const routeKey = `${req.method} ${req.url.split('?')[0]}`;
    const handler = routes[routeKey];

    if (handler) {
        try {
            await handler(req, res);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Error:`, error);
            sendJson(res, 500, { error: error.message });
        }
    } else {
        sendJson(res, 404, { error: 'Not found' });
    }
});

// Initialize and start server
initDataFile();

// Run scheduled checks every hour
setInterval(() => {
    const data = readData();
    checkBudgetAlerts(data);
    resetMonthlyBudgetAlerts();
}, 60 * 60 * 1000);

server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Family Savings server running on http://localhost:${PORT}`);
    console.log(`[${new Date().toISOString()}] Data file: ${DATA_FILE}`);
});
