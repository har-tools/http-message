# `@har-tools/http-message`

JavaScript API to create an HTTP message from Fetch API requests/responses.

## Installation

```sh
npm install @har-tools/http-message
```

## API

### `new HttpMessage(startLine, headers, body)`

Creates a new HTTP message from the given start line, heades, and optional body.

### `HttpMessage.from(request)`

Creates a new HTTP message from the given Fetch API `Request` instance.

```js
const request = new Request('https://example.com', {
  method: 'POST',
  body: 'Hello world!',
})
const message = HttpMessage.from(request)

console.log(message)
// POST https://example.com HTTP/1.0
// content-type: text/plain;charset=UTF-8
//
// Hello world!
```

### `HttpMessage.from(response)`

Creates a new HTTP message from the given Fetch API `Respnse` instance.

```js
const response = new Response(
  JSON.stringify({
    id: 1,
    name: 'John',
  }),
  {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'Value',
    },
  }
)
const message = HttpMessage.from(response)

console.log(message)
// HTTP/1.0 201 Created
// content-type: application/json
// x-custom-header: Value
//
// {"id":1,"name":"John"}
```
