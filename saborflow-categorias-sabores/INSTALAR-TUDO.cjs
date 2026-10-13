// Instala a etapa anterior (se ainda faltante) e depois subcategorias + preços por sabor.
const { spawnSync }=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
const current=path.join(process.cwd(),'components/admin/products-panel.tsx');
const newPanel=path.join(__dirname,'payload/components/admin/products-panel.tsx');
const alreadyUpdated=fs.existsSync(current) && fs.existsSync(newPanel) && fs.readFileSync(current,'utf8').replace(/\r\n/g,'\n') === fs.readFileSync(newPanel,'utf8').replace(/\r\n/g,'\n');
for (const installer of [
  ...(alreadyUpdated ? [] : ['avaliacao-tickets/APLICAR-AVALIACAO-TICKETS.cjs']),
  'APLICAR-SUBCATEGORIAS-SABORES.cjs',
]) {
  console.log('\n=== '+installer+' ===');
  const r=spawnSync(process.execPath,[path.join(__dirname,installer)],{cwd:process.cwd(),stdio:'inherit'});
  if(r.error || r.status!==0) {
    console.error('Execução interrompida por segurança. Confira a mensagem acima.');
    process.exitCode=1;
    break;
  }
}
