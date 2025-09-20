// 成本与分摊计算逻辑示例

const CostEngine = {
  // 简单平均法：按数量加权分摊运费/附加费
  allocateFreight(purchase) {
    const totalQty = purchase.items.reduce((a,b)=>a + b.qty,0);
    return purchase.items.map(it => ({
      skuId: it.skuId,
      basePrice: it.price,
      freightAlloc: (purchase.freight || 0) * (it.qty / totalQty),
      allocUnit: ((purchase.freight || 0) * (it.qty / totalQty)) / it.qty
    }));
  },
  // 重新计算库存成本 (示例：当前库存成本 = 入库单价 + 分摊单位运费的均值)
  recomputeCurrentInventoryCosts() {
    // 按 SKU 收集最近采购
    const costMap = {};
    DB.purchaseOrders.forEach(po => {
      const alloc = CostEngine.allocateFreight(po);
      alloc.forEach(a => {
        if (!costMap[a.skuId]) costMap[a.skuId] = [];
        costMap[a.skuId].push(a.basePrice + a.allocUnit);
      });
    });
    Object.entries(costMap).forEach(([skuId, arr]) => {
      const avg = arr.reduce((a,b)=>a+b,0) / arr.length;
      DB.products.filter(p=>p.skuId===skuId).forEach(p => p.costPrice = Number(avg.toFixed(2)));
    });
  },
  // 资产占用（库存金额）计算
  inventoryAssets() {
    return DB.products.map(p => ({
      productId: p.id,
      skuId: p.skuId,
      amount: Number((p.qty * p.costPrice).toFixed(2))
    }));
  },
  // 成本汇总
  costSummary() {
    const assets = CostEngine.inventoryAssets();
    const total = assets.reduce((a,b)=>a + b.amount,0);
    const byCategory = {};
    assets.forEach(a => {
      const catId = Repo.getSku(a.skuId)?.category;
      if (!byCategory[catId]) byCategory[catId] = 0;
      byCategory[catId]+=a.amount;
    });
    return { total, byCategory };
  }
};

window.CostEngine = CostEngine;