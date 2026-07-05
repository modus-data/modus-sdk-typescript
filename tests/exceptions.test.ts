import { describe, expect, it } from 'vitest'
import {
  AuthenticationError,
  ConflictError,
  InternalServerError,
  ModusError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableError,
} from '../src/_exceptions.js'
import { raiseForStatus } from '../src/_http.js'

function resp(
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): { response: Response; body: string } {
  const bodyText = body !== undefined ? JSON.stringify(body) : ''
  const init: ResponseInit = { status, headers }
  const response =
    status === 204
      ? new Response(null, init)
      : new Response(bodyText, init)
  return { response, body: status === 204 ? '' : bodyText }
}

describe('raiseForStatus', () => {
  it('2xx does not throw', () => {
    const ok = resp(200, {})
    expect(() => raiseForStatus(ok.response, ok.body)).not.toThrow()
    const noContent = resp(204)
    expect(() => raiseForStatus(noContent.response, noContent.body)).not.toThrow()
  })

  it('maps 401 to AuthenticationError', () => {
    const r = resp(401, { message: 'Invalid token' })
    expect(() => raiseForStatus(r.response, r.body)).toThrow(AuthenticationError)
  })

  it('maps 403 to PermissionDeniedError', () => {
    const r = resp(403, { message: 'Forbidden' })
    expect(() => raiseForStatus(r.response, r.body)).toThrow(PermissionDeniedError)
  })

  it('maps 404 to NotFoundError', () => {
    const r = resp(404, { message: 'Skill not found' })
    try {
      raiseForStatus(r.response, r.body)
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as NotFoundError).message).toContain('Skill not found')
    }
  })

  it('maps 409 to ConflictError', () => {
    const r = resp(409, { message: 'Run exists' })
    expect(() => raiseForStatus(r.response, r.body)).toThrow(ConflictError)
  })

  it('maps 422 to UnprocessableError', () => {
    const r = resp(422, { message: 'Validation failed' })
    expect(() => raiseForStatus(r.response, r.body)).toThrow(UnprocessableError)
  })

  it('maps 429 without retry-after', () => {
    const r = resp(429, { message: 'Too many' })
    try {
      raiseForStatus(r.response, r.body)
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBeUndefined()
    }
  })

  it('maps 429 with retry-after header', () => {
    const r = resp(429, { message: 'Slow down' }, { 'retry-after': '30' })
    try {
      raiseForStatus(r.response, r.body)
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBe(30)
    }
  })

  it('maps 5xx to InternalServerError', () => {
    const r500 = resp(500, { message: 'Broke' })
    expect(() => raiseForStatus(r500.response, r500.body)).toThrow(InternalServerError)
    const r503 = resp(503)
    expect(() => raiseForStatus(r503.response, r503.body)).toThrow(InternalServerError)
  })

  it('maps unknown 4xx to ModusError', () => {
    const r = resp(418, { message: "I'm a teapot" })
    try {
      raiseForStatus(r.response, r.body)
    } catch (error) {
      expect(error).toBeInstanceOf(ModusError)
      expect((error as ModusError).statusCode).toBe(418)
    }
  })

  it('joins NestJS list messages', () => {
    const r = resp(422, { message: ['field required', 'must be string'] })
    try {
      raiseForStatus(r.response, r.body)
    } catch (error) {
      expect((error as UnprocessableError).message).toContain('field required')
    }
  })
})

describe('exception status codes', () => {
  it('bakes in subclass status codes', () => {
    expect(new AuthenticationError('x').statusCode).toBe(401)
    expect(new PermissionDeniedError('x').statusCode).toBe(403)
    expect(new NotFoundError('x').statusCode).toBe(404)
    expect(new ConflictError('x').statusCode).toBe(409)
    expect(new UnprocessableError('x').statusCode).toBe(422)
    expect(new RateLimitError('x').statusCode).toBe(429)
    expect(new InternalServerError('x', 503).statusCode).toBe(503)
  })
})
