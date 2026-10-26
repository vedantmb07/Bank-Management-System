const { pool } = require('../config/db');

// Get all customers with their account summary
exports.getAllCustomers = async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT 
                c.customer_id,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                c.address,
                c.created_at,
                COUNT(a.account_number) AS total_accounts,
                COALESCE(SUM(a.balance), 0) AS total_balance
            FROM Customers c
            LEFT JOIN Accounts a ON c.customer_id = a.customer_id
        `;
        const params = [];

        if (search) {
            query += ` WHERE c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?`;
            const s = `%${search}%`;
            params.push(s, s, s, s);
        }

        query += ` GROUP BY c.customer_id ORDER BY c.customer_id DESC`;

        const [rows] = await pool.query(query, params);
        res.json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single customer details along with all accounts
exports.getCustomerById = async (req, res) => {
    try {
        const { id } = req.params;
        const [customers] = await pool.query('SELECT * FROM Customers WHERE customer_id = ?', [id]);
        
        if (customers.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const [accounts] = await pool.query(
            'SELECT * FROM Accounts WHERE customer_id = ? ORDER BY created_at DESC', 
            [id]
        );

        res.json({
            success: true,
            data: {
                ...customers[0],
                accounts
            }
        });
    } catch (error) {
        console.error('Error fetching customer by id:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create a new customer
exports.createCustomer = async (req, res) => {
    try {
        const { first_name, last_name, email, phone, address } = req.body;

        if (!first_name || !last_name || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'First name, last name, email, and phone number are required.'
            });
        }

        const [existing] = await pool.query(
            'SELECT customer_id FROM Customers WHERE email = ? OR phone = ?',
            [email.trim(), phone.trim()]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'A customer with this email or phone number already exists.'
            });
        }

        const [result] = await pool.query(
            'INSERT INTO Customers (first_name, last_name, email, phone, address) VALUES (?, ?, ?, ?, ?)',
            [first_name.trim(), last_name.trim(), email.trim(), phone.trim(), (address || '').trim()]
        );

        const newId = result.insertId;
        const [newCustomer] = await pool.query('SELECT * FROM Customers WHERE customer_id = ?', [newId]);

        res.status(201).json({
            success: true,
            message: 'Customer registered successfully',
            data: newCustomer[0]
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update existing customer
exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, phone, address } = req.body;

        const [exists] = await pool.query('SELECT customer_id FROM Customers WHERE customer_id = ?', [id]);
        if (exists.length === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        await pool.query(
            `UPDATE Customers 
             SET first_name = COALESCE(?, first_name),
                 last_name = COALESCE(?, last_name),
                 email = COALESCE(?, email),
                 phone = COALESCE(?, phone),
                 address = COALESCE(?, address)
             WHERE customer_id = ?`,
            [first_name, last_name, email, phone, address, id]
        );

        const [updated] = await pool.query('SELECT * FROM Customers WHERE customer_id = ?', [id]);
        res.json({
            success: true,
            message: 'Customer updated successfully',
            data: updated[0]
        });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check total balance across all accounts
        const [balanceCheck] = await pool.query(
            'SELECT COALESCE(SUM(balance), 0) AS total_balance FROM Accounts WHERE customer_id = ?',
            [id]
        );

        const totalRemaining = balanceCheck[0] ? parseFloat(balanceCheck[0].total_balance || 0) : 0;
        if (totalRemaining > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete customer with active accounts containing funds (Remaining Balance: ₹${totalRemaining.toFixed(2)}). Please withdraw or transfer funds first.`
            });
        }

        // Retrieve customer accounts to safely remove transfer references if cascade is not present
        const [accounts] = await pool.query('SELECT account_number FROM Accounts WHERE customer_id = ?', [id]);
        if (accounts && accounts.length > 0) {
            const accNums = accounts.map(a => a.account_number);
            await pool.query('DELETE FROM Transfers WHERE sender_account IN (?) OR receiver_account IN (?)', [accNums, accNums]);
        }

        const [result] = await pool.query('DELETE FROM Customers WHERE customer_id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        res.json({
            success: true,
            message: 'Customer and associated empty accounts deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting customer:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
