import { randomBytes } from 'node:crypto'

import argon2 from 'argon2'

export const passwordPolicy = Object.freeze({ minLength: 12, maxLength: 128 })

export const argon2Parameters = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
})

export interface PasswordHasher {
  hash(password: string): Promise<string>
  verify(hash: string, password: string): Promise<boolean>
  verifyAgainstDummy(password: string): Promise<void>
  needsRehash(hash: string): boolean
}

export class Argon2PasswordHasher implements PasswordHasher {
  private readonly dummyHash = argon2.hash(randomBytes(32), argon2Parameters)

  hash(password: string) {
    return argon2.hash(password, argon2Parameters)
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password)
    } catch {
      return false
    }
  }

  async verifyAgainstDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password)
  }

  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, argon2Parameters)
  }
}
