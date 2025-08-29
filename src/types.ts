export interface TransitionCallbacks {
  onPrepare?: () => any
  onCommit?:  () => any
  onCleanUp?: () => any
}
