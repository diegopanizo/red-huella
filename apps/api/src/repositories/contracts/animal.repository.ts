import type {
  AnimalSex,
  AnimalSize,
  Species,
} from '../../database/schema/enums.js'
import type { AnimalRecord } from '../../database/schema/animals.js'

export interface CreateAnimalData {
  name?: string | null
  species: Species
  breed?: string | null
  sex?: AnimalSex
  color?: string | null
  size?: AnimalSize
  approximateAge?: number | null
  description?: string | null
}

export interface AnimalRepository {
  findById(id: string): Promise<AnimalRecord | undefined>
  create(data: CreateAnimalData): Promise<AnimalRecord>
}
