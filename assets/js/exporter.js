// 数据导出示例的封装
function exportProducts() {
  const rows = DB.products.map(p => [
    p.id,
    Repo.getSkuName(p.skuId),
    p.batch,
    p.location,
    p.qty,
    p.costPrice,
    p.shelfLife,
    p.status
  ]);
  UI.exportCSV('products.csv', rows, ['ID','SKU','批次','库位','数量','成本单价','保质期','状态']);
}

window.Exporters = { exportProducts };