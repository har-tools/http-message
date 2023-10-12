import { STATUS_CODES, IncomingMessage, IncomingHttpHeaders } from 'node:http'
import { invariant } from 'outvariant'
import { DeferredPromise } from '@open-draft/deferred-promise'

export type RawHeaders = Record<string, string>

export class HttpMessage {
  static httpVersion = 'HTTP/1.0'

  static async fromRequest(request: Request): Promise<HttpMessage> {
    const startLine = `${request.method} ${request.url} ${HttpMessage.httpVersion}`
    const headers = Object.fromEntries(request.headers.entries())
    const body = await extractFetchBody(request)

    return new HttpMessage(startLine, headers, body)
  }

  static async fromResponse(
    response: Response | IncomingMessage
  ): Promise<HttpMessage> {
    // Fetch API response.
    if (response instanceof Response) {
      const statusText = response.statusText || STATUS_CODES[response.status]
      const startLine = `${HttpMessage.httpVersion} ${response.status} ${statusText}`
      const headers = Object.fromEntries(response.headers.entries())
      const body = await extractFetchBody(response)

      return new HttpMessage(startLine, headers, body)
    }

    // http.IncomingMessage response.
    if (response instanceof IncomingMessage) {
      const status = response.statusCode || 200
      const statusText = response.statusMessage || STATUS_CODES[status]
      // Infer the HTTP version from IncomingMessage directly.
      const httpVersion = response.httpVersion || HttpMessage.httpVersion
      const startLine = `${httpVersion} ${status} ${statusText}`
      const headers = headersFromIncomingHttpHeaders(response.headers)
      const body = await extractHttpIncomingMessageBody(response)

      return new HttpMessage(startLine, headers, body)
    }

    invariant(
      false,
      'Failed to create HTTP message from response: expected a Fetch API Response instance or http.IncomingMessage but got %s',
      response != null
        ? // @ts-expect-error
          response.constructor?.name
        : typeof response
    )
  }

  /**
   * Encoding of this HTTP message.
   * Inferred from the `Content-Encoding` header, otherwise undefined.
   */
  public encoding?: BufferEncoding

  /**
   * Content type of this HTTP message.
   * Inferred from the `Content-Type` header, otherwise an empty string.
   */
  public mimeType: string

  /**
   * HTTP headers string of this message.
   * Includes a double CRLF at the end if this message has body.
   * @example
   * "content-type: text/plain;charset=UTF-8"
   */
  public headers: string

  /**
   * Total number of bytes from the start of the HTTP message
   * until, and including, the double CRLF before the body.
   */
  public headersSize: number

  /**
   * Size of the request body in bytes.
   */
  public bodySize: number

  constructor(
    /**
     * Start line of the HTTP message.
     * @example
     * // For requests:
     * "GET /resource HTTP/1.0"
     * // For responses:
     * "HTTP/1.0 200 OK"
     */
    protected startLine: string,
    public rawHeaders: RawHeaders,
    public body: string | undefined
  ) {
    const fetchHeaders = new Headers(this.rawHeaders)

    this.mimeType = fetchHeaders.get('Content-Type') || ''
    this.bodySize = body == null ? 0 : Buffer.from(body).byteLength

    const headerLines = toHeaderLines(this.rawHeaders)

    if (headerLines.length === 0) {
      this.headers = ''
    } else {
      this.headers = `${headerLines.join('\r\n')}\r\n`

      if (this.bodySize > 0) {
        this.headers += '\r\n'
      }
    }

    this.headersSize = Buffer.from(
      this.startLine + '\r\n' + this.headers
    ).byteLength
  }

  /**
   * Total HTTP message sizes in bytes.
   */
  public get totalSize(): number {
    return this.headersSize + this.bodySize
  }

  /**
   * Returns a string representation of this HTTP message.
   * @example
   * message.toString()
   * `HTTP/1.0 200 OK
   * content-type: text/plain;charset=UTF-8
   * x-custom-header: Value
   *
   * Hello world!`
   */
  public toString(): string {
    let message = `${this.startLine}\r\n`
    const rawHeaders = this.headers
    const hasBody = this.body != null

    message += rawHeaders

    if (hasBody) {
      message += this.body
    } else if (rawHeaders.length > 0) {
      message += '\r\n'
    }

    return message
  }
}

function toHeaderLines(rawHeaders: RawHeaders): Array<string> {
  const lines: Array<string> = []

  for (const [name, value] of Object.entries(rawHeaders)) {
    lines.push(`${name}: ${value}`)
  }

  return lines
}

function headersFromIncomingHttpHeaders(
  headers: IncomingHttpHeaders
): RawHeaders {
  const result: RawHeaders = {}

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'undefined') {
      continue
    }

    const resolvedValue = Array.isArray(value) ? value.join(', ') : value
    result[name] = resolvedValue
  }

  return result
}

async function extractFetchBody(
  instance: Request | Response
): Promise<string | undefined> {
  if (!instance.body) {
    return undefined
  }

  // The consumer must clone the request/response
  // instance before consturcting an HTTP message from it.
  // That's also the right surface to clone the instance.
  return instance.text()
}

async function extractHttpIncomingMessageBody(
  message: IncomingMessage
): Promise<string | undefined> {
  const responseBodyPromise = new DeferredPromise<string | undefined>()
  const chunks: Array<Buffer> = []

  invariant(
    message.readable,
    'Failed to read the body of IncomingMessage: message already read'
  )

  message.on('data', (chunk) => chunks.push(chunk))
  message.on('error', (error) => responseBodyPromise.reject(error))
  message.on('end', () => {
    const text =
      chunks.length === 0 ? undefined : Buffer.concat(chunks).toString('utf8')
    responseBodyPromise.resolve(text)
  })

  return responseBodyPromise
}
