const fs = require("fs")
const path = require("path")

const root = process.cwd()
const standalone = path.join(root, ".next", "standalone")

function copy(source, destination) {
  if (!fs.existsSync(source)) {
    return
  }

  fs.mkdirSync(path.dirname(destination), {
    recursive: true,
  })

  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
  })
}

copy(
  path.join(root, "public"),
  path.join(standalone, "public")
)

copy(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static")
)

console.log("Arquivos estáticos preparados para standalone.")