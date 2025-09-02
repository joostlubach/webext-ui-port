import Logger from 'logger'
import browser from 'webextension-polyfill'
import { bindMethods, MapUtil } from 'ytil'
import { resolve } from '../../ytil/src/resolve'
import {
  ActionResultMessage,
  DirectiveListener,
  DirectiveMessage,
  InitMessage,
  StateListener,
  UpdateMessage,
} from './types'

const logger = new Logger('ui-port')

export class Client<State extends object, Actions extends object> {
  
  private constructor(
    public readonly name: string
  ) {
    bindMethods(this)
  }

  public static create<State extends object, Actions extends object>(name: string): Client<State, Actions> {
    return new Client(name)
  }

  private port: browser.Runtime.Port | undefined = undefined
  private state: State | undefined = undefined
  private listeners = new Set<StateListener<State>>()
  private directiveListeners = new Map<string, Set<DirectiveListener>>()

  public actions = new Proxy({} as any, {
    get: (target, prop, receiver) => {
      if (typeof prop !== 'string') {
        throw new Error('Unknown action')
      }

      return target[prop] ??= this.actionFunction(prop)
    }
  }) as Actions

  public connect() {
    if (this.port != null) {
      throw new Error('Already connected')
    }

    this.port = browser.runtime.connect({name: this.name})
    this.port.onMessage.addListener(this.messageListener)
  }

  public disconnect() {
    if (this.port == null) {
      throw new Error('Not connected')
    }

    this.listeners.clear()
    this.port.disconnect()
    this.port = undefined
  }

  private messageListener = (raw: unknown) => {
    const message = raw as InitMessage<State> | UpdateMessage<State> | ActionResultMessage | DirectiveMessage
    if (message.type === 'INIT') {
      this.state = message.state
      logger.info("State", this.state)
    } else if (message.type === 'UPDATE') {
      this.state = {
        ...this.state as State,
        ...message.update
      }
      logger.info("State", this.state)
    } else if (message.type === 'ACTION_RESULT') {
      const {uid, result, error} = message
      const [resolve, reject] = this.pending.get(uid) ?? []
      this.pending.delete(uid)

      if (error != null) {
        reject?.(error)
      } else {
        resolve?.(result)
      }
    } else {
      logger.info(`< ${message.name}`, message.payload)
      this.handleDirective(message.name, message.payload)
    }

    for (const listener of this.listeners) {
      listener(this.state as State)
    }
  }

  public addListener(listener: StateListener<State>) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public addDirectiveListener(directive: string, listener: DirectiveListener) {
    const listeners = MapUtil.ensure(this.directiveListeners, directive, () => new Set())
    listeners.add(listener)
  }

  private handleDirective(name: string, payload: any) {
    const listeners = this.directiveListeners.get(name)
    if (listeners == null) { return }
   
    for (const listener of listeners) {
      listener(payload)
    }
  }

  private pending = new Map<number, ResolveReject<any>>()

  private actionFunction(name: string) {
    return async (...args: any[]) => {
      const {port} = this
      if (port == null) {
        throw new Error('Not connected')
      }

      logger.info(`> ${name}`, args)

      const uid = pendingUID++
      return new Promise<any>((resolve, reject) => {
        this.pending.set(uid, [resolve, reject])
        port.postMessage({type: 'ACTION', uid, name, args})
      })
    }
  }

}

let pendingUID = 0
type ResolveReject<T> = [(result: T) => void, (cause: any) => void]