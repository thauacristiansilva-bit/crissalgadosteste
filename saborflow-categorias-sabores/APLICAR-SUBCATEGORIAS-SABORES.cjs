// SaborFlow 13/10/2026: patch seguro e reversível sobre a etapa Google/tickets.
// Altera apenas três interfaces; não troca regras de banco, pedidos ou WhatsApp.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const base = __dirname;
const normalize = s => s.replace(/\r\n/g, '\n');
const sha = s => crypto.createHash('sha256').update(normalize(s)).digest('hex');
const productOld = '6299fb65f4294dee6e0b7db321c082cdd4d41599aab99b897049aa4b8e0209da';
const payloadPath = path.join(base,'payload/components/admin/products-panel.tsx');
const productNew = fs.readFileSync(payloadPath,'utf8');
const productNewSha = sha(productNew);
function fail(msg) { throw new Error(msg); }
function change(text, before, after, file) {
  if (text.includes(after)) return text;
  if (!text.includes(before)) fail(`A interface ${file} não tem o trecho esperado. Instalação interrompida; nenhuma alteração feita.`);
  if (text.split(before).length!==2) fail(`Trecho duplicado em ${file}.`);
  return text.replace(before,after);
}
function categories(text) {
  const file='components/admin/categories-panel.tsx';
  if (text.includes('sf-category-parent-ui-v1')) return text;
  text=change(text,'const [name, setName] = useState("")','const [name, setName] = useState("")\n  const [parent, setParent] = useState("") // sf-category-parent-ui-v1',file);
  text=change(text,'setName(category.name)','setParent(category.name.includes(" / ") ? category.name.split(" / ")[0] : "")\n    setName(category.name.includes(" / ") ? category.name.split(" / ")[1] : category.name)',file);
  text=change(text,'setName("")\n','setName("")\n    setParent("")\n',file);
  text=change(text,'body: JSON.stringify({ name }),','body: JSON.stringify(editingId ? { name: parent ? `${parent} / ${name.trim()}` : name.trim() } : { name: name.trim(), parent }),',file);
  text=change(text,'{categories.map((category) => (','{[...categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })).map((category) => (',file);
  text=change(text,'>{category.name}</p>','>{category.name.includes(" / ") ? `↳ ${category.name.split(" / ")[1]}` : category.name}</p>',file);
  text=change(text,'<p className="text-xs text-gray-500">Ordem {category.sortOrder} · {category.active ? "Visível" : "Oculta"}</p>',
    '<p className="text-xs text-gray-500">{category.name.includes(" / ") ? `Dentro de ${category.name.split(" / ")[0]} · ` : ""}Ordem {category.sortOrder} · {category.active ? "Visível" : "Oculta"}</p>',file);
  text=change(text,'<p className="text-sm text-gray-500">Organize a navegação do cardápio.</p>', '<p className="text-sm text-gray-500">Crie categorias principais e subcategorias. Ex.: Pastéis → Pastéis secos.</p>',file);
  const original='<label data-tutorial="category-name" className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome *</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Salgados" className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>';
  const updated=`<label className="mb-4 block text-sm font-semibold text-gray-800">Dentro de qual categoria?
      <select value={parent} onChange={event => setParent(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm">
        <option value="">Nenhuma (categoria principal)</option>
        {categories.filter(item => item.active && !item.name.includes(" / ") && item.id !== editingId).sort((a,b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true })).map(item =>
          <option key={item.id} value={item.name}>{item.name}</option>)}
      </select>
      <small className="mt-1 block font-normal text-gray-500">Subcategorias são opcionais, com apenas um nível.</small>
    </label>
    <label data-tutorial="category-name" className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">Nome *</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder={parent ? "Ex.: Pastéis secos" : "Ex.: Pastéis"} className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>`;
  text=change(text,original,updated,file);
  // Remoção real só se não existirem produtos nem subcategorias. O endpoint impede perdas.
  const match=text.match(/<button disabled=\{busy\} onClick=\{\(\) => toggle\(category\)\}[^\n]*<\/button>/);
  if(!match) fail(`Não identifiquei o botão ativar/desativar em ${file}.`);
  const removeButton=`<button type="button" disabled={busy} aria-label={\`Excluir \${category.name}\`}
    onClick={async () => { if (!window.confirm(\`Excluir \${category.name}? Só será permitido se estiver vazia.\`)) return; setBusy(true); setError(""); try {
      const response = await fetch(\`/api/categories/\${category.id}\`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Não foi possível excluir."); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Erro ao excluir categoria.") } finally { setBusy(false) } }}
    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Excluir categoria vazia">Excluir</button>`;
  text=text.replace(match[0],match[0]+'\n  '+removeButton);
  return text;
}
function storefront(text) {
  const file='components/store/storefront.tsx';
  if (text.includes('sf-subcategory-store-nav-v1')) return text;
  text=change(text,'p.category === category,', 'p.category === category || p.category.startsWith(`${category} / `),',file);
  text=change(text,'for (const product of activeProducts) counts.set(product.category, (counts.get(product.category) || 0) + 1)',
    'for (const product of activeProducts) { counts.set(product.category, (counts.get(product.category) || 0) + 1); const parent = product.category.split(" / ")[0]; if (parent !== product.category) counts.set(parent, (counts.get(parent) || 0) + 1) }',file);
  const buttons='{["Todos", ...categories.filter((item) => item.active).map((item) => item.name)].map((item) => <button key={item} onClick={() => setCategory(item)} style={category === item ? { borderColor: settings.primaryColor, color: settings.primaryColor } : undefined} className={`flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-black ${category === item ? "bg-white" : "border-transparent text-gray-700 hover:bg-gray-50"}`}><span>{item}</span><span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{categoryCounts.get(item) || 0}</span></button>)}';
  const newButtons='{["Todos", ...categories.filter((item) => item.active && !item.name.includes(" / ")).map((item) => item.name)].map((item) => <button key={item} onClick={() => setCategory(item)} style={(category === item || (item !== "Todos" && category.startsWith(`${item} / `))) ? { borderColor: settings.primaryColor, color: settings.primaryColor } : undefined} className={`flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-black ${(category === item || (item !== "Todos" && category.startsWith(`${item} / `))) ? "bg-white" : "border-transparent text-gray-700 hover:bg-gray-50"}`}><span>{item}</span><span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{categoryCounts.get(item) || 0}</span></button>)}';
  text=change(text,buttons,newButtons,file);
  const anchor='        <section className="mt-5">\n          <div className="mb-4 flex items-end justify-between gap-3"';
  const subnav=`        {/* sf-subcategory-store-nav-v1 */}
        {category !== "Todos" && categories.some(item => item.active && item.name.startsWith(\`\${category.split(" / ")[0]} / \`)) &&
          <nav className="mt-3 flex flex-wrap gap-2" aria-label="Subcategorias">
            {[{name: category.split(" / ")[0], label: "Todos"}, ...categories.filter(item => item.active && item.name.startsWith(\`\${category.split(" / ")[0]} / \`)).map(item => ({ name: item.name, label: item.name.split(" / ")[1] }))].map(item =>
              <button key={item.name} type="button" onClick={() => setCategory(item.name)}
                className={\`rounded-xl border px-3 py-2 text-xs font-bold \${category === item.name ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"}\`}>{item.label}</button>)}
          </nav>}
        <section className="mt-5">
          <div className="mb-4 flex items-end justify-between gap-3"`;
  text=change(text,anchor,subnav,file);
  return text;
}
try {
  if (!fs.existsSync(path.join(root, 'package.json'))) fail('Abra o terminal na raiz do SaborFlow, onde está package.json.');
  const edits=[];
  for(const [p, fn] of [
    ['components/admin/products-panel.tsx', txt => {
      if(sha(txt) === productNewSha) return txt;
      if(sha(txt) !== productOld) fail('ProductsPanel não corresponde ao último pacote de correções. Aplique primeiro o ZIP Avaliação Google/Tickets ou envie o arquivo atual para atualização segura.');
      return productNew;
    }],
    ['components/admin/categories-panel.tsx', categories],
    ['components/store/storefront.tsx', storefront],
  ]) {
    const target=path.join(root,p);
    if(!fs.existsSync(target)) fail(`Arquivo obrigatório não encontrado: ${p}`);
    const prev=fs.readFileSync(target,'utf8');
    const next=fn(prev);
    if(next!==prev) edits.push({p,target,prev,next});
  }
  if(!edits.length) { console.log('Atualização já instalada. Sem alterações.'); process.exit(0); }
  const backup=path.join(path.dirname(root),path.basename(root)+'-backup-subcategorias-sabores-'+Date.now());
  for (const e of edits) { const b=path.join(backup,e.p); fs.mkdirSync(path.dirname(b),{recursive:true}); fs.writeFileSync(b,e.prev,'utf8'); }
  const written=[];
  try { for (const e of edits) { fs.writeFileSync(e.target,e.next,'utf8'); written.push(e); } }
  catch(err) { for(const e of written.reverse()) fs.writeFileSync(e.target,e.prev,'utf8'); throw err; }
  console.log(`SaborFlow atualizado: ${edits.map(e=>e.p).join(', ')}.`);
  console.log('Backup dos arquivos originais: '+backup);
  console.log('Execute: npm run typecheck. Não publique se houver erro.');
} catch(err) { console.error('INSTALAÇÃO CANCELADA: '+err.message); process.exitCode=1; }
