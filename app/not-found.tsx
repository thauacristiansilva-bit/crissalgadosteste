export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffaf5] p-6">
      <div className="max-w-md rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-xl shadow-orange-100/50">
        <div className="text-5xl">🥟</div>
        <h1 className="mt-4 text-2xl font-black text-gray-950">Página não encontrada</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">O endereço informado não existe ou o pedido não foi encontrado.</p>
        <a href="/" className="mt-5 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white">Voltar ao cardápio</a>
      </div>
    </main>
  )
}
