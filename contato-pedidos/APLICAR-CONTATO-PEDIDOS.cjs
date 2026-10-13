const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const entries=[{"path": "components/store/storefront.tsx", "before": "49a1f51218091242bfd3f4871d1fc6194ffb17852c601cfa3c185182d97ca28e", "after": "221559dff9062da651aed12944f81f0694e80f20b424bb964aa1b493eb268373"}, {"path": "components/admin/settings-panel.tsx", "before": "566d2fb84c3a7ed8102cbbbd759a7f2fbc11d2b59c786c30f06351c65b4d9dd6", "after": "ddee21a090531aec2a7c0479cddad4bf694a1b11ec5067026478fa0df2136014"}, {"path": "components/admin/orders-panel.tsx", "before": "ed6134ef84762e2bb705c72c7ca56ccf0fd6e1825862410e047358ddbd1d3c17", "after": "2fa71c4cb6954fb7adf8c0e54f9d2b1db978beee6ef98f9e7be5ce58d97dad6c"}, {"path": "components/store/order-tracker.tsx", "before": "a71d8dc715cca2e1ad703bc5b4e2d39c5ba7df945ea63e75d5a81a70ee1348f2", "after": "3caac54b730aa5deb2eb110655483f645c7c3e80cad3ab66983b19e59bd8be40"}, {"path": "lib/order-summary.ts", "before": "6b08d78cc46ebadabdea582c1fe9f49d2563ff29570603f11372321bb76abc9f", "after": "6b08d78cc46ebadabdea582c1fe9f49d2563ff29570603f11372321bb76abc9f"}, {"path": "lib/order-contact.ts", "before": null, "after": "3aef1dc009bd569f7dfa0614fd4175db8fbef5b5cb6c8a3a7b149493f8617df4"}];
const root=process.cwd();
const hash=data=>crypto.createHash("sha256").update(data.toString("utf8").replace(/\r\n/g,"\n")).digest("hex");
try {
 if(!fs.existsSync(path.join(root,"package.json"))) throw new Error("Execute na pasta original do projeto, onde está package.json.");
 const prepared=entries.map(entry=>{
  const target=path.join(root,entry.path),current=fs.existsSync(target)?fs.readFileSync(target):null;
  if(current ? ![entry.before,entry.after].includes(hash(current)) : entry.before!==null) throw new Error("Versão diferente ou arquivo ausente: "+entry.path+". Nenhum arquivo foi alterado. Envie sua versão atual para adaptar.");
  const content=fs.readFileSync(path.join(__dirname,"payload",entry.path));
  if(hash(content)!==entry.after) throw new Error("ZIP incompleto. Extraia novamente.");
  return {...entry,target,current,content};
 });
 const backup=path.join(path.dirname(root),path.basename(root)+"-backup-contato-pedidos-"+Date.now());
 for(const e of prepared) if(e.current!==null){const dest=path.join(backup,e.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,e.current);}
 try{for(const e of prepared){fs.mkdirSync(path.dirname(e.target),{recursive:true});fs.writeFileSync(e.target,e.content);}}
 catch(error){for(const e of prepared){if(e.current!==null)fs.writeFileSync(e.target,e.current);else if(fs.existsSync(e.target))fs.unlinkSync(e.target);}throw error;}
 console.log("Instalado. Backup: "+backup);
 console.log("Execute npm run typecheck. Depois faça commit e push se passar.");
}catch(error){console.error(error.message);process.exitCode=1;}
