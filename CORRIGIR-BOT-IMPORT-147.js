const fs = require("fs");

const file =
  "components/admin/admin-dashboard.tsx";

if (!fs.existsSync(file)) {
  throw new Error(
    `Arquivo nao encontrado: ${file}`
  );
}

let source =
  fs.readFileSync(
    file,
    "utf8"
  );

// ------------------------------------------------------------
// 1. REMOVE Bot DO IMPORT DO REACT
// ------------------------------------------------------------

source = source.replace(
  /import\s*\{([^}]*)\}\s*from\s*"react"/,
  (full, imports) => {
    const cleaned =
      imports
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean)
        .filter(
          (item) =>
            item !== "Bot"
        );

    return `import { ${cleaned.join(", ")} } from "react"`;
  }
);

// ------------------------------------------------------------
// 2. GARANTE Bot NO lucide-react
// ------------------------------------------------------------

source = source.replace(
  /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/,
  (full, imports) => {
    const items =
      imports
        .split(",")
        .map((item) =>
          item.trim()
        )
        .filter(Boolean);

    if (
      !items.includes("Bot")
    ) {
      items.unshift("Bot");
    }

    return `import {
  ${items.join(",\n  ")},
} from "lucide-react"`;
  }
);

// ------------------------------------------------------------
// 3. VALIDACAO
// ------------------------------------------------------------

const reactImport =
  source.match(
    /import\s*\{([^}]*)\}\s*from\s*"react"/
  )?.[1] || "";

const lucideImport =
  source.match(
    /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/
  )?.[1] || "";

if (
  /\bBot\b/.test(
    reactImport
  )
) {
  throw new Error(
    "Bot ainda esta importado do React."
  );
}

if (
  !/\bBot\b/.test(
    lucideImport
  )
) {
  throw new Error(
    "Bot nao foi adicionado ao lucide-react."
  );
}

fs.writeFileSync(
  file,
  source,
  "utf8"
);

console.log("");
console.log(
  "BOT IMPORT CORRIGIDO"
);
console.log(
  "- Bot removido de react"
);
console.log(
  "- Bot adicionado a lucide-react"
);
console.log("");