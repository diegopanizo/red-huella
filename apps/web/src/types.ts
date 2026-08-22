export type User = {
  id: string
  name: string
  email: string
  role: 'USER' | 'SHELTER' | 'ADMIN'
}
export type PublicationType = 'LOST' | 'FOUND' | 'ADOPTION'
export type PublicationStatus = 'ACTIVE' | 'RESOLVED' | 'ADOPTED' | 'ARCHIVED'
export type PublicationImage = {
  id: string
  position: number
  url: string
  thumbnailUrl: string
  width: number | null
  height: number | null
}
export type Publication = {
  id: string
  type: PublicationType
  title: string
  description: string | null
  status: PublicationStatus
  eventDate: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  location: { latitude: number; longitude: number | null } | null
  animal: {
    id: string
    name: string | null
    species: 'DOG' | 'CAT' | 'OTHER'
    breed: string | null
    sex: 'MALE' | 'FEMALE' | 'UNKNOWN'
    color: string | null
    size: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNKNOWN'
    approximateAge: number | null
    description: string | null
  }
  author: { id: string; name: string; role: User['role'] }
  images: PublicationImage[]
}
export type PublicationList = {
  items: Publication[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
