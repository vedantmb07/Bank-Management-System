// ==========================================================
// In-Memory Cloud Database Fallback
// Used when real MySQL is unreachable (e.g., hosted on Vercel)
// ==========================================================

const inMemoryDB = {
    customers: [
        {
            customer_id: 1,
            first_name: 'Aarav',
            last_name: 'Sharma',
            email: 'aarav.sharma@example.com',
            phone: '9820012345',
            address: 'Mumbai, Maharashtra',
            created_at: new Date('2026-10-25T11:48:56Z')
        },
        {
            customer_id: 2,
            first_name: 'Riya',
            last_name: 'Verma',
            email: 'riya.verma@example.com',
            phone: '9820054321',
            address: 'Pune, Maharashtra',
            created_at: new Date('2026-10-25T11:48:56Z')
        },
        {
            customer_id: 3,
            first_name: 'Ananya',
            last_name: 'Deshmukh',
            email: 'ananya.d@example.com',
            phone: '9820099999',
            address: 'Mumbai, Maharashtra',
            created_at: new Date('2026-10-25T11:48:56Z')
        }
    ],
    accounts: [
        {
            account_number: 1001,
            customer_id: 1,
            account_type: 'SAVINGS',
            balance: 20300.00,
            status: 'ACTIVE',
            created_at: new Date('2026-10-25T11:48:56Z')
        },
        {
            account_number: 1002,
            customer_id: 2,
            account_type: 'CHECKING',
            balance: 17200.00,
            status: 'ACTIVE',
            created_at: new Date('2026-10-25T11:48:56Z')
        },
        {
            account_number: 1003,
            customer_id: 3,
            account_type: 'SAVINGS',
            balance: 50000.00,
            status: 'ACTIVE',
            created_at: new Date('2026-10-25T11:48:56Z')
        }
    ],
    transactions: [
        {
            transaction_id: 5,
            account_number: 1001,
            transaction_type: 'WITHDRAWAL',
            amount: 200.00,
            balance_after: 20300.00,
            transaction_date: new Date(Date.now() - 1000 * 60 * 10)
        },
        {
            transaction_id: 4,
            account_number: 1002,
            transaction_type: 'DEPOSIT',
            amount: 200.00,
            balance_after: 17200.00,
            transaction_date: new Date(Date.now() - 1000 * 60 * 10)
        },
        {
            transaction_id: 3,
            account_number: 1001,
            transaction_type: 'DEPOSIT',
            amount: 1000.00,
            balance_after: 21000.00,
            transaction_date: new Date(Date.now() - 1000 * 60 * 25)
        },
        {
            transaction_id: 2,
            account_number: 1002,
            transaction_type: 'DEPOSIT',
            amount: 5000.00,
            balance_after: 17000.00,
            transaction_date: new Date('2026-10-25T11:49:05Z')
        },
        {
            transaction_id: 1,
            account_number: 1001,
            transaction_type: 'WITHDRAWAL',
            amount: 5000.00,
            balance_after: 20000.00,
            transaction_date: new Date('2026-10-25T11:49:05Z')
        }
    ],
    transfers: [
        {
            transfer_id: 2,
            sender_account: 1001,
            receiver_account: 1002,
            amount: 200.00,
            transfer_date: new Date(Date.now() - 1000 * 60 * 10)
        },
        {
            transfer_id: 1,
            sender_account: 1001,
            receiver_account: 1002,
            amount: 5000.00,
            transfer_date: new Date('2026-10-25T11:49:05Z')
        }
    ]
};

let nextCustomerId = 4;
let nextAccountNumber = 1004;
let nextTransactionId = 6;
let nextTransferId = 3;

// Simulated query executor for MySQL operations
async function mockQuery(sql, params = []) {
    const q = sql.trim().toUpperCase();

    // 1. DASHBOARD STATS
    if (q.includes('COUNT(*) AS TOTAL_CUSTOMERS FROM CUSTOMERS')) {
        return [[{ total_customers: inMemoryDB.customers.length }]];
    }

    if (q.includes('COUNT(*) AS TOTAL_ACCOUNTS') && q.includes('TOTAL_LIQUIDITY')) {
        const totalLiquidity = inMemoryDB.accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
        const active = inMemoryDB.accounts.filter(a => a.status === 'ACTIVE').length;
        const frozen = inMemoryDB.accounts.filter(a => a.status === 'FROZEN').length;
        const closed = inMemoryDB.accounts.filter(a => a.status === 'CLOSED').length;
        return [[{
            total_accounts: inMemoryDB.accounts.length,
            total_liquidity: totalLiquidity,
            active_accounts: active,
            frozen_accounts: frozen,
            closed_accounts: closed
        }]];
    }

    if (q.includes('GROUP BY ACCOUNT_TYPE')) {
        const map = {};
        inMemoryDB.accounts.forEach(a => {
            if (!map[a.account_type]) map[a.account_type] = { count: 0, total_balance: 0 };
            map[a.account_type].count++;
            map[a.account_type].total_balance += parseFloat(a.balance);
        });
        const rows = Object.keys(map).map(k => ({
            account_type: k,
            count: map[k].count,
            total_balance: map[k].total_balance
        }));
        return [rows];
    }

    if (q.includes('COUNT(*) AS TOTAL_TRANSFERS')) {
        const totalVolume = inMemoryDB.transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        return [[{
            total_transfers: inMemoryDB.transfers.length,
            total_transfer_volume: totalVolume
        }]];
    }

    // 2. TRANSACTIONS LIST
    if (q.startsWith('SELECT') && q.includes('FROM TRANSACTIONS')) {
        let results = inMemoryDB.transactions.map(t => {
            const acc = inMemoryDB.accounts.find(a => a.account_number === t.account_number) || {};
            const cust = inMemoryDB.customers.find(c => c.customer_id === acc.customer_id) || {};
            return {
                ...t,
                account_type: acc.account_type,
                customer_id: cust.customer_id,
                customer_name: `${cust.first_name || ''} ${cust.last_name || ''}`.trim(),
                first_name: cust.first_name,
                last_name: cust.last_name
            };
        });

        // Filter by account_number
        if (q.includes('T.ACCOUNT_NUMBER = ?') || q.includes('ACCOUNT_NUMBER = ?')) {
            const targetAcc = parseInt(params[0], 10);
            results = results.filter(r => r.account_number === targetAcc);
        }

        // Filter by type
        if (q.includes('T.TRANSACTION_TYPE = ?')) {
            const targetType = params[q.includes('ACCOUNT_NUMBER = ?') ? 1 : 0];
            results = results.filter(r => r.transaction_type === targetType);
        }

        // Sort desc
        results.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

        // Limit
        const limitParam = params[params.length - 1];
        if (typeof limitParam === 'number' && limitParam > 0) {
            results = results.slice(0, limitParam);
        } else {
            const limitMatch = q.match(/LIMIT\s+(\d+)/);
            if (limitMatch) {
                results = results.slice(0, parseInt(limitMatch[1], 10));
            }
        }

        return [results];
    }

    // 3. TRANSFERS LIST
    if (q.startsWith('SELECT') && q.includes('FROM TRANSFERS')) {
        const results = inMemoryDB.transfers.map(tr => {
            const senderAcc = inMemoryDB.accounts.find(a => a.account_number === tr.sender_account) || {};
            const senderCust = inMemoryDB.customers.find(c => c.customer_id === senderAcc.customer_id) || {};
            const receiverAcc = inMemoryDB.accounts.find(a => a.account_number === tr.receiver_account) || {};
            const receiverCust = inMemoryDB.customers.find(c => c.customer_id === receiverAcc.customer_id) || {};

            return {
                transfer_id: tr.transfer_id,
                sender_account: tr.sender_account,
                receiver_account: tr.receiver_account,
                amount: tr.amount,
                transfer_date: tr.transfer_date,
                sender_name: `${senderCust.first_name || ''} ${senderCust.last_name || ''}`.trim(),
                sender_email: senderCust.email || '',
                receiver_name: `${receiverCust.first_name || ''} ${receiverCust.last_name || ''}`.trim(),
                receiver_email: receiverCust.email || ''
            };
        });

        results.sort((a, b) => new Date(b.transfer_date) - new Date(a.transfer_date));
        return [results.slice(0, 50)];
    }

    // 4. CUSTOMERS LIST & DETAIL
    if (q.includes('FROM CUSTOMERS C') && q.includes('COUNT(A.ACCOUNT_NUMBER)')) {
        let results = inMemoryDB.customers.map(c => {
            const custAccounts = inMemoryDB.accounts.filter(a => a.customer_id === c.customer_id);
            const totalBal = custAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
            return {
                ...c,
                total_accounts: custAccounts.length,
                total_balance: totalBal
            };
        });

        if (params.length > 0 && typeof params[0] === 'string' && params[0].startsWith('%')) {
            const term = params[0].replace(/%/g, '').toLowerCase();
            results = results.filter(c => 
                c.first_name.toLowerCase().includes(term) ||
                c.last_name.toLowerCase().includes(term) ||
                c.email.toLowerCase().includes(term) ||
                c.phone.toLowerCase().includes(term)
            );
        }

        results.sort((a, b) => b.customer_id - a.customer_id);
        return [results];
    }

    if (q.startsWith('SELECT * FROM CUSTOMERS WHERE CUSTOMER_ID = ?') || q.startsWith('SELECT CUSTOMER_ID FROM CUSTOMERS WHERE CUSTOMER_ID = ?')) {
        const id = parseInt(params[0], 10);
        const rows = inMemoryDB.customers.filter(c => c.customer_id === id);
        return [rows];
    }

    if (q.includes('FROM CUSTOMERS WHERE EMAIL = ? OR PHONE = ?')) {
        const [email, phone] = params;
        const rows = inMemoryDB.customers.filter(c => c.email.toLowerCase() === email.toLowerCase() || c.phone === phone);
        return [rows];
    }

    if (q.startsWith('INSERT INTO CUSTOMERS')) {
        const [first_name, last_name, email, phone, address] = params;
        const newCust = {
            customer_id: nextCustomerId++,
            first_name,
            last_name,
            email,
            phone,
            address: address || '',
            created_at: new Date()
        };
        inMemoryDB.customers.push(newCust);
        return [{ insertId: newCust.customer_id, affectedRows: 1 }];
    }

    if (q.startsWith('UPDATE CUSTOMERS')) {
        const id = parseInt(params[params.length - 1], 10);
        const cust = inMemoryDB.customers.find(c => c.customer_id === id);
        if (cust) {
            const [first_name, last_name, email, phone, address] = params;
            if (first_name !== null && first_name !== undefined) cust.first_name = first_name;
            if (last_name !== null && last_name !== undefined) cust.last_name = last_name;
            if (email !== null && email !== undefined) cust.email = email;
            if (phone !== null && phone !== undefined) cust.phone = phone;
            if (address !== null && address !== undefined) cust.address = address;
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    if (q.includes('FROM ACCOUNTS WHERE CUSTOMER_ID = ?') && (q.includes('COALESCE(SUM(BALANCE)') || q.includes('TOTAL_BALANCE'))) {
        const custId = parseInt(params[0], 10);
        const custAccounts = inMemoryDB.accounts.filter(a => a.customer_id === custId);
        const total = custAccounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
        return [[{ total_balance: total }]];
    }

    if (q.includes('SELECT ACCOUNT_NUMBER FROM ACCOUNTS WHERE CUSTOMER_ID = ?')) {
        const custId = parseInt(params[0], 10);
        const rows = inMemoryDB.accounts.filter(a => a.customer_id === custId).map(a => ({ account_number: a.account_number }));
        return [rows];
    }

    if (q.startsWith('DELETE FROM TRANSFERS')) {
        const accNums = Array.isArray(params[0]) ? params[0] : [params[0]];
        const numSet = new Set(accNums.map(n => parseInt(n, 10)));
        const before = inMemoryDB.transfers.length;
        inMemoryDB.transfers = inMemoryDB.transfers.filter(tr => !numSet.has(tr.sender_account) && !numSet.has(tr.receiver_account));
        return [{ affectedRows: before - inMemoryDB.transfers.length }];
    }

    if (q.startsWith('DELETE FROM TRANSACTIONS WHERE ACCOUNT_NUMBER IN')) {
        const accNums = Array.isArray(params[0]) ? params[0] : [params[0]];
        const numSet = new Set(accNums.map(n => parseInt(n, 10)));
        const before = inMemoryDB.transactions.length;
        inMemoryDB.transactions = inMemoryDB.transactions.filter(t => !numSet.has(t.account_number));
        return [{ affectedRows: before - inMemoryDB.transactions.length }];
    }

    if (q.startsWith('DELETE FROM ACCOUNTS WHERE CUSTOMER_ID = ?')) {
        const custId = parseInt(params[0], 10);
        const before = inMemoryDB.accounts.length;
        inMemoryDB.accounts = inMemoryDB.accounts.filter(a => a.customer_id !== custId);
        return [{ affectedRows: before - inMemoryDB.accounts.length }];
    }

    if (q.startsWith('DELETE FROM CUSTOMERS WHERE CUSTOMER_ID = ?')) {
        const custId = parseInt(params[0], 10);
        const idx = inMemoryDB.customers.findIndex(c => c.customer_id === custId);
        if (idx !== -1) {
            inMemoryDB.customers.splice(idx, 1);
            // Cascade delete empty accounts for this customer
            inMemoryDB.accounts = inMemoryDB.accounts.filter(a => a.customer_id !== custId);
            return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
    }

    // 5. ACCOUNTS LIST & DETAIL
    if (q.includes('FROM ACCOUNTS A') && q.includes('JOIN CUSTOMERS C')) {
        if (q.includes('A.ACCOUNT_NUMBER = ?')) {
            const accNum = parseInt(params[0], 10);
            const acc = inMemoryDB.accounts.find(a => a.account_number === accNum);
            if (!acc) return [[]];
            const cust = inMemoryDB.customers.find(c => c.customer_id === acc.customer_id) || {};
            return [[{ ...acc, first_name: cust.first_name, last_name: cust.last_name, email: cust.email, phone: cust.phone, address: cust.address }]];
        }

        let rows = inMemoryDB.accounts.map(a => {
            const cust = inMemoryDB.customers.find(c => c.customer_id === a.customer_id) || {};
            return {
                ...a,
                first_name: cust.first_name || '',
                last_name: cust.last_name || '',
                email: cust.email || '',
                phone: cust.phone || ''
            };
        });

        // Filter status & type with sequential param tracking
        let pIdx = 0;
        if (q.includes('A.STATUS = ?')) {
            const statusVal = params[pIdx++];
            rows = rows.filter(r => r.status === statusVal);
        }
        if (q.includes('A.ACCOUNT_TYPE = ?')) {
            const typeVal = params[pIdx++];
            rows = rows.filter(r => r.account_type === typeVal);
        }
        if (q.includes('A.ACCOUNT_NUMBER LIKE ?')) {
            const sVal = (params[pIdx] || '').replace(/%/g, '').toLowerCase();
            rows = rows.filter(r => 
                String(r.account_number).includes(sVal) ||
                (r.first_name || '').toLowerCase().includes(sVal) ||
                (r.last_name || '').toLowerCase().includes(sVal) ||
                (r.email || '').toLowerCase().includes(sVal)
            );
        }

        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return [rows];
    }

    if (q.startsWith('SELECT * FROM ACCOUNTS WHERE CUSTOMER_ID = ?')) {
        const custId = parseInt(params[0], 10);
        const rows = inMemoryDB.accounts.filter(a => a.customer_id === custId);
        return [rows];
    }

    if (q.startsWith('SELECT * FROM ACCOUNTS WHERE ACCOUNT_NUMBER = ?') || q.startsWith('SELECT BALANCE FROM ACCOUNTS WHERE ACCOUNT_NUMBER = ?')) {
        const accNum = parseInt(params[0], 10);
        const rows = inMemoryDB.accounts.filter(a => a.account_number === accNum);
        return [rows];
    }

    if (q.startsWith('INSERT INTO ACCOUNTS')) {
        const [customer_id, account_type, balance, status] = params;
        const newAcc = {
            account_number: nextAccountNumber++,
            customer_id: parseInt(customer_id, 10),
            account_type,
            balance: parseFloat(balance) || 0,
            status: status || 'ACTIVE',
            created_at: new Date()
        };
        inMemoryDB.accounts.push(newAcc);
        return [{ insertId: newAcc.account_number, affectedRows: 1 }];
    }

    if (q.startsWith('INSERT INTO TRANSACTIONS')) {
        const [account_number, transaction_type, amount, balance_after] = params;
        const newTx = {
            transaction_id: nextTransactionId++,
            account_number: parseInt(account_number, 10),
            transaction_type,
            amount: parseFloat(amount),
            balance_after: parseFloat(balance_after),
            transaction_date: new Date()
        };
        inMemoryDB.transactions.unshift(newTx);
        return [{ insertId: newTx.transaction_id, affectedRows: 1 }];
    }

    if (q.startsWith('INSERT INTO TRANSFERS')) {
        const [sender_account, receiver_account, amount] = params;
        const newTr = {
            transfer_id: nextTransferId++,
            sender_account: parseInt(sender_account, 10),
            receiver_account: parseInt(receiver_account, 10),
            amount: parseFloat(amount),
            transfer_date: new Date()
        };
        inMemoryDB.transfers.unshift(newTr);
        return [{ insertId: newTr.transfer_id, affectedRows: 1 }];
    }

    if (q.startsWith('UPDATE ACCOUNTS SET BALANCE = BALANCE + ?')) {
        const [amount, accNum] = params;
        const acc = inMemoryDB.accounts.find(a => a.account_number === parseInt(accNum, 10));
        if (acc) {
            acc.balance = parseFloat(acc.balance) + parseFloat(amount);
            // Simulate after_account_update trigger
            inMemoryDB.transactions.unshift({
                transaction_id: nextTransactionId++,
                account_number: acc.account_number,
                transaction_type: 'DEPOSIT',
                amount: parseFloat(amount),
                balance_after: acc.balance,
                transaction_date: new Date()
            });
        }
        return [{ affectedRows: acc ? 1 : 0 }];
    }

    if (q.startsWith('UPDATE ACCOUNTS SET BALANCE = BALANCE - ?')) {
        const [amount, accNum] = params;
        const acc = inMemoryDB.accounts.find(a => a.account_number === parseInt(accNum, 10));
        if (acc) {
            acc.balance = parseFloat(acc.balance) - parseFloat(amount);
            // Simulate after_account_update trigger
            inMemoryDB.transactions.unshift({
                transaction_id: nextTransactionId++,
                account_number: acc.account_number,
                transaction_type: 'WITHDRAWAL',
                amount: parseFloat(amount),
                balance_after: acc.balance,
                transaction_date: new Date()
            });
        }
        return [{ affectedRows: acc ? 1 : 0 }];
    }

    if (q.startsWith('UPDATE ACCOUNTS SET STATUS = ? WHERE ACCOUNT_NUMBER = ?')) {
        const [newStatus, accNum] = params;
        const acc = inMemoryDB.accounts.find(a => a.account_number === parseInt(accNum, 10));
        if (acc) acc.status = newStatus;
        return [{ affectedRows: acc ? 1 : 0 }];
    }

    if (q.startsWith('UPDATE TRANSACTIONS SET TRANSACTION_TYPE = ? WHERE ACCOUNT_NUMBER = ?')) {
        const [newType, accNum] = params;
        const targetAcc = parseInt(accNum, 10);
        const tx = inMemoryDB.transactions.find(t => t.account_number === targetAcc);
        if (tx) tx.transaction_type = newType;
        return [{ affectedRows: tx ? 1 : 0 }];
    }

    return [[[]]];
}

// Mock connection pool interface
const mockPool = {
    async query(sql, params) {
        return mockQuery(sql, params);
    },
    async getConnection() {
        return {
            query: async (sql, params) => mockQuery(sql, params),
            beginTransaction: async () => {},
            commit: async () => {},
            rollback: async () => {},
            release: () => {}
        };
    }
};

module.exports = {
    inMemoryDB,
    mockPool,
    mockQuery
};
