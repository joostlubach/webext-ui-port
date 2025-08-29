import browser from 'webextension-polyfill'
import { bindMethods, MapUtil } from 'ytil'
import {
  DirectiveListener,
  DirectiveMessage,
  InitMessage,
  StateListener,
  UpdateMessage,
} from './types'

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

  public actions = new Proxy({}, {
    get: (target, prop, receiver) => {
      if (typeof prop !== 'string') {
        throw new Error('Unknown action')
      }

      console.log('>', prop)
      return this.actionFunction(prop)
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
    const message = raw as InitMessage<State> | UpdateMessage<State> | DirectiveMessage
    if (message.type === 'INIT') {
      this.state = message.state
    } else if (message.type === 'UPDATE') {
      console.log('<', message.update)
      this.state = {
        ...this.state as State,
        ...message.update
      }
    } else {
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

  private actionFunction(name: string) {
    return (...args: any[]) => {
      if (this.port == null) {
        throw new Error('Not connected')
      }

      this.port.postMessage({type: 'ACTION', name, args})
    }
  }

}
