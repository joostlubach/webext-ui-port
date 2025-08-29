import { Client } from './Client'
import { Server, ServerConfig } from './Server'

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

export interface DirectiveMessage {
  type: 'DIRECTIVE'
  name: string
  payload: any
}

export type StateListener<State> = (state: State) => void
export type DirectiveListener = (payload: any) => void

export type UIPortActions = {
  [key: string]: (...args: any[]) => void
}

export type UIPort<State extends object, Actions extends object> = {
  server: (init: ServerConfig<State, Actions>) => Server<State, Actions>
  client: () => Client<State, Actions>
}