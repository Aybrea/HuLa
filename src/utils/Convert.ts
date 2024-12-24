import { MessageStatusEnum, MsgEnum } from '../enums'
import { MessageType } from '../services/types'

export const convertMessage = (msg: any): MessageType => {
  console.log('🚀 ~ file: Convert.ts:5 ~ msg:', msg)
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
