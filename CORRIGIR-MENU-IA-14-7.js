const fs = require("fs");

const file =
  "components/admin/admin-dashboard.tsx";

if (!fs.existsSync(file)) {
  throw new Error(
    `Arquivo nao encontrado: ${file}`
  );
}

const backup =
  `${file}.bak147-menu`;

fs.copyFileSync(
  file,
  backup
);

let source =
  fs.readFileSync(
    file,
    "utf8"
  );

const eol =
  source.includes("\r\n")
    ? "\r\n"
    : "\n";

// ============================================================
// 1. ADICIONAR ICONE BOT
// ============================================================

const lucideRegex =
  /import\s*\{([\s\S]*?)\}\s*from\s*"lucide-react"/;

const lucideMatch =
  source.match(lucideRegex);

if (!lucideMatch) {
  throw new Error(
    "Import do lucide-react nao encontrado."
  );
}

if (
  !/\bBot\b/.test(
    lucideMatch[1]
  )
) {
  const currentImport =
    lucideMatch[0];

  const newImport =
    currentImport.replace(
      "import {",
      `import {${eol}  Bot,`
    );

  source =
    source.replace(
      currentImport,
      newImport
    );
}

// ============================================================
// 2. ADICIONAR IMPORT DO CHATBOT PANEL
// ============================================================

const chatbotImport =
  'import { ChatbotPanel } from "@/components/admin/chatbot-panel"';

if (
  !source.includes(
    chatbotImport
  )
) {
  const possibleAnchors = [
    'import { LinksPanel } from "@/components/admin/links-panel"',
    'import { SettingsPanel } from "@/components/admin/settings-panel"',
    'import { ReviewsPanel } from "@/components/admin/reviews-panel"',
  ];

  const anchor =
    possibleAnchors.find(
      (item) =>
        source.includes(
          item
        )
    );

  if (!anchor) {
    throw new Error(
      "Nao encontrei local para importar ChatbotPanel."
    );
  }

  source =
    source.replace(
      anchor,
      `${anchor}${eol}${chatbotImport}`
    );
}

// ============================================================
// 3. ADICIONAR IA E AUTOMACOES AO MENU
// ============================================================

const chatbotMenuRegex =
  /\{\s*key:\s*"chatbot"\s*,/;

if (
  !chatbotMenuRegex.test(
    source
  )
) {
  const lines =
    source.split(/\r?\n/);

  const settingsIndex =
    lines.findIndex(
      (line) =>
        line.includes(
          'key: "settings"'
        ) &&
        line.includes(
          'group: "gestao"'
        )
    );

  if (
    settingsIndex < 0
  ) {
    throw new Error(
      'Item "Configurações da loja" nao encontrado no menu.'
    );
  }

  const indent =
    lines[settingsIndex].match(
      /^\s*/
    )?.[0] || "  ";

  lines.splice(
    settingsIndex + 1,
    0,
    `${indent}{ key: "chatbot", label: "IA e Automações", icon: Bot, group: "gestao" },`
  );

  source =
    lines.join(eol);
}

// ============================================================
// 4. ADICIONAR RENDERIZACAO DA CENTRAL
// ============================================================

if (
  !source.includes(
    'section === "chatbot"'
  )
) {
  const lines =
    source.split(/\r?\n/);

  const settingsRenderIndex =
    lines.findIndex(
      (line) =>
        line.includes(
          'section === "settings"'
        ) &&
        line.includes(
          "<SettingsPanel"
        )
    );

  if (
    settingsRenderIndex < 0
  ) {
    throw new Error(
      "Renderizacao de SettingsPanel nao encontrada."
    );
  }

  const indent =
    lines[
      settingsRenderIndex
    ].match(
      /^\s*/
    )?.[0] || "          ";

  lines.splice(
    settingsRenderIndex + 1,
    0,
    `${indent}{section === "chatbot" && <ChatbotPanel settings={settings} onSettingsChanged={setSettings} />}`
  );

  source =
    lines.join(eol);
}

// ============================================================
// 5. VALIDACOES
// ============================================================

const checks = [
  {
    value:
      'label: "IA e Automações"',
    description:
      "item do menu",
  },
  {
    value:
      'section === "chatbot"',
    description:
      "renderizacao",
  },
  {
    value:
      "@/components/admin/chatbot-panel",
    description:
      "import do painel",
  },
];

for (
  const check of checks
) {
  if (
    !source.includes(
      check.value
    )
  ) {
    throw new Error(
      `Falhou: ${check.description}`
    );
  }
}

fs.writeFileSync(
  file,
  source,
  "utf8"
);

console.log("");
console.log(
  "=============================================="
);
console.log(
  "MENU IA 14.7 CORRIGIDO"
);
console.log(
  "=============================================="
);
console.log(
  "- IA e Automacoes adicionada em Gestao"
);
console.log(
  "- ChatbotPanel importado"
);
console.log(
  "- Renderizacao da central restaurada"
);
console.log(
  `- Backup: ${backup}`
);
console.log("");