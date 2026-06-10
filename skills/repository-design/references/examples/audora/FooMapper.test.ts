/**
 * Worked example — Mapper test (Audora profile).
 *
 * Round-trip: `fromRow` produces the right entity; `toRow` produces the right
 * row (note `labels` becomes a JSON string). Pure functions, strict deep-equal.
 */
import { Foo, FooStatus } from '@entities/entities'
import { ObjectId } from '@entities/value-objects'
import { FooRow } from '../schema'
import { FooMapper } from './FooMapper'

describe(FooMapper.name, () => {
  const UID = new ObjectId('UID')
  const COMPANY_UID = new ObjectId('COMPANY_UID')
  const NAME = 'compliance'
  const LABELS = ['a', 'b']
  const STATUS = FooStatus.Active
  const CREATED_AT = new Date('2024-02-05 17:00:00')
  const MODIFIED_AT = new Date('2024-02-07 17:00:00')

  describe('fromRow', () => {
    const row: FooRow = {
      id: UID.value,
      company_id: COMPANY_UID.value,
      name: NAME,
      labels: LABELS,
      status: STATUS,
      created_at: CREATED_AT,
      modified_at: MODIFIED_AT,
    }

    it('should map to a Foo', () => {
      const entity = FooMapper.fromRow(row)

      expect(entity.uid).toEqual(UID)
      expect(entity.companyUid).toEqual(COMPANY_UID)
      expect(entity.name).toEqual(NAME)
      expect(entity.labels).toEqual(LABELS)
      expect(entity.status).toEqual(STATUS)
      expect(entity.createdAt).toStrictEqual(CREATED_AT)
      expect(entity.modifiedAt).toStrictEqual(MODIFIED_AT)
    })
  })

  describe('toRow', () => {
    const entity = new Foo({
      uid: UID,
      companyUid: COMPANY_UID,
      name: NAME,
      labels: LABELS,
      status: STATUS,
      createdAt: CREATED_AT,
      modifiedAt: MODIFIED_AT,
    })

    it('should map it to a row with labels serialized', () => {
      const row = FooMapper.toRow(entity)

      expect(row).toStrictEqual({
        id: UID.value,
        company_id: COMPANY_UID.value,
        name: NAME,
        labels: JSON.stringify(LABELS),
        status: STATUS,
        created_at: CREATED_AT,
        modified_at: MODIFIED_AT,
      })
    })
  })
})
