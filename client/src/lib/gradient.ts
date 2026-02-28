const GRADIENTS: [string, string][] = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#30cfd0', '#663399'],
  ['#f6d365', '#fda085'],
  ['#89f7fe', '#66a6ff'],
  ['#a18cd1', '#fbc2eb'],
  ['#fd746c', '#ff9068'],
  ['#96fbc4', '#f9f586'],
  ['#c471ed', '#12c2e9'],
  ['#4481eb', '#04befe'],
  ['#f7971e', '#ffd200'],
  ['#56ab2f', '#a8e063'],
  ['#ee0979', '#ff6a00'],
]

export function getGradient(seed: string | number): string {
  const str = String(seed)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  const [from, to] = GRADIENTS[Math.abs(hash) % GRADIENTS.length]
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`
}
