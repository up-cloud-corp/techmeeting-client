import {Tooltip} from '@material-ui/core'
import {ParticipantBase} from '@stores/participants/ParticipantBase'
import {useObserver} from 'mobx-react-lite'
import React from 'react'
import {participants} from '@stores/'
import {CursorIcon} from '@components/utils/CursorIcon'

interface MouseCursorProps{
  participantId: string
}


export const MouseCursor: React.FC<MouseCursorProps> = (props:MouseCursorProps) => {
  const participant = participants.find(props.participantId) as ParticipantBase
  const position = useObserver(() => participant.mouse.position)
  const name = useObserver(() => participant.information.name)
  const [color] = participant.getColor()
  if (!position) {
    return <div />
  }
  const isLocal = props.participantId === participants.localId

  const cursor = (
    <div style={{
      left: position[0],
      top: position[1],
      position: 'absolute',
      pointerEvents: isLocal ? 'none' : 'auto',
      zIndex: isLocal ? 6000 : participant.zIndex + 4000
    }}>
      <CursorIcon color={color} width={18} height={30} />
    </div>
  )
  return isLocal ? cursor
    :<Tooltip title={name}>{cursor}</Tooltip>
}
