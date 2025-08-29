
import { Client } from './Client'
import { Server, ServerConfig } from './Server'
import { UIPort } from './types'

export function uiPort<State extends object, Actions extends object>(name: string): UIPort<State, Actions> {
  return {
    server: (init: ServerConfig<State, Actions>) => Server.create(name, init),
    client: () => Client.create(name),
  }
}

export { Server } from './Server'
export { Client } from './Client'
export * from './types'