import { STATUS_CODES } from 'node:http'

export class HttpMessage {
  static httpVersion = 'HTTP/1.0'

  static async from(instance: Request | Response): Promise<HttpMessage> {
    const startLine =
      instance instanceof Request
        ? `${instance.method} ${instance.url} ${HttpMessage.httpVersion}`
        : `${HttpMessage.httpVersion} ${instance.status} ${
            instance.statusText || STATUS_CODES[instance.status]
          }`
    const body = await getBodyOrUndefined(instance)

    return new HttpMessage(startLine, instance.headers, body)
  }

  public encoding?: BufferEncoding
  public mimeType: string
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
    protected startLine: string,
    headers: Headers,
    public body: string | undefined
  ) {
    this.encoding = (headers.get('Content-Encoding') ||
      undefined) as BufferEncoding

    this.mimeType = headers.get('Content-Type') || ''
    this.bodySize =
      body == null ? 0 : Buffer.from(body, this.encoding).byteLength

    const headersFields = toRawHeaders(headers)
    if (headersFields.length === 0) {
      this.headers = ''
    } else {
      this.headers = `${headersFields.join('\r\n')}\r\n`

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

function toRawHeaders(headers: Headers): Array<string> {
  const raw: Array<string> = []

  headers.forEach((value, name) => {
    raw.push(`${name}: ${value}`)
  })

  return raw
}

async function getBodyOrUndefined(
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
