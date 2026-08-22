import { z } from 'zod'

import { publicationContactSettingsSchema } from './validation.js'

export const contactSettingsBodySchema = z
  .object({ methods: publicationContactSettingsSchema })
  .strict()
