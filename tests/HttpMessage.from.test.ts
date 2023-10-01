import * as http from 'node:http'
import * as https from 'node:https'
import { HttpMessage } from '../src/HttpMessage.js'
import { Socket } from 'node:net'

describe('fromRequest(Request)', () => {
  it('returns http message for a GET request', async () => {
    const message = await HttpMessage.fromRequest(
      new Request('https://example.com')
    )

    expect(message.mimeType).toBe('')
    expect(message.headers).toBe('')
    expect(message.headersSize).toBe(35)
    expect(message.body).toBeUndefined()
    expect(message.bodySize).toBe(0)
    expect(message.toString()).toBe(`GET https://example.com/ HTTP/1.0\r\n`)
  })

  it('returns http message for a POST request', async () => {
    const message = await HttpMessage.fromRequest(
      new Request('https://example.com', {
        method: 'POST',
        body: 'Hello world',
      })
    )

    expect(message.mimeType).toBe('text/plain;charset=UTF-8')
    expect(message.headers).toBe(
      `content-type: text/plain;charset=UTF-8\r\n\r\n`
    )
    expect(message.headersSize).toBe(78)
    expect(message.body).toBe('Hello world')
    expect(message.bodySize).toBe(11)

    expect(message.toString()).toBe(
      `POST https://example.com/ HTTP/1.0\r\ncontent-type: text/plain;charset=UTF-8\r\n\r\nHello world`
    )
  })

  it('returns http message for a POST request with headers', async () => {
    const message = await HttpMessage.fromRequest(
      new Request('https://example.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'Value',
        },
        body: JSON.stringify({ id: 1, name: 'John' }),
      })
    )

    expect(message.mimeType).toBe('application/json')
    expect(message.headers).toBe(
      `content-type: application/json\r\nx-custom-header: Value\r\n\r\n`
    )
    expect(message.headersSize).toBe(94)
    expect(message.body).toBe(`{"id":1,"name":"John"}`)
    expect(message.bodySize).toBe(22)
    expect(message.toString()).toBe(
      `POST https://example.com/ HTTP/1.0\r\ncontent-type: application/json\r\nx-custom-header: Value\r\n\r\n{"id":1,"name":"John"}`
    )
  })
})

describe.only('fromRequest(ClientRequest)', () => {
  it('returns http message for a GET request', async () => {
    const request = https.get('https://example.com')

    const message = await HttpMessage.fromRequest(request)

    expect(message.toString()).toBe('GET https://example.com/ HTTP/1.0\r\n')
  })

  it('returns http message for a POST request', async () => {
    const request = https.request('https://example.com', {
      method: 'POST',
    })
    request.write('request')
    request.end('payload')

    const message = await HttpMessage.fromRequest(request)
    expect(message.toString()).toBe(`foo`)
  })
})

describe('fromResponse(Response)', () => {
  it('returns http message for an empty 200 OK response', async () => {
    const message = await HttpMessage.fromResponse(new Response())

    expect(message.mimeType).toBe('')
    expect(message.headers).toBe('')
    expect(message.headersSize).toBe(17)
    expect(message.body).toBeUndefined()
    expect(message.bodySize).toBe(0)
    expect(message.toString()).toBe(`HTTP/1.0 200 OK\r\n`)
  })

  it('returns http message for response with headers', async () => {
    const message = await HttpMessage.fromResponse(
      new Response(null, {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'Value',
        },
      })
    )

    expect(message.mimeType).toBe('application/json')
    expect(message.headers).toBe(
      `content-type: application/json\r\nx-custom-header: Value\r\n`
    )
    expect(message.headersSize).toBe(78)
    expect(message.body).toBeUndefined()
    expect(message.bodySize).toBe(0)
    expect(message.toString()).toBe(
      `HTTP/1.0 201 Created\r\ncontent-type: application/json\r\nx-custom-header: Value\r\n\r\n`
    )
  })

  it('returns http message for response with text body', async () => {
    const message = await HttpMessage.fromResponse(
      new Response('Hello world', {
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
        },
      })
    )

    expect(message.mimeType).toBe('text/plain;charset=UTF-8')
    expect(message.headers).toBe(
      `content-type: text/plain;charset=UTF-8\r\n\r\n`
    )
    expect(message.headersSize).toBe(59)
    expect(message.body).toBe('Hello world')
    expect(message.bodySize).toBe(11)
    expect(message.toString()).toBe(
      `HTTP/1.0 200 OK\r\ncontent-type: text/plain;charset=UTF-8\r\n\r\nHello world`
    )
  })

  it('returns http message for response with multi-line body', async () => {
    const message = await HttpMessage.fromResponse(
      new Response('Hello\r\nfrom\r\n\r\nserver!')
    )

    expect(message.mimeType).toBe('text/plain;charset=UTF-8')
    expect(message.headers).toBe(
      `content-type: text/plain;charset=UTF-8\r\n\r\n`
    )
    expect(message.headersSize).toBe(59)
    expect(message.body).toBe('Hello\r\nfrom\r\n\r\nserver!')
    expect(message.bodySize).toBe(22)
    expect(message.toString()).toBe(
      `HTTP/1.0 200 OK\r\ncontent-type: text/plain;charset=UTF-8\r\n\r\nHello\r\nfrom\r\n\r\nserver!`
    )
  })

  it('sets "bodySize" to 0 for cached response (304)', async () => {
    const message = await HttpMessage.fromResponse(
      new Response(null, { status: 304 })
    )

    /**
     * @see http://www.softwareishard.com/blog/har-12-spec/#response
     */
    expect(message.bodySize).toBe(0)
  })
})

describe('fromResponse(IncomingMessage)', () => {
  it('returns http message for an empty 200 OK response', async () => {
    const response = new http.IncomingMessage(new Socket())
    response.push(null)
    const message = await HttpMessage.fromResponse(response)

    expect(message.mimeType).toBe('')
    expect(message.headers).toBe('')
    expect(message.headersSize).toBe(17)
    expect(message.body).toBeUndefined()
    expect(message.bodySize).toBe(0)
    expect(message.toString()).toBe(`HTTP/1.0 200 OK\r\n`)
  })

  it('returns http message for response with headers', async () => {
    const response = new http.IncomingMessage(new Socket())
    response.headers['ContenT-TypE'] = 'application/json'
    response.headers['x-custom-header'] = 'Value'
    response.push(null)
    const message = await HttpMessage.fromResponse(response)

    expect(message.mimeType).toBe('application/json')
    expect(message.headers).toBe(
      'ContenT-TypE: application/json\r\nx-custom-header: Value\r\n'
    )
    expect(message.headersSize).toBe(73)
    expect(message.body).toBeUndefined()
    expect(message.bodySize).toBe(0)
    expect(message.toString()).toBe(
      `HTTP/1.0 200 OK\r\nContenT-TypE: application/json\r\nx-custom-header: Value\r\n\r\n`
    )
  })

  it('returns http message for response with text body', async () => {
    const response = new http.IncomingMessage(new Socket())
    response.headers['content-type'] = 'text/plain;charset=UTF-8'
    response.push('Hello')
    response.push(' ')
    response.push('world')
    response.push(null)

    const message = await HttpMessage.fromResponse(response)
    expect(message.mimeType).toBe('text/plain;charset=UTF-8')
    expect(message.headers).toBe(
      'content-type: text/plain;charset=UTF-8\r\n\r\n'
    )
    expect(message.body).toBe('Hello world')
    expect(message.bodySize).toBe(11)
    expect(message.toString()).toBe(
      `HTTP/1.0 200 OK\r\ncontent-type: text/plain;charset=UTF-8\r\n\r\nHello world`
    )
  })

  it('returns http message for response with JSON body', async () => {
    const response = new http.IncomingMessage(new Socket())
    response.headers['content-type'] = 'application/json'
    response.push('{"id":')
    response.push('1,')
    response.push('"name":"John"')
    response.push('}')
    response.push(null)

    const message = await HttpMessage.fromResponse(response)
    expect(message.mimeType).toBe('application/json')
    expect(message.headers).toBe('content-type: application/json\r\n\r\n')
    expect(message.headersSize).toBe(51)
    expect(message.body).toBe(`{"id":1,"name":"John"}`)
    expect(message.bodySize).toBe(22)
    expect(message.toString()).toBe(
      `HTTP/1.0 200 OK\r\ncontent-type: application/json\r\n\r\n{"id":1,"name":"John"}`
    )
  })
})
