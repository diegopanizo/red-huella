import {
  toPublicPublicationDto,
  toManagePublicationDto,
  type PublicPublicationDto,
} from '../publications/dto.js'
import {
  canTransitionPublicationStatus,
  resolvedAtForStatus,
} from '../publications/status-transition.js'
import {
  InvalidPublicationStatusTransitionError,
  PublicationForbiddenError,
  PublicationNotFoundError,
  PublicationValidationError,
} from '../errors/publication-errors.js'
import type {
  CreateAnimalData,
  UpdateAnimalData,
} from '../repositories/contracts/animal.repository.js'
import type {
  PublicationListQuery,
  PublicationRepository,
  UpdatePublicationData,
} from '../repositories/contracts/publication.repository.js'
import { LocationPrivacyService } from '../locations/location-privacy-policy.js'

function locationPersistence(
  policy: ReturnType<LocationPrivacyService['apply']>,
) {
  return {
    latitude: null,
    longitude: null,
    exactLocation: policy.exactLocation,
    publicLocation: policy.publicLocation,
    locationPrivacyVersion: policy.privacyVersion,
  }
}

export interface CreatePublicationCommand {
  userId: string
  type: 'LOST' | 'FOUND' | 'ADOPTION'
  title: string
  description?: string | null | undefined
  eventDate: Date
  location?: { latitude: number; longitude: number } | null | undefined
  animal: CreateAnimalData
}

function assertEventDate(
  type: CreatePublicationCommand['type'],
  eventDate: Date,
  now: Date,
) {
  if (
    (type === 'LOST' || type === 'FOUND') &&
    eventDate.getTime() > now.getTime()
  )
    throw new PublicationValidationError(
      'La fecha del suceso no puede ser futura',
    )
}

export class CreatePublicationService {
  constructor(
    private readonly publications: PublicationRepository,
    private readonly locationPrivacy = new LocationPrivacyService(),
  ) {}
  async execute(
    command: CreatePublicationCommand,
    now = new Date(),
  ): Promise<PublicPublicationDto> {
    assertEventDate(command.type, command.eventDate, now)
    return toPublicPublicationDto(
      await this.publications.createWithAnimal(
        {
          userId: command.userId,
          type: command.type,
          title: command.title,
          ...(command.description !== undefined
            ? { description: command.description }
            : {}),
          eventDate: command.eventDate,
          ...locationPersistence(
            this.locationPrivacy.apply({
              type: command.type,
              location: command.location ?? null,
            }),
          ),
          status: 'ACTIVE',
        },
        command.animal,
      ),
    )
  }
}

export class GetPublicationService {
  constructor(private readonly publications: PublicationRepository) {}
  async execute(id: string) {
    const result = await this.publications.findAggregateById(id)
    if (!result || result.publication.status === 'ARCHIVED')
      throw new PublicationNotFoundError()
    return toPublicPublicationDto(result)
  }
}

export class ManagePublicationService {
  constructor(private readonly publications: PublicationRepository) {}
  async execute(id: string, userId: string) {
    const result = await this.publications.findManageAggregateById(id)
    if (!result) throw new PublicationNotFoundError()
    if (result.publication.userId !== userId)
      throw new PublicationForbiddenError()
    return toManagePublicationDto(result)
  }
}

export class ListPublicationsService {
  constructor(private readonly publications: PublicationRepository) {}
  async execute(query: PublicationListQuery) {
    const result = await this.publications.findMany({
      ...query,
      includeArchived: false,
    })
    return {
      items: result.items.map(toPublicPublicationDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    }
  }
  async mine(query: PublicationListQuery, userId: string) {
    const result = await this.publications.findMany({
      ...query,
      ownerId: userId,
      includeArchived: true,
    })
    return {
      items: result.items.map(toPublicPublicationDto),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    }
  }
}

export interface UpdatePublicationCommand {
  type?: 'LOST' | 'FOUND' | 'ADOPTION' | undefined
  title?: string | undefined
  description?: string | null | undefined
  eventDate?: Date | undefined
  location?: { latitude: number; longitude: number } | null | undefined
  animal?: UpdateAnimalData | undefined
}

export class UpdatePublicationService {
  constructor(
    private readonly publications: PublicationRepository,
    private readonly locationPrivacy = new LocationPrivacyService(),
  ) {}
  async execute(
    id: string,
    userId: string,
    command: UpdatePublicationCommand,
    now = new Date(),
  ) {
    const existing = await this.publications.findManageAggregateById(id)
    if (!existing) throw new PublicationNotFoundError()
    if (existing.publication.userId !== userId)
      throw new PublicationForbiddenError()
    if (existing.publication.status !== 'ACTIVE')
      throw new InvalidPublicationStatusTransitionError()
    const finalType = command.type ?? existing.publication.type
    if (command.eventDate) assertEventDate(finalType, command.eventDate, now)
    const update: UpdatePublicationData = { updatedAt: now }
    if (command.type !== undefined) update.type = command.type
    if (command.title !== undefined) update.title = command.title
    if (command.description !== undefined)
      update.description = command.description
    if (command.eventDate !== undefined) update.eventDate = command.eventDate
    if (command.location !== undefined || command.type !== undefined) {
      const policyInputLocation =
        command.location !== undefined
          ? command.location
          : existing.publication.exactLocation
      if (
        command.type !== undefined &&
        command.type !== 'ADOPTION' &&
        command.location === undefined &&
        policyInputLocation === null
      )
        throw new PublicationValidationError(
          'El nuevo tipo requiere indicar una ubicación exacta o eliminarla explícitamente',
        )
      const existingPublicLocation =
        existing.publication.publicLocation === null ||
        existing.publication.publicLocation === undefined ||
        existing.publication.publicLocationRadiusMeters === null ||
        existing.publication.publicLocationRadiusMeters === undefined
          ? null
          : {
              ...existing.publication.publicLocation,
              radiusMeters: existing.publication.publicLocationRadiusMeters,
            }
      Object.assign(
        update,
        locationPersistence(
          this.locationPrivacy.apply({
            type: finalType,
            location: policyInputLocation,
            existing: {
              publicLocation: existingPublicLocation,
              privacyVersion: existing.publication.locationPrivacyVersion,
            },
          }),
        ),
      )
    }
    return toPublicPublicationDto(
      await this.publications.updateWithAnimal(id, update, command.animal),
    )
  }
}

export class ChangePublicationStatusService {
  constructor(private readonly publications: PublicationRepository) {}
  async execute(
    id: string,
    userId: string,
    target: 'RESOLVED' | 'ADOPTED' | 'ARCHIVED',
    now = new Date(),
  ) {
    const existing = await this.publications.findAggregateById(id)
    if (!existing) throw new PublicationNotFoundError()
    if (existing.publication.userId !== userId)
      throw new PublicationForbiddenError()
    if (
      !canTransitionPublicationStatus(
        existing.publication.type,
        existing.publication.status,
        target,
      )
    )
      throw new InvalidPublicationStatusTransitionError()
    return toPublicPublicationDto(
      await this.publications.updateStatus(
        id,
        target,
        resolvedAtForStatus(target, now),
        now,
      ),
    )
  }
}
