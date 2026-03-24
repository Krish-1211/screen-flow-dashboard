export enum PlayerState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  SYNCING = 'SYNCING'
}

export interface PlayerStatus {
  state: PlayerState;
  lastSync: Date;
  currentPlaylistId?: string;
  currentIndex: number;
  message?: string;
}

export type PlayerEvent =
  | 'STARTUP'
  | 'PLAYLIST_READY'
  | 'MEDIA_ERROR'
  | 'ERROR_RECOVERED'
  | 'NETWORK_LOST'
  | 'NETWORK_RESTORED'
  | 'SYNC_BEGIN'
  | 'SYNC_END'
  | 'STOP';

type TransitionListener = (state: PlayerState) => void;

export class PlayerStateMachine {
  private state: PlayerState = PlayerState.IDLE;
  private stateBeforeSync: PlayerState = PlayerState.IDLE;
  private listeners = new Set<TransitionListener>();

  public getState(): PlayerState {
    return this.state;
  }

  public subscribe(listener: TransitionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  public transition(event: PlayerEvent): PlayerState {
    if (event === 'SYNC_BEGIN') {
      if (this.state !== PlayerState.SYNCING) {
        this.stateBeforeSync = this.state;
        this.setState(PlayerState.SYNCING);
      }
      return this.state;
    }

    if (event === 'SYNC_END') {
      if (this.state === PlayerState.SYNCING) {
        this.setState(this.stateBeforeSync);
      }
      return this.state;
    }

    const baseState = this.state === PlayerState.SYNCING ? this.stateBeforeSync : this.state;
    let nextState = baseState;

    switch (event) {
      case 'STARTUP':
        if (baseState === PlayerState.IDLE) nextState = PlayerState.LOADING;
        break;
      case 'PLAYLIST_READY':
        if (baseState === PlayerState.LOADING || baseState === PlayerState.IDLE || baseState === PlayerState.OFFLINE) {
          nextState = PlayerState.PLAYING;
        }
        break;
      case 'MEDIA_ERROR':
        if (baseState === PlayerState.PLAYING || baseState === PlayerState.OFFLINE) {
          nextState = PlayerState.ERROR;
        }
        break;
      case 'ERROR_RECOVERED':
        if (baseState === PlayerState.ERROR) nextState = PlayerState.PLAYING;
        break;
      case 'NETWORK_LOST':
        if (baseState === PlayerState.PLAYING || baseState === PlayerState.LOADING || baseState === PlayerState.ERROR) {
          nextState = PlayerState.OFFLINE;
        }
        break;
      case 'NETWORK_RESTORED':
        if (baseState === PlayerState.OFFLINE) nextState = PlayerState.PLAYING;
        break;
      case 'STOP':
        nextState = PlayerState.IDLE;
        break;
      default:
        break;
    }

    this.stateBeforeSync = nextState;
    if (this.state !== PlayerState.SYNCING) {
      this.setState(nextState);
    } else {
      this.notify();
    }
    return this.state;
  }

  private setState(state: PlayerState) {
    this.state = state;
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
