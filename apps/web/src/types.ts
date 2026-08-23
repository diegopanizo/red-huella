export type User = {
  id: string
  name: string
  email: string
  role: 'USER' | 'SHELTER' | 'ADMIN'
}
export type PublicationType = 'LOST' | 'FOUND' | 'ADOPTION'
export type PublicationStatus = 'ACTIVE' | 'RESOLVED' | 'ADOPTED' | 'ARCHIVED'
export type ContactMethodType = 'WHATSAPP' | 'PHONE' | 'EMAIL'
export type PublicationContactMethod = {
  type: ContactMethodType
  value: string
}
export type PublicationContactSettings = {
  methods: PublicationContactMethod[]
}
export type Location = { latitude: number; longitude: number }
export type PublicLocation = Location & { radiusMeters: number }
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
  publicLocation: PublicLocation | null
  distanceMeters?: number
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
export type ManagePublication = Publication & {
  exactLocation: Location | null
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

export type MapBounds = {
  north: number
  south: number
  west: number
  east: number
}
export type MapPublication = {
  id: string
  type: PublicationType
  status: Exclude<PublicationStatus, 'ARCHIVED'>
  title: string
  eventDate: string
  publicLocation: { lat: number; long: number; radius: number }
  animal: {
    name: string | null
    species: 'DOG' | 'CAT' | 'OTHER'
    breed: string | null
  }
  thumbnail: { url: string; width: number; height: number } | null
}
export type MapPublicationsResponse = {
  publications: MapPublication[]
  truncated: boolean
  limit: 500
}

export type VisualSearchFilters = {
  targetType?: PublicationType
  species?: Publication['animal']['species']
  limit: number
}
export type VisualSearchResult = {
  publication: {
    id: string
    type: PublicationType
    title: string
    eventDate: string
    animal: Pick<Publication['animal'], 'name' | 'species' | 'breed'>
    primaryImage: Pick<PublicationImage, 'id' | 'thumbnailUrl'> | null
    publicLocation: PublicLocation | null
  }
  matchedImage: Pick<PublicationImage, 'id' | 'thumbnailUrl'>
  visualSimilarity: number
}
export type VisualSearchResponse = { items: VisualSearchResult[] }
