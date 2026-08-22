const e164Pattern = /^\+[1-9][0-9]{7,14}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizedAnimalName(animalName?: string): string | undefined {
  const value = animalName?.trim()
  return value || undefined
}

export function buildContactMessage(animalName?: string): string {
  const name = normalizedAnimalName(animalName)
  return name
    ? `Hola, te contacto por tu publicación de ${name} en Red Huella.`
    : 'Hola, te contacto por tu publicación en Red Huella.'
}

export function buildWhatsAppContactUrl(
  phone: string,
  animalName?: string,
): string | undefined {
  if (!e164Pattern.test(phone)) return undefined
  const url = new URL(`https://wa.me/${phone.slice(1)}`)
  if (url.hostname !== 'wa.me') return undefined
  url.searchParams.set('text', buildContactMessage(animalName))
  return url.toString()
}

export function buildTelephoneContactUrl(phone: string): string | undefined {
  return e164Pattern.test(phone) ? `tel:${phone}` : undefined
}

export function buildEmailContactUrl(
  email: string,
  animalName?: string,
): string | undefined {
  if (
    email.length > 254 ||
    !emailPattern.test(email) ||
    /[?&#\r\n]/.test(email)
  )
    return undefined
  const name = normalizedAnimalName(animalName)
  const params = new URLSearchParams({
    subject: name
      ? `Red Huella — publicación de ${name}`
      : 'Red Huella — publicación',
    body: buildContactMessage(name),
  })
  return `mailto:${email}?${params.toString()}`
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  try {
    const base = new URL('https://red-huella.invalid/')
    const target = new URL(value, base)
    if (target.origin !== base.origin) return '/'
    if (target.pathname === '/login' || target.pathname === '/register')
      return '/'
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return '/'
  }
}
