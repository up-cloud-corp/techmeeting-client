import {MAP_SIZE} from '@components/Constants'
import {ISharedContent} from '@models/ISharedContent'
import {ParticipantBase, PARTICIPANT_SIZE, PlaybackParticipant, RemoteParticipant} from '@models/Participant'
import {getRect, isCircleInRect, Pose2DMap} from '@models/utils'
import {convertToAudioCoordinate, getRelativePose, mulV2, normV} from '@models/utils'
import {stereoParametersStore} from '@stores/AudioParameters'
import participants from '@stores/participants/Participants'
import contents from '@stores/sharedContents/SharedContents'
import _ from 'lodash'
import {autorun, IReactionDisposer} from 'mobx'
import {NodeGroup} from './NodeGroup'
import { NodeGroupForPlayback } from './NodeGroupForPlayback'

const audioLog = false ? console.log : ()=>{}

function getRelativePoseFromObject(localPose: Pose2DMap, participant: ParticipantBase|undefined,
                                   content: ISharedContent|undefined) {
  const remotePose = _.cloneDeep(participant ? participant.pose :
    content ? content.pose : {position:[0, 0], orientation:0}) as Pose2DMap
  if (content) {
    localPose.position.forEach((pos, idx) => {
      if (localPose.position[idx] > remotePose.position[idx]) {
        const fromLT = localPose.position[idx] - remotePose.position[idx]
        remotePose.position[idx] += Math.min(content.size[idx], fromLT > 0 ? fromLT : 0)
      }
    })
  }

  return getRelativePose(localPose, remotePose)
}

export class ConnectedGroup {
  private readonly disposers: IReactionDisposer[] = []

  //  content or remote will be given.
  constructor(content: ISharedContent|undefined,
    remote: RemoteParticipant|undefined, group: NodeGroup) {
      const local = participants.local
      this.disposers.push(autorun(()=>{
        const base = _.clone(local.pose)
        if (local.soundLocalizationBase === 'user') { base.orientation = 0 }
        let relativePose = getRelativePoseFromObject(base, remote, content)
        if (remote){
          let zeroDistance = false
          let muteAudio = false

          // yarn phone -> then zero distance
          if (participants.yarnPhones.has(remote.id)){
            zeroDistance = true
            muteAudio = false
          } else {
            switch(local.zone?.zone){
            case "open":
              // open zone -> if in same zone then zero distance
              // onstage -> zero distance
              if(remote.physics.onStage){
                  zeroDistance = true
                  muteAudio = false
                } else {
                  if(!remote.closedZone){
                    const rect = getRect(local.zone.pose, local.zone.size)
                   if(isCircleInRect(remote.pose.position, 0.5*PARTICIPANT_SIZE, rect)){
                     zeroDistance = true
                     muteAudio = false
                   }
                  }
                  if(remote.closedZone?.zone == "close" ){
                    zeroDistance = false
                    muteAudio = true
                  }
                }
                // same zone -> normal
                break
            case "close":
              // closed zone -> if in same zone then zero distance and if in different zone then mute audio
              // onstage -> zero distance
              if(remote.physics.onStage){
                zeroDistance = true
                muteAudio = false
              } else {
                if(remote.closedZone?.zone == "close" ){
                  if(remote.closedZone === local.zone){
                    zeroDistance = true
                    muteAudio = false
                  }else{
                    zeroDistance = false
                    muteAudio = true
                  }
                }
              }
              break
            case "same":
              // same zone -> if in same zone then mute audio and if in different zone then zero distance?
              // onstage -> if not in same room zero distance
              if(remote.closedZone?.zone == "same"){
                if(remote.closedZone === local.zone){
                  zeroDistance = false
                  muteAudio = true
                } else if(remote.physics.onStage){
                  zeroDistance = true
                  muteAudio = false
                }
              } else if(remote.closedZone?.zone == "close") {
                zeroDistance = false
                muteAudio = true
              } else {
                zeroDistance = false
                muteAudio = false
                if(remote.physics.onStage){
                  zeroDistance = true
                  muteAudio = false
                }
              }
              break
            default:
              // not in zone ->
              if(remote.physics.onStage){
                zeroDistance = true
                muteAudio = false
              } else {
                if(remote.closedZone?.zone == "close"){
                  zeroDistance = false
                  muteAudio = true
                }
              }
              break
            }
          }
          if(muteAudio){
            // Not located yet or in different clozed zone -> mute audio
            relativePose = {orientation:0, position:[MAP_SIZE, MAP_SIZE]}
            audioLog(`mute ${remote.id} loc:${remote.physics.located}`)
          }else if(zeroDistance) {
            audioLog(`In zone: cid:${remote.id}`)
            const distance = normV(relativePose.position)
            if (distance > 1e-10){ relativePose.position = mulV2(1/distance, relativePose.position) }
          }
          group.updatePose(convertToAudioCoordinate(relativePose))
        }else if (content){
          // locate sound source.
          const contentInLocalsZone = local.zone ?
            (content.overlapZones.includes(local.zone) || content.surroundingZones.includes(local.zone)) : false
          const inOtherClosedZone = !contentInLocalsZone && content.surroundingZones.find(z => z.zone === 'close')
          if (contentInLocalsZone){
            //  make distance very small (1)
            audioLog(`In zone: cid:${content.id}`)
            const distance = normV(relativePose.position)
            if (distance > 1e-10){
              relativePose.position = mulV2(1/distance, relativePose.position)
            }
          }else if (inOtherClosedZone) {
            // In different clozed zone -> mute audio
            group.updatePose(convertToAudioCoordinate({orientation:0, position:[MAP_SIZE, MAP_SIZE]}))
            audioLog(`mute ${content.id} other:${inOtherClosedZone} cInL:${contentInLocalsZone}`)
          }
          const pose = convertToAudioCoordinate(relativePose)
          group.updatePose(pose)
        }else{
          console.error(`participant or content must be specified`)
        }
      },
    ))

    this.disposers.push(autorun(
      () => {
        const track = remote ? remote.tracks.audio : contents.getContentTrack(content!.id, 'audio')
        const ms = new MediaStream()
        if (track){
          ms.addTrack(track)
          group.updateStream(ms)
        }
      },
    ))

    this.disposers.push(autorun(
      () => group.updatePannerConfig(stereoParametersStore),
    ))
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer()
    }
  }
}

export class ConnectedGroupForPlayback {
  private readonly disposers: IReactionDisposer[] = []

  constructor(group: NodeGroupForPlayback, participant?: PlaybackParticipant, cid?: string) {
    const local = participants.local
    this.disposers.push(autorun(
      () => {
        const base = _.clone(local.pose)
        if (local.soundLocalizationBase === 'user') { base.orientation = 0 }
        let content
        if (!participant && cid){
          content = contents.findPlayback(cid)
        }
        // locate sound source.
        const relativePose = getRelativePoseFromObject(base, participant, content)
        const pose = convertToAudioCoordinate(relativePose)
        group.updatePose(pose)
        //if (content) console.log(`updatePose: ${JSON.stringify(content)}`)
      },
    ))

    this.disposers.push(autorun(
      () => {
        //console.log(`playBlob(${play.audioBlob})`)
        let clip
        if (!participant && cid){
          clip = contents.playbackClips.get(cid)
        }
        group.playClip(participant ? participant.clip : clip)
        //if (content) console.log(`playBlob: ${JSON.stringify(content?.audioBlob)} c:${JSON.stringify(content)}`)
      },
    ))

    this.disposers.push(autorun(
      () => group.updatePannerConfig(stereoParametersStore),
    ))
  }

  dispose() {
    for (const disposer of this.disposers) {
      disposer()
    }
  }
}
