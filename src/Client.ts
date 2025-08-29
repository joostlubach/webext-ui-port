import browser from 'webextension-polyfill'
import { bindMethods } from 'ytil'
import { InitMessage, StateListener, UpdateMessage } from './types'

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
  private initResolve: ((value: State) => void) | undefined = undefined

  public actions = new Proxy({}, {
    get: (target, prop, receiver) => {
      if (typeof prop !== 'string') {
        throw new Error('Unknown action')
      }

      console.log('>', prop)
      return this.actionFunction(prop)
    }
  }) as Actions

  public connect(): Promise<State> {
    if (this.port != null) {
      throw new Error('Already connected')
    }

    return new Promise<State>(resolve => {
      this.initResolve = resolve
      this.port = browser.runtime.connect({name: this.name})
      this.port.onMessage.addListener(this.messageListener)
    })
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
    const message = raw as InitMessage<State> | UpdateMessage<State>
    if (message.type === 'INIT') {
      this.state = message.state
      this.initResolve?.(this.state)
    } else {
      console.log('<', message.update)
      this.state = {
        ...this.state as State,
        ...message.update
      }
    }

    for (const listener of this.listeners) {
      listener(this.state as State)
    }
  }

  addListener(listener: StateListener<State>) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
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
