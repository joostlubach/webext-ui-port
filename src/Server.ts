import Logger from 'logger'
import browser from 'webextension-polyfill'
import { isFunction } from 'ytil'
import { ActionMessage } from './types'

const logger = new Logger('ui-port')

export class Server<State extends object, Actions extends object> {

  private constructor(
    public readonly name: string,
    private config: ServerConfig<State, Actions>
  ) {}

  private clients: browser.Runtime.Port[] = []
  private updates: Partial<State>[] = []

  public static create<State extends object, Actions extends object>(name: string, init: ServerConfig<State, Actions>) {
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
        logger.info(`< ${message.name}`, message.args)

        const handler = (this.config.handlers as any)[message.name]
        if (!isFunction(handler)) {
          throw new Error(`Unknown action: ${message.name}`)
        }

        handler(...message.args)
      })

      client.onDisconnect.addListener(client => {
        this.clients = this.clients.filter(it => it !== client)
      })

      client.onDisconnect.addListener(() => {
        this.config.onDisconnect?.()
      })

      let state = await this.config.init()
      // Race condition: if the client disconnects while it's initializing,
      // we cannot continue.
      if (!this.clients.includes(client)) { return }

      for (const update of this.updates) {
        state = {...state, ...update}
      }

      client.postMessage({type: 'INIT', state})
      this.config.onConnect?.()
    })
  }

  public updateState(update: Partial<State>) {
    logger.info('State', update)
    this.updates.push(update)
    for (const port of this.clients) {
      port.postMessage({type: 'UPDATE', update})
    }
  }

  public sendDirective(name: string, payload: any) {
    for (const port of this.clients) {
      port.postMessage({type: 'DIRECTIVE', name, payload})
    }
  }

}

export type ServerConfig<State, Actions> = {
  init(): State | Promise<State>
  onConnect?(): void
  onDisconnect?(): void
  handlers: Actions
}