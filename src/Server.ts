import browser from 'webextension-polyfill'
import { isFunction } from 'ytil'
import { ActionMessage } from './types'

export class Server<State extends object, Actions extends object> {

  private constructor(
    public readonly name: string,
    private init: ServerInit<State, Actions>
  ) {}

  private clients: browser.Runtime.Port[] = []
  private updates: Partial<State>[] = []

  public static create<State extends object, Actions extends object>(name: string, init: ServerInit<State, Actions>) {
    const server = new Server(name, init)
    server.bind()
    return server
  }

  private bind() {
    browser.runtime.onConnect.addListener(async client => {
      if (client.name !== this.name) return

      this.clients.push(client)

      client.onMessage.addListener(raw => {
        const message = raw as ActionMessage<string, any[]>
        console.log('<', message)

        const handler = (this.init.handlers as any)[message.name]
        if (!isFunction(handler)) {
          throw new Error(`Unknown action: ${message.name}`)
        }

        handler(...message.args)
      })

      client.onDisconnect.addListener(client => {
        this.clients = this.clients.filter(it => it !== client)
      })

      client.onDisconnect.addListener(() => {
        this.init.onDisconnect?.()
      })

      let state = await this.init.onConnect()
      for (const update of this.updates) {
        state = {
          ...state,
          ...update
        }
      }
      client.postMessage({type: 'INIT', state})
    })
  }

  public updateState(update: Partial<State>) {
    console.log('>', update)
    this.updates.push(update)
    for (const port of this.clients) {
      port.postMessage({type: 'UPDATE', update})
    }
  }

}

export type ServerInit<State, Actions> = {
  onConnect(): State | Promise<State>
  onDisconnect?(): void
  handlers: Actions
}