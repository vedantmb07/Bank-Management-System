// ==========================================================
// HORIZON BANK - APPLICATION CONTROLLER & UI LOGIC
// ==========================================================

// Global state
const state = {
    currentView: 'dashboard',
    customers: [],
    accounts: [],
    stats: null,
    viewedCustomerId: null
};

// Formatting utilities
const formatCurrency = (val) => {
    const num = parseFloat(val) || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const showToast = (messageOrType, typeOrMessage = 'success') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    let message = messageOrType;
    let type = typeOrMessage;
    if (['success', 'error', 'info', 'warning'].includes(messageOrType) && typeof typeOrMessage === 'string' && typeOrMessage.length > 0) {
        type = messageOrType;
        message = typeOrMessage;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 1.1rem; color: ${type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb'};"></i>
        <div style="flex: 1; font-size: 0.88rem; font-weight: 500;">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Modal helpers with automated selector population
async function populateAccountDropdowns() {
    try {
        const res = await api.getAccounts({ status: 'ACTIVE' });
        if (!res.success) return;

        const options = res.data.map(a => `
            <option value="${a.account_number}">
                #${a.account_number} - ${a.first_name} ${a.last_name} (${formatCurrency(a.balance)} | ${a.account_type})
            </option>
        `).join('');

        const depositSel = document.getElementById('depositAccountSelect');
        const withdrawSel = document.getElementById('withdrawAccountSelect');
        const transferSenderSel = document.getElementById('transferSenderSelect');
        const transferReceiverSel = document.getElementById('transferReceiverSelect');

        if (depositSel) depositSel.innerHTML = `<option value="">Select Account...</option>` + options;
        if (withdrawSel) withdrawSel.innerHTML = `<option value="">Select Account...</option>` + options;
        if (transferSenderSel) transferSenderSel.innerHTML = `<option value="">Select Sender Account...</option>` + options;
        if (transferReceiverSel) transferReceiverSel.innerHTML = `<option value="">Select Receiver Account...</option>` + options;
    } catch (e) {
        console.error('Failed to populate account dropdowns', e);
    }
}

async function populateCustomerDropdown() {
    try {
        const res = await api.getCustomers();
        if (!res.success) return;

        const custSel = document.getElementById('accountCustomerSelect');
        if (custSel) {
            custSel.innerHTML = `<option value="">Select Customer...</option>` + res.data.map(c => `
                <option value="${c.customer_id}">#${c.customer_id} - ${c.first_name} ${c.last_name} (${c.email})</option>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to populate customer dropdown', e);
    }
}

async function openModal(id) {
    try {
        if (id === 'newAccountModal') {
            const custSel = document.getElementById('accountCustomerSelect');
            const prevVal = custSel ? custSel.value : '';
            await populateCustomerDropdown();
            if (custSel && prevVal) custSel.value = prevVal;
        } else if (id === 'depositModal') {
            const sel = document.getElementById('depositAccountSelect');
            const prevVal = sel ? sel.value : '';
            await populateAccountDropdowns();
            if (sel && prevVal) sel.value = prevVal;
        } else if (id === 'withdrawModal') {
            const sel = document.getElementById('withdrawAccountSelect');
            const prevVal = sel ? sel.value : '';
            await populateAccountDropdowns();
            if (sel && prevVal) sel.value = prevVal;
        } else if (id === 'transferModal') {
            const sSel = document.getElementById('transferSenderSelect');
            const rSel = document.getElementById('transferReceiverSelect');
            const prevS = sSel ? sSel.value : '';
            const prevR = rSel ? rSel.value : '';
            await populateAccountDropdowns();
            if (sSel && prevS) sSel.value = prevS;
            if (rSel && prevR) rSel.value = prevR;
        }
    } catch (err) {
        console.warn('Error pre-populating modal options:', err);
    }
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
    if (id === 'customerDetailsModal') {
        state.viewedCustomerId = null;
    }
}

window.openModal = openModal;
window.closeModal = closeModal;
window.populateAccountDropdowns = populateAccountDropdowns;
window.populateCustomerDropdown = populateCustomerDropdown;

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
    }
});


// Master UI Synchronizer: Updates all tables, counters, feeds, dropdowns, and active modals
async function refreshAllViews() {
    try {
        await Promise.all([
            loadDashboard(),
            loadCustomers(),
            loadAccounts(),
            loadTransactions(),
            loadTransfers(),
            populateCustomerDropdown(),
            populateAccountDropdowns()
        ]);

        // If customer details modal is open, refresh its data in real-time
        if (state.viewedCustomerId) {
            const custModal = document.getElementById('customerDetailsModal');
            if (custModal && custModal.classList.contains('open')) {
                await viewCustomerDetails(state.viewedCustomerId);
            }
        }
    } catch (err) {
        console.error('Error refreshing all data views:', err);
    }
}
window.refreshAllViews = refreshAllViews;

// View Navigation
const viewTitles = {
    'dashboard': 'Banking Management Console',
    'customers': 'Customer Directory & Profiles',
    'accounts': 'Bank Accounts & Portfolios',
    'transactions': 'Transactions Ledger & Audit Trail',
    'transfers': 'Inter-Account Funds Transfers',
    'database': 'Database Diagnostics & SQL Queries Directory'
};

function switchView(viewName, filterCategory) {
    if (!viewTitles[viewName]) viewName = 'dashboard';
    state.currentView = viewName;

    // Update main heading
    const heading = document.getElementById('pageMainHeading');
    if (heading) heading.textContent = viewTitles[viewName];

    // Sync URL hash without jumping
    if (window.location.hash.slice(1) !== viewName) {
        history.pushState(null, '', `#${viewName}`);
    }

    // Update nav links
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.view === viewName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update view panels
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active-view');
    });

    const activeSection = document.getElementById(`view-${viewName}`);
    if (activeSection) {
        activeSection.classList.add('active-view');
    }

    // Load data for the view
    if (viewName === 'dashboard') loadDashboard();
    else if (viewName === 'customers') loadCustomers();
    else if (viewName === 'accounts') loadAccounts();
    else if (viewName === 'transactions') loadTransactions();
    else if (viewName === 'transfers') loadTransfers();
    else if (viewName === 'database') loadDatabaseView(filterCategory);
}
window.switchView = switchView;

// ----------------------------------------------------------
// 1. DASHBOARD VIEW
// ----------------------------------------------------------
// ----------------------------------------------------------
async function loadDashboard() {
    try {
        const res = await api.getStats();
        if (!res.success) throw new Error(res.message);

        const d = res.data;
        state.stats = d;

        // Big Hero Liquidity Balance
        const heroLiq = document.getElementById('heroTotalLiquidity');
        if (heroLiq) {
            const rawNum = (parseFloat(d.totalLiquidity) || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            heroLiq.textContent = rawNum;
        }

        // Helper to safely set text content
        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const formattedLiquidity = formatCurrency(d.totalLiquidity);
        setTxt('statTotalLiquidity', formattedLiquidity);
        setTxt('statTotalAccounts', d.totalAccounts);
        setTxt('statActiveAccounts', `${d.activeAccounts} Active Portfolios`);
        setTxt('statTotalCustomers', d.totalCustomers);
        setTxt('statTotalTransfers', d.totalTransfers);
        setTxt('statTransferVolume', formatCurrency(d.totalTransferVolume));

        // Additional Cards in Grid
        setTxt('statCardTotalAccounts', d.totalAccounts);
        setTxt('statCardActiveAccounts', `${d.activeAccounts} Active • ${d.frozenAccounts || 0} Frozen`);
        setTxt('statCardTotalCustomers', d.totalCustomers);
        setTxt('statCardTransferVolume', formatCurrency(d.totalTransferVolume));
        setTxt('statCardTotalTransfers', d.totalTransfers);

        // Average Customer Balance
        const avgBal = d.totalCustomers > 0 ? (d.totalLiquidity / d.totalCustomers) : 0;
        setTxt('statAvgCustomerBalance', formatCurrency(avgBal));

        // Render account types breakdown
        const typeContainer = document.getElementById('accountTypesBreakdown');
        if (typeContainer && d.accountTypes) {
            const totalAccs = d.totalAccounts || 1;
            typeContainer.innerHTML = d.accountTypes.map(t => {
                const pct = Math.round((t.count / totalAccs) * 100);
                let fillClass = 'fill-savings';
                let iconClass = 'fa-piggy-bank';
                if (t.account_type === 'CHECKING') {
                    fillClass = 'fill-checking';
                    iconClass = 'fa-money-check-dollar';
                }
                if (t.account_type === 'FIXED_DEPOSIT') {
                    fillClass = 'fill-fd';
                    iconClass = 'fa-vault';
                }

                return `
                    <div class="type-progress-item">
                        <div class="type-progress-labels">
                            <span style="display: inline-flex; align-items: center; gap: 6px;">
                                <i class="fas ${iconClass}" style="font-size: 0.8rem; color: var(--text-muted);"></i>
                                <strong>${t.account_type}</strong> (${t.count} accounts)
                            </span>
                            <span class="mono-val" style="font-weight: 700; color: var(--text-main);">
                                ${formatCurrency(t.total_balance)} <span style="font-size: 0.76rem; color: var(--text-muted); font-weight: 500;">(${pct}%)</span>
                            </span>
                        </div>
                        <div class="progress-track" style="height: 8px;">
                            <div class="progress-bar-fill ${fillClass}" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Render recent transactions stream
        const txTable = document.getElementById('recentTransactionsBody');
        if (txTable) {
            if (!d.recentTransactions || d.recentTransactions.length === 0) {
                txTable.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No recent transactions recorded in ledger</p></td></tr>`;
            } else {
                txTable.innerHTML = d.recentTransactions.map(tx => {
                    let badgeClass = 'badge-deposit';
                    let sign = '+';
                    let amountClass = 'amount-positive';
                    let typeIcon = 'fa-arrow-down';

                    if (tx.transaction_type === 'WITHDRAWAL') {
                        badgeClass = 'badge-withdrawal';
                        sign = '-';
                        amountClass = 'amount-negative';
                        typeIcon = 'fa-arrow-up';
                    } else if (tx.transaction_type === 'TRANSFER') {
                        badgeClass = 'badge-transfer';
                        sign = '';
                        amountClass = '';
                        typeIcon = 'fa-exchange-alt';
                    }

                    const txRef = `#TX-${String(tx.transaction_id).padStart(4, '0')}`;
                    const postBalance = tx.balance_after !== undefined && tx.balance_after !== null
                        ? formatCurrency(tx.balance_after)
                        : '-';

                    return `
                        <tr>
                            <td><span class="bank-tx-id">${txRef}</span></td>
                            <td>
                                <div style="display: flex; flex-direction: column;">
                                    <span style="font-weight: 600; color: var(--text-main); font-size: 0.85rem;">${tx.first_name || ''} ${tx.last_name || ''}</span>
                                    <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">Acc #${tx.account_number}</span>
                                </div>
                            </td>
                            <td>
                                <span class="badge ${badgeClass}" style="display: inline-flex; align-items: center; gap: 4px;">
                                    <i class="fas ${typeIcon}" style="font-size: 0.68rem;"></i>
                                    ${tx.transaction_type}
                                </span>
                            </td>
                            <td><span class="mono-val ${amountClass}" style="font-weight: 700; font-size: 0.88rem;">${sign}${formatCurrency(tx.amount)}</span></td>
                            <td><span class="mono-val" style="font-size: 0.82rem; color: var(--text-secondary);">${postBalance}</span></td>
                            <td><span class="bank-cleared-pill"><i class="fas fa-check-circle"></i> Cleared</span></td>
                            <td style="color: var(--text-dim); font-size: 0.78rem;">${formatDate(tx.transaction_date)}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

// ----------------------------------------------------------
// 2. CUSTOMERS VIEW
// ----------------------------------------------------------
async function loadCustomers(searchQuery = '') {
    const tbody = document.getElementById('customersTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Loading customer records...</td></tr>`;

    try {
        const res = await api.getCustomers(searchQuery);
        if (!res.success) throw new Error(res.message);

        state.customers = res.data;
        if (res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-users-slash"></i><p>No customers found matching "${searchQuery}"</p></td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(c => `
            <tr>
                <td><span class="mono-val" style="color: var(--text-dim);">#${c.customer_id}</span></td>
                <td>
                    <div class="avatar-cell">
                        <div class="customer-avatar">${c.first_name[0]}${c.last_name[0]}</div>
                        <div>
                            <div style="font-weight: 600;">${c.first_name} ${c.last_name}</div>
                            <div style="font-size: 0.78rem; color: var(--text-dim);">${c.address || 'No address provided'}</div>
                        </div>
                    </div>
                </td>
                <td><i class="far fa-envelope" style="color: var(--text-dim); margin-right: 6px;"></i>${c.email}</td>
                <td><i class="fas fa-phone-alt" style="color: var(--text-dim); margin-right: 6px;"></i>${c.phone}</td>
                <td><span class="badge badge-type">${c.total_accounts} Accounts</span></td>
                <td><span class="mono-val amount-positive">${formatCurrency(c.total_balance)}</span></td>
                <td>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <button class="btn btn-sm btn-outline" onclick="viewCustomerDetails(${c.customer_id})">
                            <i class="far fa-eye"></i> Details
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="openEditCustomerModal(${c.customer_id})" title="Edit Profile">
                            <i class="far fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="openNewAccountForCustomer(${c.customer_id}, '${c.first_name} ${c.last_name}')">
                            <i class="fas fa-plus"></i> Open Acc
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:#fb7185;"><i class="fas fa-exclamation-triangle"></i><p>Error loading customers: ${err.message}</p></td></tr>`;
    }
}

// ----------------------------------------------------------
// 3. ACCOUNTS VIEW
// ----------------------------------------------------------
async function loadAccounts(filters = {}) {
    const tbody = document.getElementById('accountsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Loading account accounts...</td></tr>`;

    try {
        const res = await api.getAccounts(filters);
        if (!res.success) throw new Error(res.message);

        state.accounts = res.data;
        if (res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-piggy-bank"></i><p>No accounts found</p></td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(a => {
            let statusBadge = 'badge-active';
            if (a.status === 'FROZEN') statusBadge = 'badge-frozen';
            if (a.status === 'CLOSED') statusBadge = 'badge-closed';

            return `
                <tr>
                    <td>
                        <span class="mono-val" style="font-size: 0.95rem; font-weight: 700; color: #38bdf8;">
                            #${a.account_number}
                        </span>
                    </td>
                    <td>
                        <div style="font-weight: 600;">${a.first_name} ${a.last_name}</div>
                        <div style="font-size: 0.78rem; color: var(--text-dim);">${a.email}</div>
                    </td>
                    <td><span class="badge badge-type">${a.account_type}</span></td>
                    <td><span class="mono-val amount-positive" style="font-size: 1rem;">${formatCurrency(a.balance)}</span></td>
                    <td><span class="badge ${statusBadge}">${a.status}</span></td>
                    <td style="color: var(--text-dim); font-size: 0.78rem;">${formatDate(a.created_at)}</td>
                    <td>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${a.status === 'ACTIVE' ? `
                            <button class="btn btn-sm btn-emerald" onclick="prepareDeposit(${a.account_number})">
                                <i class="fas fa-arrow-down"></i> Deposit
                            </button>
                            <button class="btn btn-sm btn-rose" onclick="prepareWithdraw(${a.account_number})">
                                <i class="fas fa-arrow-up"></i> Withdraw
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="prepareTransferFrom(${a.account_number})">
                                <i class="fas fa-exchange-alt"></i> Transfer
                            </button>
                            <button class="btn btn-sm btn-outline" style="color:#fbbf24;" onclick="changeAccountStatus(${a.account_number}, 'FROZEN')">Freeze</button>
                            <button class="btn btn-sm btn-outline" style="color:#f87171;" onclick="changeAccountStatus(${a.account_number}, 'CLOSED')">Close</button>
                            ` : a.status === 'FROZEN' ? `
                            <button class="btn btn-sm btn-outline" style="color:#34d399;" onclick="changeAccountStatus(${a.account_number}, 'ACTIVE')">Unfreeze</button>
                            <button class="btn btn-sm btn-outline" style="color:#f87171;" onclick="changeAccountStatus(${a.account_number}, 'CLOSED')">Close</button>
                            ` : `
                            <button class="btn btn-sm btn-outline" style="color:#34d399;" onclick="changeAccountStatus(${a.account_number}, 'ACTIVE')">Reactivate</button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:#fb7185;"><i class="fas fa-exclamation-triangle"></i><p>Error loading accounts: ${err.message}</p></td></tr>`;
    }
}

// ----------------------------------------------------------
// 4. TRANSACTIONS VIEW
// ----------------------------------------------------------
async function loadTransactions(filters = {}) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    if (!tbody.hasChildNodes() || tbody.innerHTML.trim() === '') {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Loading transactions ledger...</td></tr>';
    }

    try {
        const txTypeFilter = document.getElementById('txTypeFilter');
        const activeType = filters.type !== undefined ? filters.type : (txTypeFilter ? txTypeFilter.value : '');
        const queryFilters = { ...filters };
        if (activeType) queryFilters.type = activeType;

        const res = await api.getTransactions(queryFilters);
        if (!res.success) throw new Error(res.message);

        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-receipt"></i><p>No transactions found</p></td></tr>';
            return;
        }

        tbody.innerHTML = res.data.map(tx => {
            let badgeClass = 'badge-deposit';
            let sign = '+';
            let amountClass = 'amount-positive';
            if (tx.transaction_type === 'WITHDRAWAL') {
                badgeClass = 'badge-withdrawal';
                sign = '-';
                amountClass = 'amount-negative';
            } else if (tx.transaction_type === 'TRANSFER') {
                badgeClass = 'badge-transfer';
                sign = '';
                amountClass = '';
            }

            const custName = tx.customer_name || [tx.first_name, tx.last_name].filter(Boolean).join(' ') || 'Account Holder';

            return `
                <tr>
                    <td><span class="mono-val" style="color: var(--text-dim);">#${tx.transaction_id}</span></td>
                    <td><span class="mono-val" style="color: #38bdf8;">#${tx.account_number}</span></td>
                    <td style="font-weight: 500;">${custName}</td>
                    <td><span class="badge ${badgeClass}">${tx.transaction_type}</span></td>
                    <td><span class="mono-val ${amountClass}">${sign}${formatCurrency(tx.amount)}</span></td>
                    <td><span class="mono-val">${formatCurrency(tx.balance_after)}</span></td>
                    <td style="color: var(--text-dim); font-size: 0.8rem;">${formatDate(tx.transaction_date)}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="color:#fb7185;"><i class="fas fa-exclamation-triangle"></i><p>Error loading transactions: ${err.message}</p></td></tr>`;
    }
}

// ----------------------------------------------------------
// 5. TRANSFERS VIEW
// ----------------------------------------------------------
async function loadTransfers() {
    const tbody = document.getElementById('transfersTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Loading inter-account transfers...</td></tr>`;

    try {
        const res = await api.getTransfers();
        if (!res.success) throw new Error(res.message);

        if (res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-random"></i><p>No transfer records found</p></td></tr>`;
            return;
        }

        tbody.innerHTML = res.data.map(tr => `
            <tr>
                <td><span class="mono-val" style="color: var(--text-dim);">#${tr.transfer_id}</span></td>
                <td>
                    <div style="font-weight: 600;">#${tr.sender_account} (${tr.sender_name})</div>
                    <div style="font-size: 0.78rem; color: var(--text-dim);">${tr.sender_email}</div>
                </td>
                <td>
                    <div style="font-weight: 600; color: #38bdf8;">#${tr.receiver_account} (${tr.receiver_name})</div>
                    <div style="font-size: 0.78rem; color: var(--text-dim);">${tr.receiver_email}</div>
                </td>
                <td><span class="mono-val" style="font-size: 0.98rem; font-weight: 700; color: #34d399;">${formatCurrency(tr.amount)}</span></td>
                <td style="color: var(--text-dim); font-size: 0.8rem;">${formatDate(tr.transfer_date)}</td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="color:#fb7185;"><i class="fas fa-exclamation-triangle"></i><p>Error loading transfers: ${err.message}</p></td></tr>`;
    }
}

// ----------------------------------------------------------
// 6. DATABASE DIAGNOSTICS & SQL QUERIES DIRECTORY
// ----------------------------------------------------------

async function testDbConnectionQuick(silentToast = false) {
    const btn = document.getElementById('btnTestDbSection');
    const origBtnHtml = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Testing...`;

    try {
        const start = performance.now();
        const health = await api.getHealth();
        const latency = Math.round(performance.now() - start);

        // Update Diagnostics UI elements in view-database
        const dbNameEl = document.getElementById('diagDbName');
        const dbHostEl = document.getElementById('diagDbHost');
        const dbLatencyEl = document.getElementById('diagDbLatency');
        const dbTablesEl = document.getElementById('diagDbTables');
        const statusBadgeEl = document.getElementById('dbDiagStatusBadge');
        const statusBannerEl = document.getElementById('diagStatusBanner');
        const statusMsgEl = document.getElementById('diagStatusMessage');
        const statusIconEl = document.getElementById('diagStatusIcon');

        if (health.success) {
            const tableList = (health.tables || []).join(', ');
            if (dbNameEl) dbNameEl.textContent = health.database || 'BankManagementDB';
            if (dbHostEl) dbHostEl.textContent = health.isDemoMode ? '127.0.0.1:3306 (Demo Fallback)' : '127.0.0.1:3306 (MySQL 8.0)';
            if (dbLatencyEl) dbLatencyEl.textContent = `${latency} ms`;
            if (dbTablesEl) dbTablesEl.textContent = `${health.tableCount || 4} Tables (${tableList})`;

            if (statusBadgeEl) {
                statusBadgeEl.textContent = health.isDemoMode ? 'Cloud In-Memory Demo Mode' : `MySQL ${health.version || '8.0'} Live Connection`;
                if (health.isDemoMode) {
                    statusBadgeEl.parentElement?.classList.add('demo-mode');
                } else {
                    statusBadgeEl.parentElement?.classList.remove('demo-mode');
                }
            }

            if (statusBannerEl) statusBannerEl.classList.remove('is-error');
            if (statusIconEl) statusIconEl.className = 'fas fa-check-circle';
            if (statusMsgEl) statusMsgEl.textContent = `${health.message} (Ping: ${latency}ms at ${new Date().toLocaleTimeString()})`;

            if (!silentToast) {
                if (health.isDemoMode) {
                    showToast(`Cloud Demo Mode: Active (${latency}ms)`, 'info');
                } else {
                    showToast(`MySQL Database: Connected (${latency}ms, ${health.database})`, 'success');
                }
            }
        } else {
            if (statusBannerEl) statusBannerEl.classList.add('is-error');
            if (statusIconEl) statusIconEl.className = 'fas fa-exclamation-circle';
            if (statusMsgEl) statusMsgEl.textContent = `DB Error: ${health.message || 'Offline'}`;
            if (!silentToast) {
                showToast(`DB Connection: ${health.message || 'Offline'}`, 'error');
            }
        }
    } catch (err) {
        const statusBannerEl = document.getElementById('diagStatusBanner');
        const statusMsgEl = document.getElementById('diagStatusMessage');
        if (statusBannerEl) statusBannerEl.classList.add('is-error');
        if (statusMsgEl) statusMsgEl.textContent = `Connection Failure: ${err.message}`;
        if (!silentToast) {
            showToast(`Connection Failed: ${err.message}`, 'error');
        }
    } finally {
        if (btn) btn.innerHTML = origBtnHtml;
    }
}

// Complete Project SQL Queries Catalog
const sqlQueries = [
    // --- DASHBOARD SECTION ---
    {
        id: 'dash-liquidity',
        section: 'dashboard',
        sectionLabel: 'Dashboard',
        badgeType: 'Aggregate & Conditional Count',
        route: 'GET /api/dashboard/stats',
        title: 'Portfolio Total Liquidity & Simultaneous Account Status Breakdown',
        description: 'Computes total active deposits across the entire bank, along with simultaneous conditional counts of active, frozen, and closed accounts in a single table scan.',
        concepts: ['SUM() Aggregation', 'COALESCE Null Safety', 'CASE Expression', 'Conditional Aggregations'],
        query: `SELECT 
    COUNT(*) AS total_accounts,
    COALESCE(SUM(balance), 0) AS total_liquidity,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active_accounts,
    COUNT(CASE WHEN status = 'FROZEN' THEN 1 END) AS frozen_accounts,
    COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) AS closed_accounts
FROM Accounts;`
    },
    {
        id: 'dash-customers',
        section: 'dashboard',
        sectionLabel: 'Dashboard',
        badgeType: 'Entity Cardinality Count',
        route: 'GET /api/dashboard/stats',
        title: 'Total KYC-Registered Customer Count',
        description: 'Retrieves total customer records enrolled in the master database for real-time dashboard KPI tracking.',
        concepts: ['COUNT(*) Aggregate', 'Master Entity Cardinality'],
        query: `SELECT COUNT(*) AS total_customers FROM Customers;`
    },
    {
        id: 'dash-types',
        section: 'dashboard',
        sectionLabel: 'Dashboard',
        badgeType: 'Group By & Aggregations',
        route: 'GET /api/dashboard/stats',
        title: 'Portfolio Breakdown by Account Type (Savings, Checking, FD)',
        description: 'Aggregates account counts and total liquidity segregated by account type (SAVINGS, CHECKING, FIXED_DEPOSIT) for portfolio allocation bars.',
        concepts: ['GROUP BY Clause', 'SUM() & COUNT() Aggregates', 'ENUM Partitioning'],
        query: `SELECT 
    account_type, 
    COUNT(*) AS count, 
    COALESCE(SUM(balance), 0) AS total_balance 
FROM Accounts 
GROUP BY account_type;`
    },
    {
        id: 'dash-transfers',
        section: 'dashboard',
        sectionLabel: 'Dashboard',
        badgeType: 'Volume Aggregation',
        route: 'GET /api/dashboard/stats',
        title: 'Total Inter-Account Transfer Volume & Count',
        description: 'Calculates the cumulative sum of money transferred between accounts and total transfer transaction count.',
        concepts: ['Volume Metrics', 'COALESCE Fallback', 'Financial Auditing'],
        query: `SELECT 
    COUNT(*) AS total_transfers,
    COALESCE(SUM(amount), 0) AS total_transfer_volume
FROM Transfers;`
    },
    {
        id: 'dash-recent',
        section: 'dashboard',
        sectionLabel: 'Dashboard',
        badgeType: '3-Table Relational JOIN',
        route: 'GET /api/dashboard/stats',
        title: 'Real-Time Activity Stream (Transactions + Accounts + Customers)',
        description: 'Performs a 3-table relational JOIN connecting Transactions with Accounts and Customers to display owner names alongside immutable transaction audit records.',
        concepts: ['INNER JOIN', 'Foreign Key Relational Resolution', 'ORDER BY Date DESC', 'LIMIT 6 Pagination'],
        query: `SELECT 
    t.transaction_id,
    t.account_number,
    t.transaction_type,
    t.amount,
    t.balance_after,
    t.transaction_date,
    c.first_name,
    c.last_name
FROM Transactions t
JOIN Accounts a ON t.account_number = a.account_number
JOIN Customers c ON a.customer_id = c.customer_id
ORDER BY t.transaction_date DESC, t.transaction_id DESC
LIMIT 6;`
    },

    // --- CUSTOMERS SECTION ---
    {
        id: 'cust-list',
        section: 'customers',
        sectionLabel: 'Customers',
        badgeType: 'LEFT JOIN & Multi-Column Search',
        route: 'GET /api/customers?search=',
        title: 'Customer Directory with Total Accounts & Aggregated Balance',
        description: 'Performs a LEFT OUTER JOIN to list all customers including those with 0 accounts, aggregating total portfolio balance and providing multi-column search filtering.',
        concepts: ['LEFT OUTER JOIN', 'GROUP BY Primary Key', 'Wildcard LIKE Matching', 'COALESCE Handling'],
        query: `SELECT 
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
WHERE c.first_name LIKE ? 
   OR c.last_name LIKE ? 
   OR c.email LIKE ? 
   OR c.phone LIKE ?
GROUP BY c.customer_id 
ORDER BY c.customer_id DESC;`
    },
    {
        id: 'cust-profile',
        section: 'customers',
        sectionLabel: 'Customers',
        badgeType: 'Primary & Foreign Key Lookups',
        route: 'GET /api/customers/:id',
        title: 'Customer Profile Inspection & Associated Accounts Ledger',
        description: 'Fetches single master customer record by Primary Key, followed by all dependent child bank accounts via customer_id Foreign Key (1:N cardinality).',
        concepts: ['Primary Key Lookup', 'Foreign Key Traversal', '1-to-Many Relationship', 'ORDER BY created_at'],
        query: `-- 1. Fetch Master Customer Profile
SELECT * FROM Customers WHERE customer_id = ?;

-- 2. Fetch All Accounts belonging to this Customer
SELECT * FROM Accounts 
WHERE customer_id = ? 
ORDER BY created_at DESC;`
    },
    {
        id: 'cust-insert',
        section: 'customers',
        sectionLabel: 'Customers',
        badgeType: 'Unique Validation & INSERT',
        route: 'POST /api/customers',
        title: 'Customer Onboarding with Candidate Key Uniqueness Verification',
        description: 'Enforces database integrity by verifying no existing customer holds the provided unique email or phone number before issuing an INSERT.',
        concepts: ['Candidate Key Integrity', 'UNIQUE Constraints (Email & Phone)', 'DML INSERT', 'AUTO_INCREMENT Primary Key'],
        query: `-- Step 1: Pre-validation to avoid Duplicate Key Collision
SELECT customer_id FROM Customers 
WHERE email = ? OR phone = ?;

-- Step 2: Insert new verified Customer Entity
INSERT INTO Customers (first_name, last_name, email, phone, address) 
VALUES (?, ?, ?, ?, ?);

-- Step 3: Fetch Created Customer using generated ID
SELECT * FROM Customers WHERE customer_id = LAST_INSERT_ID();`
    },
    {
        id: 'cust-update',
        section: 'customers',
        sectionLabel: 'Customers',
        badgeType: 'DML UPDATE',
        route: 'PUT /api/customers/:id',
        title: 'Update Customer KYC Information & Residential Details',
        description: 'Applies localized modifications to customer name, email, phone number, and address while preserving customer_id referential links.',
        concepts: ['DML UPDATE', 'Parameterized Prepared Statements', 'Referential Link Preservation'],
        query: `UPDATE Customers 
SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ? 
WHERE customer_id = ?;`
    },
    {
        id: 'cust-delete',
        section: 'customers',
        sectionLabel: 'Customers',
        badgeType: 'ON DELETE CASCADE',
        route: 'DELETE /api/customers/:id',
        title: 'Delete Customer Record (Triggering Referential Cascade Cleanup)',
        description: 'Removes customer by ID. In accordance with the relational schema DDL, the FOREIGN KEY ON DELETE CASCADE rule automatically purges all linked accounts and audit transactions.',
        concepts: ['Referential Integrity', 'ON DELETE CASCADE', 'Automated Orphan Cleanup', 'DML DELETE'],
        query: `-- Deleting customer automatically cascades to child accounts & transactions:
DELETE FROM Customers WHERE customer_id = ?;`
    },

    // --- ACCOUNTS SECTION ---
    {
        id: 'acc-list',
        section: 'accounts',
        sectionLabel: 'Accounts',
        badgeType: 'INNER JOIN with Multi-Filters',
        route: 'GET /api/accounts?status=&account_type=&search=',
        title: 'Bank Accounts Ledger with Customer Profile Information',
        description: 'Performs an INNER JOIN between Accounts and Customers with multi-parametric filtering by account status, type, and search keyword.',
        concepts: ['INNER JOIN', 'Compound WHERE Predicates', 'ENUM Matching', 'ORDER BY created_at DESC'],
        query: `SELECT 
    a.account_number,
    a.customer_id,
    a.account_type,
    a.balance,
    a.status,
    a.created_at,
    c.first_name,
    c.last_name,
    c.email,
    c.phone
FROM Accounts a
JOIN Customers c ON a.customer_id = c.customer_id
WHERE (a.status = ? OR ? IS NULL)
  AND (a.account_type = ? OR ? IS NULL)
  AND (a.account_number LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)
ORDER BY a.created_at DESC;`
    },
    {
        id: 'acc-create',
        section: 'accounts',
        sectionLabel: 'Accounts',
        badgeType: 'FK Verification & INSERT',
        route: 'POST /api/accounts',
        title: 'Open New Bank Account with Initial Deposit',
        description: 'Verifies existence of parent customer, allocates a new unique account_number starting at 1001, and establishes foreign key connection.',
        concepts: ['Foreign Key Verification', 'AUTO_INCREMENT = 1001', 'DML INSERT', 'DECIMAL Precision'],
        query: `-- Step 1: Verify Customer Parent Entity Exists
SELECT customer_id FROM Customers WHERE customer_id = ?;

-- Step 2: Insert New Bank Account Entity
INSERT INTO Accounts (customer_id, account_type, balance, status) 
VALUES (?, ?, ?, 'ACTIVE');

-- Step 3: Fetch Created Account with Owner Details
SELECT a.*, c.first_name, c.last_name 
FROM Accounts a 
JOIN Customers c ON a.customer_id = c.customer_id 
WHERE a.account_number = LAST_INSERT_ID();`
    },
    {
        id: 'acc-details',
        section: 'accounts',
        sectionLabel: 'Accounts',
        badgeType: 'Account Statement & Audit Feed',
        route: 'GET /api/accounts/:accountNumber',
        title: 'Account Statement with Historical Transactions Ledger',
        description: 'Retrieves complete account details along with recent chronological debit and credit transaction statements.',
        concepts: ['Primary Key Filter', 'Foreign Key Relational Lookup', 'Historical Ledger Ordering', 'LIMIT 20'],
        query: `-- 1. Fetch Account and Customer Owner Details
SELECT 
    a.*,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.address
FROM Accounts a
JOIN Customers c ON a.customer_id = c.customer_id
WHERE a.account_number = ?;

-- 2. Fetch Recent Audit Transactions for Statement
SELECT * FROM Transactions 
WHERE account_number = ? 
ORDER BY transaction_date DESC, transaction_id DESC 
LIMIT 20;`
    },
    {
        id: 'acc-status',
        section: 'accounts',
        sectionLabel: 'Accounts',
        badgeType: 'State Machine UPDATE',
        route: 'PATCH /api/accounts/:accountNumber/status',
        title: 'Account Lifecycle Status Control (Freeze, Unfreeze, Close)',
        description: 'Updates account operational status, preventing transactions on frozen or closed portfolios.',
        concepts: ['State Machine Transition', 'ENUM Validation (ACTIVE, FROZEN, CLOSED)', 'DML UPDATE'],
        query: `UPDATE Accounts 
SET status = ? 
WHERE account_number = ?;`
    },

    // --- TRANSACTIONS SECTION ---
    {
        id: 'tx-ledger',
        section: 'transactions',
        sectionLabel: 'Transactions',
        badgeType: '3-Table Multi-JOIN & Ledger Audit',
        route: 'GET /api/transactions?accountNumber=&type=&limit=',
        title: 'Immutable Transactions Audit Ledger with Customer Attribution',
        description: 'Executes a 3-way relational JOIN to project transaction ledger entries with associated account type and customer holder name.',
        concepts: ['Audit Logging', '3-Table INNER JOIN', 'CONCAT String Formatting', 'LIMIT Pagination'],
        query: `SELECT 
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
WHERE (t.account_number = ? OR ? IS NULL)
  AND (t.transaction_type = ? OR ? IS NULL)
ORDER BY t.transaction_date DESC, t.transaction_id DESC 
LIMIT 50;`
    },
    {
        id: 'tx-operations',
        section: 'transactions',
        sectionLabel: 'Transactions',
        badgeType: 'Trigger-Driven Balance Operations',
        route: 'POST /api/transactions/deposit | withdraw',
        title: 'Funds Deposit & Withdrawal Operations (Firing after_account_update Trigger)',
        description: 'Modifies account balance. In DBMS architecture, application code does NOT manually insert into Transactions; the MySQL trigger executes automatically upon balance modification.',
        concepts: ['Encapsulated Business Logic', 'Database Trigger Invariant', 'Zero Ledger Drift', 'DML UPDATE'],
        query: `-- DEPOSIT OPERATION:
-- 1. Verify account is ACTIVE
SELECT * FROM Accounts WHERE account_number = ?;

-- 2. Update balance (Fires 'after_account_update' Trigger -> Inserts 'DEPOSIT' row)
UPDATE Accounts SET balance = balance + ? WHERE account_number = ?;

-- 3. Fetch verified updated balance
SELECT balance FROM Accounts WHERE account_number = ?;


-- WITHDRAWAL OPERATION:
-- 1. Check account is ACTIVE and has sufficient balance (balance >= amount)
SELECT * FROM Accounts WHERE account_number = ?;

-- 2. Update balance (Fires 'after_account_update' Trigger -> Inserts 'WITHDRAWAL' row)
UPDATE Accounts SET balance = balance - ? WHERE account_number = ?;

-- 3. Fetch verified updated balance
SELECT balance FROM Accounts WHERE account_number = ?;`
    },

    // --- TRANSFERS SECTION ---
    {
        id: 'transfer-acid',
        section: 'transfers',
        sectionLabel: 'Transfers',
        badgeType: 'ACID Transaction with FOR UPDATE',
        route: 'POST /api/transactions/transfer',
        title: 'Atomic Inter-Account Funds Transfer (Strict ACID Transaction Block)',
        description: 'Enforces ACID guarantees with pessimistic row-level locking (SELECT ... FOR UPDATE) to prevent race conditions or double-spending, committing or rolling back as an indivisible unit.',
        concepts: ['Atomicity (COMMIT/ROLLBACK)', 'Pessimistic Row Locking (FOR UPDATE)', 'Isolation Level', 'Dual Ledger Update'],
        query: `-- INITIATE STRICT ACID TRANSACTION
START TRANSACTION;

-- Step 1: Pessimistic Row Lock on Sender Account (Prevents concurrent debits)
SELECT * FROM Accounts WHERE account_number = ? FOR UPDATE;

-- Step 2: Pessimistic Row Lock on Receiver Account
SELECT * FROM Accounts WHERE account_number = ? FOR UPDATE;

-- Step 3: Debit Sender Account (Automatically triggers WITHDRAWAL audit row)
UPDATE Accounts SET balance = balance - ? WHERE account_number = ?;

-- Step 4: Credit Receiver Account (Automatically triggers DEPOSIT audit row)
UPDATE Accounts SET balance = balance + ? WHERE account_number = ?;

-- Step 5: Record Link in Dedicated Inter-Account Transfers Ledger
INSERT INTO Transfers (sender_account, receiver_account, amount) 
VALUES (?, ?, ?);

-- ATOMIC COMMIT: Persists all changes together, or ROLLBACK on any failure
COMMIT;`
    },
    {
        id: 'transfer-list',
        section: 'transfers',
        sectionLabel: 'Transfers',
        badgeType: 'Dual Multi-Table Relational JOIN',
        route: 'GET /api/transactions/transfers',
        title: 'Inter-Account Transfer History with Dual Party Name Resolution',
        description: 'Joins Accounts and Customers twice to simultaneously resolve sender account owner and receiver account owner in a single unified view.',
        concepts: ['Self-Referencing / Dual Table Aliases', 'Multi-Table Joins', 'CONCAT Formatting', 'Audit Ledger'],
        query: `SELECT 
    t.transfer_id,
    t.sender_account,
    t.receiver_account,
    t.amount,
    t.transfer_date,
    CONCAT(cs.first_name, ' ', cs.last_name) AS sender_name,
    CONCAT(cr.first_name, ' ', cr.last_name) AS receiver_name
FROM Transfers t
JOIN Accounts sender ON t.sender_account = sender.account_number
JOIN Customers cs ON sender.customer_id = cs.customer_id
JOIN Accounts receiver ON t.receiver_account = receiver.account_number
JOIN Customers cr ON receiver.customer_id = cr.customer_id
ORDER BY t.transfer_date DESC, t.transfer_id DESC;`
    },

    // --- TRIGGERS & SCHEMA DDL ---
    {
        id: 'ddl-trigger',
        section: 'triggers',
        sectionLabel: 'Triggers & Schema',
        badgeType: 'Active Database Trigger DDL',
        route: 'Database.sql',
        title: 'Automated Ledger Audit Trigger: after_account_update',
        description: 'Active database rule that fires after any balance update on Accounts, autonomously inserting an immutable audit record into Transactions without application intervention.',
        concepts: ['AFTER UPDATE Event', 'Active Database Rules', 'OLD & NEW Pseudo-Records', 'Zero Ledger Drift'],
        query: `DELIMITER $$
DROP TRIGGER IF EXISTS after_account_update$$
CREATE TRIGGER after_account_update
AFTER UPDATE ON Accounts
FOR EACH ROW
BEGIN
    IF NEW.balance <> OLD.balance THEN
        INSERT INTO Transactions (account_number, transaction_type, amount, balance_after)
        VALUES (
            NEW.account_number, 
            IF(NEW.balance > OLD.balance, 'DEPOSIT', 'WITHDRAWAL'), 
            ABS(NEW.balance - OLD.balance), 
            NEW.balance
        );
    END IF;
END$$
DELIMITER ;`
    },
    {
        id: 'ddl-schema',
        section: 'triggers',
        sectionLabel: 'Triggers & Schema',
        badgeType: 'Relational DDL & Foreign Keys',
        route: 'Database.sql',
        title: 'Relational Database Schema Definition (DDL with Cascades & Constraints)',
        description: 'Formal relational schema definition matching EER diagram with Primary Keys, Foreign Keys, AUTO_INCREMENT seeds, and ON DELETE CASCADE constraints.',
        concepts: ['DDL CREATE TABLE', 'Primary & Foreign Keys', 'ON DELETE CASCADE', 'ENUM & DECIMAL Data Types'],
        query: `CREATE DATABASE IF NOT EXISTS BankManagementDB;
USE BankManagementDB;

-- 1. Customers Table (Master Customer Entity)
CREATE TABLE IF NOT EXISTS Customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts Table (Financial Portfolio Entity)
CREATE TABLE IF NOT EXISTS Accounts (
    account_number BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    account_type ENUM('SAVINGS', 'CHECKING', 'FIXED_DEPOSIT') NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status ENUM('ACTIVE', 'FROZEN', 'CLOSED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE CASCADE
) AUTO_INCREMENT = 1001;

-- 3. Transactions Table (Immutable Financial Ledger)
CREATE TABLE IF NOT EXISTS Transactions (
    transaction_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_number BIGINT NOT NULL,
    transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_number) REFERENCES Accounts(account_number) ON DELETE CASCADE
);

-- 4. Transfers Table (Dual-Party Inter-Account Log)
CREATE TABLE IF NOT EXISTS Transfers (
    transfer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_account BIGINT NOT NULL,
    receiver_account BIGINT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_account) REFERENCES Accounts(account_number) ON DELETE CASCADE,
    FOREIGN KEY (receiver_account) REFERENCES Accounts(account_number) ON DELETE CASCADE
);`
    },
    {
        id: 'ddl-health',
        section: 'triggers',
        sectionLabel: 'Triggers & Schema',
        badgeType: 'Data Dictionary Introspection',
        route: 'GET /api/health',
        title: 'Database Engine Health & Catalog Verification Queries',
        description: 'Introspects current MySQL database session catalog, engine version, and verifies physical tables count.',
        concepts: ['Data Dictionary Metadata', 'SHOW TABLES', 'DATABASE() & VERSION() Functions'],
        query: `-- 1. Introspect active database and engine version
SELECT DATABASE() AS current_db, VERSION() AS version;

-- 2. Verify registered tables in schema
SHOW TABLES;`
    }
];

let currentSqlFilter = 'all';
let currentSqlSearch = '';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function highlightSql(rawSql) {
    let escaped = escapeHtml(rawSql);

    // 1. Extract comments: -- ...
    const comments = [];
    escaped = escaped.replace(/(--[^\n\r]*)/g, (match) => {
        comments.push(match);
        return `___COMMENT_${comments.length - 1}___`;
    });

    // 2. Extract string literals: '...'
    const strings = [];
    escaped = escaped.replace(/('([^'\\]|\\.)*')/g, (match) => {
        strings.push(match);
        return `___STR_${strings.length - 1}___`;
    });

    // 3. Highlight SQL Keywords
    const keywords = [
        'START TRANSACTION', 'COMMIT', 'ROLLBACK', 'FOR UPDATE',
        'INSERT IGNORE INTO', 'INSERT INTO', 'DELETE FROM', 'CREATE DATABASE',
        'CREATE TABLE', 'DROP TRIGGER', 'CREATE TRIGGER', 'AFTER UPDATE ON',
        'FOR EACH ROW', 'ON DELETE CASCADE', 'IF NOT EXISTS', 'PRIMARY KEY',
        'AUTO_INCREMENT', 'FOREIGN KEY', 'REFERENCES', 'DEFAULT CURRENT_TIMESTAMP',
        'GROUP BY', 'ORDER BY', 'LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN',
        'SHOW TABLES', 'SELECT', 'FROM', 'WHERE', 'JOIN', 'ON', 'AS', 'AND',
        'OR', 'NOT', 'ASC', 'DESC', 'LIMIT', 'VALUES', 'UPDATE', 'SET',
        'DELETE', 'CASE', 'WHEN', 'THEN', 'END', 'BEGIN', 'IF', 'DELIMITER',
        'USE', 'TIMESTAMP', 'DEFAULT', 'NEW', 'OLD'
    ];
    keywords.sort((a, b) => b.length - a.length);
    const kwRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    escaped = escaped.replace(kwRegex, (match) => `<span class="sql-kw">${match.toUpperCase()}</span>`);

    // 4. Highlight Common SQL Functions
    const functions = ['COUNT', 'SUM', 'COALESCE', 'ABS', 'LAST_INSERT_ID', 'DATABASE', 'VERSION', 'CONCAT'];
    const fnRegex = new RegExp(`\\b(${functions.join('|')})\\b`, 'gi');
    escaped = escaped.replace(fnRegex, (match) => `<span class="sql-fn">${match.toUpperCase()}</span>`);

    // 5. Highlight Table Names
    const tables = ['Customers', 'Accounts', 'Transactions', 'Transfers', 'BankManagementDB'];
    tables.forEach(table => {
        const tRegex = new RegExp(`\\b${table}\\b`, 'g');
        escaped = escaped.replace(tRegex, `<span class="sql-table">${table}</span>`);
    });

    // 6. Restore string literals
    escaped = escaped.replace(/___STR_(\d+)___/g, (_, idx) => `<span class="sql-str">${strings[idx]}</span>`);

    // 7. Restore comments
    escaped = escaped.replace(/___COMMENT_(\d+)___/g, (_, idx) => `<span class="sql-comment">${comments[idx]}</span>`);

    return escaped;
}

function renderSqlQueries(filter = currentSqlFilter, search = currentSqlSearch) {
    currentSqlFilter = filter;
    currentSqlSearch = search;

    const container = document.getElementById('sqlCardsContainer');
    if (!container) return;

    // Filter queries
    const qLower = search.trim().toLowerCase();
    const filtered = sqlQueries.filter(item => {
        const matchesSection = (filter === 'all' || item.section === filter);
        const matchesSearch = !qLower || (
            item.title.toLowerCase().includes(qLower) ||
            item.description.toLowerCase().includes(qLower) ||
            item.query.toLowerCase().includes(qLower) ||
            item.badgeType.toLowerCase().includes(qLower) ||
            item.route.toLowerCase().includes(qLower) ||
            item.concepts.some(c => c.toLowerCase().includes(qLower))
        );
        return matchesSection && matchesSearch;
    });

    // Update section counts on filter pills
    const countAll = document.getElementById('countAllSql');
    if (countAll) countAll.textContent = sqlQueries.length;
    ['dashboard', 'customers', 'accounts', 'transactions', 'transfers', 'triggers'].forEach(sec => {
        const el = document.getElementById(`count${sec.charAt(0).toUpperCase() + sec.slice(1)}Sql`);
        if (el) el.textContent = sqlQueries.filter(q => q.section === sec).length;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="card-panel" style="text-align: center; padding: 40px;">
                <i class="fas fa-search" style="font-size: 2rem; color: var(--text-dim); margin-bottom: 12px;"></i>
                <h4 style="color: var(--text-secondary);">No matching SQL queries found</h4>
                <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">Try searching for another keyword or switch section filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const highlighted = highlightSql(item.query);
        const conceptsHtml = item.concepts.map(c => `<span class="sql-concept-tag">${escapeHtml(c)}</span>`).join('');

        return `
            <div class="sql-query-card" id="query-${item.id}">
                <div class="sql-card-header">
                    <div class="sql-header-badges">
                        <span class="sql-badge sql-badge-section">${escapeHtml(item.sectionLabel)}</span>
                        <span class="sql-badge sql-badge-type">${escapeHtml(item.badgeType)}</span>
                        <span class="sql-badge sql-badge-route">${escapeHtml(item.route)}</span>
                    </div>
                    <button class="btn-copy-sql" onclick="copySqlQuery('${item.id}')" id="copyBtn-${item.id}">
                        <i class="far fa-copy"></i> Copy SQL
                    </button>
                </div>
                <h4 class="sql-card-title">${escapeHtml(item.title)}</h4>
                <p class="sql-card-desc">${escapeHtml(item.description)}</p>
                
                <pre class="sql-code-block"><code>${highlighted}</code></pre>
                
                <div class="sql-card-footer">
                    <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-dim); margin-right: 4px;">DBMS Concepts:</span>
                    ${conceptsHtml}
                </div>
            </div>
        `;
    }).join('');
}

function copySqlQuery(queryId) {
    const item = sqlQueries.find(q => q.id === queryId);
    if (!item) return;

    navigator.clipboard.writeText(item.query).then(() => {
        const btn = document.getElementById(`copyBtn-${queryId}`);
        if (btn) {
            btn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = `<i class="far fa-copy"></i> Copy SQL`;
                btn.classList.remove('copied');
            }, 2000);
        }
        showToast('SQL Query copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy SQL query', 'error');
    });
}
window.copySqlQuery = copySqlQuery;

function loadDatabaseView(filterCategory) {
    if (filterCategory) {
        currentSqlFilter = filterCategory;
        document.querySelectorAll('.sql-filter-pill').forEach(pill => {
            if (pill.dataset.section === filterCategory) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }
    renderSqlQueries(currentSqlFilter, currentSqlSearch);
    testDbConnectionQuick(true);
}

// ----------------------------------------------------------
// MODAL ACTIONS & FORM SUBMISSIONS
// ----------------------------------------------------------

// (Dropdown helper functions declared above and attached to window)

// Action button triggers from table
window.prepareDeposit = async (accNum) => {
    await populateAccountDropdowns();
    const sel = document.getElementById('depositAccountSelect');
    if (sel) sel.value = accNum;
    openModal('depositModal');
};

window.prepareWithdraw = async (accNum) => {
    await populateAccountDropdowns();
    const sel = document.getElementById('withdrawAccountSelect');
    if (sel) sel.value = accNum;
    openModal('withdrawModal');
};

window.prepareTransferFrom = async (accNum) => {
    await populateAccountDropdowns();
    const sel = document.getElementById('transferSenderSelect');
    if (sel) sel.value = accNum;
    openModal('transferModal');
};

window.openNewAccountForCustomer = async (custId, custName) => {
    await populateCustomerDropdown();
    const sel = document.getElementById('accountCustomerSelect');
    if (sel) sel.value = custId;
    openModal('newAccountModal');
};

window.changeAccountStatus = async (accNum, newStatus) => {
    if (!confirm(`Are you sure you want to set Account #${accNum} status to ${newStatus}?`)) return;
    try {
        const res = await api.updateAccountStatus(accNum, newStatus);
        if (res.success) {
            showToast(res.message, 'success');
            await refreshAllViews();
        } else {
            showToast(res.message, 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.viewCustomerDetails = async (custId) => {
    try {
        state.viewedCustomerId = custId;
        const res = await api.getCustomer(custId);
        if (!res.success) throw new Error(res.message);

        const c = res.data;
        const detailsBody = document.getElementById('customerDetailsModalBody');
        if (!detailsBody) return;

        detailsBody.innerHTML = `
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border-subtle);">
                <div class="customer-avatar" style="width: 48px; height: 48px; font-size: 1.1rem;">${c.first_name[0]}${c.last_name[0]}</div>
                <div>
                    <h3 style="font-size: 1.2rem; font-weight: 700;">${c.first_name} ${c.last_name}</h3>
                    <div style="font-size: 0.8rem; color: var(--text-dim);">Customer ID: #${c.customer_id} • Registered ${formatDate(c.created_at)}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
                    <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Email Address</div>
                    <div style="font-weight: 600;">${c.email}</div>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
                    <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Phone Number</div>
                    <div style="font-weight: 600;">${c.phone}</div>
                </div>
                <div style="grid-column: span 2; background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle);">
                    <div style="font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase;">Address</div>
                    <div style="font-weight: 500;">${c.address || 'No address on file'}</div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; margin-top: 16px;">
                <h4 style="font-size: 0.95rem; font-weight: 700;">Linked Accounts (${c.accounts.length})</h4>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-outline" onclick="openEditCustomerModal(${c.customer_id})">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                    <button class="btn btn-sm btn-outline" style="color: #f87171;" onclick="handleDeleteCustomer(${c.customer_id})">
                        <i class="fas fa-trash-alt"></i> Delete Customer
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="openNewAccountForCustomer(${c.customer_id}, '${c.first_name} ${c.last_name}')">
                        <i class="fas fa-plus"></i> Open Account
                    </button>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${c.accounts.length === 0 ? `<div class="empty-state">No accounts opened yet for this customer.</div>` : c.accounts.map(acc => `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-subtle);">
                        <div>
                            <span class="mono-val" style="color: #38bdf8; font-weight: 700;">#${acc.account_number}</span>
                            <span class="badge badge-type" style="margin-left: 8px;">${acc.account_type}</span>
                            <span class="badge ${acc.status === 'ACTIVE' ? 'badge-active' : acc.status === 'FROZEN' ? 'badge-frozen' : 'badge-closed'}" style="margin-left: 4px;">${acc.status}</span>
                        </div>
                        <div class="mono-val amount-positive" style="font-size: 1.1rem; font-weight: 700;">
                            ${formatCurrency(acc.balance)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        openModal('customerDetailsModal');
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.openEditCustomerModal = async (custId) => {
    try {
        const res = await api.getCustomer(custId);
        if (!res.success) throw new Error(res.message);
        const c = res.data;
        document.getElementById('editCustId').value = c.customer_id;
        document.getElementById('editCustFirstName').value = c.first_name;
        document.getElementById('editCustLastName').value = c.last_name;
        document.getElementById('editCustEmail').value = c.email;
        document.getElementById('editCustPhone').value = c.phone;
        document.getElementById('editCustAddress').value = c.address || '';
        openModal('editCustomerModal');
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.handleDeleteCustomer = async (custId) => {
    try {
        const custRes = await api.getCustomer(custId);
        if (!custRes.success) throw new Error(custRes.message);
        const c = custRes.data;

        const totalRemaining = (c.accounts || []).reduce((sum, a) => sum + parseFloat(a.balance), 0);
        if (totalRemaining > 0) {
            showToast(`Cannot delete customer: ${c.first_name} has remaining balance of ${formatCurrency(totalRemaining)}. Please withdraw or transfer funds first.`, 'error');
            return;
        }

        if (!confirm(`Are you sure you want to permanently delete customer ${c.first_name} ${c.last_name}? Associated empty accounts will be closed.`)) {
            return;
        }

        const res = await api.deleteCustomer(custId);
        if (res.success) {
            showToast(res.message, 'success');
            state.viewedCustomerId = null;
            closeModal('customerDetailsModal');
            await refreshAllViews();
        } else {
            showToast(res.message, 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
};

// ----------------------------------------------------------
// EVENT LISTENERS INITIALIZATION
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Mobile Drawer Controls
    const appSidebar = document.getElementById('appSidebar');
    const sidebarBackdrop = document.getElementById('sidebarBackdrop');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

    const openMobileSidebar = () => {
        if (appSidebar) appSidebar.classList.add('mobile-open');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
    };

    const closeMobileSidebar = () => {
        if (appSidebar) appSidebar.classList.remove('mobile-open');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
    };

    mobileMenuBtn?.addEventListener('click', openMobileSidebar);
    sidebarCloseBtn?.addEventListener('click', closeMobileSidebar);
    sidebarBackdrop?.addEventListener('click', closeMobileSidebar);

    // Brand Logo / Web App Name click -> Return to Home (Dashboard)
    const goHome = (e) => {
        e.preventDefault();
        switchView('dashboard');
        closeMobileSidebar();
    };
    document.getElementById('sidebarBrandLink')?.addEventListener('click', goHome);
    document.getElementById('headerBrandLink')?.addEventListener('click', goHome);

    // Navigation items click (and auto-close mobile drawer)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            if (view) {
                switchView(view);
                closeMobileSidebar();
            }
        });
    });

    // Group Members Dropdown Toggle
    const groupDropdownWrapper = document.getElementById('groupDropdownWrapper');
    const groupMembersBtn = document.getElementById('groupMembersBtn');

    if (groupMembersBtn && groupDropdownWrapper) {
        groupMembersBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            groupDropdownWrapper.classList.toggle('open');
            const isOpen = groupDropdownWrapper.classList.contains('open');
            groupMembersBtn.setAttribute('aria-expanded', isOpen);
        });

        // Close on clicking anywhere outside
        document.addEventListener('click', (e) => {
            if (!groupDropdownWrapper.contains(e.target)) {
                groupDropdownWrapper.classList.remove('open');
                groupMembersBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                groupDropdownWrapper.classList.remove('open');
                groupMembersBtn.setAttribute('aria-expanded', 'false');
                closeMobileSidebar();
            }
        });
    }

    // Test DB connection button in sidebar
    const testDbBtn = document.getElementById('btnTestConnection');
    if (testDbBtn) {
        testDbBtn.addEventListener('click', async () => {
            switchView('database');
            await testDbConnectionQuick(false);
            closeMobileSidebar();
        });
    }

    // Dashboard Re-Sync Button
    document.getElementById('btnSyncDashboard')?.addEventListener('click', async () => {
        const syncBtn = document.getElementById('btnSyncDashboard');
        const origHtml = syncBtn ? syncBtn.innerHTML : '';
        if (syncBtn) syncBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Syncing...</span>`;
        try {
            await Promise.all([
                loadDashboard(),
                populateCustomerDropdown(),
                populateAccountDropdowns()
            ]);
            if (state.currentView === 'customers') await loadCustomers();
            if (state.currentView === 'accounts') await loadAccounts();
            if (state.currentView === 'transactions') await loadTransactions();
            if (state.currentView === 'transfers') await loadTransfers();
            showToast('Core ledger & database state synchronized!', 'success');
        } catch (e) {
            showToast('Sync failed: ' + e.message, 'error');
        } finally {
            if (syncBtn) syncBtn.innerHTML = origHtml;
        }
    });

    // Sidebar DB status card click -> open database view
    const sidebarDbCard = document.querySelector('.db-status-card');
    if (sidebarDbCard) {
        sidebarDbCard.style.cursor = 'pointer';
        sidebarDbCard.addEventListener('click', (e) => {
            if (e.target.closest('#btnTestConnection')) return;
            switchView('database');
            closeMobileSidebar();
        });
    }

    // In-view diagnostics test button
    document.getElementById('btnTestDbSection')?.addEventListener('click', async () => {
        await testDbConnectionQuick(false);
    });

    // SQL filter pills
    document.querySelectorAll('.sql-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.sql-filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const sec = pill.dataset.section || 'all';
            renderSqlQueries(sec, currentSqlSearch);
        });
    });

    // SQL search input
    const sqlSearchInput = document.getElementById('sqlQuerySearch');
    if (sqlSearchInput) {
        let sqlSearchTimeout;
        sqlSearchInput.addEventListener('input', (e) => {
            clearTimeout(sqlSearchTimeout);
            sqlSearchTimeout = setTimeout(() => {
                renderSqlQueries(currentSqlFilter, e.target.value.trim());
            }, 200);
        });
    }

    // Modal Triggers
    document.getElementById('btnNewCustomer')?.addEventListener('click', () => openModal('newCustomerModal'));
    document.getElementById('btnNewAccount')?.addEventListener('click', async () => {
        await populateCustomerDropdown();
        openModal('newAccountModal');
    });
    document.getElementById('btnDeposit')?.addEventListener('click', async () => {
        await populateAccountDropdowns();
        openModal('depositModal');
    });
    document.getElementById('btnWithdraw')?.addEventListener('click', async () => {
        await populateAccountDropdowns();
        openModal('withdrawModal');
    });
    document.getElementById('btnTransfer')?.addEventListener('click', async () => {
        await populateAccountDropdowns();
        openModal('transferModal');
    });

    // Search & Filter Listeners
    const custSearch = document.getElementById('customerSearchInput');
    if (custSearch) {
        let timeout;
        custSearch.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => loadCustomers(e.target.value.trim()), 300);
        });
    }

    const accSearch = document.getElementById('accountSearchInput');
    if (accSearch) {
        let timeout;
        accSearch.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => loadAccounts({ search: e.target.value.trim() }), 300);
        });
    }

    // Filter pills for accounts
    document.querySelectorAll('.account-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.account-filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const type = pill.dataset.type;
            const status = pill.dataset.status;
            loadAccounts({ account_type: type || '', status: status || '' });
        });
    });

    // Transaction filter
    const txTypeFilter = document.getElementById('txTypeFilter');
    if (txTypeFilter) {
        txTypeFilter.addEventListener('change', (e) => {
            loadTransactions({ type: e.target.value });
        });
    }

    // ------------------------------------------------------
    // FORM SUBMISSIONS
    // ------------------------------------------------------

    // 1. Add Customer Form
    document.getElementById('newCustomerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const first_name = document.getElementById('custFirstName').value.trim();
        const last_name = document.getElementById('custLastName').value.trim();
        const email = document.getElementById('custEmail').value.trim();
        const phone = document.getElementById('custPhone').value.trim();
        const address = document.getElementById('custAddress').value.trim();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

        try {
            const res = await api.createCustomer({ first_name, last_name, email, phone, address });
            if (res.success) {
                showToast(`Customer ${first_name} ${last_name} created successfully!`, 'success');
                closeModal('newCustomerModal');
                e.target.reset();
                await refreshAllViews();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) submitBtn.innerHTML = origBtnText;
        }
    });

    // 2. Open Account Form
    document.getElementById('newAccountForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customer_id = document.getElementById('accountCustomerSelect').value;
        const account_type = document.getElementById('accountTypeSelect').value;
        const initial_balance = document.getElementById('accountInitialBalance').value;

        if (!customer_id) {
            showToast('Please select a customer for this account.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            const res = await api.createAccount({ customer_id, account_type, initial_balance });
            if (res.success) {
                showToast(`Account #${res.data.account_number} created with balance ${formatCurrency(res.data.balance)}!`, 'success');
                closeModal('newAccountModal');
                e.target.reset();
                await refreshAllViews();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) submitBtn.innerHTML = origBtnText;
        }
    });

    // 3. Deposit Form
    document.getElementById('depositForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const account_number = document.getElementById('depositAccountSelect').value;
        const amount = document.getElementById('depositAmount').value;

        if (!account_number) {
            showToast('Please select an account for deposit.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const res = await api.deposit(account_number, amount);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('depositModal');
                e.target.reset();
                await refreshAllViews();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) submitBtn.innerHTML = origBtnText;
        }
    });

    // 4. Withdraw Form
    document.getElementById('withdrawForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const account_number = document.getElementById('withdrawAccountSelect').value;
        const amount = document.getElementById('withdrawAmount').value;

        if (!account_number) {
            showToast('Please select an account for withdrawal.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            const res = await api.withdraw(account_number, amount);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('withdrawModal');
                e.target.reset();
                await refreshAllViews();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) submitBtn.innerHTML = origBtnText;
        }
    });

    // 5. Transfer Form
    document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sender_account = document.getElementById('transferSenderSelect').value;
        const receiver_account = document.getElementById('transferReceiverSelect').value;
        const amount = document.getElementById('transferAmount').value;

        if (!sender_account || !receiver_account) {
            showToast('Please select both sender and receiver accounts.', 'error');
            return;
        }

        if (sender_account === receiver_account) {
            showToast('Sender and receiver accounts cannot be the same.', 'error');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Transferring...';

        try {
            const res = await api.transfer(sender_account, receiver_account, amount);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('transferModal');
                e.target.reset();
                await refreshAllViews();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            if (submitBtn) submitBtn.innerHTML = origBtnText;
        }
    });

    // 6. Edit Customer Form
    document.getElementById('editCustomerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editCustId').value;
        const first_name = document.getElementById('editCustFirstName').value.trim();
        const last_name = document.getElementById('editCustLastName').value.trim();
        const email = document.getElementById('editCustEmail').value.trim();
        const phone = document.getElementById('editCustPhone').value.trim();
        const address = document.getElementById('editCustAddress').value.trim();

        try {
            const res = await api.updateCustomer(id, { first_name, last_name, email, phone, address });
            if (res.success) {
                showToast(`Customer ${first_name} ${last_name} updated successfully!`, 'success');
                closeModal('editCustomerModal');
                await refreshAllViews();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Check DB status on startup to update indicator
    api.getHealth().then(health => {
        const badge = document.getElementById('headerDbStatus');
        const sidebarBadge = document.getElementById('sidebarDbBadge');
        if (health && health.success) {
            if (health.isDemoMode) {
                if (badge) {
                    badge.innerHTML = `<span class="pulse-dot" style="background:#38bdf8; box-shadow:0 0 0 0 rgba(56,189,248,0.7);"></span><span>Cloud Engine Active</span>`;
                    badge.style.background = 'rgba(56, 189, 248, 0.1)';
                    badge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                    badge.style.color = '#38bdf8';
                }
                if (sidebarBadge) {
                    sidebarBadge.innerHTML = `<span class="pulse-dot" style="background:#38bdf8;"></span><span>Cloud Memory</span>`;
                    sidebarBadge.style.color = '#38bdf8';
                }
            } else {
                if (badge) badge.innerHTML = `<span class="pulse-dot"></span><span>MySQL: ${health.database}</span>`;
            }
        }
    });

    // Handle URL hash routing
    const handleHash = () => {
        const hash = window.location.hash.slice(1);
        if (hash && viewTitles[hash]) {
            switchView(hash);
        } else {
            switchView('dashboard');
        }
    };

    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);

    // Initial load from hash or dashboard default
    handleHash();
});
