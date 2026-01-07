// CEX Wallet Frontend
const API_BASE = 'http://localhost:3000';

// State
let currentUser = null;
let userBalances = [];

// DOM Elements
const elements = {
  userId: document.getElementById('userId'),
  connectBtn: document.getElementById('connectBtn'),
  depositChain: document.getElementById('depositChain'),
  depositAddress: document.getElementById('depositAddress'),
  copyAddress: document.getElementById('copyAddress'),
  withdrawAmount: document.getElementById('withdrawAmount'),
  withdrawToken: document.getElementById('withdrawToken'),
  withdrawAddress: document.getElementById('withdrawAddress'),
  withdrawChain: document.getElementById('withdrawChain'),
  withdrawBtn: document.getElementById('withdrawBtn'),
  withdrawableBalance: document.getElementById('withdrawableBalance'),
  maxBtn: document.getElementById('maxBtn'),
  balanceList: document.getElementById('balanceList'),
  pendingList: document.getElementById('pendingList'),
  refreshBalance: document.getElementById('refreshBalance'),
  estimatedFee: document.getElementById('estimatedFee'),
  toast: document.getElementById('toast')
};

// Tab Navigation
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}-panel`).classList.add('active');
  });
});

// Toast Notification
function showToast(message, type = 'info') {
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type}`;
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

// API Helpers
async function api(endpoint, options = {}) {
  try {
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    console.log('API Request:', endpoint, fetchOptions);
    const res = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
    const data = await res.json();
    console.log('API Response:', data);
    if (!res.ok) throw new Error(data.error || 'API Error');
    return data;
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
}

// Connect User
elements.connectBtn.addEventListener('click', async () => {
  const userId = elements.userId.value.trim();
  if (!userId) {
    showToast('请输入用户 ID', 'error');
    return;
  }
  
  try {
    currentUser = userId;
    elements.connectBtn.textContent = `用户 ${userId}`;
    elements.connectBtn.classList.add('connected');
    showToast(`已连接用户 ${userId}`, 'success');
    
    // Load initial data
    await Promise.all([
      loadDepositAddress(),
      loadBalances()
    ]);
    
    elements.copyAddress.disabled = false;
    elements.withdrawBtn.disabled = false;
  } catch (err) {
    showToast('连接失败: ' + err.message, 'error');
  }
});

// Load Deposit Address
async function loadDepositAddress() {
  if (!currentUser) return;
  
  const chain = elements.depositChain.value;
  try {
    const res = await api(`/api/user/${currentUser}/address?chain_type=${chain}`);
    elements.depositAddress.textContent = res.data.address;
  } catch (err) {
    elements.depositAddress.textContent = '获取失败';
    showToast('获取地址失败', 'error');
  }
}

elements.depositChain.addEventListener('change', loadDepositAddress);

// Copy Address
elements.copyAddress.addEventListener('click', () => {
  const address = elements.depositAddress.textContent;
  if (address && address !== '请先连接用户' && address !== '获取失败') {
    navigator.clipboard.writeText(address);
    showToast('地址已复制', 'success');
  }
});

// Load Balances
async function loadBalances() {
  if (!currentUser) return;
  
  try {
    const [totalRes, pendingRes] = await Promise.all([
      api(`/api/user/${currentUser}/balance/total`),
      api(`/api/user/${currentUser}/balance/pending`)
    ]);
    
    userBalances = totalRes.data || [];
    renderBalances(userBalances);
    renderPending(pendingRes.data || []);
    updateWithdrawableBalance();
  } catch (err) {
    showToast('获取余额失败', 'error');
  }
}

function renderBalances(balances) {
  if (!balances.length) {
    elements.balanceList.innerHTML = '<div class="empty-state">暂无资产</div>';
    return;
  }
  
  const icons = { ETH: '⟠', USDT: '₮', SOL: '◎', BTC: '₿' };
  
  elements.balanceList.innerHTML = balances.map(b => `
    <div class="balance-item">
      <div class="token-info">
        <div class="token-icon">${icons[b.token_symbol] || '💰'}</div>
        <div>
          <div class="token-name">${b.token_symbol}</div>
          <div class="token-chain">${b.address_count} 个地址</div>
        </div>
      </div>
      <div class="token-balance">
        <div class="balance-amount">${formatBalance(b.available_balance)}</div>
        ${parseFloat(b.frozen_balance) > 0 ? `<div class="balance-frozen">🔒 ${formatBalance(b.frozen_balance)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderPending(pending) {
  if (!pending.length) {
    elements.pendingList.innerHTML = '<div class="empty-state">暂无充值中的交易</div>';
    return;
  }
  
  elements.pendingList.innerHTML = pending.map(p => `
    <div class="balance-item">
      <div class="token-info">
        <div class="token-icon">⏳</div>
        <div>
          <div class="token-name">${p.token_symbol}</div>
          <div class="token-chain">${p.transaction_count} 笔交易</div>
        </div>
      </div>
      <div class="token-balance">
        <div class="balance-amount">+${formatBalance(p.pending_amount)}</div>
      </div>
    </div>
  `).join('');
}

function formatBalance(value) {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

// Update Withdrawable Balance
function updateWithdrawableBalance() {
  const token = elements.withdrawToken.value;
  const balance = userBalances.find(b => b.token_symbol === token);
  elements.withdrawableBalance.textContent = balance ? formatBalance(balance.available_balance) : '0.00';
}

elements.withdrawToken.addEventListener('change', updateWithdrawableBalance);

// Max Button
elements.maxBtn.addEventListener('click', () => {
  const token = elements.withdrawToken.value;
  const balance = userBalances.find(b => b.token_symbol === token);
  if (balance) {
    elements.withdrawAmount.value = parseFloat(balance.available_balance);
  }
});

// Withdraw
elements.withdrawBtn.addEventListener('click', async () => {
  if (!currentUser) {
    showToast('请先连接用户', 'error');
    return;
  }
  
  const amount = elements.withdrawAmount.value;
  const token = elements.withdrawToken.value;
  const to = elements.withdrawAddress.value.trim();
  const chainType = elements.withdrawChain.value;
  
  if (!amount || parseFloat(amount) <= 0) {
    showToast('请输入有效金额', 'error');
    return;
  }
  
  if (!to) {
    showToast('请输入接收地址', 'error');
    return;
  }
  
  try {
    elements.withdrawBtn.disabled = true;
    elements.withdrawBtn.textContent = '处理中...';
    
    const requestBody = {
      userId: parseInt(currentUser),
      to,
      amount,
      tokenSymbol: token,
      chainId: chainType === 'evm' ? 1 : 0,
      chainType
    };
    console.log('Withdraw request body:', requestBody);
    
    const res = await api('/api/user/withdraw', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
    
    showToast(`提现成功！提现ID: ${res.data.withdrawId}`, 'success');
    elements.withdrawAmount.value = '';
    elements.withdrawAddress.value = '';
    await loadBalances();
  } catch (err) {
    showToast('提现失败: ' + err.message, 'error');
  } finally {
    elements.withdrawBtn.disabled = false;
    elements.withdrawBtn.textContent = '提现';
  }
});

// Refresh Balance
elements.refreshBalance.addEventListener('click', () => {
  if (currentUser) {
    loadBalances();
    showToast('余额已刷新', 'success');
  }
});

// Initialize
console.log('CEX Wallet Frontend initialized');
