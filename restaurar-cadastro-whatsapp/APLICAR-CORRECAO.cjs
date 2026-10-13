const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const entries = [{"path": "components/admin/products-panel.tsx", "before": "59599ddf28b069f79137f0676d6c589abc7ac76e5b3f330ce54c7a2c2fd5baf2", "after": "6299fb65f4294dee6e0b7db321c082cdd4d41599aab99b897049aa4b8e0209da"}, {"path": "components/admin/product-composition-editor.tsx", "before": "bd1c44eb9f5db448f7b3d0ef326c75d0fb9e25997f79c79468ec44457fd18a5c", "after": "8a5b207076b2ed95ff22f7bfea4fb90f7917cee7a844c24108921f3838aa0fe1"}, {"path": "components/store/storefront.tsx", "before": "3251468ffa68ed5177a672bcd197dae2cd2959033fd85a0eabc49e16684f75bc", "after": "49a1f51218091242bfd3f4871d1fc6194ffb17852c601cfa3c185182d97ca28e"}, {"path": "lib/order-summary.ts", "before": "d4d06722e42cb286f03a7b4f8a03e3baa11cccdda0a93ac3fc80209d42d567a2", "after": "6b08d78cc46ebadabdea582c1fe9f49d2563ff29570603f11372321bb76abc9f"}];
const root = process.cwd();
const digest = data => crypto.createHash("sha256").update(data.toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
try {
 if (!fs.existsSync(path.join(root, "package.json"))) throw new Error("Abra o terminal na pasta original do projeto, onde está package.json.");
 const prepared = entries.map(entry => {
  const target=path.join(root,entry.path);
  if (!fs.existsSync(target)) throw new Error("Arquivo ausente: "+entry.path+". Nenhum arquivo foi alterado.");
  const current=fs.readFileSync(target),hash=digest(current);
  if(hash!==entry.before && hash!==entry.after) throw new Error("Versão diferente: "+entry.path+". Nenhum arquivo foi alterado. Envie a versão atual para adaptar a correção.");
  const content=fs.readFileSync(path.join(__dirname,"payload",entry.path));
  if(digest(content)!==entry.after) throw new Error("Arquivo do ZIP incompleto. Extraia novamente.");
  return {...entry,current,content,target};
 });
 const backup=path.join(path.dirname(root),path.basename(root)+"-backup-cadastro-"+Date.now());
 for(const entry of prepared) {const saved=path.join(backup,entry.path);fs.mkdirSync(path.dirname(saved),{recursive:true});fs.writeFileSync(saved,entry.current);}
 try {for(const entry of prepared) fs.writeFileSync(entry.target,entry.content);} catch(error) {for(const entry of prepared) fs.writeFileSync(entry.target,entry.current);throw error;}
 console.log("Correção instalada. Backup: "+backup);
 console.log("Agora execute npm run typecheck. Só faça commit e push se passar sem erro.");
} catch(error) {console.error(error.message);process.exitCode=1;}
