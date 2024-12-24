import { MsgEnum, OnlineEnum } from '../enums'
import { ContactItem, MessageType } from '../services/types'

export const convertMessage = (msg: any): MessageType => {
  return {
    sendTime: msg.servertTime,
    fromUser: {
      avatar: msg.icon,
      locPlace: '',
      uid: msg.senderId,
      username: msg.nickname
    },
    message: {
      body: {
        content: msg.text
      },
      id: msg.msgId,
      roomId: msg.chatId,
      sendTime: msg.servertTime,
      status: msg.status,
      type: MsgEnum.TEXT,
      messageMark: {
        dislikeCount: 0,
        likeCount: 0,
        userDislike: 0,
        userLike: 0
      }
    }
  }
}

export const convertContact = (contact: any): ContactItem => {
  return {
    activeStatus: OnlineEnum.ONLINE,
    lastOptTime: 0,
    uid: contact.userId
  }
}
