
import browser from 'webextension-polyfill'

export function createUIPort<State, Actions>(name: string): UIPort<State, Actions> {
  function bindBackground(init: BackgroundInit<State, Actions>): BackgroundInterface<State> {
    let $port: browser.Runtime.Port | undefined = undefined

    browser.runtime.onConnect.addListener(async port => {
      if (port.name !== name) return

      $port = port

      port.onMessage.addListener(raw => {
        const message = raw as ActionMessage<string, any[]>
        (init as any)[message.name](...message.args)
      })

      port.onDisconnect.addListener(() => {
        init.onDisconnect?.()
      })

      const initialState = await init.onConnect()
      port.postMessage({type: 'INIT', state: initialState})
    })

    return {
      updateState: (update: Partial<State>) => {
        if ($port == null) {
          throw new Error('Not connected')
        }

        $port.postMessage({type: 'UPDATE', update})
      }
    }
  }

  function bindUI(): UISide<State, Actions> {
    let $port: browser.Runtime.Port | undefined = undefined
    let $state: State | undefined = undefined

    const listeners = new Set<StateListener<State>>()
    let initResolve: ((value: State) => void) | undefined = undefined

    function connect() {
      if ($port != null) {
        throw new Error('Already connected')
      }

      return new Promise<State>(resolve => {
        initResolve = resolve
        $port = browser.runtime.connect({name})
        $port.onMessage.addListener(messageListener)
      })
    }

    function disconnect() {
      if ($port == null) {
        throw new Error('Not connected')
      }

      listeners.clear()
      $port.disconnect()
      $port = undefined
    }

    function messageListener(raw: unknown) {
      const message = raw as InitMessage<State> | UpdateMessage<State>
      if (message.type === 'INIT') {
        $state = message.state
        initResolve?.($state)
      } else {
        $state = {
          ...$state as State,
          ...message.update
        }
      }
    }

    function addListener(listener: StateListener<State>) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }

    function actionFunction(name: string) {
      return (...args: any[]) => {
        if ($port == null) {
          throw new Error('Not connected')
        }

        $port.postMessage({type: 'ACTION', name, args})
      }
    }

    return new Proxy({
      connect,
      disconnect,
      addListener
    } as UISide<State, {}>, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver)
        } else if (typeof prop === 'string') {
          return actionFunction(prop)
        } else {
          throw new Error('Unknown action')
        }
      }
    }) as UISide<State, Actions>
  }

  return {
    bindBackground,
    bindUI
  }
}

export type UIPort<State, Actions> = {
  bindBackground: (init: BackgroundInit<State, Actions>) => BackgroundInterface<State>
  bindUI: () => UISide<State, Actions>
}

interface ActionMessage<Name extends string, Args extends any[]> {
  type: 'ACTION'
  name: Name
  args: Args
}
interface InitMessage<S> {
  type: 'INIT'
  state: S
}

interface UpdateMessage<S> {
  type: 'UPDATE'
  update: Partial<S>
}

// #region Background side

export type BackgroundInit<State, Actions> = {
  onConnect(): State | Promise<State>
  onDisconnect?(): void
} & Actions

export interface BackgroundInterface<State> {
  updateState: (update: Partial<State>) => void
}

// #endregion

// #region UI side

export type UISide<State, Actions> = {
  connect: () => Promise<State>
  disconnect: () => void
  addListener: (listener: StateListener<State>) => void
} & {
  [K in keyof Actions as Actions[K] extends (...args: any[]) => void ? K : never]: Actions[K]
}

export type StateListener<State> = (state: State) => void

// #endregion

export type UIPortActions = {
  [key: string]: (...args: any[]) => void
}