// ==========================================================
// HORIZON BANK - FRONTEND API CLIENT
// ==========================================================

const API_BASE = '/api';

async function safeRequest(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        let data;
        try {
            data = await res.json();
        } catch (e) {
            data = { success: false, message: `Server responded with status ${res.status}` };
        }
        if (!res.ok && data && !data.message) {
            data.message = `HTTP Error ${res.status}`;
        }
        return data;
    } catch (err) {
        console.error(`[API Error] ${endpoint}:`, err);
        return { success: false, message: err.message || 'Network communication error' };
    }
}

const api = {
    // Dashboard & System Health
    async getStats() {
        return safeRequest('/dashboard/stats');
    },

    async getHealth() {
        return safeRequest('/health');
    },

    // Customers
    async getCustomers(search = '') {
        const endpoint = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
        return safeRequest(endpoint);
    },

    async getCustomer(id) {
        return safeRequest(`/customers/${id}`);
    },

    async createCustomer(data) {
        return safeRequest('/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateCustomer(id, data) {
        return safeRequest(`/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteCustomer(id) {
        return safeRequest(`/customers/${id}`, {
            method: 'DELETE'
        });
    },

    // Accounts
    async getAccounts({ status = '', account_type = '', search = '' } = {}) {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (account_type) params.append('account_type', account_type);
        if (search) params.append('search', search);

        return safeRequest(`/accounts?${params.toString()}`);
    },

    async getAccount(accountNumber) {
        return safeRequest(`/accounts/${accountNumber}`);
    },

    async createAccount(data) {
        return safeRequest('/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async updateAccountStatus(accountNumber, status) {
        return safeRequest(`/accounts/${accountNumber}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
    },

    // Transactions & Transfers
    async getTransactions({ accountNumber = '', type = '', limit = 50 } = {}) {
        const params = new URLSearchParams();
        if (accountNumber) params.append('accountNumber', accountNumber);
        if (type) params.append('type', type);
        if (limit) params.append('limit', limit);

        return safeRequest(`/transactions?${params.toString()}`);
    },

    async deposit(account_number, amount) {
        return safeRequest('/transactions/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_number, amount })
        });
    },

    async withdraw(account_number, amount) {
        return safeRequest('/transactions/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_number, amount })
        });
    },

    async transfer(sender_account, receiver_account, amount) {
        return safeRequest('/transactions/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_account, receiver_account, amount })
        });
    },

    async getTransfers() {
        return safeRequest('/transactions/transfers');
    }
};

window.api = api;
