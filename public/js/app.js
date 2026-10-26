// ==========================================================
// HORIZON BANK - APPLICATION CONTROLLER & UI LOGIC
// ==========================================================

// Global state
const state = {
    currentView: 'dashboard',
    customers: [],
    accounts: [],
    stats: null
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

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

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

// Modal helpers
const openModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
};

const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
};

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
    }
});

// View Navigation
const viewTitles = {
    'dashboard': 'Banking Management Console',
    'customers': 'Customer Directory & Profiles',
    'accounts': 'Bank Accounts & Portfolios',
    'transactions': 'Transactions Ledger & Audit Trail',
    'transfers': 'Inter-Account Funds Transfers'
};

function switchView(viewName) {
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
}

// ----------------------------------------------------------
// 1. DASHBOARD VIEW
// ----------------------------------------------------------
async function loadDashboard() {
    try {
        const res = await api.getStats();
        if (!res.success) throw new Error(res.message);

        const d = res.data;
        state.stats = d;

        // Metric Counters
        document.getElementById('statTotalLiquidity').textContent = formatCurrency(d.totalLiquidity);
        document.getElementById('statTotalAccounts').textContent = d.totalAccounts;
        document.getElementById('statActiveAccounts').textContent = `${d.activeAccounts} Active • ${d.frozenAccounts} Frozen`;
        document.getElementById('statTotalCustomers').textContent = d.totalCustomers;
        document.getElementById('statTotalTransfers').textContent = d.totalTransfers;
        document.getElementById('statTransferVolume').textContent = formatCurrency(d.totalTransferVolume);

        // Render account types breakdown
        const typeContainer = document.getElementById('accountTypesBreakdown');
        if (typeContainer && d.accountTypes) {
            const totalAccs = d.totalAccounts || 1;
            typeContainer.innerHTML = d.accountTypes.map(t => {
                const pct = Math.round((t.count / totalAccs) * 100);
                let fillClass = 'fill-savings';
                if (t.account_type === 'CHECKING') fillClass = 'fill-checking';
                if (t.account_type === 'FIXED_DEPOSIT') fillClass = 'fill-fd';

                return `
                    <div class="type-progress-item">
                        <div class="type-progress-labels">
                            <span>${t.account_type} (${t.count})</span>
                            <span class="mono-val">${formatCurrency(t.total_balance)} (${pct}%)</span>
                        </div>
                        <div class="progress-track">
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
                txTable.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fas fa-inbox"></i><p>No recent transactions</p></td></tr>`;
            } else {
                txTable.innerHTML = d.recentTransactions.map(tx => {
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

                    return `
                        <tr>
                            <td><span class="mono-val">#${tx.account_number}</span></td>
                            <td>${tx.first_name} ${tx.last_name}</td>
                            <td><span class="badge ${badgeClass}">${tx.transaction_type}</span></td>
                            <td><span class="mono-val ${amountClass}">${sign}${formatCurrency(tx.amount)}</span></td>
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
                    <button class="btn btn-sm btn-outline" onclick="viewCustomerDetails(${c.customer_id})">
                        <i class="far fa-eye"></i> Details
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="openNewAccountForCustomer(${c.customer_id}, '${c.first_name} ${c.last_name}')">
                        <i class="fas fa-plus"></i> Open Acc
                    </button>
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
                            <button class="btn btn-sm btn-emerald" onclick="prepareDeposit(${a.account_number})">
                                <i class="fas fa-arrow-down"></i> Deposit
                            </button>
                            <button class="btn btn-sm btn-rose" onclick="prepareWithdraw(${a.account_number})">
                                <i class="fas fa-arrow-up"></i> Withdraw
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="prepareTransferFrom(${a.account_number})">
                                <i class="fas fa-exchange-alt"></i> Transfer
                            </button>
                            ${a.status === 'ACTIVE' 
                                ? `<button class="btn btn-sm btn-outline" style="color:#fbbf24;" onclick="changeAccountStatus(${a.account_number}, 'FROZEN')">Freeze</button>` 
                                : a.status === 'FROZEN' 
                                ? `<button class="btn btn-sm btn-outline" style="color:#34d399;" onclick="changeAccountStatus(${a.account_number}, 'ACTIVE')">Unfreeze</button>` 
                                : ''}
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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Loading transactions ledger...</td></tr>`;

    try {
        const res = await api.getTransactions(filters);
        if (!res.success) throw new Error(res.message);

        if (res.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-receipt"></i><p>No transactions found</p></td></tr>`;
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

            return `
                <tr>
                    <td><span class="mono-val" style="color: var(--text-dim);">#${tx.transaction_id}</span></td>
                    <td><span class="mono-val" style="color: #38bdf8;">#${tx.account_number}</span></td>
                    <td style="font-weight: 500;">${tx.customer_name}</td>
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
// 6. DB CONNECTION HEALTH CHECK
// ----------------------------------------------------------
async function testDbConnectionQuick() {
    try {
        const start = performance.now();
        const health = await api.getHealth();
        const latency = Math.round(performance.now() - start);

        if (health.success) {
            if (health.isDemoMode) {
                showToast('info', `Cloud Demo Mode: Active (${latency}ms)`);
            } else {
                showToast('success', `MySQL Database: Connected (${latency}ms, ${health.database})`);
            }
        } else {
            showToast('error', `DB Connection: ${health.message || 'Offline'}`);
        }
    } catch (err) {
        showToast('error', `Connection Failed: ${err.message}`);
    }
}

// ----------------------------------------------------------
// MODAL ACTIONS & FORM SUBMISSIONS
// ----------------------------------------------------------

// Populate account selectors in modals
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

// Populate customer selector for Open Account modal
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
            loadAccounts();
            loadDashboard();
        } else {
            showToast(res.message, 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
};

window.viewCustomerDetails = async (custId) => {
    try {
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

            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px;">Linked Accounts (${c.accounts.length})</h4>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${c.accounts.length === 0 ? `<div class="empty-state">No accounts opened yet for this customer.</div>` : c.accounts.map(acc => `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-subtle);">
                        <div>
                            <span class="mono-val" style="color: #38bdf8; font-weight: 700;">#${acc.account_number}</span>
                            <span class="badge badge-type" style="margin-left: 8px;">${acc.account_type}</span>
                            <span class="badge ${acc.status === 'ACTIVE' ? 'badge-active' : 'badge-frozen'}" style="margin-left: 4px;">${acc.status}</span>
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
            await testDbConnectionQuick();
            closeMobileSidebar();
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

        try {
            const res = await api.createCustomer({ first_name, last_name, email, phone, address });
            if (res.success) {
                showToast(`Customer ${first_name} ${last_name} created successfully!`, 'success');
                closeModal('newCustomerModal');
                e.target.reset();
                loadCustomers();
                loadDashboard();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 2. Open Account Form
    document.getElementById('newAccountForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const customer_id = document.getElementById('accountCustomerSelect').value;
        const account_type = document.getElementById('accountTypeSelect').value;
        const initial_balance = document.getElementById('accountInitialBalance').value;

        try {
            const res = await api.createAccount({ customer_id, account_type, initial_balance });
            if (res.success) {
                showToast(`Account #${res.data.account_number} created with balance ${formatCurrency(res.data.balance)}!`, 'success');
                closeModal('newAccountModal');
                e.target.reset();
                loadAccounts();
                loadDashboard();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 3. Deposit Form
    document.getElementById('depositForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const account_number = document.getElementById('depositAccountSelect').value;
        const amount = document.getElementById('depositAmount').value;

        try {
            const res = await api.deposit(account_number, amount);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('depositModal');
                e.target.reset();
                loadDashboard();
                if (state.currentView === 'accounts') loadAccounts();
                if (state.currentView === 'transactions') loadTransactions();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 4. Withdraw Form
    document.getElementById('withdrawForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const account_number = document.getElementById('withdrawAccountSelect').value;
        const amount = document.getElementById('withdrawAmount').value;

        try {
            const res = await api.withdraw(account_number, amount);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('withdrawModal');
                e.target.reset();
                loadDashboard();
                if (state.currentView === 'accounts') loadAccounts();
                if (state.currentView === 'transactions') loadTransactions();
            } else {
                showToast(res.message, 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // 5. Transfer Form
    document.getElementById('transferForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sender_account = document.getElementById('transferSenderSelect').value;
        const receiver_account = document.getElementById('transferReceiverSelect').value;
        const amount = document.getElementById('transferAmount').value;

        try {
            const res = await api.transfer(sender_account, receiver_account, amount);
            if (res.success) {
                showToast(res.message, 'success');
                closeModal('transferModal');
                e.target.reset();
                loadDashboard();
                if (state.currentView === 'accounts') loadAccounts();
                if (state.currentView === 'transfers') loadTransfers();
                if (state.currentView === 'transactions') loadTransactions();
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
