import { Buffer } from 'node:buffer'

import { customType } from 'drizzle-orm/pg-core'

export interface GeographyPoint {
  latitude: number
  longitude: number
}

const EWKB_SRID_FLAG = 0x20000000
const EWKB_POINT_TYPE = 1
const WGS84_SRID = 4326

function parseEwkbPoint(value: string): GeographyPoint {
  if (!/^[0-9a-f]+$/iu.test(value) || value.length % 2 !== 0)
    throw new Error('Invalid PostGIS point encoding')
  const bytes = Buffer.from(value, 'hex')
  if (bytes.length !== 25) throw new Error('Invalid PostGIS point length')

  const littleEndian = bytes[0] === 1
  if (!littleEndian && bytes[0] !== 0)
    throw new Error('Invalid PostGIS byte order')
  const readUInt32 = littleEndian
    ? (offset: number) => bytes.readUInt32LE(offset)
    : (offset: number) => bytes.readUInt32BE(offset)
  const readDouble = littleEndian
    ? (offset: number) => bytes.readDoubleLE(offset)
    : (offset: number) => bytes.readDoubleBE(offset)
  const encodedType = readUInt32(1)
  if (
    (encodedType & EWKB_SRID_FLAG) === 0 ||
    (encodedType & 0xff) !== EWKB_POINT_TYPE ||
    readUInt32(5) !== WGS84_SRID
  )
    throw new Error('Unexpected PostGIS point type or SRID')

  const longitude = readDouble(9)
  const latitude = readDouble(17)
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error('Invalid PostGIS point coordinates')
  return { latitude, longitude }
}

export const geographyPoint = customType<{
  data: GeographyPoint
  driverData: string
}>({
  dataType: () => 'geography(Point,4326)',
  fromDriver: parseEwkbPoint,
  toDriver: (value) =>
    `SRID=${WGS84_SRID};POINT(${value.longitude} ${value.latitude})`,
})
