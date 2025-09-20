// 主应用（路由 + 模块渲染）

const Routes = {};
const viewRoot = () => document.getElementById('view');
const breadcrumbsEl = () => document.getElementById('breadcrumbs');

function setBreadcrumbs(arr) {
  breadcrumbsEl().innerHTML = arr.map((v,i)=> i===arr.length-1 ? `<span class="highlight">${v}</span>` : `<span>${v}</span><span>/</span>`).join('');
}

// 工具：状态 Pill
function stockStatusPill(status) {
  if (status === 'OK') return '<span class="status-pill status-ok">正常</span>';
  if (status === 'LOW') return '<span class="status-pill status-low">低库存</span>';
  return '<span class="status-pill status-out">缺货</span>';
}

// 模块：商品展示（聚合库存）
Routes['/products'] = function renderProducts() {
  setBreadcrumbs(['商品管理','商品展示']);
  const root = viewRoot();
  root.innerHTML = '';
  const header = UI.el('div', { class:'flex between center' }, [
    UI.el('h2',{ class:'module-title'},'商品展示'),
    UI.el('div',{ class:'toolbar'},[
      UI.el('button',{ class:'btn', onClick:()=> openNewProduct() },'新增库存'),
      UI.el('button',{ class:'btn-secondary', onClick:()=> { Exporters.exportProducts(); } },'导出'),
      UI.el('button',{ class:'btn-secondary', onClick:()=>{ load(); UI.toast('已刷新'); } },'刷新')
    ])
  ]);

  const filterRow = UI.el('div',{ class:'filter-row'});
  const keyInput = UI.el('input',{ placeholder:'关键词 (SKU/批次/库位)'});
  const statusSel = UI.el('select');
  statusSel.innerHTML = '<option value="">状态(全部)</option><option value="OK">正常</option><option value="LOW">低库存</option><option value="OUT">缺货</option>';
  filterRow.append(keyInput,statusSel);

  const container = UI.el('div');
  root.append(header, filterRow, container);

  function openNewProduct() {
    UI.showModal({
      title:'新增库存记录',
      content:() => {
        const wrap = UI.el('div',{ class:'form-grid'});
        const skuSel = UI.el('select',{ name:'skuId'});
        DB.skus.forEach(s => skuSel.append(UI.el('option',{ value:s.id}, `${s.name}`)));
        wrap.append(
          field('SKU', skuSel),
          inputField('批次号','batch'),
            inputField('库位','location'),
          inputField('数量','qty','number'),
          inputField('成本单价','costPrice','number'),
          inputField('保质期','shelfLife','date')
        );
        function valueOf(name){ return wrap.querySelector(`[name="${name}"]`).value.trim(); }
        function inputField(label, name, type='text') {
          const inp = UI.el('input',{ name, type, required:true });
          return field(label, inp);
        }
        function field(label, node) {
          const l = UI.el('label',{},[
            UI.el('span',{}, label),
            node
          ]);
          return l;
        }
        wrap.valueOf = valueOf;
        return wrap;
      },
      onConfirm: function() {
        const form = document.querySelector('.modal .form-grid');
        const data = {
          skuId: form.valueOf('skuId'),
          batch: form.valueOf('batch'),
          location: form.valueOf('location'),
          qty: form.valueOf('qty'),
          costPrice: form.valueOf('costPrice'),
          shelfLife: form.valueOf('shelfLife')
        };
        if (!data.batch) { UI.toast('批次必填','warn'); return false; }
        Repo.newProduct(data);
        Repo.pushLog(`新增库存 SKU=${Repo.getSkuName(data.skuId)} 数量=${data.qty}`);
        load();
        UI.toast('已新增');
      }
    });
  }

  function load() {
    const kw = keyInput.value.trim().toLowerCase();
    const st = statusSel.value;
    const rows = DB.products
      .filter(p => !kw || [Repo.getSkuName(p.skuId), p.batch, p.location].some(t => t.toLowerCase().includes(kw)))
      .filter(p => !st || p.status === st)
      .map(p => ({
        ...p,
        skuName: Repo.getSkuName(p.skuId),
        amount: (p.qty * p.costPrice).toFixed(2)
      }));
    container.innerHTML = '';
    const tableEl = UI.table({
      columns:[
        { label:'SKU', render:r=> r.skuName },
        { label:'批次', key:'batch'},
        { label:'库位', key:'location'},
        { label:'数量', render:r=> r.qty },
        { label:'成本单价', render:r=> r.costPrice },
        { label:'库存金额', render:r=> r.amount },
        { label:'保质期', key:'shelfLife'},
        { label:'状态', render:r=> stockStatusPill(r.status)},
        { label:'操作', render:r=> {
          const wrap = UI.el('div',{ class:'actions-cell'});
          wrap.append(
            UI.el('button',{ class:'btn-secondary small', onClick:()=> adjust(r) },'调整'),
            UI.el('button',{ class:'btn-secondary small', onClick:()=> removeRow(r) },'删除')
          );
          return wrap;
        }}
      ],
      data: rows,
      rowClass: r => r.status==='LOW' ? 'danger-row':''
    });
    container.append(tableEl);
  }
  keyInput.addEventListener('input', load);
  statusSel.addEventListener('change', load);
  load();

  function adjust(row) {
    UI.showModal({
      title:`库存调整 (${row.batch})`,
      content:() => {
        const wrap = UI.el('div',{ class:'form-grid'});
        const delta = UI.el('input',{ name:'delta', type:'number', value:0 });
        wrap.append(field('调整数量(正=入库 负=出库)', delta));
        function field(label,node){
          return UI.el('label',{},[UI.el('span',{},label), node]);
        }
        return wrap;
      },
      onConfirm:() => {
        const val = Number(document.querySelector('.modal input[name="delta"]').value);
        if (!val) { UI.toast('未输入调整值','warn'); return false; }
        Repo.adjustStock(row.id, val);
        Repo.pushLog(`调整库存 ${row.id} ${val>0?'+':''}${val}`);
        load();
        UI.toast('库存已调整');
      }
    });
  }
  function removeRow(row) {
    if (!confirm('确认删除该库存记录?')) return;
    DB.products = DB.products.filter(p => p.id !== row.id);
    Repo.pushLog(`删除库存记录 ${row.id}`);
    load();
  }
};

// 模块：库存明细
Routes['/inventory'] = function inventory() {
  setBreadcrumbs(['商品管理','库存明细']);
  const root = viewRoot(); root.innerHTML='';
  const h = UI.el('h2',{ class:'module-title'},'库存明细 & 预警');
  const metricsWrap = UI.el('div',{ class:'split'});
  const productCount = DB.products.length;
  const totalQty = DB.products.reduce((a,b)=>a+b.qty,0);
  const lowCount = DB.products.filter(p=>p.status==='LOW').length;
  const outCount = DB.products.filter(p=>p.status==='OUT').length;
  const totalAmt = DB.products.reduce((a,b)=>a + b.qty * b.costPrice,0);

  function metric(title,value,sub){
    const m = UI.el('div',{ class:'metric'},[
      UI.el('h4',{},title),
      UI.el('div',{ class:'metric-value'}, value),
      sub? UI.el('small',{},sub): null
    ]);
    return m;
  }
  metricsWrap.append(
    metric('SKU库存记录', productCount),
    metric('库存总数量', totalQty),
    metric('库存金额(元)', totalAmt.toFixed(2)),
    metric('低库存', lowCount, '需补货'),
    metric('缺货', outCount, '优先采购')
  );
  const tableWrap = UI.el('div');

  const refreshBtn = UI.el('button',{ class:'btn-secondary', onClick:()=> renderTable() },'刷新');
  root.append(h, metricsWrap, refreshBtn, tableWrap);

  function renderTable() {
    tableWrap.innerHTML='';
    const t = UI.table({
      columns:[
        { label:'ID', key:'id'},
        { label:'SKU', render:r=> Repo.getSkuName(r.skuId)},
        { label:'数量', key:'qty'},
        { label:'安全库存', render:r=> Repo.getSku(r.skuId)?.safetyStock || '-' },
        { label:'状态', render:r=> stockStatusPill(r.status)},
        { label:'批次', key:'batch'},
        { label:'库位', key:'location'},
        { label:'保质期', key:'shelfLife'}
      ],
      data: DB.products,
      rowClass: r=> r.status!=='OK' ? 'danger-row':''
    });
    tableWrap.append(t);
  }
  renderTable();
};

// 模块：库存调整快捷页面
Routes['/inventory-adjust'] = function invAdjust() {
  setBreadcrumbs(['商品管理','库存调整']);
  const root=viewRoot(); root.innerHTML='';
  root.append(UI.el('h2',{ class:'module-title'},'批量库存调整 (示例)'));
  const info = UI.el('div',{ class:'card soft'},[
    UI.el('div',{},'支持输入：SKU ID / 数量变化。'),
    UI.el('div',{ class:'pre'},`示例:
sku-1001,+10
sku-3001,-5`)
  ]);
  const textarea = UI.el('textarea',{ style:'width:100%;min-height:160px;font-family:monospace;' });
  const btn = UI.el('button',{ class:'btn', onClick:()=> apply() },'执行');
  root.append(info, textarea, btn);

  function apply() {
    const lines = textarea.value.trim().split(/\n+/);
    lines.forEach(line => {
      const [skuId, deltaStr] = line.split(',');
      const delta = Number(deltaStr);
      if (!skuId || !delta) return;
      DB.products.filter(p=>p.skuId===skuId).slice(0,1).forEach(p=> Repo.adjustStock(p.id, delta));
    });
    Repo.pushLog('批量库存调整('+lines.length+'行)');
    UI.toast('已执行');
  }
};

// 模块：SKU 管理
Routes['/sku'] = function skuModule() {
  setBreadcrumbs(['基础资料','SKU 管理']);
  const root = viewRoot();
  root.innerHTML='';
  const header = UI.el('div',{ class:'flex between center'},[
    UI.el('h2',{ class:'module-title'},'SKU 管理'),
    UI.el('div',{ class:'toolbar'},[
      UI.el('button',{ class:'btn', onClick:()=> openNew() },'新增SKU'),
      UI.el('button',{ class:'btn-secondary', onClick:()=> render() },'刷新')
    ])
  ]);
  const body = UI.el('div');
  root.append(header, body);

  function openNew(editRow) {
    UI.showModal({
      title: editRow ? '编辑 SKU' : '新增 SKU',
      content:() => {
        const wrap = UI.el('div',{ class:'form-grid'});
        const name = UI.el('input',{ name:'name', value:editRow?.name||'' });
        const spec = UI.el('input',{ name:'spec', value:editRow?.spec||'' });
        const unit = UI.el('input',{ name:'unit', value:editRow?.unit||'件' });
        const safety = UI.el('input',{ name:'safetyStock', type:'number', value:editRow?.safetyStock||0 });
        const cat = UI.el('select',{ name:'category'});
        DB.categories.forEach(c=> cat.append(UI.el('option',{ value:c.id, selected: c.id===editRow?.category }, c.name)));
        [ ['名称',name], ['规格',spec], ['单位',unit], ['安全库存',safety], ['分类',cat] ].forEach(([l,node]) => {
          wrap.append(UI.el('label',{},[UI.el('span',{},l), node]));
        });
        wrap.getVal = f => wrap.querySelector(`[name="${f}"]`).value.trim();
        return wrap;
      },
      onConfirm:() => {
        const form = document.querySelector('.modal .form-grid');
        const data = {
            name: form.getVal('name'),
            spec: form.getVal('spec'),
            unit: form.getVal('unit'),
            safetyStock: form.getVal('safetyStock'),
            category: form.getVal('category')
        };
        if (!data.name) { UI.toast('名称必填','warn'); return false; }
        if (editRow) {
          Repo.updateSku(editRow.id, data);
          Repo.pushLog(`编辑SKU ${editRow.id}`);
        } else {
          Repo.newSku(data);
          Repo.pushLog(`新增SKU ${data.name}`);
        }
        render();
        UI.toast('已保存');
      }
    });
  }

  function render() {
    body.innerHTML='';
    const tableEl = UI.table({
      columns:[
        { label:'ID', key:'id'},
        { label:'名称', key:'name'},
        { label:'规格', key:'spec'},
        { label:'单位', key:'unit'},
        { label:'分类', render:r=> Repo.getCategoryName(r.category) },
        { label:'安全库存', key:'safetyStock'},
        { label:'操作', render:r=>{
          const wrap=UI.el('div',{ class:'actions-cell'});
          wrap.append(
            UI.el('button',{ class:'btn-secondary small', onClick:()=> openNew(r) },'编辑'),
            UI.el('button',{ class:'btn-secondary small', onClick:()=> del(r) },'删除')
          );
          return wrap;
        }}
      ],
      data: DB.skus
    });
    body.append(tableEl);
  }
  function del(row) {
    if (!confirm('确认删除该 SKU ?')) return;
    Repo.deleteSku(row.id);
    Repo.pushLog(`删除SKU ${row.id}`);
    render();
  }
  render();
};

// 模块：分类管理
Routes['/categories'] = function categories() {
  setBreadcrumbs(['基础资料','分类管理']);
  const root=viewRoot(); root.innerHTML='';
  const h = UI.el('h2',{ class:'module-title'},'分类管理');
  const btn = UI.el('button',{ class:'btn', onClick:()=> openNew() },'新增分类');
  const box = UI.el('div');
  root.append(h, btn, box);

  function openNew(editRow) {
    UI.showModal({
      title: editRow?'编辑分类':'新增分类',
      content:() => {
        const wrap = UI.el('div',{ class:'form-grid'});
        const name = UI.el('input',{ name:'name', value: editRow?.name||'' });
        const code = UI.el('input',{ name:'code', value: editRow?.code||'' });
        const remark = UI.el('textarea',{ name:'remark' }, editRow?.remark||'');
        [['名称', name], ['编码', code], ['备注', remark]].forEach(([l,n]) => wrap.append(UI.el('label',{},[UI.el('span',{},l), n])));
        wrap.getVal = f => wrap.querySelector(`[name="${f}"]`).value.trim();
        return wrap;
      },
      onConfirm:() => {
        const form = document.querySelector('.modal .form-grid');
        const data = {
          name: form.getVal('name'),
          code: form.getVal('code'),
          remark: form.getVal('remark')
        };
        if (!data.name) { UI.toast('名称必填','warn'); return false; }
        if (editRow) {
          Repo.updateCategory(editRow.id, data);
          Repo.pushLog(`编辑分类 ${editRow.id}`);
        } else {
          Repo.newCategory(data);
          Repo.pushLog('新增分类 '+data.name);
        }
        render();
        UI.toast('已保存');
      }
    });
  }

  function del(row) {
    if (!confirm('删除该分类?')) return;
    Repo.deleteCategory(row.id);
    Repo.pushLog('删除分类 '+row.name);
    render();
  }

  function render() {
    box.innerHTML='';
    box.append(UI.table({
      columns:[
        { label:'ID', key:'id'},
        { label:'名称', key:'name'},
        { label:'编码', key:'code'},
        { label:'备注', key:'remark'},
        { label:'操作', render:r=>{
          const wrap=UI.el('div',{ class:'actions-cell'});
          wrap.append(
            UI.el('button',{ class:'btn-secondary small', onClick:()=> openNew(r) },'编辑'),
            UI.el('button',{ class:'btn-secondary small', onClick:()=> del(r) },'删除')
          );
          return wrap;
        }}
      ],
      data: DB.categories
    }));
  }
  render();
};

// 模块：采购入库
Routes['/purchase'] = function purchaseModule() {
  setBreadcrumbs(['业务单据','采购入库']);
  const root=viewRoot(); root.innerHTML='';
  const header = UI.el('div',{ class:'flex between center'},[
    UI.el('h2',{ class:'module-title'},'采购入库'),
    UI.el('div',{ class:'toolbar'},[
      UI.el('button',{ class:'btn', onClick:()=> openNew() },'新建入库单'),
      UI.el('button',{ class:'btn-secondary', onClick:()=> render() },'刷新')
    ])
  ]);
  const container = UI.el('div');
  root.append(header, container);

  function openNew() {
    UI.showModal({
      title:'新建采购入库单',
      content:() => {
        const wrap = UI.el('div',{ class:'form-grid'});
        const supplier = UI.el('input',{ name:'supplier' });
        const date = UI.el('input',{ name:'date', type:'date', value: new Date().toISOString().slice(0,10)});
        const freight = UI.el('input',{ name:'freight', type:'number', value:0});
        wrap.append(field('供应商', supplier), field('日期', date), field('运费', freight));
        const itemsBox = UI.el('div',{ style:'grid-column:1/-1;display:flex;flex-direction:column;gap:10px;'});
        const addItemBtn = UI.el('button',{ class:'btn-secondary small', onClick:()=> addLine() },'添加行');
        itemsBox.append(addItemBtn);
        wrap.append(itemsBox);
        addLine(); // 初始一行

        function addLine() {
          const line = UI.el('div',{ class:'flex', style:'gap:8px;align-items:center;'});
          const skuSel = UI.el('select',{ name:'skuId'});
          DB.skus.forEach(s=> skuSel.append(UI.el('option',{ value:s.id},s.name)));
            const qty = UI.el('input',{ type:'number', name:'qty', placeholder:'数量'});
          const price = UI.el('input',{ type:'number', name:'price', placeholder:'单价'});
          const delBtn = UI.el('button',{ class:'btn-ghost small', onClick:()=> line.remove() },'✕');
          line.append(skuSel, qty, price, delBtn);
          itemsBox.append(line);
        }
        function field(label,node){
          return UI.el('label',{},[UI.el('span',{},label), node]);
        }
        wrap.collect = () => {
          const lines = [...itemsBox.querySelectorAll('div.flex')].map(div => {
            const [skuIdEl, qtyEl, priceEl] = div.querySelectorAll('select,input');
            return {
              skuId: skuIdEl.value,
              qty: Number(qtyEl.value),
              price: Number(priceEl.value)
            };
          }).filter(x=>x.qty>0 && x.price>0);
          return {
            supplier: supplier.value.trim(),
            date: date.value,
            freight: Number(freight.value)||0,
            items: lines
          };
        };
        return wrap;
      },
      onConfirm:() => {
        const form = document.querySelector('.modal .form-grid');
        const data = form.collect();
        if (!data.supplier || !data.items.length) { UI.toast('供应商 & 行项目必填','warn'); return false; }
        const id = 'PO-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + (DB.purchaseOrders.length+1).toString().padStart(3,'0');
        const po = { id, status:'RECEIVED', ...data };
        Repo.newPurchase(po);
        // 写入库存
        data.items.forEach(it => {
          Repo.newProduct({
            skuId: it.skuId,
            batch: 'BATCH'+id.slice(-3),
            location: '待上架',
            qty: it.qty,
            costPrice: it.price,
            shelfLife: new Date(Date.now()+1000*3600*24*120).toISOString().slice(0,10)
          });
        });
        CostEngine.recomputeCurrentInventoryCosts();
        Repo.pushLog(`创建采购入库单 ${id}`);
        render();
        UI.toast('入库已创建');
      }
    });
  }

  function render() {
    container.innerHTML='';
    container.append(UI.table({
      columns:[
        { label:'单号', key:'id'},
        { label:'供应商', key:'supplier'},
        { label:'日期', key:'date'},
        { label:'SKU数', render:r=> r.items.length },
        { label:'运费', key:'freight'},
        { label:'状态', render:r=> '<span class="tag success">已入库</span>'},
        { label:'操作', render:r=> {
          const wrap=UI.el('div',{ class:'actions-cell'});
          wrap.append(UI.el('button',{ class:'btn-secondary small', onClick:()=> detail(r) },'详情'));
          return wrap;
        }}
      ],
      data: DB.purchaseOrders
    }));
  }
  function detail(row) {
    UI.showModal({
      title: '入库单详情 '+row.id,
      content:() => {
        const box=UI.el('div',{ style:'display:flex;flex-direction:column;gap:12px;'});
        box.append(UI.el('div',{},`供应商：${row.supplier}`));
        box.append(UI.el('div',{},`日期：${row.date}`));
        const list=UI.el('div',{ class:'pre'});
        list.textContent = row.items.map(i => `${Repo.getSkuName(i.skuId)} x ${i.qty} @${i.price}`).join('\n');
        box.append(list);
        return box;
      },
      hideFooter:true
    });
  }
  render();
};

// 模块：领用出库
Routes['/issue'] = function issueModule() {
  setBreadcrumbs(['业务单据','领用出库']);
  const root=viewRoot(); root.innerHTML='';
  const header = UI.el('div',{ class:'flex between center'},[
    UI.el('h2',{ class:'module-title'},'领用出库'),
    UI.el('div',{ class:'toolbar'},[
      UI.el('button',{ class:'btn', onClick:()=> openNew() },'新建领用'),
      UI.el('button',{ class:'btn-secondary', onClick:()=> render() },'刷新')
    ])
  ]);
  const container = UI.el('div');
  root.append(header, container);

  function openNew() {
    UI.showModal({
      title:'新建领用单',
      content:() => {
        const wrap = UI.el('div',{ class:'form-grid'});
        const dept = UI.el('input',{ name:'dept', placeholder:'领用部门'});
        wrap.append(field('部门', dept));
        const itemsBox = UI.el('div',{ style:'grid-column:1/-1;display:flex;flex-direction:column;gap:10px;'});
        const btnAdd = UI.el('button',{ class:'btn-secondary small', onClick:()=> addLine() },'添加行');
        itemsBox.append(btnAdd);
        wrap.append(itemsBox);
        addLine();

        function addLine() {
          const line = UI.el('div',{ class:'flex', style:'gap:8px;align-items:center;'});
          const skuSel = UI.el('select',{ name:'skuId'});
          DB.skus.forEach(s=> skuSel.append(UI.el('option',{ value:s.id}, s.name)));
          const qty = UI.el('input',{ type:'number', name:'qty', placeholder:'数量'});
          const del = UI.el('button',{ class:'btn-ghost small', onClick:()=> line.remove() },'✕');
          line.append(skuSel, qty, del);
          itemsBox.append(line);
        }
        function field(l,n){ return UI.el('label',{},[UI.el('span',{},l), n]); }
        wrap.collect = () => {
          const lines = [...itemsBox.querySelectorAll('div.flex')].map(div => {
            const [skuIdEl, qtyEl] = div.querySelectorAll('select,input');
            return { skuId: skuIdEl.value, qty: Number(qtyEl.value) };
          }).filter(x=>x.qty>0);
          return { dept: dept.value.trim(), lines };
        };
        return wrap;
      },
      onConfirm:() => {
        const form = document.querySelector('.modal .form-grid');
        const data = form.collect();
        if (!data.dept || !data.lines.length) { UI.toast('部门/行项目必填','warn'); return false; }
        // 扣减库存
        data.lines.forEach(l => {
          const product = DB.products.find(p => p.skuId===l.skuId && p.qty>=l.qty);
          if (product) Repo.adjustStock(product.id, -l.qty);
        });
        const id = 'IS-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + (DB.issueOrders.length+1).toString().padStart(3,'0');
        Repo.newIssue({
          id,
          department: data.dept,
          date: new Date().toISOString().slice(0,10),
          items: data.lines,
          status: 'COMPLETED'
        });
        Repo.pushLog(`创建领用单 ${id}`);
        UI.toast('领用已登记');
        render();
      }
    });
  }

  function render() {
    container.innerHTML='';
    container.append(UI.table({
      columns:[
        { label:'单号', key:'id'},
        { label:'部门', key:'department'},
        { label:'日期', key:'date'},
        { label:'SKU数', render:r=> r.items.length },
        { label:'状态', render:r=> '<span class="tag primary">已完成</span>'},
        { label:'操作', render:r=> {
          const wrap=UI.el('div',{ class:'actions-cell'});
          wrap.append(UI.el('button',{ class:'btn-secondary small', onClick:()=> detail(r) },'详情'));
          return wrap;
        }}
      ],
      data: DB.issueOrders
    }));
  }
  function detail(row) {
    UI.showModal({
      title:'领用详情 '+row.id,
      content:() => {
        const box=UI.el('div',{ style:'display:flex;flex-direction:column;gap:12px;'});
        box.append(UI.el('div',{},`部门：${row.department}`));
        box.append(UI.el('div',{},`日期：${row.date}`));
        const list=UI.el('div',{ class:'pre'});
        list.textContent = row.items.map(i => `${Repo.getSkuName(i.skuId)} x ${i.qty}`).join('\n');
        box.append(list);
        return box;
      },
      hideFooter:true
    });
  }
  render();
};

// 模块：成本核算
Routes['/cost'] = function costModule() {
  setBreadcrumbs(['成本与分析','成本核算']);
  const root=viewRoot(); root.innerHTML='';
  const h = UI.el('h2',{ class:'module-title'},'成本核算');
  const recomputeBtn = UI.el('button',{ class:'btn', onClick:()=> { CostEngine.recomputeCurrentInventoryCosts(); render(); UI.toast('已重算成本'); } },'重新计算成本');
  const container = UI.el('div');
  root.append(h, recomputeBtn, container);

  function render() {
    container.innerHTML='';
    const summary = CostEngine.costSummary();
    const metrics = UI.el('div',{ class:'split'});
    metrics.append(
      metric('库存总金额(元)', summary.total.toFixed(2)),
      metric('分类数', Object.keys(summary.byCategory).length),
      metric('产品记录', DB.products.length),
      metric('采购单数', DB.purchaseOrders.length)
    );
    function metric(title,value){
      return UI.el('div',{ class:'metric'},[
        UI.el('h4',{},title),
        UI.el('div',{ class:'metric-value'}, value)
      ]);
    }
    container.append(metrics);

    // 成本明细表
    const rows = DB.products.map(p => ({
      sku: Repo.getSkuName(p.skuId),
      batch: p.batch,
      qty: p.qty,
      unitCost: p.costPrice,
      amount: (p.qty * p.costPrice).toFixed(2)
    }));
    container.append(UI.el('h3',{},'库存成本明细'));
    container.append(UI.table({
      columns:[
        { label:'SKU', key:'sku'},
        { label:'批次', key:'batch'},
        { label:'数量', key:'qty'},
        { label:'单位成本', key:'unitCost'},
        { label:'金额', key:'amount'}
      ],
      data: rows
    }));

    // 最近采购运费分摊展示
    container.append(UI.el('h3',{},'最近采购运费分摊示例'));
    const allocRows = DB.purchaseOrders.slice(-3).flatMap(po => CostEngine.allocateFreight(po).map(a => ({
      po: po.id,
      sku: Repo.getSkuName(a.skuId),
      basePrice: a.basePrice,
      freightAlloc: a.freightAlloc.toFixed(2),
      allocUnit: a.allocUnit.toFixed(2)
    })));
    container.append(UI.table({
      columns:[
        { label:'采购单', key:'po'},
        { label:'SKU', key:'sku'},
        { label:'采购单价', key:'basePrice'},
        { label:'分摊运费', key:'freightAlloc'},
        { label:'单位分摊', key:'allocUnit'}
      ],
      data: allocRows
    }));
  }
  render();
};

// 模块：资产占用
Routes['/assets'] = function assets() {
  setBreadcrumbs(['成本与分析','资产占用']);
  const root=viewRoot(); root.innerHTML='';
  root.append(UI.el('h2',{ class:'module-title'},'库存资产占用'));
  const assets = CostEngine.inventoryAssets().map(a => ({
    sku: Repo.getSkuName(a.skuId),
    amount: a.amount
  }));
  const bySku = {};
  assets.forEach(a => {
    if (!bySku[a.sku]) bySku[a.sku]=0;
     bySku[a.sku]+=a.amount;
  });
  const rows = Object.entries(bySku).map(([sku, amt])=>({ sku, amount:amt.toFixed(2)}));
  root.append(UI.table({
    columns:[
      { label:'SKU', key:'sku'},
      { label:'金额(元)', key:'amount'}
    ],
    data: rows
  }));
  const total = rows.reduce((a,b)=>a+Number(b.amount),0);
  root.append(UI.el('div',{ class:'card'},[
    UI.el('strong',{},`总资产占用：${total.toFixed(2)} 元`)
  ]));
};

// 模块：智能分析
Routes['/analytics'] = function analytics() {
  setBreadcrumbs(['成本与分析','智能分析']);
  const root=viewRoot(); root.innerHTML='';
  root.append(UI.el('h2',{ class:'module-title'},'智能分析'));
  const chartsWrap = UI.el('div',{ class:'grid cols-3'});
  const c1Card = UI.el('div',{ class:'card'},[
    UI.el('h3',{},'领用消耗趋势'),
    (() => {
      const box = UI.el('div',{ class:'chart-box'});
      const canvas = UI.el('canvas');
      box.append(canvas);
      setTimeout(()=> Analytics.consumptionTrendChart(canvas.getContext('2d')),0);
      return box;
    })()
  ]);
  const c2Card = UI.el('div',{ class:'card'},[
    UI.el('h3',{},'库存结构(金额占比)'),
    (() => {
      const box = UI.el('div',{ class:'chart-box'});
      const canvas = UI.el('canvas');
      box.append(canvas);
      setTimeout(()=> Analytics.inventoryStructureChart(canvas.getContext('2d')),30);
      return box;
    })()
  ]);
  const insight = UI.el('div',{ class:'card soft'},[
    UI.el('h3',{},'AI 风险提示 (示例伪造)'),
    UI.el('div',{},'1. 冻带鱼 库存低于安全线 10% ，建议补货。'),
    UI.el('div',{},'2. 高蛋白配合饲料 将在 45 天后达到批次平均消耗阈值，注意滚动采购节奏。'),
    UI.el('div',{},'3. 大黄鱼 800g 销售/领用速度上升 12%，可能进入旺季。')
  ]);
  chartsWrap.append(c1Card, c2Card, insight);
  root.append(chartsWrap);
};

// 模块：系统设置（仅展示）
Routes['/settings'] = function settings() {
  setBreadcrumbs(['系统','系统设置']);
  const root=viewRoot(); root.innerHTML='';
  root.append(UI.el('h2',{ class:'module-title'},'系统设置 (演示)'));
  root.append(UI.el('div',{ class:'card'},[
    UI.el('div',{},'此处可扩展：'),
    UI.el('ul',{},[
      UI.el('li',{},'用户与角色权限'),
      UI.el('li',{},'预警阈值与通知方式'),
      UI.el('li',{},'计量单位转换'),
      UI.el('li',{},'API Key / Webhook 集成')
    ])
  ]));
};

// 模块：操作日志
Routes['/logs'] = function logs() {
  setBreadcrumbs(['系统','操作日志']);
  const root=viewRoot(); root.innerHTML='';
  root.append(UI.el('h2',{ class:'module-title'},'操作日志'));
  root.append(UI.table({
    columns:[
      { label:'时间', key:'time'},
      { label:'用户', key:'user'},
      { label:'操作', key:'action'}
    ],
    data: DB.logs
  }));
};

// 默认路由
function router() {
  const hash = location.hash || '#/products';
  const path = hash.replace('#','');
  document.querySelectorAll('[data-route]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === hash);
  });
  (Routes[path] || Routes['/products'])();
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  // 全局搜索
  document.getElementById('globalSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const kw = e.target.value.trim().toLowerCase();
      if (!kw) return;
      // 简单策略：跳到商品展示并过滤
      location.hash = '#/products';
      setTimeout(()=>{
        const input = document.querySelector('#view .filter-row input');
        if (input) { input.value = kw; input.dispatchEvent(new Event('input')); }
      },60);
    }
  });
  document.getElementById('toggleTheme').addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-theme', html.getAttribute('data-theme') === 'light' ? 'dark':'light');
  });

  router();
});