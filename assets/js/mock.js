// Mock 数据与基础状态
const DB = {
  categories: [
    { id: 'cat-01', name: '活鲜', code: 'HX', remark: '新鲜捕捞' },
    { id: 'cat-02', name: '冻品', code: 'DP', remark: '冷冻保鲜' },
    { id: 'cat-03', name: '饲料', code: 'SL', remark: '辅助消耗品' },
  ],
  skus: [
    { id: 'sku-1001', name: '大黄鱼 500g', category: 'cat-01', unit: '尾', spec: '500-600g', safetyStock: 50 },
    { id: 'sku-1002', name: '大黄鱼 800g', category: 'cat-01', unit: '尾', spec: '800-900g', safetyStock: 40 },
    { id: 'sku-2001', name: '冻带鱼 段', category: 'cat-02', unit: '箱', spec: '10kg', safetyStock: 20 },
    { id: 'sku-3001', name: '高蛋白配合饲料', category: 'cat-03', unit: '袋', spec: '25kg', safetyStock: 30 },
  ],
  products: [
    { id: 'p-001', skuId: 'sku-1001', batch: 'BATCH20240901', location: '冷库A-01', qty: 120, costPrice: 18.5, shelfLife: '2024-12-31', status: 'OK' },
    { id: 'p-002', skuId: 'sku-1002', batch: 'BATCH20240908', location: '冷库A-02', qty: 40, costPrice: 29.0, shelfLife: '2024-12-31', status: 'OK' },
    { id: 'p-003', skuId: 'sku-2001', batch: 'BATCH20240905', location: '冻库B-01', qty: 18, costPrice: 210, shelfLife: '2025-03-31', status: 'LOW' },
    { id: 'p-004', skuId: 'sku-3001', batch: 'BATCH20240903', location: '常温C-02', qty: 12, costPrice: 160, shelfLife: '2025-06-30', status: 'LOW' },
  ],
  purchaseOrders: [
    {
      id: 'PO-202409-001',
      supplier: '舟山海产合作社',
      date: '2024-09-12',
      items: [
        { skuId: 'sku-1001', qty: 50, price: 17.8 },
        { skuId: 'sku-3001', qty: 20, price: 158 },
      ],
      freight: 260,
      status: 'RECEIVED'
    },
  ],
  issueOrders: [
    {
      id: 'IS-202409-001',
      department: '加工车间',
      date: '2024-09-15',
      items: [
        { skuId: 'sku-1001', qty: 20 },
        { skuId: 'sku-3001', qty: 5 },
      ],
      status: 'COMPLETED'
    }
  ],
  logs: [
    { id: 1, time: '2024-09-15 09:12', user: 'Admin', action: '创建采购入库单 PO-202409-001' },
    { id: 2, time: '2024-09-15 10:25', user: 'Admin', action: '入库完成 2 个SKU' },
    { id: 3, time: '2024-09-16 13:02', user: 'Admin', action: '创建领用单 IS-202409-001' },
  ]
};

// 简单 ID 生成
function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2,8)}`;
}

// 数据访问层（模拟）
const Repo = {
  getCategoryName(id) {
    return DB.categories.find(c => c.id === id)?.name || '-';
  },
  getSku(id) {
    return DB.skus.find(s => s.id === id);
  },
  getSkuName(id) {
    return Repo.getSku(id)?.name || '-';
  },
  listProducts() {
    return DB.products;
  },
  adjustStock(productId, delta) {
    const p = DB.products.find(x => x.id === productId);
    if (!p) return;
    p.qty += delta;
    if (p.qty <= 0) {
      p.status = 'OUT';
    } else {
      const sku = Repo.getSku(p.skuId);
      p.status = p.qty < (sku?.safetyStock || 0) ? 'LOW' : 'OK';
    }
  },
  newProduct({ skuId, batch, location, qty, costPrice, shelfLife }) {
    DB.products.push({
      id: genId('p'),
      skuId,
      batch,
      location,
      qty: Number(qty),
      costPrice: Number(costPrice),
      shelfLife,
      status: 'OK'
    });
  },
  newSku(data) {
    DB.skus.push({ id: genId('sku'), ...data, safetyStock: Number(data.safetyStock || 0) });
  },
  updateSku(id, patch) {
    Object.assign(DB.skus.find(s => s.id === id) || {}, patch);
  },
  deleteSku(id) {
    const idx = DB.skus.findIndex(s => s.id === id);
    if (idx > -1) DB.skus.splice(idx,1);
  },
  newCategory(data) {
    DB.categories.push({ id: genId('cat'), ...data });
  },
  updateCategory(id, patch) {
    Object.assign(DB.categories.find(c => c.id === id) || {}, patch);
  },
  deleteCategory(id) {
    const idx = DB.categories.findIndex(c => c.id === id);
    if (idx > -1) DB.categories.splice(idx,1);
  },
  newPurchase(po) {
    DB.purchaseOrders.push(po);
  },
  newIssue(io) {
    DB.issueOrders.push(io);
  },
  pushLog(action) {
    DB.logs.unshift({
      id: Date.now(),
      time: new Date().toISOString().slice(0,16).replace('T',' '),
      user: 'Admin',
      action
    });
  }
};