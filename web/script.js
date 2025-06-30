// 配置
const CONFIG = {
    // Cloudflare Workers API 端点 - 请替换为您的实际域名
    API_ENDPOINT: 'https://your-worker-name.your-subdomain.workers.dev',
    // 本地测试端点（用于开发）
    LOCAL_ENDPOINT: 'http://localhost:8787',
    // 自动刷新间隔（毫秒）
    AUTO_REFRESH_INTERVAL: 4 * 60 * 1000, // 4分钟
    // 请求超时时间
    REQUEST_TIMEOUT: 10000 // 10秒
};

// 全局状态
let currentData = null;
let autoRefreshTimer = null;
let nextUpdateTimer = null;

// 常用货币配置
const COMMON_CURRENCIES = {
    'USD': '美元',
    'EUR': '欧元', 
    'JPY': '日元',
    'GBP': '英镑',
    'AUD': '澳元',
    'CAD': '加元',
    'CHF': '瑞士法郎',
    'HKD': '港元',
    'SGD': '新加坡元',
    'NZD': '新西兰元',
    'KRW': '韩元',
    'THB': '泰铢'
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
function initializeApp() {
    console.log('🚀 汇率监控应用启动');
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 检测API端点
    detectAPIEndpoint().then(() => {
        // 立即加载数据
        loadExchangeRates();
        
        // 启动自动刷新
        startAutoRefresh();
    });
}

// 绑定事件监听器
function bindEventListeners() {
    // 刷新按钮
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshClick);
    }
    
    // 重试按钮
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', handleRetryClick);
    }
    
    // 货币筛选
    const currencySelect = document.getElementById('currencySelect');
    if (currencySelect) {
        currencySelect.addEventListener('change', handleCurrencyFilter);
    }
    
    // 模态框关闭
    const modalClose = document.getElementById('modalClose');
    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }
    
    // 点击模态框外部关闭
    const modal = document.getElementById('rateModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }
}

// 检测API端点
async function detectAPIEndpoint() {
    console.log('🔍 检测API端点...');
    
    // 首先尝试生产环境端点
    try {
        const response = await fetchWithTimeout(CONFIG.API_ENDPOINT, 3000);
        console.log('✅ 生产环境API可用');
        return;
    } catch (error) {
        console.log('⚠️ 生产环境API不可用:', error.message);
    }
    
    // 尝试本地开发端点
    try {
        const response = await fetchWithTimeout(CONFIG.LOCAL_ENDPOINT, 3000);
        CONFIG.API_ENDPOINT = CONFIG.LOCAL_ENDPOINT;
        console.log('✅ 本地开发API可用');
        return;
    } catch (error) {
        console.log('⚠️ 本地开发API不可用:', error.message);
    }
    
    console.warn('❌ 所有API端点都不可用，请检查配置');
}

// 带超时的fetch请求
function fetchWithTimeout(url, timeout = CONFIG.REQUEST_TIMEOUT) {
    return Promise.race([
        fetch(url),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('请求超时')), timeout)
        )
    ]);
}

// 加载汇率数据
async function loadExchangeRates() {
    console.log('📡 开始获取汇率数据...');
    
    // 显示加载状态
    showLoadingState();
    
    try {
        const response = await fetchWithTimeout(CONFIG.API_ENDPOINT);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ 数据获取成功:', data);
        
        // 更新全局状态
        currentData = data;
        
        // 更新界面
        updateUI(data);
        
        // 更新下次刷新时间
        updateNextRefreshTime();
        
    } catch (error) {
        console.error('❌ 数据获取失败:', error);
        showErrorState(error.message);
    }
}

// 显示加载状态
function showLoadingState() {
    document.getElementById('loadingSection').style.display = 'block';
    document.getElementById('errorSection').style.display = 'none';
    document.getElementById('ratesSection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
}

// 显示错误状态
function showErrorState(errorMessage) {
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'block';
    document.getElementById('ratesSection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
    
    const errorMessageEl = document.getElementById('errorMessage');
    if (errorMessageEl) {
        errorMessageEl.textContent = errorMessage;
    }
}

// 更新界面
function updateUI(data) {
    // 隐藏加载和错误状态
    document.getElementById('loadingSection').style.display = 'none';
    document.getElementById('errorSection').style.display = 'none';
    
    // 显示数据区域
    document.getElementById('ratesSection').style.display = 'block';
    document.getElementById('statsSection').style.display = 'flex';
    
    // 更新统计信息
    updateStats(data);
    
    // 更新最后更新时间
    updateLastUpdateTime(data.update_time || new Date().toLocaleString());
    
    // 更新银行汇率数据
    updateBanksGrid(data.data || []);
    
    // 更新货币筛选器
    updateCurrencyFilter(data.data || []);
    
    // 添加渐入动画
    document.querySelector('.container').classList.add('fade-in');
}

// 更新统计信息
function updateStats(data) {
    const elements = {
        totalBanks: document.getElementById('totalBanks'),
        successfulBanks: document.getElementById('successfulBanks'),
        successRate: document.getElementById('successRate')
    };
    
    if (elements.totalBanks) {
        elements.totalBanks.textContent = data.total_banks || 0;
    }
    
    if (elements.successfulBanks) {
        elements.successfulBanks.textContent = data.successful_banks || 0;
    }
    
    if (elements.successRate) {
        elements.successRate.textContent = data.success_rate || '0%';
    }
}

// 更新最后更新时间
function updateLastUpdateTime(updateTime) {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        // 格式化时间显示
        const date = new Date(updateTime);
        const formatted = date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastUpdateEl.textContent = formatted;
    }
}

// 更新银行网格
function updateBanksGrid(banksData) {
    const banksGrid = document.getElementById('banksGrid');
    if (!banksGrid) return;
    
    banksGrid.innerHTML = '';
    
    banksData.forEach(bankData => {
        const bankCard = createBankCard(bankData);
        banksGrid.appendChild(bankCard);
    });
}

// 创建银行卡片
function createBankCard(bankData) {
    const card = document.createElement('div');
    card.className = `bank-card ${bankData.success ? '' : 'error'}`;
    
    if (bankData.success) {
        card.innerHTML = createSuccessfulBankHTML(bankData);
    } else {
        card.innerHTML = createFailedBankHTML(bankData);
    }
    
    return card;
}

// 创建成功银行的HTML
function createSuccessfulBankHTML(bankData) {
    const rates = parseExchangeRates(bankData.data, bankData.bank_code);
    
    return `
        <div class="bank-header">
            <div class="bank-name">${bankData.bank}</div>
            <div class="bank-status">
                <div class="status-indicator"></div>
                <span>数据正常</span>
            </div>
        </div>
        <div class="bank-body">
            ${rates.length > 0 ? createRatesTable(rates) : '<div class="no-data">暂无汇率数据</div>'}
        </div>
    `;
}

// 创建失败银行的HTML
function createFailedBankHTML(bankData) {
    return `
        <div class="bank-header">
            <div class="bank-name">${bankData.bank}</div>
            <div class="bank-status">
                <div class="status-indicator error"></div>
                <span>数据异常</span>
            </div>
        </div>
        <div class="error-message-card">
            错误信息: ${bankData.error || '未知错误'}
        </div>
    `;
}

// 解析汇率数据
function parseExchangeRates(data, bankCode) {
    if (!data) return [];
    
    try {
        // 不同银行的数据格式可能不同，需要适配
        if (Array.isArray(data)) {
            return data.slice(0, 10); // 只显示前10种货币
        }
        
        if (typeof data === 'object' && data.data) {
            return Array.isArray(data.data) ? data.data.slice(0, 10) : [];
        }
        
        return [];
    } catch (error) {
        console.error('解析汇率数据失败:', error);
        return [];
    }
}

// 创建汇率表格
function createRatesTable(rates) {
    if (!rates || rates.length === 0) {
        return '<div class="no-data">暂无汇率数据</div>';
    }
    
    let tableHTML = `
        <table class="rates-table">
            <thead>
                <tr>
                    <th>货币</th>
                    <th>买入价</th>
                    <th>卖出价</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    rates.forEach(rate => {
        const currencyName = rate['币种名称'] || rate.currency_name || '';
        const currencyCode = rate['币种代码'] || rate.currency_code || '';
        const buyPrice = rate['现汇买入价'] || rate['现钞买入价'] || rate.buy_price || '--';
        const sellPrice = rate['现汇卖出价'] || rate['现钞卖出价'] || rate.sell_price || '--';
        
        tableHTML += `
            <tr>
                <td>
                    <div class="currency-name">${currencyName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">${currencyCode}</div>
                </td>
                <td><span class="rate-value buy">${formatRate(buyPrice)}</span></td>
                <td><span class="rate-value sell">${formatRate(sellPrice)}</span></td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    return tableHTML;
}

// 格式化汇率显示
function formatRate(rate) {
    if (!rate || rate === '--' || rate === '-') {
        return '--';
    }
    
    const numRate = parseFloat(rate);
    if (isNaN(numRate)) {
        return '--';
    }
    
    return numRate.toFixed(4);
}

// 更新货币筛选器
function updateCurrencyFilter(banksData) {
    const currencySelect = document.getElementById('currencySelect');
    if (!currencySelect) return;
    
    // 收集所有货币
    const currencies = new Set();
    
    banksData.forEach(bankData => {
        if (bankData.success && bankData.data) {
            const rates = parseExchangeRates(bankData.data, bankData.bank_code);
            rates.forEach(rate => {
                const code = rate['币种代码'] || rate.currency_code;
                if (code) {
                    currencies.add(code);
                }
            });
        }
    });
    
    // 清空现有选项（保留"全部货币"）
    currencySelect.innerHTML = '<option value="all">全部货币</option>';
    
    // 添加货币选项
    Array.from(currencies).sort().forEach(code => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${COMMON_CURRENCIES[code] || code} (${code})`;
        currencySelect.appendChild(option);
    });
}

// 处理刷新按钮点击
function handleRefreshClick() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
    }
    
    loadExchangeRates().finally(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
    });
}

// 处理重试按钮点击
function handleRetryClick() {
    loadExchangeRates();
}

// 处理货币筛选
function handleCurrencyFilter() {
    const currencySelect = document.getElementById('currencySelect');
    const selectedCurrency = currencySelect ? currencySelect.value : 'all';
    
    if (!currentData || !currentData.data) return;
    
    const banksGrid = document.getElementById('banksGrid');
    if (!banksGrid) return;
    
    const bankCards = banksGrid.querySelectorAll('.bank-card');
    
    bankCards.forEach((card, index) => {
        const bankData = currentData.data[index];
        if (!bankData || !bankData.success) return;
        
        if (selectedCurrency === 'all') {
            card.style.display = 'block';
            return;
        }
        
        // 检查银行是否有该货币
        const rates = parseExchangeRates(bankData.data, bankData.bank_code);
        const hasCurrency = rates.some(rate => {
            const code = rate['币种代码'] || rate.currency_code;
            return code === selectedCurrency;
        });
        
        card.style.display = hasCurrency ? 'block' : 'none';
    });
}

// 启动自动刷新
function startAutoRefresh() {
    console.log('⏰ 启动自动刷新，间隔:', CONFIG.AUTO_REFRESH_INTERVAL / 1000, '秒');
    
    // 清除现有定时器
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    // 设置新的定时器
    autoRefreshTimer = setInterval(() => {
        console.log('🔄 自动刷新数据...');
        loadExchangeRates();
    }, CONFIG.AUTO_REFRESH_INTERVAL);
}

// 更新下次刷新时间
function updateNextRefreshTime() {
    // 清除现有定时器
    if (nextUpdateTimer) {
        clearInterval(nextUpdateTimer);
    }
    
    const nextUpdateEl = document.getElementById('nextUpdate');
    if (!nextUpdateEl) return;
    
    let remainingTime = CONFIG.AUTO_REFRESH_INTERVAL / 1000; // 秒
    
    // 更新倒计时显示
    const updateCountdown = () => {
        if (remainingTime <= 0) {
            nextUpdateEl.textContent = '即将更新...';
            return;
        }
        
        const minutes = Math.floor(remainingTime / 60);
        const seconds = remainingTime % 60;
        nextUpdateEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        remainingTime--;
    };
    
    // 立即更新一次
    updateCountdown();
    
    // 每秒更新一次
    nextUpdateTimer = setInterval(updateCountdown, 1000);
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('rateModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 错误处理
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
});

// 页面卸载时清理定时器
window.addEventListener('beforeunload', function() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    if (nextUpdateTimer) {
        clearInterval(nextUpdateTimer);
    }
});

// 导出配置给用户自定义
window.ExchangeRateConfig = CONFIG; 