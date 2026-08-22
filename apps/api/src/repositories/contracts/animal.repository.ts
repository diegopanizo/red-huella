import type {
  AnimalSex,
  AnimalSize,
  Species,
} from '../../database/schema/enums.js'
import type { AnimalRecord } from '../../database/schema/animals.js'

export interface CreateAnimalData {
  name?: string | null | undefined
  species: Species
  breed?: string | null | undefined
  sex?: AnimalSex | undefined
  color?: string | null | undefined
  size?: AnimalSize | undefined
  approximateAge?: number | null | undefined
  description?: string | null | undefined
}

export interface AnimalRepository {
  findById(id: string): Promise<AnimalRecord | undefined>
  create(data: CreateAnimalData): Promise<AnimalRecord>
}

export type UpdateAnimalData = {
  [Key in keyof CreateAnimalData]?: CreateAnimalData[Key] | undefined
}
