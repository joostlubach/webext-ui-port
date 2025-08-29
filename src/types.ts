import { Client } from './Client'
import { Server, ServerInit } from './Server'

export interface ActionMessage<Name extends string, Args extends any[]> {
  type: 'ACTION'
  name: Name
  args: Args
}

export interface InitMessage<S> {
  type: 'INIT'
  state: S
}

export interface UpdateMessage<S> {
  type: 'UPDATE'
  update: Partial<S>
}

export type StateListener<State> = (state: State) => void

export type UIPortActions = {
  [key: string]: (...args: any[]) => void
}

export type UIPort<State extends object, Actions extends object> = {
  server: (init: ServerInit<State, Actions>) => Server<State, Actions>
  client: () => Client<State, Actions>
}