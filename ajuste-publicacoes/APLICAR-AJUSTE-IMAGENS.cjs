const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = process.cwd();
const panel = "components/admin/marketing-publications-panel.tsx";
const entries = [["marketing-publications-panel.tsx", panel], ["publication-image-editor.tsx", "components/admin/publication-image-editor.tsx"], ["publication-image-layout.ts", "lib/publication-image-layout.ts"]];
const digest = text => crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
const allowed = ["d56b87b1b199f43f9541974fb4fc245b3f2f712e24bf8c0bef8cd3b731a27c8d", "ead9b3234c8e183243e6c996994a7f54d2d476e938ee28c8e930ef4a58723287"];
try {
 if (!fs.existsSync(path.join(root, "package.json")) || !fs.existsSync(path.join(root,panel))) throw new Error("Execute este comando na pasta original do SaborFlow, onde está package.json.");
 if (!allowed.includes(digest(fs.readFileSync(path.join(root,panel),"utf8")))) throw new Error("Sua tela de publicações está em outra versão. Nenhum arquivo foi alterado. Envie components/admin/marketing-publications-panel.tsx para adaptar esta etapa sem perder suas mudanças.");
 const prepared = entries.map(([source,dest])=>({dest,content:fs.readFileSync(path.join(__dirname,"payload",source),"utf8")}));
 const backup = path.join(path.dirname(root),path.basename(root)+"-backup-ajuste-imagens-"+Date.now());
 for(const {dest} of prepared) if(fs.existsSync(path.join(root,dest))) { const saved=path.join(backup,dest);fs.mkdirSync(path.dirname(saved),{recursive:true});fs.copyFileSync(path.join(root,dest),saved); }
 for(const {dest,content} of prepared) {const target=path.join(root,dest);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}
 console.log("Ajuste de imagens instalado. Backup: "+backup);
 console.log("Agora execute npm run typecheck. Se passar, faça commit e push.");
} catch(error) { console.error(error.message); process.exitCode=1; }
