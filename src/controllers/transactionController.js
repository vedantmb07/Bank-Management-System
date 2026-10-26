const { pool } = require('../config/db');

// List all transactions with account and customer info
exports.getAllTransactions = async (req, res) => {
    try {
        const { accountNumber, type, limit = 50 } = req.query;
        let query = `
            SELECT 
                t.transaction_id,
                t.account_number,
                t.transaction_type,
                t.amount,
                t.balance_after,
                t.transaction_date,
                a.account_type,
                c.customer_id,
                CONCAT(c.first_name, ' ', c.last_name) AS customer_name
            FROM Transactions t
            JOIN Accounts a ON t.account_number = a.account_number
            JOIN Customers c ON a.customer_id = c.customer_id
            WHERE 1=1
        `;
        const params = [];

        if (accountNumber) {
            query += ` AND t.account_number = ?`;
            params.push(accountNumber);
        }
        if (type) {
            query += ` AND t.transaction_type = ?`;
            params.push(type);
        }

        query += ` ORDER BY t.transaction_date DESC, t.transaction_id DESC LIMIT ?`;
        params.push(parseInt(limit, 10));

        const [rows] = await pool.query(query, params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Deposit funds into an account
exports.deposit = async (req, res) => {
    try {
        const { account_number, amount } = req.body;
        const depositAmount = parseFloat(amount);

        if (!account_number || isNaN(depositAmount) || depositAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid account number and positive amount are required.'
            });
        }

        const [accounts] = await pool.query(
            'SELECT * FROM Accounts WHERE account_number = ?',
            [account_number]
        );

        if (accounts.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const account = accounts[0];
        if (account.status !== 'ACTIVE') {
            return res.status(400).json({
                success: false,
                message: `Cannot deposit into an account with status: ${account.status}`
            });
        }

        // Updating balance triggers after_account_update in MySQL
        await pool.query(
            'UPDATE Accounts SET balance = balance + ? WHERE account_number = ?',
            [depositAmount, account_number]
        );

        const [updated] = await pool.query(
            'SELECT balance FROM Accounts WHERE account_number = ?',
            [account_number]
        );

        res.json({
            success: true,
            message: `Successfully deposited ₹${depositAmount.toFixed(2)} into Account #${account_number}`,
            account_number,
            amount: depositAmount,
            new_balance: parseFloat(updated[0].balance)
        });
    } catch (error) {
        console.error('Error in deposit:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Withdraw funds from an account
exports.withdraw = async (req, res) => {
    try {
        const { account_number, amount } = req.body;
        const withdrawAmount = parseFloat(amount);

        if (!account_number || isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid account number and positive amount are required.'
            });
        }

        const [accounts] = await pool.query(
            'SELECT * FROM Accounts WHERE account_number = ?',
            [account_number]
        );

        if (accounts.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const account = accounts[0];
        if (account.status !== 'ACTIVE') {
            return res.status(400).json({
                success: false,
                message: `Cannot withdraw from an account with status: ${account.status}`
            });
        }

        const currentBalance = parseFloat(account.balance);
        if (currentBalance < withdrawAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient funds. Current balance is ₹${currentBalance.toFixed(2)}, attempted withdrawal: ₹${withdrawAmount.toFixed(2)}`
            });
        }

        // Updating balance triggers after_account_update in MySQL
        await pool.query(
            'UPDATE Accounts SET balance = balance - ? WHERE account_number = ?',
            [withdrawAmount, account_number]
        );

        const [updated] = await pool.query(
            'SELECT balance FROM Accounts WHERE account_number = ?',
            [account_number]
        );

        res.json({
            success: true,
            message: `Successfully withdrew ₹${withdrawAmount.toFixed(2)} from Account #${account_number}`,
            account_number,
            amount: withdrawAmount,
            new_balance: parseFloat(updated[0].balance)
        });
    } catch (error) {
        console.error('Error in withdrawal:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Transfer funds between two accounts (Atomic Transaction)
exports.transfer = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { sender_account, receiver_account, amount } = req.body;
        const transferAmount = parseFloat(amount);

        if (!sender_account || !receiver_account || isNaN(transferAmount) || transferAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Sender account, receiver account, and positive transfer amount are required.'
            });
        }

        if (parseInt(sender_account) === parseInt(receiver_account)) {
            return res.status(400).json({
                success: false,
                message: 'Sender and receiver accounts cannot be the same.'
            });
        }

        await connection.beginTransaction();

        // 1. Check sender
        const [senders] = await connection.query(
            'SELECT * FROM Accounts WHERE account_number = ? FOR UPDATE',
            [sender_account]
        );

        if (senders.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: `Sender Account #${sender_account} not found.` });
        }

        const sender = senders[0];
        if (sender.status !== 'ACTIVE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Sender account is not active (Status: ${sender.status}).`
            });
        }

        if (parseFloat(sender.balance) < transferAmount) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Insufficient balance in Sender Account #${sender_account}. Available: ₹${parseFloat(sender.balance).toFixed(2)}`
            });
        }

        // 2. Check receiver
        const [receivers] = await connection.query(
            'SELECT * FROM Accounts WHERE account_number = ? FOR UPDATE',
            [receiver_account]
        );

        if (receivers.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: `Receiver Account #${receiver_account} not found.` });
        }

        const receiver = receivers[0];
        if (receiver.status !== 'ACTIVE') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Receiver account is not active (Status: ${receiver.status}).`
            });
        }

        // 3. Perform debit on sender (triggers WITHDRAWAL in Transactions)
        await connection.query(
            'UPDATE Accounts SET balance = balance - ? WHERE account_number = ?',
            [transferAmount, sender_account]
        );

        // 4. Perform credit on receiver (triggers DEPOSIT in Transactions)
        await connection.query(
            'UPDATE Accounts SET balance = balance + ? WHERE account_number = ?',
            [transferAmount, receiver_account]
        );

        // 5. Update the trigger-created transaction audit records to 'TRANSFER'
        await connection.query(
            'UPDATE Transactions SET transaction_type = ? WHERE account_number = ? ORDER BY transaction_id DESC LIMIT 1',
            ['TRANSFER', sender_account]
        );
        await connection.query(
            'UPDATE Transactions SET transaction_type = ? WHERE account_number = ? ORDER BY transaction_id DESC LIMIT 1',
            ['TRANSFER', receiver_account]
        );

        // 6. Record the transfer in Transfers table
        const [transferResult] = await connection.query(
            'INSERT INTO Transfers (sender_account, receiver_account, amount) VALUES (?, ?, ?)',
            [sender_account, receiver_account, transferAmount]
        );

        await connection.commit();

        const [senderUpdated] = await pool.query('SELECT balance FROM Accounts WHERE account_number = ?', [sender_account]);

        res.json({
            success: true,
            message: `Transfer of ₹${transferAmount.toFixed(2)} from #${sender_account} to #${receiver_account} completed successfully.`,
            transfer_id: transferResult.insertId,
            sender_account,
            receiver_account,
            amount: transferAmount,
            sender_new_balance: parseFloat(senderUpdated[0].balance)
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error during fund transfer:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// List all transfers
exports.getAllTransfers = async (req, res) => {
    try {
        const query = `
            SELECT 
                tr.transfer_id,
                tr.sender_account,
                tr.receiver_account,
                tr.amount,
                tr.transfer_date,
                CONCAT(c1.first_name, ' ', c1.last_name) AS sender_name,
                c1.email AS sender_email,
                CONCAT(c2.first_name, ' ', c2.last_name) AS receiver_name,
                c2.email AS receiver_email
            FROM Transfers tr
            JOIN Accounts a1 ON tr.sender_account = a1.account_number
            JOIN Customers c1 ON a1.customer_id = c1.customer_id
            JOIN Accounts a2 ON tr.receiver_account = a2.account_number
            JOIN Customers c2 ON a2.customer_id = c2.customer_id
            ORDER BY tr.transfer_date DESC, tr.transfer_id DESC
            LIMIT 50
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
