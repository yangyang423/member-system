import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

const MemberManagementSystem = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('input');
  const [aiInput, setAiInput] = useState('');
  const [parsedOrders, setParsedOrders] = useState([]);
  const [showParsedResult, setShowParsedResult] = useState(false);
  const [mergeUpgradeOrders, setMergeUpgradeOrders] = useState(true);
  const [expiringDays, setExpiringDays] = useState(30); // 可调节预警天数
  
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedPackage, setSelectedPackage] = useState('all');
  const [timeView, setTimeView] = useState('month');

  const priceMap = {
    '素材群': { '月卡': 19.9, '季卡': 29.9, '年卡': 88 },
    '跟圈号': { '月卡': 39.9, '季卡': 89.9, '年卡': 159.9 }
  };

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const result = await window.storage.get('member-orders-v3', true);
        if (result?.value) setOrders(JSON.parse(result.value));
      } catch (error) {
        const local = localStorage.getItem('member-orders-v3');
        if (local) setOrders(JSON.parse(local));
      }
    };
    loadOrders();
  }, []);

  const saveOrders = async (newOrders) => {
    try {
      await window.storage.set('member-orders-v3', JSON.stringify(newOrders), true);
    } catch (error) {
      localStorage.setItem('member-orders-v3', JSON.stringify(newOrders));
    }
    setOrders(newOrders);
  };

  // AI识别逻辑
  const parseAIInput = () => {
    const text = aiInput.trim();
    if (!text) return alert('请输入订单信息');

    const lines = text.split('\n').filter(l => l.trim());
    const allParsed = [];

    lines.forEach(line => {
      const lineTrimmed = line.trim();
      if (lineTrimmed.length < 5) return;

      let customer = '';
      const customerMatch = lineTrimmed.match(/^(\d+|[\u4e00-\u9fa5]{2,4})/);
      if (customerMatch) customer = customerMatch[1];

      let orderDate = new Date();
      if (lineTrimmed.includes('今天') || lineTrimmed.includes('今日')) {
        orderDate = new Date();
      } else if (lineTrimmed.includes('昨天') || lineTrimmed.includes('昨日')) {
        orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - 1);
      } else if (lineTrimmed.includes('前天')) {
        orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - 2);
      } else {
        const dateMatch = lineTrimmed.match(/(\d{1,2})月(\d{1,2})[日号]/);
        if (dateMatch) {
          orderDate = new Date(new Date().getFullYear(), parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
        }
      }
      const dateStr = orderDate.toISOString().split('T')[0];

      let channel = '';
      if (lineTrimmed.includes('朋友圈')) channel = '朋友圈';
      else if (lineTrimmed.includes('公众号')) channel = '公众号';
      else if (lineTrimmed.includes('私信')) channel = '私信';
      else if (lineTrimmed.includes('推荐')) channel = '朋友推荐';

      const orderSegments = [];
      const commaSplit = lineTrimmed.split(/[,，]/);
      
      commaSplit.forEach(segment => {
        if (segment.includes('又')) {
          const parts = segment.split('又');
          parts.forEach((p, idx) => {
            if (idx > 0) p = '又' + p;
            if (p.trim()) orderSegments.push(p.trim());
          });
        } else {
          if (segment.trim()) orderSegments.push(segment.trim());
        }
      });

      orderSegments.forEach(segment => {
        const orders = [];
        
        ['素材群', '跟圈号'].forEach(productName => {
          const productKeywords = productName === '素材群' ? ['素材群', '素材'] : ['跟圈号', '跟圈', '圈号'];
          const hasProduct = productKeywords.some(kw => segment.includes(kw));
          
          if (hasProduct) {
            const order = {
              customer: customer,
              product: productName,
              package: '',
              amount: 0,
              date: dateStr,
              startDate: dateStr,
              endDate: '',
              channel: channel,
              orderType: 'purchase',
              note: '',
              isRenewal: false,
              isUpgrade: false
            };

            if (segment.includes('年卡')) order.package = '年卡';
            else if (segment.includes('季卡')) order.package = '季卡';
            else if (segment.includes('月卡')) order.package = '月卡';

            let foundAmount = false;
            const amountPatterns = [
              segment.match(/花了?\s*(\d+\.?\d*)\s*[元块]/),
              segment.match(/(\d+\.?\d*)\s*元/),
              segment.match(/(\d+\.?\d*)\s*买/)
            ];
            
            for (const match of amountPatterns) {
              if (match) {
                order.amount = parseFloat(match[1]);
                foundAmount = true;
                break;
              }
            }

            if (segment.includes('续费')) {
              order.orderType = 'renew';
              order.note = '续费';
              order.isRenewal = true;
            } else if (segment.includes('升级')) {
              order.orderType = 'upgrade';
              order.note = '升级';
              order.isUpgrade = true;
            } else if (segment.includes('补差') || segment.includes('差价')) {
              order.orderType = 'supplement';
              order.note = '补差价';
              order.isUpgrade = true;
              const supplementMatch = segment.match(/补.*?(\d+\.?\d*)/);
              if (supplementMatch) {
                order.amount = parseFloat(supplementMatch[1]);
                foundAmount = true;
              }
            }

            if (!foundAmount && order.package && priceMap[order.product]?.[order.package]) {
              order.amount = priceMap[order.product][order.package];
            }

            if (order.package && order.amount > 0) {
              orders.push(order);
            }
          }
        });

        orders.forEach(o => {
          if (o.customer && o.product && o.package && o.amount > 0) {
            allParsed.push(o);
          }
        });
      });
    });

    if (allParsed.length === 0) {
      alert('未能识别到有效订单\n\n请包含：\n✓ 客户名称\n✓ 产品（素材群/跟圈号）\n✓ 套餐（月卡/季卡/年卡）');
      return;
    }

    setParsedOrders(allParsed);
    setShowParsedResult(true);
  };

  // 智能处理订单（续费、升级）
  const processOrderDates = (newOrder, existingOrders) => {
    const customerOrders = existingOrders.filter(o => 
      o.customer === newOrder.customer && 
      o.product === newOrder.product
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    let startDate = newOrder.date;
    let packageDays = 0;
    
    if (newOrder.package === '月卡') packageDays = 30;
    else if (newOrder.package === '季卡') packageDays = 90;
    else if (newOrder.package === '年卡') packageDays = 365;

    // 处理续费
    if (newOrder.isRenewal && customerOrders.length > 0) {
      const latestOrder = customerOrders[0];
      const latestEndDate = new Date(latestOrder.endDate);
      const now = new Date(newOrder.date);
      
      // 如果之前的套餐还没到期，续费时间从到期日开始
      if (latestEndDate > now) {
        startDate = latestOrder.endDate;
      }
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + packageDays);
    
    return {
      startDate,
      endDate: endDate.toISOString().split('T')[0]
    };
  };

  // 确认保存订单
  const confirmOrders = async () => {
    let ordersToSave = [...parsedOrders];
    
    // 智能合并同一天的升级订单
    if (mergeUpgradeOrders) {
      const merged = [];
      const upgradeGroups = new Map();
      
      ordersToSave.forEach(order => {
        const key = `${order.customer}-${order.product}-${order.date}`;
        if (!upgradeGroups.has(key)) {
          upgradeGroups.set(key, []);
        }
        upgradeGroups.get(key).push(order);
      });
      
      upgradeGroups.forEach((groupOrders, key) => {
        if (groupOrders.length === 1) {
          merged.push(groupOrders[0]);
        } else {
          const packageLevel = { '月卡': 1, '季卡': 2, '年卡': 3 };
          const sorted = groupOrders.sort((a, b) => packageLevel[a.package] - packageLevel[b.package]);
          
          let isUpgradeSequence = true;
          for (let i = 0; i < sorted.length - 1; i++) {
            if (packageLevel[sorted[i].package] >= packageLevel[sorted[i+1].package]) {
              isUpgradeSequence = false;
              break;
            }
          }
          
          if (isUpgradeSequence) {
            const finalOrder = sorted[sorted.length - 1];
            const totalAmount = sorted.reduce((sum, o) => sum + o.amount, 0);
            const packageHistory = sorted.map(o => o.package).join('→');
            
            merged.push({
              ...finalOrder,
              amount: totalAmount,
              note: `升级路径: ${packageHistory}`,
              orderType: 'upgrade',
              isUpgrade: true
            });
          } else {
            merged.push(...groupOrders);
          }
        }
      });
      
      ordersToSave = merged;
    }

    // 处理跨天升级：检查历史订单
    const processedOrders = [];
    for (const newOrder of ordersToSave) {
      if (newOrder.isUpgrade && !mergeUpgradeOrders) {
        // 跨天升级：查找最近的同客户同产品订单
        const recentOrder = orders
          .filter(o => 
            o.customer === newOrder.customer && 
            o.product === newOrder.product &&
            o.date < newOrder.date
          )
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

        if (recentOrder) {
          // 只记录补的差价
          newOrder.note = `从${recentOrder.package}升级(补差价)`;
          // amount已经是补的差价了
        }
      }

      // 计算开始和结束日期
      const dates = processOrderDates(newOrder, orders);
      newOrder.startDate = dates.startDate;
      newOrder.endDate = dates.endDate;
      
      processedOrders.push(newOrder);
    }
    
    const newOrders = [...orders, ...processedOrders.map(o => ({
      ...o,
      id: Date.now() + Math.random(),
      createTime: new Date().toISOString()
    }))];
    
    await saveOrders(newOrders);
    setAiInput('');
    setParsedOrders([]);
    setShowParsedResult(false);
    alert(`✅ 成功保存 ${processedOrders.length} 条订单！`);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (selectedProduct !== 'all' && order.product !== selectedProduct) return false;
      if (selectedPackage !== 'all' && order.package !== selectedPackage) return false;
      if (dateRange.start && order.date < dateRange.start) return false;
      if (dateRange.end && order.date > dateRange.end) return false;
      return true;
    });
  }, [orders, selectedProduct, selectedPackage, dateRange]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 总客户数（去重）
    const uniqueCustomers = new Set(filteredOrders.map(o => o.customer)).size;
    
    // 累计收入
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.amount, 0);
    
    // 活跃会员数：按客户-产品维度统计
    const activeCustomerProducts = new Set();
    filteredOrders.forEach(o => {
      if (new Date(o.endDate) >= now) {
        activeCustomerProducts.add(`${o.customer}-${o.product}`);
      }
    });
    const activeMembers = activeCustomerProducts.size;
    
    // 本月订单
    const monthOrders = filteredOrders.filter(o => new Date(o.date) >= thisMonthStart);
    
    // 复购客户数：有2笔以上订单的客户
    const customerOrderCounts = {};
    filteredOrders.forEach(o => {
      customerOrderCounts[o.customer] = (customerOrderCounts[o.customer] || 0) + 1;
    });
    const repurchaseCustomers = Object.values(customerOrderCounts).filter(count => count >= 2).length;
    
    return {
      totalOrders: filteredOrders.length,
      uniqueCustomers,
      activeMembers,
      totalRevenue,
      avgPrice: filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0,
      ltv: uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0,
      repurchaseRate: uniqueCustomers > 0 ? (repurchaseCustomers / uniqueCustomers * 100) : 0,
      monthRevenue: monthOrders.reduce((sum, o) => sum + o.amount, 0)
    };
  }, [filteredOrders]);

  const trendData = useMemo(() => {
    if (filteredOrders.length === 0) return [];
    
    const grouped = {};
    filteredOrders.forEach(order => {
      const date = new Date(order.date);
      let key;
      
      if (timeView === 'day') {
        key = order.date; // YYYY-MM-DD
      } else if (timeView === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (timeView === 'quarter') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = String(date.getFullYear());
      }
      
      if (!grouped[key]) grouped[key] = { period: key, revenue: 0, orders: 0, customers: new Set() };
      grouped[key].revenue += order.amount;
      grouped[key].orders += 1;
      grouped[key].customers.add(order.customer);
    });
    
    return Object.values(grouped).map(g => ({ ...g, customers: g.customers.size })).sort((a, b) => a.period.localeCompare(b.period));
  }, [filteredOrders, timeView]);

  const conversionData = useMemo(() => {
    const customerPackages = {};
    filteredOrders.forEach(order => {
      if (!customerPackages[order.customer]) customerPackages[order.customer] = [];
      customerPackages[order.customer].push({ package: order.package, date: order.date, product: order.product });
    });
    let monthToQuarter = 0, quarterToYear = 0, monthToYear = 0;
    Object.values(customerPackages).forEach(packages => {
      packages.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 0; i < packages.length - 1; i++) {
        if (packages[i].product === packages[i+1].product) {
          if (packages[i].package === '月卡' && packages[i+1].package === '季卡') monthToQuarter++;
          if (packages[i].package === '季卡' && packages[i+1].package === '年卡') quarterToYear++;
          if (packages[i].package === '月卡' && packages[i+1].package === '年卡') monthToYear++;
        }
      }
    });
    return [
      { name: '月卡→季卡', value: monthToQuarter },
      { name: '季卡→年卡', value: quarterToYear },
      { name: '月卡→年卡', value: monthToYear }
    ];
  }, [filteredOrders]);

  const lifecycleData = useMemo(() => {
    const customerLifecycles = {};
    filteredOrders.forEach(order => {
      if (!customerLifecycles[order.customer]) {
        customerLifecycles[order.customer] = { firstDate: order.date, lastDate: order.date, totalSpent: 0, orderCount: 0 };
      }
      const lc = customerLifecycles[order.customer];
      if (order.date < lc.firstDate) lc.firstDate = order.date;
      if (order.date > lc.lastDate) lc.lastDate = order.date;
      lc.totalSpent += order.amount;
      lc.orderCount += 1;
    });
    return Object.entries(customerLifecycles).map(([customer, lc]) => {
      const days = Math.floor((new Date(lc.lastDate) - new Date(lc.firstDate)) / (1000 * 60 * 60 * 24));
      return { customer, days, totalSpent: lc.totalSpent, orderCount: lc.orderCount };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [filteredOrders]);

  const expiringAlerts = useMemo(() => {
    const now = new Date();
    const inNDays = new Date(now.getTime() + expiringDays * 24 * 60 * 60 * 1000);
    const activeOrders = filteredOrders.filter(o => new Date(o.endDate) >= now);
    const customerLatestOrders = {};
    activeOrders.forEach(order => {
      const key = `${order.customer}-${order.product}`;
      if (!customerLatestOrders[key] || order.endDate > customerLatestOrders[key].endDate) {
        customerLatestOrders[key] = order;
      }
    });
    return Object.values(customerLatestOrders)
      .filter(o => new Date(o.endDate) <= inNDays)
      .map(o => {
        const daysLeft = Math.ceil((new Date(o.endDate) - now) / (1000 * 60 * 60 * 24));
        return { ...o, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [filteredOrders, expiringDays]);

  const customerSegments = useMemo(() => {
    const customerStats = {};
    filteredOrders.forEach(order => {
      if (!customerStats[order.customer]) {
        customerStats[order.customer] = { totalSpent: 0, orderCount: 0, lastOrderDate: order.date, hasActive: false };
      }
      const cs = customerStats[order.customer];
      cs.totalSpent += order.amount;
      cs.orderCount += 1;
      if (order.date > cs.lastOrderDate) cs.lastOrderDate = order.date;
      if (new Date(order.endDate) >= new Date()) cs.hasActive = true;
    });
    const highValue = [], atRisk = [], now = new Date();
    Object.entries(customerStats).forEach(([customer, stats]) => {
      if (stats.totalSpent >= 200 || stats.orderCount >= 3) {
        highValue.push({ customer, ...stats, segment: '高价值' });
      }
      const daysSinceLastOrder = Math.floor((now - new Date(stats.lastOrderDate)) / (1000 * 60 * 60 * 24));
      if (!stats.hasActive && daysSinceLastOrder > 30 && daysSinceLastOrder < 180) {
        atRisk.push({ customer, ...stats, daysSinceLastOrder, segment: '流失风险' });
      }
    });
    return { highValue, atRisk };
  }, [filteredOrders]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif', padding: '0 15px' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', marginBottom: '20px', borderRadius: '8px' }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>🚀 专业会员管理系统 v3.0</h1>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>智能续费 · 跨天升级 · 精准预警</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'input', label: '💬 录入' },
          { key: 'overview', label: '📊 总览' },
          { key: 'trend', label: '📈 趋势' },
          { key: 'conversion', label: '🔄 转化' },
          { key: 'lifecycle', label: '⏱️ 周期' },
          { key: 'alert', label: '⚠️ 预警' },
          { key: 'segment', label: '👥 分层' },
          { key: 'formula', label: '📐 公式' }
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: '10px 16px', border: 'none', borderRadius: '8px', background: activeTab === tab.key ? '#667eea' : '#f8f9fa', color: activeTab === tab.key ? 'white' : '#495057', cursor: 'pointer', fontWeight: activeTab === tab.key ? 'bold' : 'normal', fontSize: '14px' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'input' && activeTab !== 'formula' && (
        <div style={{ background: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}>产品</label>
              <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="all">全部</option>
                <option value="素材群">素材群</option>
                <option value="跟圈号">跟圈号</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}>套餐</label>
              <select value={selectedPackage} onChange={(e) => setSelectedPackage(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="all">全部</option>
                <option value="月卡">月卡</option>
                <option value="季卡">季卡</option>
                <option value="年卡">年卡</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}>开始</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '5px' }}>结束</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
          </div>
          <button onClick={() => { setSelectedProduct('all'); setSelectedPackage('all'); setDateRange({ start: '', end: '' }); }}
            style={{ marginTop: '10px', padding: '6px 12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
            重置筛选
          </button>
        </div>
      )}

      {activeTab === 'input' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, fontSize: '20px' }}>AI智能录入</h2>
          
          <div style={{ background: '#e7f3ff', padding: '12px', borderRadius: '8px', marginBottom: '15px', fontSize: '13px', lineHeight: '1.6' }}>
            💡 <strong>智能功能：</strong><br/>
            • <strong>续费自动续接</strong>：如果客户还有剩余天数，自动从到期日开始计算<br/>
            • <strong>升级智能处理</strong>：同一天升级自动合并；跨天升级只记录补差价<br/>
            • 示例：客户2.5买了季卡，2.7升级年卡 → 只记录差价70元<br/>
            <label style={{ display: 'flex', alignItems: 'center', marginTop: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={mergeUpgradeOrders} onChange={(e) => setMergeUpgradeOrders(e.target.checked)}
                style={{ marginRight: '6px' }} />
              开启同一天升级订单自动合并
            </label>
          </div>
          
          <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)}
            placeholder="每行一个客户...&#10;&#10;示例：&#10;01今天买了素材群月卡19.9&#10;02昨天续费跟圈号季卡&#10;03前天花了39.9买素材群季卡，又花59.1升级年卡"
            style={{ width: '100%', minHeight: '100px', padding: '12px', border: '2px solid #e9ecef', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
          
          <button onClick={parseAIInput}
            style={{ width: '100%', padding: '14px', marginTop: '15px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            🤖 智能识别
          </button>

          {showParsedResult && parsedOrders.length > 0 && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>✅ 识别到 {parsedOrders.length} 条订单</h3>
              {parsedOrders.map((order, idx) => (
                <div key={idx} style={{ padding: '12px', background: 'white', borderRadius: '8px', marginBottom: '10px', border: '2px solid #667eea' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                    <div><strong>客户:</strong> {order.customer}</div>
                    <div><strong>产品:</strong> {order.product}</div>
                    <div><strong>套餐:</strong> {order.package}</div>
                    <div><strong>金额:</strong> ¥{order.amount}</div>
                    <div><strong>类型:</strong> {order.note || order.orderType}</div>
                    <div><strong>日期:</strong> {order.date}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button onClick={confirmOrders}
                  style={{ flex: 1, padding: '12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ✓ 确认保存
                </button>
                <button onClick={() => { setParsedOrders([]); setShowParsedResult(false); }}
                  style={{ flex: 1, padding: '12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                  ✗ 取消
                </button>
              </div>
            </div>
          )}

          {orders.length > 0 && (
            <div style={{ marginTop: '20px', padding: '15px', background: 'white', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>📋 最近5条订单</h3>
              {orders.slice(-5).reverse().map((order, idx) => (
                <div key={idx} style={{ padding: '10px', borderBottom: '1px solid #f1f3f5', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong>{order.customer}</strong>
                    <span style={{ color: '#667eea', fontWeight: 'bold' }}>¥{order.amount}</span>
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {order.product} · {order.package} · {order.note || order.orderType} · {order.date}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: '总订单', value: stats.totalOrders, color: '#667eea' },
              { label: '总客户', value: stats.uniqueCustomers, color: '#764ba2' },
              { label: '活跃套餐', value: stats.activeMembers, color: '#43e97b' },
              { label: '累计收入', value: `¥${stats.totalRevenue.toFixed(0)}`, color: '#f093fb' },
              { label: '客单价', value: `¥${stats.avgPrice.toFixed(1)}`, color: '#4facfe' },
              { label: '单粉产值', value: `¥${stats.ltv.toFixed(1)}`, color: '#fa709a' },
              { label: '复购率', value: `${stats.repurchaseRate.toFixed(1)}%`, color: '#ffb347' },
              { label: '本月收入', value: `¥${stats.monthRevenue.toFixed(0)}`, color: '#667eea' }
            ].map((stat, idx) => (
              <div key={idx} style={{ background: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: stat.color, marginBottom: '6px' }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3>产品分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: '素材群', value: filteredOrders.filter(o => o.product === '素材群').length },
                    { name: '跟圈号', value: filteredOrders.filter(o => o.product === '跟圈号').length }
                  ]}
                  cx="50%" cy="50%" labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80} fill="#8884d8" dataKey="value">
                  {[0, 1].map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'trend' && (
        <div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0 }}>销售趋势</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { value: 'day', label: '按天' },
                  { value: 'month', label: '按月' },
                  { value: 'quarter', label: '按季' },
                  { value: 'year', label: '按年' }
                ].map(option => (
                  <button key={option.value} onClick={() => setTimeView(option.value)}
                    style={{ padding: '6px 12px', border: 'none', borderRadius: '4px', background: timeView === option.value ? '#667eea' : '#f8f9fa', color: timeView === option.value ? 'white' : '#495057', cursor: 'pointer', fontSize: '13px' }}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" style={{ fontSize: '12px' }} />
                  <YAxis yAxisId="left" style={{ fontSize: '12px' }} />
                  <YAxis yAxisId="right" orientation="right" style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#667eea" name="收入" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#43e97b" name="订单数" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="customers" stroke="#f093fb" name="客户数" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <p>当前筛选条件下暂无数据</p>
              </div>
            )}
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h3>会员增长</h3>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" style={{ fontSize: '12px' }} />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="customers" fill="#667eea" name="新增客户" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>暂无数据</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'conversion' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2>套餐升级转化</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={conversionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" style={{ fontSize: '12px' }} />
              <YAxis style={{ fontSize: '12px' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#667eea" name="转化人数" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '30px' }}>
            <h3>转化漏斗</h3>
            {conversionData.map((item, idx) => (
              <div key={idx} style={{ 
                background: `linear-gradient(90deg, ${COLORS[idx]} 0%, ${COLORS[idx]}88 ${(item.value / Math.max(...conversionData.map(d => d.value || 1)) * 100)}%, #f8f9fa ${(item.value / Math.max(...conversionData.map(d => d.value || 1)) * 100)}%)`,
                padding: '15px', borderRadius: '8px', marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{item.name}</strong>
                  <span>{item.value} 人</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'lifecycle' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2>生命周期分析</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>客户</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>周期(天)</th>
                  <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>订单数</th>
                  <th style={{ padding: '10px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>累计消费</th>
                </tr>
              </thead>
              <tbody>
                {lifecycleData.slice(0, 20).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f3f5' }}>
                    <td style={{ padding: '10px' }}>{item.customer}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.days}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{item.orderCount}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#667eea' }}>¥{item.totalSpent.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'alert' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0 }}>⚠️ 到期预警</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '14px' }}>预警天数:</label>
              <select value={expiringDays} onChange={(e) => setExpiringDays(Number(e.target.value))}
                style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}>
                <option value="7">7天</option>
                <option value="15">15天</option>
                <option value="30">30天</option>
                <option value="60">60天</option>
                <option value="90">90天</option>
              </select>
            </div>
          </div>
          {expiringAlerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>✅ 暂无即将到期</div>
          ) : (
            <div>
              {expiringAlerts.map((alert, idx) => (
                <div key={idx} style={{ 
                  padding: '15px', background: alert.daysLeft <= 7 ? '#fff3cd' : '#e7f3ff',
                  border: `2px solid ${alert.daysLeft <= 7 ? '#ffc107' : '#667eea'}`,
                  borderRadius: '8px', marginBottom: '10px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{alert.customer}</strong>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                        {alert.product} - {alert.package}
                      </div>
                      <div style={{ fontSize: '13px', color: '#999', marginTop: '3px' }}>
                        到期: {alert.endDate}
                      </div>
                    </div>
                    <div style={{ 
                      padding: '8px 16px', background: alert.daysLeft <= 7 ? '#dc3545' : '#ffc107',
                      color: 'white', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px'
                    }}>
                      {alert.daysLeft} 天
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'segment' && (
        <div>
          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
            <h2>💎 高价值会员 ({customerSegments.highValue.length})</h2>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              定义：累计消费 ≥ 200元 或 订单数 ≥ 3笔
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {customerSegments.highValue.slice(0, 10).map((customer, idx) => (
                <div key={idx} style={{ padding: '15px', background: '#e7f3ff', borderRadius: '8px', border: '2px solid #667eea' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{customer.customer}</strong>
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                        订单: {customer.orderCount} | 最近: {customer.lastOrderDate}
                      </div>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>
                      ¥{customer.totalSpent.toFixed(0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2>⚠️ 流失风险 ({customerSegments.atRisk.length})</h2>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              定义：已过期 + 最后订单距今 30-180天
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              {customerSegments.atRisk.slice(0, 10).map((customer, idx) => (
                <div key={idx} style={{ padding: '15px', background: '#fff3cd', borderRadius: '8px', border: '2px solid #ffc107' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '16px' }}>{customer.customer}</strong>
                      <div style={{ fontSize: '13px', color: '#666', marginTop: '5px' }}>
                        最近: {customer.lastOrderDate} | 已过期 {customer.daysSinceLastOrder} 天
                      </div>
                    </div>
                    <div style={{ fontSize: '14px', color: '#856404', fontWeight: 'bold' }}>需跟进</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'formula' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2>📐 数据计算公式</h2>
          <div style={{ fontSize: '14px', lineHeight: '1.8' }}>
            <h3 style={{ color: '#667eea', marginTop: '20px' }}>基础指标</h3>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>总订单数</strong> = 所有订单的数量
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>总客户数</strong> = 去重后的客户数量 (Set)
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>活跃套餐数</strong> = 到期日期 ≥ 今天的 [客户-产品] 组合数<br/>
              <span style={{ fontSize: '12px', color: '#666' }}>说明：一个客户可能同时有素材群和跟圈号两个活跃套餐</span>
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>累计收入</strong> = Σ(所有订单金额)
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>客单价</strong> = 累计收入 ÷ 总订单数<br/>
              <span style={{ fontSize: '12px', color: '#666' }}>说明：每笔订单的平均金额</span>
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>单粉产值 (LTV)</strong> = 累计收入 ÷ 总客户数<br/>
              <span style={{ fontSize: '12px', color: '#666' }}>说明：每个客户的平均贡献收入</span>
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>复购率</strong> = (有2笔以上订单的客户数 ÷ 总客户数) × 100%<br/>
              <span style={{ fontSize: '12px', color: '#dc3545' }}>修正：之前公式有误，已修正为统计实际复购客户占比</span>
            </div>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '10px', fontFamily: 'monospace' }}>
              <strong>本月收入</strong> = Σ(订单日期在本月的订单金额)
            </div>

            <h3 style={{ color: '#667eea', marginTop: '30px' }}>会员分层定义</h3>
            <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
              <strong style={{ color: '#667eea' }}>💎 高价值会员</strong><br/>
              条件：累计消费 ≥ 200元 <strong>或</strong> 订单数 ≥ 3笔<br/>
              <span style={{ fontSize: '12px', color: '#666', marginTop: '5px', display: 'block' }}>满足任一条件即可</span>
            </div>
            <div style={{ background: '#fff3cd', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
              <strong style={{ color: '#856404' }}>⚠️ 流失风险会员</strong><br/>
              条件1：当前无活跃套餐<br/>
              条件2：最后订单距今 30-180天<br/>
              <span style={{ fontSize: '12px', color: '#666', marginTop: '5px', display: 'block' }}>需同时满足两个条件</span>
            </div>

            <h3 style={{ color: '#667eea', marginTop: '30px' }}>特殊逻辑</h3>
            <div style={{ background: '#d4edda', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
              <strong style={{ color: '#155724' }}>🔄 续费时间计算</strong><br/>
              • 如果客户现有套餐未到期：从<strong>到期日</strong>开始续<br/>
              • 如果客户现有套餐已到期：从<strong>续费日</strong>开始算<br/>
              例：客户2.5办了月卡(到期3.5)，2.20续费季卡 → 3.5 + 90天
            </div>
            <div style={{ background: '#d4edda', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
              <strong style={{ color: '#155724' }}>⬆️ 升级处理</strong><br/>
              • <strong>同一天升级</strong>：自动合并，记录总金额<br/>
              • <strong>跨天升级</strong>：只记录补的差价<br/>
              例：2.5买季卡29.9，2.7升级年卡补差59.1 → 只记录59.1元
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberManagementSystem;