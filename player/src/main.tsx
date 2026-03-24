import React from 'react'
import ReactDOM from 'react-dom/client'
import { PlayerDisplay } from '../ui/display'
import { playerConfig } from '../config/playerConfig'
import './index.css'

const deviceId = playerConfig.getDeviceId()
const apiBaseUrl = playerConfig.getApiUrl()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <PlayerDisplay deviceId={deviceId} apiBaseUrl={apiBaseUrl} />
)
