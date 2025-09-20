// 共享组件 & 工具

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  });
  [].concat(children).forEach(ch => {
    if (ch === null || ch === undefined) return;
    node.append(ch.nodeType ? ch : document.createTextNode(ch));
  });
  return node;
}

function showModal({ title, content, onConfirm, confirmText = '保存', size = 'md', hideFooter = false }) {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', { class: 'modal' });
  const h = el('h3', {}, title);
  const body = el('div', {}, typeof content === 'function' ? content() : content);
  const footer = el('div', { class: 'modal-footer' });
  const btnCancel = el('button', { class: 'btn-secondary' , onClick: () => close() }, '取消');
  const btnOk = el('button', { class: 'btn' , onClick: () => { if (onConfirm?.() !== false) close(); } }, confirmText);
  if (!hideFooter) {
    footer.append(btnCancel, btnOk);
  }
  modal.append(h, body);
  if (!hideFooter) modal.append(footer);
  backdrop.append(modal);
  document.getElementById('modalRoot').append(backdrop);
  function close(){ backdrop.remove(); }
  return { close };
}

function toast(msg, type='success', timeout=2400) {
  const t = el('div', { class: `toast ${type}` }, [msg]);
  const root = document.getElementById('toastRoot');
  root.append(t);
  setTimeout(()=> t.remove(), timeout);
}

function table({ columns, data, rowClass, empty = '暂无数据', onRow }) {
  const wrapper = el('div', { class: 'table-wrapper' });
  const tableEl = el('table');
  const thead = el('thead');
  const trh = el('tr');
  columns.forEach(c => trh.append(el('th', {}, c.label)));
  thead.append(trh);
  const tbody = el('tbody');
  if (!data.length) {
    const tr = el('tr');
    const td = el('td', { colSpan: columns.length }, empty);
    td.className = 'empty';
    tr.append(td);
    tbody.append(tr);
  } else {
    data.forEach(row => {
      const tr = el('tr', { class: rowClass?.(row) || '' });
      columns.forEach(c => {
        const value = typeof c.render === 'function' ? c.render(row) : row[c.key];
        const td = el('td', {}, value);
        tr.append(td);
      });
      if (onRow) {
        tr.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') onRow(row); });
      }
      tbody.append(tr);
    });
  }
  tableEl.append(thead, tbody);
  wrapper.append(tableEl);
  return wrapper;
}

// 导出 CSV
function exportCSV(filename, rows, headers) {
  const lines = [];
  if (headers) lines.push(headers.join(','));
  rows.forEach(r => {
    lines.push(r.map(v => `"${(v ?? '').toString().replace(/"/g,'""')}"`).join(','));
  });
  const blob = new Blob([ '\ufeff' + lines.join('\n') ], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('CSV 已导出');
}

// 分页器
function paginate(array, page=1, size=10) {
  const total = array.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const start = (page - 1) * size;
  const slice = array.slice(start, start + size);
  return { data: slice, page, size, total, pages };
}

function renderPagination({ page, pages, onChange }) {
  const bar = el('div', { class: 'pagination' });
  const addBtn = (p,label=p) => {
    const btn = el('button', { class: p===page?'active':'' , onClick: () => onChange(p) }, label);
    bar.append(btn);
  };
  addBtn(Math.max(1, page-1), '‹');
  for (let i = 1; i <= pages; i++) if (i===1 || i===pages || Math.abs(i-page)<=1 ) addBtn(i);
  addBtn(Math.min(pages, page+1), '›');
  return bar;
}

window.UI = { el, showModal, toast, table, exportCSV, paginate, renderPagination };