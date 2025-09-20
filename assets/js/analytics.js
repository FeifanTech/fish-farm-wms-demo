// 简单分析模块（生成数据 + 绘图）

const Analytics = {
  consumptionTrendChart(ctx) {
    const labels = ['5月','6月','7月','8月','9月','10月'];
    const data1 = [1200,1350,1400,1600,1580,1700]; // 数量
    const data2 = [21000,22800,24400,26600,25900,28300]; // 金额
    return new Chart(ctx, {
      type:'line',
      data:{
        labels,
        datasets:[
          { label:'领用数量(件)', data:data1, tension:.35, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.2)', fill:true },
          { label:'领用金额(元)', data:data2, tension:.35, borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,.18)', yAxisID:'y1' }
        ]
      },
      options:{
        responsive:true,
        interaction:{mode:'index',intersect:false},
        scales:{
          y:{ beginAtZero:true },
          y1:{ position:'right', grid:{drawOnChartArea:false}, beginAtZero:true }
        }
      }
    });
  },
  inventoryStructureChart(ctx) {
    const summary = CostEngine.costSummary();
    const labels = Object.keys(summary.byCategory).map(cat => Repo.getCategoryName(cat));
    const data = Object.values(summary.byCategory);
    return new Chart(ctx, {
      type:'doughnut',
      data:{ labels, datasets:[{ data, backgroundColor:['#2563eb','#f59e0b','#16a34a','#dc2626','#6366f1'] }]},
      options:{ plugins:{ legend:{ position:'right' } } }
    });
  }
};

window.Analytics = Analytics;