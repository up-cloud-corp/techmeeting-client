import {PARTICIPANT_SIZE} from '@models/Participant'
import {Pose3DAudio} from '@models/utils'
import {mulV3, normV} from '@models/utils/coordinates'
import errorInfo from '@stores/ErrorInfo'
import {ConfigurableParams, ConfigurableProp} from './StereoParameters'
import participants from '@stores/participants/Participants'

export function setAudioOutputDevice(audio: HTMLAudioElement, deviceId: string) {
  const audioEx:any = audio
  if (audioEx?.setSinkId) {
    audioEx.setSinkId(deviceId).then(
      () => {
        //  console.debug('audio.setSinkId:', deviceId, ' success')
      },
    ).catch(
      () => { console.warn('audio.setSinkId:', deviceId, ' failed') },
    )
  }
}
export function getAudioOutputDevice(audio: HTMLAudioElement) {
  const audioEx:any = audio
  return audioEx.sinkId as string | undefined
}


// NOTE Set default value will change nothing. Because value will be overwrite by store in ConnectedGroup
/*
const DEFAULT_PANNER_NODE_CONFIG: Partial<PannerNode> & {refDistance: number} = {
  panningModel: 'HRTF',
  distanceModel: 'inverse',
  refDistance: PARTICIPANT_SIZE,
  maxDistance: 10000,
  rolloffFactor: 1,
  coneInnerAngle: 45,
  coneOuterAngle: 360,
  coneOuterGain: 0,
}
*/
export const BROADCAST_DISTANCE = 100000

export type PlayMode = 'Context' | 'Element' | 'Pause'

export class NodeGroup {
  protected sourceNode: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | undefined = undefined
  protected audioElement: HTMLAudioElement | undefined = undefined

  protected readonly pannerNode: PannerNode
  protected readonly destination: MediaStreamAudioDestinationNode

  protected readonly context: AudioContext
  protected playMode: PlayMode|undefined
  protected audibility = false

  private audioDeviceId = ''
  private distance = 1

  constructor(context: AudioContext, destination: MediaStreamAudioDestinationNode,
              playMode: PlayMode|undefined, audibility: boolean) {
    this.context = context
    this.destination = destination
    this.pannerNode = this.createPannerNode(context)
    this.pannerNode.connect(this.destination)
    this.playMode = playMode
    this.updateAudibility(audibility)
  }

  interval = 0
  setPlayMode(playMode: PlayMode|undefined) {
    this.playMode = playMode

    switch (playMode) {
      case 'Pause': {
        this.sourceNode?.disconnect()
        /*try {
          this.pannerNode.disconnect(this.destination)
        }catch (e) {}*/

        if (this.interval) {
          window.clearInterval(this.interval)
          this.interval = 0
        }
        if (this.audioElement) {
          this.audioElement.pause() //  Do not pause when this is for playback.
        }
        break
      }
      case 'Context': {
        this.sourceNode?.connect(this.pannerNode)
        //  this.pannerNode.connect(this.destination)
        if (this.interval) {
          window.clearInterval(this.interval)
          this.interval = 0
        }
        if (this.audioElement) {
          this.audioElement.pause()
        }
        break
      }
      case 'Element': {
        this.sourceNode?.disconnect()
        /*try {
          this.pannerNode.disconnect(this.destination)
        }catch (e) {}*/

        if (!this.audioElement) {
          this.audioElement = this.createAudioElement()
        }
        this.audioElement.muted = false
        if (!this.interval) {
          this.interval = window.setInterval(
            () => {
              if (!errorInfo.type) {
                this?.audioElement?.play().then(() => {
                  //  console.warn(`Succeed to play in NodeGroup`)
                  if (this.interval) {
                    window.clearInterval(this.interval)
                    this.interval = 0
                  }
                }).catch(reason => {
                  //  console.warn(`Failed to play in NodeGroup reason:${reason}`)
                })
              }
            },
            500,
          )
        }
        break
      }
      default:
        console.error(`Unknown output: ${playMode}`)
        break
    }

    this.updateAudibility(this.audibility)
    this.updateVolume()
  }

  setAudioOutput(id: string) {
    if (this.audioDeviceId !== id) {
      this.audioDeviceId = id
      if (this.audioElement) {
        setAudioOutputDevice(this.audioElement, this.audioDeviceId)
      }
    }
  }

  updateStream(stream: MediaStream | undefined) {
    this.updateSourceStream(stream)
    this.setPlayMode(this.playMode)
  }

  updatePose(pose: Pose3DAudio) {
    const dist = normV(pose.position)
    const mul = ((dist * dist) / (this.pannerNode.refDistance * this.pannerNode.refDistance)
      + this.pannerNode.refDistance - 1) / (dist ? dist : 1)
    this.distance = mul * dist

    if (this.pannerNode.positionX && this.pannerNode.orientationX) {
      this.pannerNode.positionX.setValueAtTime(mul * pose.position[0], this.context.currentTime)
      this.pannerNode.positionY.setValueAtTime(mul * pose.position[1], this.context.currentTime)
      this.pannerNode.positionZ.setValueAtTime(mul * pose.position[2], this.context.currentTime)
      this.pannerNode.orientationX.setValueAtTime(pose.orientation[0], this.context.currentTime)
      this.pannerNode.orientationY.setValueAtTime(pose.orientation[1], this.context.currentTime)
      this.pannerNode.orientationZ.setValueAtTime(pose.orientation[2], this.context.currentTime)
    }else {
      this.pannerNode.setPosition(...mulV3(mul, pose.position))
      this.pannerNode.setOrientation(...pose.orientation)
    }
    this.updateVolume()
  }
  protected updateVolume() {
    if (this.audioElement) {
      // Mute the volume while the call notification sound is playing. ver1.1
      if (participants.local.callSoundStatus === 1 || participants.local.callSoundStatus === 2){
        this.audioElement.volume = 0
        return
      }
      const volume = this.playMode === 'Element' ?
        Math.pow(Math.max(this.distance, this.pannerNode.refDistance) / this.pannerNode.refDistance,
                        - this.pannerNode.rolloffFactor) : 0
      this.audioElement.volume = volume
    }
  }

  private _defaultPannerRefDistance = PARTICIPANT_SIZE
  private get defaultPannerRefDistance () { return this._defaultPannerRefDistance }
  private set defaultPannerRefDistance(val: number) {
    this._defaultPannerRefDistance = val
    this.pannerNode.refDistance = this._defaultPannerRefDistance
  }
  updateBroadcast(broadcast: boolean) {
    if (!broadcast) {
      this.pannerNode.refDistance = this.defaultPannerRefDistance
    } else {
      this.pannerNode.refDistance = BROADCAST_DISTANCE
    }
  }

  updatePannerConfig(config: ConfigurableParams) {
    const observedPannerKeys: ConfigurableProp[] =
      ['coneInnerAngle', 'coneOuterAngle', 'coneOuterGain', 'distanceModel', 'maxDistance', 'distanceModel', 'panningModel', 'refDistance', 'rolloffFactor']
    observedPannerKeys.forEach((key) => {
      if (key === 'refDistance') {
        this.defaultPannerRefDistance = config['refDistance']
      } else {
        (this.pannerNode[key] as any) = config[key]
      }
    })
  }

  updateAudibility(audibility: boolean) {
    if (audibility) {
      this.pannerNode.connect(this.destination)
    } else {
      this.pannerNode.disconnect()
    }

    if (this.audioElement) {
      this.audioElement.muted = !audibility
    }

    this.audibility = audibility
  }

  dispose() {
    if (this.sourceNode) {
      this.sourceNode.disconnect()
    }

    this.pannerNode.disconnect()
    if (this.audioElement) {
      this.audioElement.volume = 0
      this.audioElement.pause()
      this.audioElement.remove()
    }
  }

  private createGainNode(context: AudioContext) {
    const gain = context.createGain()

    gain.gain.value = 1

    return gain
  }

  private createPannerNode(context: AudioContext) {
    const panner = context.createPanner()

    return panner
  }

  private updateSourceStream(stream: MediaStream | undefined) {
    if (this.sourceNode) {
      this.sourceNode.disconnect()
    }

    if (stream === undefined) {
      this.sourceNode = undefined

      return
    }

    this.sourceNode = this.context.createMediaStreamSource(stream)

    //  Anyway, soruce must be connected audioElement, for the case of Element mode.
    //    if (isChrome) { // NOTE Chorme would not work if not connect stream to audio tag
    if (this.audioElement === undefined) {
      this.audioElement = this.createAudioElement()
    }

    this.audioElement.srcObject = stream
    //    }
  }


  createAudioElement() {
    const audio = new Audio()
    setAudioOutputDevice(audio, this.audioDeviceId)

    return audio
  }
}
