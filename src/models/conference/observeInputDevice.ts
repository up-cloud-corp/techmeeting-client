import {getNotificationPermission} from '@models/conference/Notification'
import {urlParameters} from '@models/url'
import participants from '@stores/participants/Participants'
import {IReactionDisposer, autorun} from 'mobx'
import {stopMpTrack, startMpTrack} from './mediapipeCamera'
import {stopFaceTrack, createLocalCamera} from './faceCamera'
import {MSTrack} from '@models/conference/RtcConnection'
import {conference} from '@models/conference'
import { UCLogger } from '@models/utils'

const eventLog = UCLogger.getByFeature("event");

//  mic device selection
export function createLocalMic() {
  const promise = new Promise<MSTrack>((resolutionFunc, rejectionFunc) => {
    const did = participants.local.devicePreference.audioinput
    navigator.mediaDevices.getUserMedia({
      audio:{deviceId: did}
    }).then((ms)=>{
      const track = ms.getAudioTracks()[0]
      if (track){
        resolutionFunc({track, peer:participants.local.id, role:'avatar', deviceId:did})
      }
    }).catch(rejectionFunc)
  })

  return promise
}

//  mic mute and audio input device selection
function isMicMuted(){
  return participants.local.muteAudio || participants.local.physics.awayFromKeyboard ||
    !participants.localId || urlParameters.testBot !== null
}
//  camera mute and camera device update
const DELETE_TRACK = true
function isCameraMuted(){
  return participants.local.muteVideo || participants.local.physics.awayFromKeyboard ||
    !participants.localId || urlParameters.testBot !== null
}

const disposes:IReactionDisposer[] = []
function onDeviceChange(_: Event){
  const old = {
    audioinput: participants.local.devicePreference.audioinput,
    videoinput: participants.local.devicePreference.videoinput,
    audiooutput: participants.local.devicePreference.audiooutput
  }
  participants.local.devicePreference.videoinput = undefined
  participants.local.devicePreference.audiooutput = undefined
  conference.setLocalMicTrack(undefined).then(()=>{
    participants.local.devicePreference.audioinput = undefined
    participants.local.audioLevel = 0
    for(const _ in old){
      Object.assign(participants.local.devicePreference, old)
    }
  })
}
export function inputChangeObservationStart(){
  navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)
  disposes.push(autorun(() => {
    eventLog.info('Mic observer autorun called');
    let did = participants.local.devicePreference.audioinput
    if (isMicMuted() || did===undefined){
      //  When muted or device not selected. remove mic track and finish.
      conference.setLocalMicTrack(undefined).then(()=>{
        participants.local.audioLevel = 0
        participants.local.isMicMuting = false
      })
      return
    }

    //  When mic is used. First confirm the existance of the device.
    navigator.mediaDevices.enumerateDevices().then(infos => { //  Check if the device in the preferencec exists.
      const device = infos.find((info) => info.deviceId === did)
      if (!device && infos.length){
        eventLog.warn(`Device not found. Please change input device.`, {
          deviceId: did,
          devicesList: infos,
        });
        conference.setLocalMicTrack(undefined).then(()=>{
          participants.local.devicePreference.audioinput = infos[0].deviceId
          participants.local.audioLevel = 0
        })
        return  //  autorun again
      }
      eventLog.info(`Device found. Creating a new mic track.`, { deviceId: did });
      const track = conference.getLocalMicTrack()
      if (track && track.deviceId === did) { return }
      createLocalMic().then((newTrack)=>{
        if (isMicMuted()){
          newTrack.track?.stop()
        }else{
          conference.setLocalMicTrack(newTrack)
        }
        participants.local.isMicMuting = false
      }).finally(getNotificationPermission)
      return
    })
  }))
  disposes.push(autorun(() => {
    const did = participants.local.devicePreference.videoinput
    const faceTrack = participants.local.information.faceTrack
    if (isCameraMuted()) {
      stopMpTrack()
      stopFaceTrack()
      if (DELETE_TRACK){
        conference.setLocalCameraTrack(undefined).then(track => {
          track?.track.stop()
          participants.local.isTurningOffCamera = false
        })
      } else {
        const track = conference.getLocalCameraTrack()
        if (track) {
           conference.removeLocalTrack(true, track)
           participants.local.isTurningOffCamera = false
         }
      }
    }else{
      const isVrm = participants.local.information.avatarSrc.slice(-4) === '.vrm'
      if (isVrm){
        stopFaceTrack()
        startMpTrack(!faceTrack)
      }else{
        stopMpTrack()
        const track = conference.getLocalCameraTrack()
        if (track && track.deviceId === did) { return }
        createLocalCamera(faceTrack).then((track)=>{
          if (!isCameraMuted()){
            conference.setLocalCameraTrack(track)
          }else{
            track?.track.stop()
          }
          participants.local.isTurningOffCamera = false
        }).finally(getNotificationPermission)
      }
    }
  }))
}
export function inputChangeObservationStop(){
  for(const d of disposes){ d() }
  disposes.length = 0
  navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
}
