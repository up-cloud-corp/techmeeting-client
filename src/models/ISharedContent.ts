import {MapObject} from './MapObject'
const MAXIMIZABLE_IMAGE_MIN_WIDTH = 200

export type ContentType = 'img' | 'text' | 'pdf' | 'youtube' | 'iframe' | 'screen' | 'camera' |
  'gdrive' | 'whiteboard' | 'playbackScreen' | 'playbackCamera' | ''

export interface SharedContentInfoData {
  name: string                    //  name or title of the content.
  ownerName: string               //  name of the initial owner
  color:number[]                  //  color in the left var
  textColor:number[]              //  textColor in the left var
  type: ContentType               //  content type ('img', etc)
  playback?: boolean
}
export const defaultSharedContentInfoData: SharedContentInfoData = {
  name:'', ownerName:'', color:[], textColor:[], type:'text'}

export interface SharedContentId{
  id: string                      //  unique ID (generated by participant id + number)
}
export interface SharedContentInfo extends SharedContentInfoData, SharedContentId{
}
export function isEqualSharedContentInfo(a:SharedContentInfo, b:SharedContentInfo){
  return a.name === b.name && a.ownerName === b.ownerName
    && a.color.toString() === b.color.toString() && a.textColor.toString() === b.textColor.toString()
}
export function extractSharedContentInfo(c: SharedContentInfo){
  const rv:SharedContentInfo = {id:c.id, name: c.name, ownerName: c.ownerName,
    color:c.color, textColor: c.textColor, type: c.type}

  return rv
}
// ver1.2 added same
export type ZoneType = 'open' | 'close' | 'same'

export interface SharedContentDataToSend extends SharedContentInfoData {
  zorder: number                  //  unix timestamp when shared or moved to top.
  url: string                     //  url or text to share
  size: [number, number]          //  current size of the content
  originalSize: [number, number]  //  original size of the content or [0, 0]
  pinned: boolean                //  pinned (not resizable or resizable)
  noFrame?: boolean               //  no (invisible) frame
  opacity?: number                //  opacity
  zone?: ZoneType                 //  is this a audio zone is the zone closed or open?
}

export interface SharedContentData extends SharedContentDataToSend {
  playback?: boolean                  //  is playback or normal content
  zIndex?: number                     //  zIndex for display
  overlapZones: ISharedContent[]      //  other zones overlap this
  surroundingZones: ISharedContent[]  //  surrounded zones
}

export interface ISharedContent extends MapObject, SharedContentData, SharedContentId {
}
export interface ISharedContentToSend extends MapObject, SharedContentDataToSend, SharedContentId {
}
export interface ISharedContentToSave extends MapObject, SharedContentDataToSend{
}

export function contentsToSend(them: ISharedContent[]) {
  for(const content of them){
    const c = content as any
    delete c.playback
    delete c.zIndex
    delete c.zones
  }
  return them as ISharedContentToSend[]
}
export function receiveToContents(them: ISharedContentToSend[]) {
  for(const content of them){
    const c = content as ISharedContent
    c.overlapZones = []
    c.surroundingZones = []
  }
  return them as ISharedContent[]
}
export function contentsToSave(them: ISharedContent[]) {
  for(const content of them){
    const c = content as any
    delete c.playback
    delete c.zIndex
    delete c.zones
    delete c.id
  }
  return them as ISharedContentToSave[]
}
let loadToContentConut = 1
export function loadToContents(them: ISharedContentToSend[]) {
  for(const c of them){
    if (!c.id){
      c.id = "LD" + loadToContentConut
      loadToContentConut ++
    }
  }
  return receiveToContents(them)
}

export const TIME_RESOLUTION_IN_MS = 100
export const TEN_YEAR = 1000 * 60 * 60 * 24 * 365 * 10 / TIME_RESOLUTION_IN_MS

//  Does content use keyinput during editing or not.
export function doseContentEditingUseKeyinput(c: ISharedContent){
  return c.type === 'text' || c.type === 'pdf'
}
//  can this type of content be a wall paper or not
export function canContentBeAWallpaper(c?: ISharedContent){
  return c && (c.type !== 'camera' && c.type !== 'screen')
}
//  editable or not
export function isContentEditable(c?: ISharedContent) {
  return c && (c.type === 'text' || c.type === 'iframe' || c.type === 'pdf' ||
    c.type === 'whiteboard' || c.type === 'gdrive' || c.type === 'youtube')
}
//  maximizable or not
export function isContentMaximizable(c?: ISharedContent) {
  return c && (c.type === 'iframe' || c.type === 'pdf' || c.type === 'whiteboard' ||
    c.type === 'gdrive' || c.type === 'youtube' || c.type === 'screen' || c.type === 'camera'
    ||  (c.type === 'img' && c.size[0] > MAXIMIZABLE_IMAGE_MIN_WIDTH)
    ||  (c.type === 'text' && c.size[0] > MAXIMIZABLE_IMAGE_MIN_WIDTH)
  )

}
export function isContentRequireLogin(c?: ISharedContent) {
  return c && (c.type === 'gdrive')
}
//  wallpaper or not
export function isContentWallpaper(c?: ISharedContent) {
  return c && c.zorder <= TEN_YEAR
}
export const CONTENT_OUT_OF_RANGE_VALUE = 1024*1024
export function isContentOutOfRange(c?: ISharedContent) {
  return !c || c.pose.position[0] === CONTENT_OUT_OF_RANGE_VALUE
}

export function isContentRtc(c?: SharedContentInfoData){
  return c && (c.type === 'camera' || c.type === 'screen')
}

export interface WallpaperStore {
  room: string
  contents: SharedContentData[]
}

export interface TextMessage {
  message: string, //  text to display
  name: string, //  The name of whom create this text
  color?:number[]        //  background color
  textColor?:number[]    //  textColor
  pid: string,  //  The pid of whom create this text
  time: number, //  Timestamp when this message created.
}
export interface TextMessages {
  messages: TextMessage[]
  scroll: [number, number]
}

export function compTextMessage(t1: TextMessage, t2: TextMessage) {
  return t1.time - t2.time
}
